define(function(require, exports, module) {
    "use strict";
    
    main.consumes = ["Plugin", "auth", "http", "api", "error_handler", "metrics"];
    main.provides = ["vfs.endpoint"];
    
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var auth = imports.auth;
        var http = imports.http;
        var api = imports.api;
        var errorHandler = imports.error_handler;
        var metrics = imports.metrics;
        
        var PARALLEL_SEARCHES = 2;
        
        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        var urlServers, lastVfs;
        var query = require("url").parse(document.location.href, true).query;
        if (query.vfs) {
            if (!query.vfs.match(/^https:\/\/.*\/vfs$/))
                alert("Bad VFS URL passed, expected: https://host/vfs");
            urlServers = [{
                url: query.vfs,
                region: "url"
            }];
        }
        if (query.vfs || query.region) {
            var vfs = recallVfs();
            if (vfs) {
                if (query.vfs && query.vfs !== vfs.url)
                    deleteOldVfs();
                else if (query.region && query.region !== vfs.region)
                    deleteOldVfs();
            }
        }
        if (query.vfs)
            options.updateServers = false;
            
        var strictRegion = query.region || options.strictRegion;
        var ignoreProtocolVersion = options.ignoreProtocolVersion;
        var region = strictRegion || options.region;

        var servers;
        var pendingServerReqs = [];
        
        initDefaultServers();
        
        options.pid = options.pid || 1;
        
        /***** Methods *****/
        
        function initDefaultServers(baseURI) {
            if (options.getServers)
                return options.getServers(init);
            init();

            function init() {
                options.getServers = undefined;
                var loc = require("url").parse(baseURI || document.baseURI || window.location.href);
                var defaultServers = [{
                    url: loc.protocol + "//" + loc.hostname + (loc.port ? ":" + loc.port : "") + "/vfs",
                    region: "default"
                }];
                servers = (urlServers || options.servers || defaultServers).map(function(server) {
                    server.url = server.url.replace(/\/*$/, "");
                    return server;
                });
                pendingServerReqs.forEach(function(cb) {
                    cb(null, servers);
                });
            }
        }

        function getServers(callback) {
            if (typeof options.getServers == "function")
                return pendingServerReqs.push(callback);
            
            if (!options.updateServers)
                return callback(null, servers);
                
            // first time take the ones from the options
            var _servers = servers;
            if (_servers && _servers.length) {
                servers = null;
                return callback(null, _servers);
            }
                
            api.vfs.get("servers", function(err, servers) {
                if (err) return callback(err);
                
                return callback(null, servers.servers); 
            });
        }

        function getVfsEndpoint(version, callback) {
            getServers(function(err, _servers) {
                if (err) {
                    if (err.code !== "EDISCONNECT")
                        errorHandler.reportError(new Error("Could not get list of VFS servers"), { cause: err });
                    metrics.increment("vfs.failed.connect_getservers", 1, true);
                    initDefaultServers();
                    _servers = servers;
                }
                
                getVfsUrl(version, _servers, function(err, vfsid, url, region) {
                    if (err) return callback(err);
    
                    callback(null, {
                        url: url,
                        region: region,
                        home: vfsid + "/home",
                        project: vfsid + "/workspace",
                        socket: vfsid + "/socket",
                        ping: vfsid,
                        serviceUrl: vfsid,
                    });
                });
            });
        }

        function isOnline(callback) {
            http.request("/_ping", {
                timeout: 3000,
                headers: {
                    Accept: "application/json"
                }
            }, function(err, data, res) {
                callback(err, !err);
            });
        }

        function isServerAlive(url, callback) {
            auth.request(url, {
                headers: {
                    Accept: "application/json"
                }
            }, function(err, data, res) {
                if (err)
                    deleteOldVfs();

                callback(err, !err);
            });
        }

        function getVfsUrl(version, vfsServers, callback) {
            var vfs = recallVfs();

            if (vfs && vfs.vfsid) {
                auth.request(vfs.vfsid, {
                    method: "GET",
                    headers: {
                        Accept: "application/json"
                    }
                }, function(err, res) {
                    if (err) {
                        deleteOldVfs();
                        return getVfsUrl(version, vfsServers, callback);
                    }
                    callback(null, vfs.vfsid, vfs.url, vfs.region);
                });
                return;
            }
            
            servers = shuffleServers(version, vfsServers);
            
            // check for version
            if (vfsServers.length && !servers.length) {
                if (strictRegion)
                    return callback(fatalError("No VFS server(s) found for region " + strictRegion, "reload"));
                return onProtocolChange(callback);
            }
                
            var latestServer = 0;
            var foundServer = false;
            
            /* Create a callback that is only ever called once */
            var mainCallback = callback;
            callback = function() {
                if (!foundServer) {
                    foundServer = true;
                    var args = Array.prototype.slice.call(arguments);
                    return mainCallback.apply(this, args);
                }
            };
            
            // just take the first server that doesn't return an error
            function tryNext(i) {
                if (foundServer) return false; 
                if (i >= servers.length) {
                    metrics.increment("vfs.failed.connect_all", 1, true);
                    return callback(new Error("Disconnected: Could not reach your workspace. Please try again later."));
                }

                var server = servers[i];
                auth.request(server.url + "/" + options.pid, {
                    method: "POST",
                    timeout: 120000,
                    body: {
                        version: version
                    },
                    headers: {
                        Accept: "application/json"
                    }
                }, function(err, res) {
                    // the workspace is not configured correctly
                    if (err && res && res.error) {
                        if (err.code == 429) {
                            // rate limited
                            setTimeout(function() {
                                tryNext(i);
                            }, res.error.retryIn || 10000);
                            return;
                        }
                        else if (err.code == 412 && res.error && res.error.subtype == "protocol_mismatch") {
                            return onProtocolChange(callback);
                        }
                        else if (err.code == 412) {
                            callback(fatalError(res.error.message, "dashboard"));
                            return;
                        }
                        else if (err.code == 404) {
                            callback(fatalError("This workspace no longer appears to exist or failed to be created.", "dashboard"));
                            return;
                        }
                        else if (err.code === 428 && res.error) {
                            emit("restore", {
                                projectState: res.error.projectState,
                                premium: res.error.premium,
                                progress: res.error.progress || {
                                    progress: 0,
                                    nextProgress: 0,
                                    message: ""
                                }
                            });
                            setTimeout(function() {
                                tryNext(i);
                            }, res.error.retryIn || 10000);
                            return;
                        }
                        else if (err.code == 403) {
                            if (res.error.blocked)
                                callback(fatalError(res.error.message, "dashboard"));
                                
                            // forbidden. User doesn't have access
                            // wait a while before trying again
                            setTimeout(function() {
                                tryNext(i);
                            }, 10000);
                            return;
                        }
                        else if (err.code == 503) {
                            // service unavailable
                            setTimeout(function() {
                                tryNext(i);
                            }, res.error.retryIn || 15000);
                            return;
                        }
                        else if (err.code === 500 && res && res.error && res.error.cause) {
                            return callback(res.error.cause.message);
                        }
                    }

                    if (err) {
                        setTimeout(function() {
                            tryNext(++latestServer);
                        }, 2000);
                        return;
                    }

                    if (!foundServer) {
                        var vfs = rememberVfs(server, res.vfsid);
                        callback(null, vfs.vfsid, server.url, server.region);
                    }
                });
            }
            
            
            function startParallelSearches (totalRunners) {
                var attemptedServers = {}; 
                for (var s = 0; s < servers.length && s < totalRunners; s++)  {
                    latestServer = s; 
                    var server = servers[s];
                    var serverHostUrl = getHostFromServerUrl(server.url);
                    if (!attemptedServers[serverHostUrl]) {
                        attemptedServers[serverHostUrl] = true;
                        tryNext(s);
                    }
                }
            }
            
            startParallelSearches(PARALLEL_SEARCHES);
        }
        
        function getHostFromServerUrl(serverUrl) {
            // server.url looks like: https://vfs-gce-ae-09-2.c9.io or https://vfs.c9.dev/vfs we're grabbing the base url of the host (without the -2)
            var serverHostUrl = serverUrl.replace(/^(https:..[^.]+-\d+)(-\d+)(.*)/, "$1$3");  
            if (serverHostUrl) {
                return serverHostUrl;
            }
            return serverUrl;
        }

        function onProtocolChange(callback) {
            // I'm keeping this vague because we don't want users to blame
            // a "cloud9 update" for losing work
            deleteOldVfs();
            metrics.increment("vfs.failed.protocol_mismatch", 1, true);
            return callback(fatalError("Protocol change detected", "reload"));
        }

        function shuffleServers(version, servers) {
            // If a strict region is specified, only use that region
            servers = servers.slice();
            if (strictRegion) {
                servers = servers.filter(function(s) {
                    return s.region === strictRegion;
                });
            }
            // Never use staging servers if we're not on staging,
            // even though they appear in the production VFS registry
            var isBetaClient = region === "beta";
            servers = servers.filter(function(s) {
                var isBetaServer = s.region === "beta";
                return isBetaServer === isBetaClient;
            });
            servers = servers.filter(function(s) {
                return ignoreProtocolVersion || s.version == undefined || s.version == version;
            });
            return servers.sort(function(a, b) {
                if (a.region == b.region) {
                    if (a.packageVersion == b.packageVersion) {
                        if (a.load < b.load) {
                            return -1;
                        } 
                        else {
                            return 1;
                        }
                    }
                    else if (a.packageVersion > b.packageVersion) {
                        return -1;
                    }
                    else {
                        return 1;
                    }
                }
                else if (a.region == region) {
                    return -1;
                }
                else if (b.region == region) {
                    return 1;
                }
                else {
                    return 0;
                }
            });
        }

        function rememberVfs(server, vfsid) {
            var vfs = {
                url: server.url,
                region: server.region,
                pid: options.pid,
                vfsid: server.url + "/" + options.pid + "/" + vfsid,
                readonly: options.readonly
            };

            var data = JSON.stringify(vfs);
            
            var oldData = lastVfs || window.sessionStorage.getItem("vfsid");
            if (oldData && oldData !== data)
                deleteOldVfs();
            
            lastVfs = data;
            
            return vfs;
        }

        function recallVfs() {
            var vfs;
            try {
                vfs = JSON.parse(lastVfs || window.sessionStorage.getItem("vfsid") || null);
                if (!lastVfs && vfs) {
                    window.sessionStorage.removeItem("vfsid");
                    lastVfs = JSON.stringify(vfs);
                }
            } catch (e) {}

            if (!vfs)
                return null;

            if (vfs.pid !== options.pid || vfs.readonly != options.readonly) {
                deleteOldVfs();
                return null;
            }

            return vfs;
        }

        function deleteOldVfs() {
            var vfs;
            try {
                vfs = JSON.parse(lastVfs || window.sessionStorage.getItem("vfsid"));
            } catch (e) {}

            window.sessionStorage.removeItem("vfsid");
            lastVfs = null;
            if (!vfs) return;

            auth.request(vfs.vfsid, {
                method: "DELETE",
                headers: {
                    Accept: "application/json"
                }
            }, function(err) {
                if (err) console.error(vfs.vfsid, "deleted", err);
                });
        }
        
        function fatalError(msg, action) {
            var err = new Error(msg);
            err.fatal = true;
            err.action = action || "reload";
            return err;
        }
        
        function saveToSessionStorage() {
            try {
                window.sessionStorage.setItem("vfsid", lastVfs);
            } catch(e) {
                // could throw a quota exception
            }
        }
        
        plugin.on("load", function() {
            window.addEventListener("unload", saveToSessionStorage);
        });
        
        plugin.on("unload", function() {
            window.removeEventListener("unload", saveToSessionStorage);
        });

        /***** Register and define API *****/

        /**
         **/
        plugin.freezePublicAPI({
            /**
             * Returns the URLs for the home and project REST API and the socket
             */
            get: getVfsEndpoint,

            /**
             * Checks if the client has a network connection
             */
            isOnline: isOnline,
            
            /**
             * 
             */
            clearCache: deleteOldVfs,
            
            /**
             * Checks if the current VFS server is still alive
             */
            isServerAlive: isServerAlive
        });

        register(null, {
            "vfs.endpoint": plugin
        });
    }
});