define(function(require, exports, module) {
    main.consumes = ["Plugin", "c9"];
    main.provides = ["automate"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var c9 = imports.c9;
        
        var async = require("async");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var namespaces = {};
        
        /***** Methods *****/
        
        function addCommand(ns, name, implementation) {
            if (!namespaces[ns]) namespaces[ns] = { commands: {}, alias: {}};
            
            namespaces[ns].commands[name] = implementation;
        }
        
        function removeCommand(ns, name) {
            if (!namespaces[ns]) namespaces[ns] = { commands: {}, alias: {}};
            
            delete namespaces[ns].commands[name];
        }
        
        function addCommandAlias(ns, name) {
            if (!namespaces[ns]) namespaces[ns] = { commands: {}, alias: {}};
            
            for (var i = 1; i < arguments.length; i++) {
                namespaces[ns].alias[arguments[i]] = name;
            }
        }
        
        function getCommand(ns, name) {
            if (!namespaces[ns]) throw new Error("Unknown namespace: " + ns);
            
            var cmd = namespaces[ns].commands;
            return cmd[name] || cmd[namespaces[ns].alias[name]];
        }
        
        function createSession(ns) {
            var session = new Plugin("Ajax.org", main.consumes);
            var emit = session.getEmitter();
            
            var tasks = [];
            var output = "";
            var lastProcess;
            var lastTask;
            var executing = false;
            var aborting = false;
            
            function task(task, options, validate) {
                if (executing) throw new Error("Adding tasks while executing");
                
                if (typeof options == "function" || options === undefined) {
                    if (!validate) validate = options;
                    options = {};
                }
                
                Object.defineProperty(task, "$options", {
                   enumerable: false,
                   configurable: false,
                   writable: false,
                   value: options
                });
                
                tasks.push(task);
            }
            
            function execute(tasks, callback, options) {
                if (tasks.$options)
                    options = tasks.$options;
                
                // Loop over all tasks or sub-tasks when called recursively
                async.eachSeries(tasks, function(task, next) {
                    options = task.$options || options || {};
                    
                    if (options.ignore) 
                        return next();
                    
                    // The task consists of multiple tasks
                    if (Array.isArray(task))
                        return execute(task, next, options);
                    
                    // Loop over all competing tasks
                    async.eachSeries(Object.keys(task), function(type, next) {
                        var s = type.split(":");
                        if (s.length > 1)
                            s = { ns: s[0], type: s[1] };
                        
                        if (type == "install") {
                            return execute(task[type], function(err) {
                                next(err || 1);
                            }, options);
                        }
                        
                        var command = getCommand(s.ns || ns, s.type || type);
                        command.isAvailable(function(available) {
                            if (!available) return next();
                            
                            var items = Array.isArray(task[type]) 
                                ? task[type] : [task[type]];
                            
                            // Loop over each of the tasks for this command
                            async.eachSeries(items, function(item, next) {
                                if (aborting)
                                    return next(new Error("Aborted"));
                                
                                emit("each", {
                                    session: session,
                                    task: task, 
                                    options: options, 
                                    type: type, 
                                    item: item
                                });
                                
                                lastTask = task;
                                
                                var onData = function(chunk, process) {
                                    if (aborting) return process && process.end();
                                    
                                    output += chunk;
                                    lastProcess = process;
                                    emit("data", { data: chunk, process: process });
                                };
                                
                                var onFinish = function(err) {
                                    if (err && err.code == "EDISCONNECT") {
                                        c9.once("connect", function() {
                                            command.execute(item, options, onData, onFinish);
                                        });
                                        return;
                                    }
                                    
                                    next(err);
                                };
                                
                                command.execute(item, options, onData, onFinish);
                            }, function(err) {
                                next(err || 1);
                            });
                        });
                    }, function(err) {
                        // Success
                        if (err === 1) return next();
                        
                        // Failure
                        if (err) return next(err);
                        
                        // No command avialable
                        err = new Error("None of the available commands are available: " 
                            + JSON.stringify(task, 4, "   "));
                        err.code = "ENOTAVAILABLE";
                        return next(err);
                    });
                    
                }, function(err) {
                    callback(err);
                });
            }
            
            function run(callback) {
                if (executing) return;
                
                emit("run");
                
                aborting = false;
                executing = true;
                execute(tasks, function(err) {
                    executing = false;
                    lastProcess = null;
                    
                    callback && callback.apply(this, arguments);
                    session.unload();
                    
                    emit("stop", err);
                });
            }
            
            function abort(callback) {
                aborting = true;
                
                if (!executing) {
                    lastProcess = null;
                    emit("stop", new Error("Aborted"));
                }
                
                callback && callback();
            }
            
            // Make session a baseclass to allow others to extend
            session.baseclass();
            
            /**
             * 
             **/
            session.freezePublicAPI({
                /**
                 * 
                 */
                get tasks() { return tasks; },
                
                /**
                 * 
                 */
                get executing() { return executing; },
                
                /**
                 * 
                 */
                get output() { return output; },
                
                /**
                 * 
                 */
                get process() { return lastProcess || null; },
                
                /**
                 * 
                 */
                get lastTask() { return lastTask || null; },
                
                /**
                 * 
                 */
                task: task,
                
                /**
                 * 
                 */
                run: run,
                
                /**
                 * 
                 */
                abort: abort
            });
            
            return session;
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            
        });
        plugin.on("unload", function() {
            
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            createSession: createSession,
            
            /**
             * 
             */
            addCommand: addCommand,
            
            /**
             * 
             */
            removeCommand: removeCommand,
            
            /**
             * 
             */
            addCommandAlias: addCommandAlias
        });
        
        register(null, {
            automate: plugin
        });
    }
});