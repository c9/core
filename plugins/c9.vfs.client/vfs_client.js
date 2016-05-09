define(function(require, exports, module) {
    "use strict";
    
    main.consumes = [
        "Plugin", "auth", "vfs.endpoint", "dialog.error",
        "dialog.alert", "error_handler", "metrics"
    ];
    main.provides = ["vfs"];
    return main;

    /**
     * login flow
     * 
     * init:
     *  - receive list of VFS servers
     *  - choose one of the servers (based on some metric)
     *  - create VFS connection to that VFS server and remember the ID in sessionStorage
     * 
     * offline:
     *  - ping a stable URL to detect if it is a network error
     *  - if it is a network error try to reconnect to the same VFS server with the same ID
     *  - if it is not a network error pick another server
     */

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var auth = imports.auth;
        var vfsEndpoint = imports["vfs.endpoint"];
        var errorDialog = imports["dialog.error"];
        var showError = errorDialog.show;
        var hideError = errorDialog.hide;
        var showAlert = imports["dialog.alert"].show;
        var errorHandler = imports.error_handler;
        var metrics = imports.metrics;
        
        var eio = require("engine.io");
        var Consumer = require("vfs-socket/consumer").Consumer;
        var connectClient = require("kaefer");
        var protocolVersion = require("kaefer/version").protocol;
        var smith = require("smith");
        var URL = require("url");
        var DEBUG = options.debug 
            && (typeof location == "undefined" 
            || location.href.indexOf("debug=3") > -1);

        // The connected vfs unique id
        var id;

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        // Give reference to vfs to plugins
        errorDialog.vfs = plugin;
        
        var buffer = [];
        var dashboardUrl = options.dashboardUrl;
        var region, vfsBaseUrl, homeUrl, projectUrl, pingUrl, serviceUrl;
        var eioOptions, connection, consumer, vfs;
        var showErrorTimer, showErrorTimerMessage;
        var lastError;
        
        function emptyBuffer(){
            var b = buffer;
            buffer = [];
            b.forEach(function(item) {
                if (!item) return;
                
                var xhr = rest.apply(null, item);
                if (item.length > 3)
                    item[3].abort = xhr.abort.bind(xhr);
            });
        }
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            smith.debug = DEBUG;
            
            connection = connectClient(connectEngine, {
                preConnectCheck: preConnectCheck,
                debug: DEBUG
            });
            
            connection.on("away", emit.bind(null, "away"));
            connection.on("back", function(e) {
                emit("back");
                emptyBuffer();
            });
            
            connection.on("disconnect", onDisconnect);
            connection.on("connect", onConnect);

            reconnectNow();
            
            function connectEngine() {
                if (auth.accessToken) {
                    eioOptions.query = {
                        access_token: auth.accessToken
                    };
                }
                return eio(eioOptions);
            }
    
            function preConnectCheck(callback) {

                vfsEndpoint.isOnline(function(err, isOnline) {
                    if (err || !isOnline) return callback(null, false);
                    
                    if (!eioOptions) return disconnect();
                    if (!pingUrl) return disconnect();
                    
                    vfsEndpoint.isServerAlive(pingUrl, function(err, isAlive) {
                        if (!err && isAlive) return callback(null, true);

                        disconnect();
                    });
                });
                
                function disconnect() {
                    pingUrl = null;
                    reconnect(function(err) {
                        if (err && err.fatal)
                            return;
                        callback(err, !err);
                    });
                }
            }
        }
        
        /***** Methods *****/
        
        function join(a, b) {
            return (a || "").replace(/\/?$/, "/") + (b || "").replace(/^\//, "");
        }
        
        function vfsUrl(path) {
            // resolve home and project url
            return path.charAt(0) == "~"
                ? join(homeUrl, escape(path.slice(1)))
                : join(projectUrl, escape(path));
        }
        
        function rest(path, options, callback) {
            if (!vfs || !connection || connection.readyState != "open") {
                // console.error("[vfs-client] Cannot perform rest action for ", path, " vfs is disconnected");
                var stub = { abort: function(){ buffer[this.id]= null; } };
                stub.id = buffer.push([path, options, callback, stub]) - 1;
                return stub;
            }
            
            // resolve home and project url
            var url = vfsUrl(path);

            options.overrideMimeType = options.contentType || "text/plain";
            options.contentType = options.contentType || "text/plain";

            return auth.request(url, options, function(err, data, res) {
                var reErrorCode = /(ENOENT|EISDIR|ENOTDIR|EEXIST|EACCES|ENOTCONNECTED)/;
                
                if (err) {
                    var isConnected = !connection || connection.readyState == "open";
                    if (err.code === 499 || (err.code === 0) && !isConnected) {
                        if (isConnected)
                            buffer.push([path, options, callback]);
                        else
                            rest(path, options, callback);
                        return;
                    }
                    
                    if (!res) return callback(err);
                    
                    var message = (res.body || "").replace(/^Error:\s+/, "");
                    var code = res.status === 0
                        ? "ENOTCONNECTED"
                        : message.match(reErrorCode) && RegExp.$1;
                    
                    err = new Error(res.body);
                    err.code = code || undefined;
                    err.status = res.status;
                    return callback(err);
                }
                callback(null, data, res);
            });
        }
        
        function download(path, filename, isfile) {
            var extraPaths = "";
            if (Array.isArray(path)) {
                extraPaths = path;
                path = path[0];
                extraPaths = "," + extraPaths.map(function(p) {
                    return p[0] == path[0] && p != path ? escape(p) : "";
                }).filter(Boolean).join(",");
            }
            window.open(vfsUrl(path) + extraPaths
                + "?download" 
                + (filename ? "=" + escape(filename) : "")
                + (isfile ? "&isfile=1" : ""));
        }

        function reconnectNow() {
            reconnect(function(_err) {
                connection.connect();
            });
        }
        
        function reconnect(callback) {
            if (!connection) return;
            connection.socket.setSocket(null);
            
            vfsEndpoint.get(protocolVersion, function(err, urls) {
                if (err) {
                    metrics.increment("vfs.failed.connect", 1, true);
                    if (!showErrorTimer) {
                        showErrorTimer = setTimeout(function() {
                            showVfsError(showErrorTimerMessage);
                        }, err.fatal ? 0 : 20000);
                    }
                    showErrorTimerMessage = err;
                    return callback(err);
                }
                
                if (lastError)
                    hideError(lastError);

                region = urls.region;
                vfsBaseUrl = urls.url;
                homeUrl = urls.home;
                projectUrl = urls.project;
                pingUrl = urls.ping;
                serviceUrl = urls.serviceUrl;
                id = pingUrl.split("/").pop();

                var parsedSocket = URL.parse(urls.socket);
                eioOptions = {
                    path: parsedSocket.path,
                    host: parsedSocket.host,
                    port: parsedSocket.port 
                        || parsedSocket.protocol == "https:" ? "443" : null,
                    secure: parsedSocket.protocol 
                        ? parsedSocket.protocol == "https:" : true
                };
                callback();
            });
        }
        
        function showVfsError(err) {
            switch (err.action) {
                case "dashboard":
                    if (/Permission denied \(public key/.test(err.message))
                        err.message = "SSH permission denied. Please review your workspace configuration.";
                    return showAlert("Workspace Error", "Unable to access your workspace", err.message, function() {
                        window.location = dashboardUrl;
                    }, { yes: "Return to dashboard" });
                case "reload":
                    lastError = showError(err.message + ". Please reload this window.", -1);
                    setTimeout(function() {
                        window.location.reload();
                    }, (Math.random() * 8) + 2 * 60 * 1000);
                    break;
                default:
                    lastError = showError(err, -1);
            }
            if (err.fatal)
                console.error("Fatal connection error:", err);
        }

        function onDisconnect() {
            vfs = null;
            emit("disconnect");
        }
        
        function onConnect() {
            var transport = new smith.EngineIoTransport(connection); 
            
            if (consumer)
                consumer.disconnect();
                
            clearTimeout(showErrorTimer);
            showErrorTimer = null;
            
            consumer = new Consumer();
            consumer.connectionTimeout = 5000;
            consumer.connect(transport, function(err, _vfs) {
                // TODO
                if (err) {
                    errorHandler.reportError(new Error("Error connecting to VFS", { err: err }));
                    console.error("error connecting to VFS", err);
                    return;
                }
                
                if (emit("beforeConnect", { done: callback, vfs: _vfs }) !== false)
                    callback();
                
                function callback(shouldReconnect) {
                    if (shouldReconnect) {
                        vfsEndpoint.clearCache();
                        reconnectNow();
                        return;
                    }
                    
                    vfs = _vfs;
                    
                    bufferedVfsCalls.forEach(vfsCall);
                    bufferedVfsCalls = [];
                    emit("connect");
                    
                    emptyBuffer();
                }
            });
            
            consumer.on("error", function(err) {
                connection.disconnect();
            });
        }
        
        var bufferedVfsCalls = [];
        function vfsCall(method, path, options, callback) {
            if (Array.isArray(method))
                return vfsCall.apply(null, method);
                
            if (vfs)
                return vfs[method](path, options, callback);
            else
                bufferedVfsCalls.push([method, path, options, callback]);
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("unload", function(){
            loaded = false;
            
            if (consumer)
                consumer.disconnect();
            if (connection)
                connection.disconnect();
            
            id = null;
            buffer = [];
            region = null;
            vfsBaseUrl = null;
            homeUrl = null;
            projectUrl = null;
            pingUrl = null;
            serviceUrl = null;
            eioOptions = null;
            consumer = null;
            connection = null;
            vfs = null;
            showErrorTimer = null;
            showErrorTimerMessage = null;
            lastError = null;
        });
        
        /***** Register and define API *****/
        
        /**
         * @event connect Fires ...
         * @event disconnect Fires ...
         * @event message Fires ...
         * @event away Fires ...
         * @event back Fires ...
         * @event error Fires ...
         */
        plugin.freezePublicAPI({
            
            get connection(){ return connection; },
            get connecting(){ return connection ? connection.readyState == "reconnecting" : true; },
            get connected(){ return vfs ? connection.readyState == "open" : false; },
            
            get previewUrl(){ throw new Error("gone") },
            get serviceUrl(){ return serviceUrl; },
            get id() { return id; },
            get baseUrl() { return vfsBaseUrl; },
            get region() { return region; },
            
            /**
             * Performs a VFS REST API call
             * @param path      {String} Path of the resource. Can be prefixed 
             *                           with '~' to resolve the path relative 
             *                           to the user's home dir
             * @param options   {Object} Same format as 'http.request'
             * @param callback(err, data) {Function}
             */
            rest: rest,
            download: download,
            url: vfsUrl,
            reconnect: reconnectNow,

            // File management
            resolve: vfsCall.bind(null, "resolve"),
            stat: vfsCall.bind(null, "stat"),
            readfile: vfsCall.bind(null, "readfile"),
            readdir: vfsCall.bind(null, "readdir"),
            mkfile: vfsCall.bind(null, "mkfile"),
            mkdir: vfsCall.bind(null, "mkdir"),
            mkdirP: vfsCall.bind(null, "mkdirP"),
            appendfile: vfsCall.bind(null, "appendfile"),
            rmfile: vfsCall.bind(null, "rmfile"),
            rmdir: vfsCall.bind(null, "rmdir"),
            rename: vfsCall.bind(null, "rename"),
            copy: vfsCall.bind(null, "copy"),
            chmod: vfsCall.bind(null, "chmod"),
            symlink: vfsCall.bind(null, "symlink"),

            // Retrieve Metadata
            metadata: vfsCall.bind(null, "metadata"),

            // Wrapper around fs.watch or fs.watchFile
            watch: vfsCall.bind(null, "watch"),

            // Network connection
            connect: vfsCall.bind(null, "connect"),

            // Process Management
            spawn: vfsCall.bind(null, "spawn"),
            pty: vfsCall.bind(null, "pty"),
            tmux: vfsCall.bind(null, "tmux"),
            execFile: vfsCall.bind(null, "execFile"),
            killtree: vfsCall.bind(null, "killtree"),

            // Extending the API
            use: vfsCall.bind(null, "use"),
            extend: vfsCall.bind(null, "extend"),
            unextend: vfsCall.bind(null, "unextend")
        });
        
        register(null, {
            "vfs": plugin
        });
    }
});