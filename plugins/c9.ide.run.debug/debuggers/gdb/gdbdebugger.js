/**
 * GDB Debugger plugin for Cloud9
 *
 * @author Dan Armendariz <danallan AT cs DOT berkeley DOT edu>
 */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "c9", "debugger", "dialog.error", "fs", "panels", "settings"
    ];
    main.provides = ["gdbdebugger"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var c9 = imports.c9;
        var debug = imports["debugger"];
        var fs = imports["fs"];
        var panels = imports.panels;
        var settings = imports.settings;
        var showError = imports["dialog.error"].show;

        var Frame = debug.Frame;
        var Source = debug.Source;
        var Breakpoint = debug.Breakpoint;
        var Variable = debug.Variable;
        var Scope = debug.Scope;

        var Path = require("path");
        var GDBProxyService = require("./lib/GDBProxyService");

        /***** Initialization *****/

        var plugin = new Plugin("CS50", main.consumes);
        var emit = plugin.getEmitter();
        emit.setMaxListeners(1000);

        // increment when shim is updated to force rewrite
        var SHIM_VERSION = 2;

        var TYPE = "gdb";

        var attached = false;

        var state,          // debugger state
            socket,         // socket to proxy
            stack,          // always up-to-date frame stack
            proxy = null;   // GDB service proxy

        // GUI buttons
        var btnResume, btnSuspend, btnStepOver, btnStepInto, btnStepOut;

        var SCOPES = ["Arguments", "Locals"];

        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;

            settings.on("read", function() {
                settings.setDefaults("user/debug", [
                    ["autoshow", true]
                ]);
            });

            // must register ASAP, or debugger won't be ready for reconnects
            debug.registerDebugger(TYPE, plugin);

            // writeFile root is workspace directory, unless given ~
            var shimVersion = "~/.c9/bin/.c9gdbshim" + SHIM_VERSION;
            var shim = require("text!./shim.js");
            fs.exists(shimVersion, function(exists) {
                if (exists)
                    return;

                fs.writeFile("~/.c9/bin/c9gdbshim.js", shim, "utf8", function(err) {
                    if (err) {
                        // unregister the debugger on error
                        debug.unregisterDebugger(TYPE, plugin);
                        return console.log("Error writing gdb shim: " + err);
                    }

                    // remember we wrote current version
                    fs.writeFile(shimVersion, "", function(err) {
                        if (err)
                            return console.log("Error writing shim version: " + err);
                    });
                });
            });
        }

        /***** Helper Functions *****/

        /*
         * Build individual variable objects from GDB output
         */
        function buildVariable(variable, scope) {
            if (variable == null) return;

            return new Variable({
               ref: (variable.objname) ? variable.objname : variable.name,
               name: (variable.exp) ? variable.exp : variable.name,
               value: variable.value,
               type: variable.type,
               children: (variable.numchild && variable.numchild > 0),
               properties: null,
               scope: scope
            });
        }

        /*
         * Create a scope and variables from data received from GDB
         */
        function buildScopeVariables(frame_vars, scope_index, frame_index, vars) {
            var scope = new Scope({
                index: scope_index,
                type: SCOPES[scope_index],
                frameIndex: frame_index
            });

            for (var i = 0, j = vars.length; i < j; i++) {
                frame_vars.push(buildVariable(vars[i], scope));
            }
        }

        /*
         * Create a frame object, scope, and variables from a GDB frame
         */
        function buildFrame(thread, topIndex, frame, i) {
            var variables = [];

            // build scopes and variables for this frame
            buildScopeVariables(variables, 0, i, frame.args);
            if (typeof frame.locals !== "undefined") {
                buildScopeVariables(variables, 1, i, frame.locals);
            }

            // get file path from GDB output
            var fullpath = (frame.fullname)
                ? frame.fullname
                : ((frame.from) ? frame.from : c9.workspaceDir + "/?");

            // get file name and relative path from full path
            var file = Path.basename(fullpath);
            var relative = "/" + ((fullpath.indexOf(c9.workspaceDir) == 0)
                ? Path.relative(c9.workspaceDir, fullpath)
                : fullpath);

            var line = parseInt(frame.line, 10);
            line = (isNaN(line)) ? 0 : line - 1;

            return new Frame({
                index: i,
                name: frame.func,
                column: 0,
                id: file + ":" + frame.func + i + line,
                line: line,
                script: file,
                path: relative,
                sourceId: file,
                thread: thread,
                istop: (i === topIndex),
                variables: variables
            });
        }

        /*
         * Process out-of-sequence information received from proxy,
         * like errors or frames on breakpoint hit.
         */
        function processHalt(content) {
            if (content.err === "killed") {
                // GDB was killed
                return detach();
            }
            else if (content.err === "corrupt") {
                showError("GDB has detected a corrupt execution environment and has shut down!");
                return detach();
            }

            // process frames
            var frames = content.frames;
            var topIndex = Math.max(0, frames.findIndex(function (frame) {
                return frame.exists;
            }));
            stack = frames.map(buildFrame.bind(this, content.thread, topIndex));
            var topFrame = stack[topIndex];

            setState("stopped");
            emit("frameActivate", { frame: topFrame });

            var frameObj = { frame: topFrame, frames: stack };

            if (content.err === "signal" && content.signal.name !== "SIGINT") {
                var e = "Process received " + content.signal.name + ": "
                        + content.signal.text;
                showError(e);
                emit("exception", frameObj, new Error(content.signal.name));
            }
            else {
                emit("break", frameObj);
            }

            if (stack.length == 1)
                btnStepOut.setAttribute("disabled", true);
        }

        /*
         * A special case of sendCommand that demands a status update on reply.
         */
        function sendExecutionCommand(command, callback) {
            proxy.sendCommand(command, {}, function(err, reply) {
                if (err)
                    return callback && callback(err);

                setState(reply.state);
                callback && callback();
            });
        }

        /*
         * Set the debugger state and emit state change
         */
        function setState(_state) {
            if (state === _state) return;
            state = _state;
            emit("stateChange", { state: state });
        }

        /***** Methods *****/

        function getProxySource(process) {
            var socketpath = Path.join(c9.home, "/.c9/gdbdebugger.socket");
            return {
                source: null,
                socketpath: process.runner.socketpath || socketpath,
                retryInverval: process.runner.retryInterval || 300,
                retries: process.runner.retryCount || 1000
            };
        }

        function attach(s, reconnect, callback) {
            if (proxy)
                proxy.detach();

            socket = s;

            socket.on("back", function() {
                reconnectSync();
            }, plugin);

            socket.on("error", function(err) {
                console.log("gdbdebugger err: ", err);
                emit("error", err);
            }, plugin);

            proxy = new GDBProxyService(socket, processHalt);
            proxy.attach(function() {
                emit("connect");

                // if we're reconnecting, check GDB's state
                if (reconnect)
                    reconnectSync(callback);
                else
                    sync(true, callback);
            });

            // show the debug panel immediately
            if (settings.getBool("user/debug/@autoshow"))
                panels.activate("debugger");

            // attach to GUI elements
            btnResume = debug.getElement("btnResume");
            btnStepOver = debug.getElement("btnStepOver");
            btnStepInto = debug.getElement("btnStepInto");
            btnStepOut = debug.getElement("btnStepOut");
            btnSuspend = debug.getElement("btnSuspend");
        }

        function detach() {
            if (proxy)
                proxy.detach();

            emit("frameActivate", { frame: null });
            setState(null);

            socket = null;
            attached = false;
            proxy = null;

            btnResume.$ext.style.display = "inline-block";
            btnSuspend.$ext.style.display = "none";
            btnSuspend.setAttribute("disabled", false);
            btnStepOut.setAttribute("disabled", false);
            btnStepInto.setAttribute("disabled", false);
            btnStepOver.setAttribute("disabled", false);

            emit("detach");
        }

        function sync(begin, callback) {
            // send breakpoints to gdb and attach when done
            var localBkpts = emit("getBreakpoints");

            listBreakpoints(function(err, remoteBkpts) {
                if (err) return callback(err);

                /* There exist two sets of breakpoints. One local as shown
                 * in the GUI, L, and one "remote" that already exists in
                 * GDB's state, R.
                 * Syncing L and R must prioritize L's elements. We'll
                 * create three sets:
                 * to_remove = R\L (or {x∈R|x∉L})
                 *  BPs present in R but not in L, must be removed from R
                 * to_add = L/R (or {x∈L|x∉R})
                 *  BPs present in L but not in R, must be added to R
                 * synced = L∩R
                 *  BPs already in both.
                 */

                 var to_add = [];
                 var synced = [];

                // compare the GUI breakpoints to those already created
                for (var i = 0, j = localBkpts.length; i < j; i++) {
                    var bp = localBkpts[i];
                    var missing = true;

                    // test for membership of bp in remoteBkpts
                    for (var x = 0, y = remoteBkpts.length; x < y; x++) {
                        var rbp = remoteBkpts[x];
                        if (bp.text == rbp.text && bp.line == rbp.line &&
                            bp.condition == rbp.condition) {
                            // make sure synced BP has correct id
                            bp.id = rbp.id;

                            // track necessary removals by removing used BPs
                            remoteBkpts.splice(x, 1);
                            missing = false;
                            break;
                        }
                    }

                    if (missing)
                        to_add.push(bp);
                    else
                        synced.push(bp);
                }

                // notify GDB of new breakpoints
                manyBreakpoints(to_add, setBreakpoint, function(added, fail) {
                    // successfully created BPs are now synced
                    synced = synced.concat(added);

                    // now remove extraneous BPs
                    manyBreakpoints(remoteBkpts, clearBreakpoint, function(cleared, clrfail) {
                        // BPs that failed to remove need to be present locally
                        synced = synced.concat(clrfail);

                        attached = true;
                        emit("attach", { breakpoints: synced });

                        if (begin)
                            resume(callback);
                        else
                            sendExecutionCommand("status", callback);
                    });
                });
            });
        }

        /*
         * Not applicable.
         */
        function getSources(callback) {
            var sources = [new Source()];
            callback(null, sources);
            emit("sources", { sources: sources });
        }

        /*
         * Not applicable.
         */
        function getSource(source, callback) {
            callback(null, new Source());
        }

        function getFrames(callback, silent) {
            emit("getFrames", { frames: stack });
            callback(null, stack);
        }

        function getScope(frame, scope, callback) {
            callback(null, scope.variables, scope, frame);
        }

        function getProperties(variable, callback) {
            // request children of a variable
            var args = { name: variable.ref };
            proxy.sendCommand("var-children", args, function(err, reply) {
                if (err)
                    return callback && callback(err);
                else if (typeof reply.children === "undefined")
                    return callback && callback(new Error("No children"));

                var children = [];
                reply.children.forEach(function (child) {
                    children.push(buildVariable(child, variable.scope));
                });
                variable.properties = children;
                callback && callback(null, children, variable);
            });
        }

        function stepInto(callback) {
            sendExecutionCommand("step", callback);
        }

        function stepOver(callback) {
            sendExecutionCommand("next", callback);
        }

        function stepOut(callback) {
            // step out only works in GDB if we're not inside main()
            if (stack.length > 1)
                sendExecutionCommand("finish", callback);
        }

        function resume(callback) {
            sendExecutionCommand("continue", callback);
        }

        function suspend(callback) {
            proxy.sendCommand("suspend", {}, function(err) {
                if (err)
                    return callback && callback(err);
                emit("suspend");
                callback && callback();
            });
        }

        function reconnectSync(callback) {
            // If a program is executing when debugger reconnects, GDB must
            // be paused to fetch the state and then restarted or it will hang
            if (!callback) callback = function() {};
            proxy.sendCommand("reconnect", {}, function(err, reply) {
                var restart = !err && reply.state == "running";
                sync(restart, callback);
            });
        }

        function evaluate(expression, frame, global, disableBreak, callback) {
            var args = {
                "exp": expression,
                "f": (!frame || frame.index == null) ? 0 : frame.index,
                "t": (!frame || frame.thread == null) ? 1 : frame.thread,
            };
            proxy.sendCommand("eval", args, function(err, reply) {
                if (err)
                    return callback(new Error("No value"));
                else if (typeof reply.status === "undefined")
                    return callback(new Error(reply.status.msg));

                callback(null, new Variable({
                    name: expression,
                    value: reply.status.value,
                    type: undefined, /* type info is not provided by GDB */
                    children: false
                }));
            });
        }

        function setVariable(variable, value, frame, callback) {
            var args = {
                "name": variable.ref,
                "val": value
            };
            proxy.sendCommand("var-set", args, function(err, reply) {
                if (err)
                    return callback && callback(err);

                callback && callback(null, variable);
            });
        }

        function setBreakpoint(bp, callback) {
            bp.data.fullpath = Path.join(c9.workspaceDir, bp.data.path);
            proxy.sendCommand("bp-set", bp.data, function(err, reply) {
                if (err)
                    return callback && callback(err);
                if (!reply.status || !reply.status.bkpt)
                    return callback && callback(new Error("Can't set breakpoint"));
                bp.id = reply.status.bkpt.number;
                callback && callback(null, bp, {});
            });
        }

        function manyBreakpoints(breakpoints, command, callback) {
            function _setBPs(breakpoints, failed, callback, i) {
                // run callback once we've exhausted setting breakpoints
                if (i == breakpoints.length) {
                    callback(breakpoints, failed);
                    return;
                }

                command(breakpoints[i], function(err, bp) {
                    if (err) {
                        // breakpoint failure, remove it before going on
                        failed.push(breakpoints.splice(i, 1));
                        _setBPs(breakpoints, failed, callback, i);
                    }
                    else {
                        breakpoints[i].id = bp.id;
                        _setBPs(breakpoints, failed, callback, i + 1);
                    }
                });
            }

            _setBPs(breakpoints, [], callback, 0);
        }


        function changeBreakpoint(bp, callback) {
            proxy.sendCommand("bp-change", bp.data, function(err) {
                callback && callback(err, bp);
            });
        }

        function clearBreakpoint(bp, callback) {
            proxy.sendCommand("bp-clear", bp.data, function(err) {
                callback && callback(err, bp);
            });
        }

        function listBreakpoints(callback) {
            proxy.sendCommand("bp-list", {}, function(err, reply) {
                if (err)
                    return callback && callback(err);

                var bps = reply.status.BreakpointTable.body.map(function (bp) {
                    return new Breakpoint({
                        id: bp.number,
                        path: bp.fullname,
                        line: parseInt(bp.line, 10) - 1,
                        ignoreCount: (bp.hasOwnProperty("ignore")) ?
                                      bp.ignore : undefined,
                        condition: (bp.hasOwnProperty("cond")) ?
                                    bp.cond : undefined,
                        enabled: (bp.enabled == "y") ? true : false,
                        text: bp.file
                    });
                });
                callback(null, bps);
            });
        }

        function serializeVariable(variable, callback) {
            callback(variable.value);
        }

        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {

        });
        plugin.on("disable", function() {

        });
        plugin.on("unload", function() {
            debug.unregisterDebugger(TYPE, plugin);

            state = null;
            socket = null;
            reader = null;
            stack = null;
            proxy = null;
            btnResume = btnSuspend = btnStepOver = btnStepInto = btnStepOut = null;
            loaded = false;
            attached = false;
        });

        /***** Register and define API *****/

        /**
         * Debugger implementation for Cloud9. When you are implementing a
         * custom debugger, implement this API. If you are looking for the
         * debugger interface of Cloud9, check out the {@link debugger}.
         *
         * This interface is defined to be as stateless as possible. By
         * implementing these methods and events you'll be able to hook your
         * debugger seamlessly into the Cloud9 debugger UI.
         *
         * See also {@link debugger#registerDebugger}.
         *
         * @class debugger.implementation
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
                executeCode: true
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
            get breakOnExceptions() { return false; },
            /**
             * Whether the debugger will break when it encounters an uncaught
             * exception.
             * @property {Boolean} breakOnUncaughtExceptions
             * @readonly
             */
            get breakOnUncaughtExceptions() { return false; },

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
            setScriptSource: function() {},

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
             * @param {debugger.Variable[]} parents        The parent variables (i.e. the objects of which the variable is the property).
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
            restartFrame: function() {},

            /**
             *
             */
            serializeVariable: serializeVariable,

            /**
             * Defines how the debugger deals with exceptions.
             * @param {"all"/"uncaught"} type          Specifies which errors to break on.
             * @param {Boolean}          enabled       Specifies whether to enable breaking on exceptions.
             * @param {Function}         callback      Called after the setting is changed.
             * @param {Error}            callback.err  The error if any error occured.
             */
            setBreakBehavior: function() {},

            /**
             * Returns the source of the proxy
             */
            getProxySource: getProxySource
        });

        register(null, {
            gdbdebugger: plugin
        });
    }
});
