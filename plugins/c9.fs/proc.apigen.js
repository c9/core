define(function(require, exports, module) {
    main.consumes = ["Plugin", "proc"];
    main.provides = ["proc.apigen"];
    return main;

    function main(options, imports, register) {
        var proc = imports.proc;
        var Plugin = imports.Plugin;
        
        function ApiGenerator(options) {
            var runtime = options.runtime;
            var basepath = options.basepath;
            var errorCheck = options.errorCheck;
            var env = options.env;

            /***** Initialization *****/
            
            var plugin = new Plugin("Ajax.org", main.consumes);
            // var emit = plugin.getEmitter();

            /***** Methods *****/

            function spawn(args, callback, cbExit, noAuthCheck) {
                proc.pty(runtime, {
                    args: args,
                    cwd: basepath,
                    env: env
                }, function(err, pty) {
                    if (err)
                        return callback(err);
                    
                    var control = {
                        kill: function() { pty.kill(); },
                        write: function(value) { pty.write(value); },
                        discard: function(keep) {
                            if (keep) pty.off("data", ondata);
                            pty.off("exit", onexit);
                        }
                    };

                    function ondata(data) {
                        var err = errorCheck(data, noAuthCheck, control);
                        if (err) {
                            control.discard();
                            return callback(err);
                        }
                        
                        callback(null, data, control);
                    }
                    function onexit(data) {
                        return cbExit ? cbExit() : callback("No data received");
                    }
                    
                    pty.on("data", ondata);
                    pty.on("exit", onexit);
                });
            }

            function parseArg(options, arg, found, data) {
                if (arg instanceof RegExp) {
                    var m = data.match(arg);
                    return m.length > 1 ? m[1] : m[0];
                }
                else if (typeof arg == "object") {
                    var obj = {};
                    for (var prop in arg)
                        obj[prop] = parseArg(options, arg[prop], found, data);
                    return obj;
                }
                else if (typeof arg == "string") {
                    return arg.replace(/\\\{|\{(.*?)\}/g, function(m, name) {
                        if (m == "\\{") return m;
                        // Replace $n in regexpses
                        if (name.charAt(0) == "$")
                            return found[name.substr(1)];
                        // Replace {name} in strings
                        return options[name];
                    });
                }
                return arg;
            }

            function createMethod(def) {
                return function(options, callback) {
                    var parse = parseArg.bind(this, options);
                    var args = typeof def.args == "function"
                        ? def.args(options)
                        : def.args.map(parse);

                    var buffer = "";
                    spawn(args, function(err, data, control) {
                        if (err)
                            return callback(err);

                        if (def.buffer) {
                            buffer += data;
                            return;
                        }

                        if (def.write) {
                            def.write.forEach(function(item) {
                                var found;
                                if (typeof item.match == "string")
                                    found = data.indexOf(item.match) > -1;
                                else
                                    found = data.match(item.match);

                                if (found)
                                    control.write(parse(item.text, found, data));
                            });
                        }
                        if (def.exit) {
                            var found;

                            for (var i = 0; i < def.exit.length; i++) {
                                var item = def.exit[i];

                                if (typeof item.match == "string")
                                    found = data.indexOf(item.match) > -1;
                                else
                                    found = data.match(item.match);

                                if (found) {
                                    if (item.error)
                                        callback(item.result
                                            ? parse(item.result, found, data)
                                            : data);
                                    else
                                        callback(null, parse(item.result, found, data));

                                    control.discard();
                                    if (item.error || item.kill)
                                        control.kill();
                                    break;
                                }
                            }
                        }
                        
                        if (def.stream) {
                            callback(null, data, control);
                            return;
                        }
                    }, function() {
                        if (def.buffer) {
                            try { 
                                callback(null, 
                                    def.parse ? def.parse(buffer) : buffer); 
                            }
                            catch (e) { 
                                console.error(e);
                                callback(e);
                            }
                        }
                        else {
                            callback(def.defaultSuccess ? null : "No proper data received");
                        }
                    }, def.noauth);
                };
            }
        
            /***** Register and define API *****/
            
            /**
             * Factory object for the {@link ApiGenerator}.
             * @class proc.apigen
             * @extends Object
             */
            /**
             * Create an instance of ApiGenerator.
             * @method create
             * @param {Object} options
             * @param {String} options.runtime                  The path to the CLI in the workspace
             * @param {String} options.basepath                 The basepath to the file in the workspace
             * @param {Object} [options.env]                    Key value pairs of strings that 
             *   specify the environment variables to set when executing the CLI.
             * @param {Function} options.errorCheck             This function is 
             *   called when data comes in from a command and should be used to 
             *   check for errors. This function should not return an object
             *   or string when an error has occured. When an auth error has
             *   occurred return an Error object with a property "code" set to 
             *   100.
             * @param {String} options.errorCheck.data          The output from the command.
             * @param {Boolean} options.errorCheck.noAuthCheck  Whether to ignore any auth check.
             * @return {ApiGenerator}
             */
            /**
             * Helps to create an API based on a CLI.
             * @class ApiGenerator
             **/
            plugin.freezePublicAPI({
                /**
                 * Start the CLI process and process it's output.
                 * @param {Array}    args              The arguments to send to the CLI
                 * @param {Function} callback          Called each time data is received from the process
                 * @param {String}   callback.data     The data received
                 * @param {Object}   callback.control  
                 * @param {Function} callback.control.kill     Kills the process
                 * @param {Function} callback.control.write    Write to the process
                 * @param {Function} callback.control.discard  Discard any further changes
                 * @param {Function} cbExit                    This callback is called when the process exits successfully.
                 * @param {Boolean}  [noAuthCheck=false]       Whether to perform a check for authentication
                 */
                spawn: spawn,
                
                /**
                 * 
                 */
                createMethod: createMethod
            });

            return plugin;
        }
        
        register(null, {
            "proc.apigen": { create: ApiGenerator }
        });
    }
});