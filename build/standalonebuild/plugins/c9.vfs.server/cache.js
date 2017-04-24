define(function(require, exports, module) {
    "use strict";
    
    main.consumes = [
        "Plugin",
        "vfs.connect",
        "metrics"
    ];
    main.provides = ["vfs.cache"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var connectVfs = imports["vfs.connect"].connect;
        var metrics = imports.metrics;

        var async = require("async");
        var uid = require("c9/uid");
        var error = require("http-error");
        var EventEmitter = require("events").EventEmitter;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        var cache = {};
        var maxAge = options.maxAge || 15 * 1000;
        
        var vfsExtensions = [];
        
        /***** Methods *****/
        
        function registerExtension(handler) {
            vfsExtensions.push(handler);
        }
        
        function create(pid, user, callback) {
            var vfsid;
            do {
                vfsid = uid(16);
            } while (has(vfsid));
            
            var entry = createEntry(pid, user, vfsid);
            cache[vfsid] = entry;
            
            return connectVfs(user, pid, function(err, vfs) {
                if (err) return done(err);
                
                vfs.id = vfsid;
                vfs.uid = user.id;
                vfs.pid = pid;
                entry.vfs = vfs;
                
                async.forEach(vfsExtensions, function(factory, next) {
                    factory(vfs, next);
                }, function(err) {
                    if (err) return done(err);
                    
                    entry.connectTime = Date.now() - entry.startTime;
                    metrics.timing("vfs.connect.time", entry.connectTime);
                    
                    entry.emit("loaded");
                    
                    cache[vfsid] = entry;
                    entry.keepalive();

                    vfs.on("destroy", function() {
                        remove(vfsid);
                    });
                    vfs.on("keepalive", function() {
                        entry.keepalive();
                        emit("keepalive", entry);
                    });
                    
                    done();
                });
            });
            
            function done(err) {
                if (err) {
                    entry.emit("fail", err);
                    remove(vfsid);
                    return callback(err);
                }
                callback(null, entry);
            }
        }
        
        function has(vfsid) {
            return !!cache[vfsid];
        }
        
        function get(vfsid) {
            var entry = cache[vfsid];
            if (entry)
                entry.keepalive();
            
            return entry || null;
        }
        
        function getAll() {
            return cache;
        }
        
        function remove(vfsid) {
            var entry = cache[vfsid];
            if (entry) {
                delete cache[vfsid];
                entry.destroy();
            }
        }
        
        function createEntry(pid, user, vfsid) {
            var entry = new EventEmitter();
            entry.setMaxListeners(100);
            
            entry.pid = pid;
            entry.user = user;
            entry.vfsid = vfsid;
            entry.startTime = Date.now();
            
            var expiresAt = 0;
            Object.defineProperty(entry, "ttl", {
                get: function() {
                    return expiresAt - Date.now();
                }
            });
            
            entry.destroy = function() {
                entry.vfs && entry.vfs.destroy();
            };
            
            entry.keepalive = function() {
                startTimer();
            };
            
            var timer;
            function startTimer() {
                clearTimeout(timer);
                expiresAt = Date.now() + maxAge;
                timer = setTimeout(function() {
                    remove(vfsid);
                }, maxAge);
            }
            
            return entry;
        }


        function readonlyRest(pid, user, path, scope, req, res, next) {
            for (var key in cache) {
                var entry = cache[key];
                var isPublic = entry.vfs && entry.vfs.public;
                if (entry.pid == pid && (entry.user.id == user.id || isPublic)) {
                    if (entry.vfs)
                        handle(entry.vfs);
                    else {
                        var called = false;
                        entry.on("loaded", function() {
                            if (called) return;
                            called = true;
                            handle(entry.vfs);
                        });
                        entry.on("fail", function(err) {
                            if (called) return;
                            called = true;
                            return next(err); 
                        });
                    }
                    return;
                }
            }
            
            create(pid, user, function(err, entry) {
                if (err) return next(err);
                
                handle(entry.vfs);
            });
            
            function handle(vfs) {
                if (req.method !== "GET" && req.method !== "HEAD")
                    return next(new error.Forbidden("Only GET and HEAD requests are allowed in read only mode"));
                    
                vfs.handleRest(scope, path, req, res, next);
            }
        }
        
        /***** Register and define API *****/
    
        /**
         * Keeps a Cache of VFS instances
         * 
         * @singleton
         */    
        plugin.freezePublicAPI({
            /**
             * Create a new VFS connection
             * 
             * @param {Number}      pid             Project ID of the workspace to connect to
             * @param {Object}      user            User trying to connect to the worksapce
             * @param {Function}    callback        Called after the VFs connection has been established
             * @param {Error}       callback.err    Error object if an error occured.
             * @param {Object}      callback.entry        Cached VFS entry
             * @param {Vfs}         callback.entry.vfs    VFS instance
             * @param {String}      callback.entry.vfsid  Unique ID of the cache entry
             */
            create: create,
            
            /**
             * Get an entry by it's unique ID
             * 
             * @param  {String}      vfsid  Unique ID of the cache entry
             * @return {Object}      callback.entry        Cached VFS entry
             * @return {Vfs}         callback.entry.vfs    VFS instance
             * @return {String}      callback.entry.vfsid  Unique ID of the cache entry
             */
            get: get,
            
            /**
             * Get all cached entries
             * 
             * @return {Object}     Object keys are the VFS IDs and the values are the cache entries
             */
            getAll: getAll,
            
            /**
             * Check if the cache has an entry with the given VFS ID
             * 
             * @param  {String}     vfsid   Unique ID of the cache entry
             * @return {Boolean}    Whether the cache has an entry with the given ID
             */
            has: has,
            
            /**
             * Remove an entry by vfs ID
             * 
             * @param  {String}     vfsid   Unique ID of the cache entry
             */
            remove: remove,
            
            readonlyRest: readonlyRest,
            
            /**
             * Register a callback which is called with each created VFS connection.
             * This can e.g. be used to extend the remote agent using 'vfs.extend'.
             * 
             * @param {Function}    factory Function to be called on new VFS connections
             * @param {Object}      vfs     The VFS Object
             * @param {Function}    callback Needs to be called after the factory is done
             */
            registerExtension: registerExtension
        });
        
        register(null, {
            "vfs.cache": plugin
        });
    }
});