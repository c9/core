define(function(require, exports, module) {
    main.consumes = ["Plugin", "c9", "debugger"];
    main.provides = ["debugger.xdebug"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var c9 = imports.c9;
        var debug = imports["debugger"];

        var Frame = debug.Frame;
        var Source = debug.Source;
        var Breakpoint = debug.Breakpoint;
        var Variable = debug.Variable;
        var Scope = debug.Scope;

        var url = require("url");
        var path = require("path");
        var DbgpClient = require("./lib/DbgpClient");
        var base64Decode = require("./lib/util").base64Decode;

        /***** Initialization *****/

        var TYPE = "xdebug";
        var PROXY = require("text!./netproxy.js");

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        // emit.setMaxListeners(1000);

        var SCOPE_TYPES = {
            "Locals": "Locals",
            "Superglobals": "Globals",
            "User defined constants": "Contants",
        };

        var socket, client, session;

        var attached = false;
        var state = null;
        var breakOnExceptions = false;
        var breakOnUncaughtExceptions = false;

        /***** Event Handlers *****/

        function load() {
            debug.registerDebugger(TYPE, plugin);
        }

        function unload() {
            detach();
            socket = client = session = state = null;
            attached = false;
            breakOnExceptions = false;
            breakOnUncaughtExceptions = false;
        
            debug.unregisterDebugger(TYPE, plugin);
        }

        function onBreak() {
            plugin.getFrames(function(err, frames) {
                emit("frameActivate", { frame: frames[0] });
                emit("break", { frame: frames[0], frames: frames });
                setState("stopped");
            });
        }

        function onStatus(status) {
            switch (status) {
                case "starting":
                case "stopping":
                case "stopped":
                    setState(null);
                    break;

                case "running":
                    setState("running");
                    break;

                case "break":
                    // handled by onBreak
                    break;

                default:
                    throw new TypeError("Unknown debugger status: " + status);
            }
        }

        /***** Helper Functions *****/

        function formatType(property) {
            if (property["@type"] === "uninitialized") {
                return null;
            }

            if (property["@type"] === "object" && property["@classname"] === "Closure") {
                return "callable";
            }

            return property["@type"];
        }

        function formatValue(property, value) {
            if (property["@encoding"] === "base64") {
                value = base64Decode(value);
            }

            switch (property["@type"]) {
                case "null":
                    return property["@type"];

                case "array":
                    return "array(" + property["@numchildren"] + ")";

                case "bool":
                    return (value ? "true" : "false");

                case "int":
                    return parseInt(value, 10) + "";

                case "float":
                    return parseFloat(value) + "";

                case "string":
                    return JSON.stringify(value);

                case "object":
                    if (property["@classname"] === "Closure") {
                        return "callable";
                    }

                    return property["@classname"];

                default:
                    return value;
            }
        }

        function createVariable(property) {
            var children = property["property"];

            if (children && !Array.isArray(children))
                children = [children];

            return new Variable({
                name: property["@name"],
                value: formatValue(property, property["$"]),
                type: formatType(property),
                ref: property["@fullname"],
                children: !!property["@children"],
                properties: children && children.map(function(child) {
                    return createVariable(child);
                })
            });
        }

        function findScope(variable) {
            if (variable.scope)
                return variable.scope;
            else if (variable.parent)
                return findScope(variable.parent);
            else
                throw new Error("Could not find scope in variable or parents");
        }

        function setState(state_) {
            if (state === state_)
                return;
                
            // console.info(state_);

            state = state_;
            emit("stateChange", { state: state });
        }

        function filesystemPath(workspacePath) {
            return path.join(c9.workspaceDir, path.relative("/", workspacePath));
        }

        function workspacePath(filesystemPath) {
            return path.resolve("/", path.relative(c9.workspaceDir, filesystemPath));
        }

        /***** Methods *****/

        function attach(socket_, reconnect, callback) {
            socket = socket_;

            client = new DbgpClient();

            client.on("session", function(session_) {
                session = session_;
                    
                session.setFeature("max_depth", 0);
                session.setFeature("max_data", 1024);
                session.setFeature("max_children", 150);
                
                session.on("status", onStatus);
                session.on("break", onBreak);

                setBreakpoints(emit("getBreakpoints"), function(breakpoints) {
                    if (!attached) {
                        attached = true;
                        emit("attach", { breakpoints: breakpoints });
                    }
                    
                    callback();
                    
                    session.run();
                });
            });

            client.on("error", function(err) {
                emit("error", err);
            }, plugin);
            
            client.once("listening", function() {
                emit("connect");
            }, plugin);

            client.listen(socket);
            
            socket.on("end", function() {
                setState("running");
            });
            
            socket.on("connect", function() {
                if (client && !client.listening)
                    client.listen(socket);
            });
        }

        function detach() {
            if (session) session.stop();
            if (client) client.close();
            if (socket) socket.close();

            emit("frameActivate", { frame: null });
            setState(null);

            socket = null;
            client = null;
            session = null;
            attached = false;

            emit("detach");
        }

        function getSources(callback) {
            callback && callback(new Error("Not implemented"));
        }

        function getSource(source, callback) {
            session.getSource(source.id, callback);
        }

        function getFrames(callback, silent) {
            session.getStackFrames(null, function(err, data) {
                if (err) return callback(err);

                var frames = data.map(function(frame) {
                    var scriptURI = frame["@filename"]
                        , parts = url.parse(scriptURI);

                    var scriptPath
                        , scriptName;

                    if (parts.protocol === "file:") {
                        // resolve absolute file path to workspace path
                        scriptPath = workspacePath(parts.pathname);
                        scriptName = path.basename(scriptPath);
                    } else {
                        // FIXME: causes metadata errors
                        scriptPath = scriptURI;
                        scriptName = scriptURI;

                        // TODO: push "fake" sources to avoid metadata error
                        //var sources = [
                            //new Source({
                                //id: scriptURI,
                                //name: parts.protocol + path.basename(parts.pathname),
                                ////path: parts.protocol + path.basename(parts.pathname),
                                //debug: true
                            //})
                        //];
                        //emit("sources", { sources: sources });
                    }

                    var level = frame["@level"];
                    var line = frame["@lineno"] - 1;

                    return new Frame({
                        index: level,
                        name: frame["@where"],
                        line: line,
                        column: 0, // TODO: cmdbegin = line:col
                        id: null,
                        script: scriptName,
                        path: scriptPath,
                        sourceId: scriptURI,
                        scopes: [
                            new Scope({ index: 0, type: "Locals", frameIndex: level }),
                            new Scope({ index: 1, type: "Superglobals", frameIndex: level }),

                            /* FIXME: Xdebug 2.3.0+ only */
                            // new Scope({ index: 2, type: "Contants", frameIndex: level })
                        ],
                        variables: [],
                        istop: (level === 0)
                    });
                });

                emit("getFrames", { frames: frames });
                callback(null, frames);
            });
        }

        function getScope(frame, scope, callback) {
            session.getContextProperties(frame.index, scope.index, function(err, data) {
                if (err) return callback(err);

                var variables = data.map(function(prop) {
                    var result = createVariable(prop);
                    result.scope = scope;
                    return result;
                });

                scope.variables = variables;

                callback(null, variables, scope, frame);
            });
        }

        function getProperties(variable, callback) {
            var scope = findScope(variable);

            session.getPropertyChildren(variable.ref, scope.frameIndex, scope.index, function(err, data) {
                if (err) return callback(err);

                var properties = data.map(function(prop) {
                    var result = createVariable(prop);
                    result.parent = variable;
                    return result;
                });

                variable.properties = properties;

                callback(null, properties, variable);
            });
        }

        function stepInto(callback) {
            session.stepInto(callback);
        }

        function stepOver(callback) {
            session.stepOver(callback);
        }

        function stepOut(callback) {
            session.stepOut(callback);
        }

        function resume(callback) {
            session.run(callback);
        }

        function suspend(callback) {
            callback && callback(new Error("FIXME: command 'break' is not supported by PHP Xdebug"));
        }

        function evaluate(expression, frame, global, disableBreak, callback) {
            expression = expression.trim();

            if (state !== "stopped")
                return callback(null, new Variable({ name: expression }));

            session.eval(expression, function(err, data) {
                if (err) return callback(err);

                var variable = createVariable(data);
                variable.name = expression;
                variable.ref = expression;
                variable.scope = frame.scopes[0];

                callback(null, variable);
            });
        }

        function setBreakpoint(bp, callback) {
            if (!bp.path) return; // this can happen for serverOnly breakpoints
            var path = filesystemPath(bp.path);

            var options = {
                line: (bp.line + 1),
                enabled: bp.enabled,
                condition: bp.condition,
                ignoreCount: bp.ignoreCount
            };

            session.setBreakpoint(path, options, function(err, breakpointId) {
                if (!err) bp.id = breakpointId;
                callback && callback(err, bp);
            });
        }

        function changeBreakpoint(bp, callback) {
            var options = {
                line: (bp.line + 1),
                enabled: bp.enabled,
                condition: bp.condition,
                ignoreCount: bp.ignoreCount,
            };

            session.updateBreakpoint(bp.id, options, function(err) {
                callback && callback(err, bp);
            });
        }

        function clearBreakpoint(bp, callback) {
            session.removeBreakpoint(bp.id, function(err) {
                callback && callback(err, bp);
            });
        }

        function listBreakpoints(callback) {
            // normally we'd send breakpoint_list, but since breakpoint state
            // is entirely dependent on UI, we'll manage it globally
            callback(null, emit("getBreakpoints"));
        }

        function setVariable(variable, value, frame, callback) {
            var scope = findScope(variable);

            session.setPropertyValue(variable.ref, frame.index, scope.index, value, function(err) {
                if (err) return callback(err);

                session.getProperty(variable.ref, frame.index, scope.index, function(err, property) {
                    if (err) return callback(err);

                    variable.type = formatType(property);
                    variable.value = formatValue(property, property["$"]);
                    variable.children = !!property["@children"];
                    variable.properties = undefined;

                    variable.status = "pending"; // force a refresh of tree view

                    callback(null, variable);
                });
            });
        }

        function getProxySource(process) {
            var socketPath = c9.home + "/.c9/xdebug.sock";
            if (c9.platform == "win32")
                socketPath = "\\\\.\\pipe\\" + socketPath.replace(/\//g, "\\");
            return {
                source: PROXY
                    .replace(/^\s*\/\/.*/gm, "")
                    .replace(/[\n\r]/g, "")
                    .replace(/\{HOST\}/, process.runner.debughost || "")
                    .replace(/\{PORT\}/, process.runner.debugport),
                port: socketPath
            };
        }

        function setBreakpoints(breakpoints, callback) {
            function _setBPs(breakpoints, callback, i) {
                // run callback once we've exhausted setting breakpoints
                if (i == breakpoints.length) {
                    callback(breakpoints);
                    return;
                }

                var bp = breakpoints[i];

                plugin.setBreakpoint(bp, function() {
                    _setBPs(breakpoints, callback, i + 1);
                });
            }

            _setBPs(breakpoints, callback, 0);
        }

        function setBreakBehavior(type, enabled, callback) {
            breakOnExceptions = enabled ? type == "all" : false;
            breakOnUncaughtExceptions = enabled ? type == "uncaught" : false;

            // session.sendCommand("breakpoint_set", { t: "exception", x: "*", s: "enabled" }, null, function(err, args, data, raw) {
                // TODO: store args.id and use it to toggle exception bp on/off
                // callback && callback();
            // });
        }

        /***** Register and define API *****/

        plugin.on("load", load);
        plugin.on("unload", unload);

        /**
         * Xdebug (DBGP) debugger implementation for Cloud9. This debugger
         * implements the DBGP protocol, which can be used with several
         * different language engines, such as PHP, or Python.
         *
         * @class debugger.xdebug
         * @extends debugger.implementation
         */
        plugin.freezePublicAPI({
            /**
             * Specifies the features that this debugger implementation supports
             * @property {Object} features
             * @property {Boolean} features.scripts                 Able to download code (disable the scripts button)
             * @property {Boolean} features.conditionalBreakpoints  Able to have conditional breakpoints (disable menu item)
             * @property {Boolean} features.liveUpdate              Able to update code live (don't do anything when saving)
             * @property {Boolean} features.updateWatchedVariables  Able to edit variables in watches (don't show editor)
             * @property {Boolean} features.updateScopeVariables    Able to edit variables in variables panel (don't show editor)
             * @property {Boolean} features.setBreakBehavior        Able to configure break behavior (disable break behavior button)
             * @property {Boolean} features.executeCode             Able to execute code (disable REPL)
             */
            features: {
                scripts: false,
                conditionalBreakpoints: true,
                liveUpdate: false,
                updateWatchedVariables: true,
                updateScopeVariables: true,
                setBreakBehavior: false,
                executeCode: true,
                listeningDebugger: true

                // TODO: flag to disable "suspend" command
            },

            /**
             * The type of the debugger implementation. This is the identifier
             * with which the runner selects the debugger implementation.
             * @property {String} type
             * @readonly
             */
            type: TYPE,

            /**
             * @property {null|"running"|"stopped"} state  The state of the debugger process
             * <table>
             * <tr><td>Value</td><td>      Description</td></tr>
             * <tr><td>null</td><td>       process doesn't exist</td></tr>
             * <tr><td>"stopped"</td><td>  paused on breakpoint</td></tr>
             * <tr><td>"running"</td><td>  process is running</td></tr>
             * </table>
             * @readonly
             */
            get state() { return state; },

            /**
             *
             */
            get attached() { return attached; },

            /**
             * Whether the debugger will break when it encounters any exception.
             * This includes exceptions in try/catch blocks.
             * @property {Boolean} breakOnExceptions
             * @readonly
             */
            get breakOnExceptions() { return breakOnExceptions; },

            /**
             * Whether the debugger will break when it encounters an uncaught
             * exception.
             * @property {Boolean} breakOnUncaughtExceptions
             * @readonly
             */
            get breakOnUncaughtExceptions() { return breakOnUncaughtExceptions; },

            _events: [
                /**
                 * Fires when the debugger hits a breakpoint.
                 * @event break
                 * @param {Object}           e
                 * @param {debugger.Frame}   e.frame        The frame where the debugger has breaked at.
                 * @param {debugger.Frame[]} [e.frames]     The callstack frames.
                 */
                "break",

                /**
                 * Fires when the {@link #state} property changes
                 * @event stateChange
                 * @param {Object}          e
                 * @param {debugger.Frame}  e.state  The new value of the state property.
                 */
                "stateChange",

                /**
                 * Fires when the debugger hits an exception.
                 * @event exception
                 * @param {Object}          e
                 * @param {debugger.Frame}  e.frame      The frame where the debugger has breaked at.
                 * @param {Error}           e.exception  The exception that the debugger breaked at.
                 */
                "exception",

                /**
                 * Fires when a frame becomes active. This happens when the debugger
                 * hits a breakpoint, or when it starts running again.
                 * @event frameActivate
                 * @param {Object}          e
                 * @param {debugger.Frame/null}  e.frame  The current frame or null if there is no active frame.
                 */
                "frameActivate",

                /**
                 * Fires when the result of the {@link #method-getFrames} call comes in.
                 * @event getFrames
                 * @param {Object}            e
                 * @param {debugger.Frame[]}  e.frames  The frames that were retrieved.
                 */
                "getFrames",

                /**
                 * Fires when the result of the {@link #getSources} call comes in.
                 * @event sources
                 * @param {Object}            e
                 * @param {debugger.Source[]} e.sources  The sources that were retrieved.
                 */
                "sources",

                /**
                 * Fires when a source file is (re-)compiled. In your event
                 * handler, make sure you check against the sources you already
                 * have collected to see if you need to update or add your source.
                 * @event sourcesCompile
                 * @param {Object}          e
                 * @param {debugger.Source} e.file  the source file that is compiled.
                 **/
                "sourcesCompile"
            ],

            /**
             * Attaches the debugger to the started process.
             * @param {Object}                runner        A runner as specified by {@link run#run}.
             * @param {debugger.Breakpoint[]} breakpoints   The set of breakpoints that should be set from the start
             */
            attach: attach,

            /**
             * Detaches the debugger from the started process.
             */
            detach: detach,

            /**
             * Loads all the active sources from the process
             *
             * @param {Function}          callback          Called when the sources are retrieved.
             * @param {Error}             callback.err      The error object if an error occured.
             * @param {debugger.Source[]} callback.sources  A list of the active sources.
             * @fires sources
             */
            getSources: getSources,

            /**
             * Retrieves the contents of a source file
             * @param {debugger.Source} source             The source to retrieve the contents for
             * @param {Function}        callback           Called when the contents is retrieved
             * @param {Error}           callback.err       The error object if an error occured.
             * @param {String}          callback.contents  The contents of the source file
             */
            getSource: getSource,

            /**
             * Retrieves the current stack of frames (aka "the call stack")
             * from the debugger.
             * @param {Function}          callback          Called when the frame are retrieved.
             * @param {Error}             callback.err      The error object if an error occured.
             * @param {debugger.Frame[]}  callback.frames   A list of frames, where index 0 is the frame where the debugger has breaked in.
             * @fires getFrames
             */
            getFrames: getFrames,

            /**
             * Retrieves the variables from a scope.
             * @param {debugger.Frame}      frame               The frame to which the scope is related.
             * @param {debugger.Scope}      scope               The scope from which to load the variables.
             * @param {Function}            callback            Called when the variables are loaded
             * @param {Error}               callback.err        The error object if an error occured.
             * @param {debugger.Variable[]} callback.variables  A list of variables defined in the `scope`.
             * @param {debugger.Scope}      callback.scope      The scope to which these variables belong
             * @param {debugger.Frame}      callback.frame      The frame related to the scope.
             */
            getScope: getScope,

            /**
             * Retrieves and sets the properties of a variable.
             * @param {debugger.Variable}   variable             The variable for which to retrieve the properties.
             * @param {Function}            callback             Called when the properties are loaded
             * @param {Error}               callback.err         The error object if an error occured.
             * @param {debugger.Variable[]} callback.properties  A list of properties of the variable.
             * @param {debugger.Variable}   callback.variable    The variable to which the properties belong.
             */
            getProperties: getProperties,

            /**
             * Step into the next statement.
             */
            stepInto: stepInto,

            /**
             * Step over the next statement.
             */
            stepOver: stepOver,

            /**
             * Step out of the current statement.
             */
            stepOut: stepOut,

            /**
             * Continues execution of a process after it has hit a breakpoint.
             */
            resume: resume,

            /**
             * Pauses the execution of a process at the next statement.
             */
            suspend: suspend,

            /**
             * Evaluates an expression in a frame or in global space.
             * @param {String}            expression         The expression.
             * @param {debugger.Frame}    frame              The stack frame which serves as the contenxt of the expression.
             * @param {Boolean}           global             Specifies whether to execute the expression in global space.
             * @param {Boolean}           disableBreak       Specifies whether to disabled breaking when executing this expression.
             * @param {Function}          callback           Called after the expression has executed.
             * @param {Error}             callback.err       The error if any error occured.
             * @param {debugger.Variable} callback.variable  The result of the expression.
             */
            evaluate: evaluate,

            /**
             * Change a live running source to the latest code state
             * @param {debugger.Source} source        The source file to update.
             * @param {String}          value         The new contents of the source file.
             * @param {Boolean}         previewOnly
             * @param {Function}        callback      Called after the expression has executed.
             * @param {Error}           callback.err  The error if any error occured.
             */
            // setScriptSource: setScriptSource,

            /**
             * Adds a breakpoint to a line in a source file.
             * @param {debugger.Breakpoint} breakpoint           The breakpoint to add.
             * @param {Function}            callback             Called after the expression has executed.
             * @param {Error}               callback.err         The error if any error occured.
             * @param {debugger.Breakpoint} callback.breakpoint  The added breakpoint
             * @param {Object}              callback.data        Additional debugger specific information.
             */
            setBreakpoint: setBreakpoint,

            /**
             * Updates properties of a breakpoint
             * @param {debugger.Breakpoint} breakpoint  The breakpoint to update.
             * @param {Function}            callback             Called after the expression has executed.
             * @param {Error}               callback.err         The error if any error occured.
             * @param {debugger.Breakpoint} callback.breakpoint  The updated breakpoint
             */
            changeBreakpoint: changeBreakpoint,

            /**
             * Removes a breakpoint from a line in a source file.
             * @param {debugger.Breakpoint} breakpoint  The breakpoint to remove.
             * @param {Function}            callback             Called after the expression has executed.
             * @param {Error}               callback.err         The error if any error occured.
             * @param {debugger.Breakpoint} callback.breakpoint  The removed breakpoint
             */
            clearBreakpoint: clearBreakpoint,

            /**
             * Retrieves a list of all the breakpoints that are set in the
             * debugger.
             * @param {Function}              callback              Called when the breakpoints are retrieved.
             * @param {Error}                 callback.err          The error if any error occured.
             * @param {debugger.Breakpoint[]} callback.breakpoints  A list of breakpoints
             */
            listBreakpoints: listBreakpoints,

            /**
             * Sets the value of a variable.
             * @param {debugger.Variable}   variable       The variable to set the value of.
             * @param {Mixed}               value          The new value of the variable.
             * @param {debugger.Frame}      frame          The frame to which the variable belongs.
             * @param {Function}            callback
             * @param {Function}            callback       Called when the breakpoints are retrieved.
             * @param {Error}               callback.err   The error if any error occured.
             * @param {Object}              callback.data  Additional debugger specific information.
             */
            setVariable: setVariable,

            /**
             *
             */
            // restartFrame: restartFrame,

            /**
             *
             */
            // serializeVariable: serializeVariable,

            /**
             * Defines how the debugger deals with exceptions.
             * @param {"all"/"uncaught"} type          Specifies which errors to break on.
             * @param {Boolean}          enabled       Specifies whether to enable breaking on exceptions.
             * @param {Function}         callback      Called after the setting is changed.
             * @param {Error}            callback.err  The error if any error occured.
             */
            setBreakBehavior: setBreakBehavior,

            /**
             * Returns the source of the proxy
             */
            getProxySource: getProxySource
        });

        register(null, {
            "debugger.xdebug": plugin
        });
    }
});
