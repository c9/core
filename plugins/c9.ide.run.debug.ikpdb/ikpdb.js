/**
 * This file is part of IKPdb Cloud9 debugger plugin.
 * Copyright (c) 2016 by Cyril MORISSE, Audaxis
 * Licence MIT. See LICENCE at repository root
 */

define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "c9", "util", "debugger", "dialog.error", 
        "notification.bubble"
    ];
    main.provides = ["ikpdb"];
    return main;

    function main(options, imports, register) {
        /****( IDE connection )*****/
        var Plugin = imports.Plugin;
        var util = imports.util;        

        var debug = imports["debugger"];
        var showError = imports["dialog.error"].show;
        var bubble = imports["notification.bubble"];

        var panels = imports.panels;
        var settings = imports.settings;
        
        var Frame = debug.Frame;
        var Source = debug.Source;
        var Breakpoint = debug.Breakpoint;
        var Variable = debug.Variable;
        var Scope = debug.Scope;
        
        /***** Other dependencies *****/
        var IKPdbService = require("./lib/IKPdbService");

        
        /***** Initialization *****/
        var TYPE = "pythondebug";
        var PROXY = require("text!./netproxy.js");
        
        var plugin = new Plugin("Cyril Morisse,Audaxis", main.consumes);
        var emit = plugin.getEmitter();
        // TODO: emit.setMaxListeners(1000);
    
        /**
         * State variables
         */
        var attached = false,
            state = null,
            stack = null,
            ikpdbs = null;
            
        var debugger_socket = null;
        var SCOPES = ["Parameters", "Locals"];
        
        /***** Lifecycle *****/
        plugin.on("load", function() {
            debug.registerDebugger(TYPE, plugin);
        });
        plugin.on("unload", function() {
            debug.unregisterDebugger(TYPE, plugin);
            attached = false;
            stack = null;
            ikpdbs = null;
            state = null;
            debugger_socket = null;
        });
       

        /*****(Event handlers and Methods )*****/

        function sendCommand(command, args, callback) {
            ikpdbs.sendCommand(command, args, function(err, reply) {
                /*****
                 * Process the messages IKPdb could send
                 * Note that error messages ar only displayed if IKPdb returned
                 * an error.
                 */
                if (reply) {
                    // Display info and warning messages
                    reply.info_messages.forEach(function (iMessage) {
                        console.log(iMessage);
                    });
                    reply.warning_messages.forEach(function (wMessage) {
                        bubble.popup(wMessage, false);
                    });
                }

                if (err) {
                    // Display errors
                    var errMessage;
                    if (reply) {
                        errMessage = reply.error_messages.join(" ");
                        showError(errMessage, 10000);
                    }
                    return callback && callback(err);
                }
                
                if (reply.result.executionStatus)
                    setState(reply.result.executionStatus);
                
                callback && callback(err, reply);
            });
        }

         /* Called by Cloud9 when user start execution */
        function runScript(callback) {
            sendCommand("runScript", {}, callback);
        }
         /* Called by Cloud9 when user clic on the Step over / F10 button */
        function stepOver(callback) {
            sendCommand("stepOver", {}, callback);
        }
         /* Called by Cloud9 when user clic on the Step over / F10 button */
        function stepInto(callback) {
            sendCommand("stepInto", {}, callback);
        }
         /* Called by Cloud9 when user clic on the Step over / F10 button */
        function stepOut(callback) {
            sendCommand("stepOut", {}, callback);
        }

        /* Called by Cloud9 when user clic on the Resume / F8 button  */
        function resume(callback) {
            sendCommand("resume", {}, callback);
        }

        /* Called by Cloud9 when user clic on Suspend */
        function suspend(callback) {
            sendCommand("suspend", {}, callback);
        }

        /**
         * Build individual variable objects from IKPdb output
         */
        function buildVariable(variable, scope) {
            if (variable == null) return;

            return new Variable({
               // ref: (variable.objname) ? variable.objname : variable.name,
               ref: variable.id,
               // name: (variable.exp) ? variable.exp : variable.name,
               name: variable.name,
               value: variable.value,
               type: variable.type,
               //children: (variable.numchild && variable.numchild > 0),
               children: variable.children_count,
               properties: null,
               scope: scope
            });
        }

        /**
         * Create a scope and variables from data received from IKPdb
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

        function buildFrame(thread_id, frame, i) {
            var variables = [];

            // build scopes and variables for this frame
            /*
             * Right now Cloud9 does not allow to diplay parameter appart from
             * local vars
             * TODO: Discuss with Cloud9 how to render parameters appart from locals in Debugger panels
             */
            //buildScopeVariables(variables, 0, i, frame.f_locals);
            if (typeof frame.f_locals !== "undefined") {
                buildScopeVariables(variables, 1, i, frame.f_locals);
            }

            // parse file from path
            return new Frame({
                index: i,
                name: frame.name,
                column: 0,
                id: frame.id,
                line: parseInt(frame.line_number, 10) - 1,  // IKPdb lines are 1 based
                path: util.normalizePath("/" + frame.file_path),
                sourceId: frame.file_path,
                thread: thread_id,
                istop: (i === 0),
                variables: variables
            });
        }

        /**
         * Process asynchonous messags received from remote debugger
         * like breakpoint hit or program termination
         */
        function programBreak(message) {
            if (message.command === 'programEnd') {
                return detach();  // detach() update state
            }

            // no error, only frames
            stack = [];

            // process frames
            var frames = message.frames;
            for (var i = 0, j = frames.length; i < j; i++) {
                stack.push(buildFrame(frames[i].thread, frames[i], i));
            }

            setState("stopped");
            emit("frameActivate", { frame: stack[0] });

            /*****
             * Process the 3 levels of messags IKPdb can send.
             */
            message.info_messages.forEach(function (iMessage) {
                console.log(iMessage);
            });
            message.warning_messages.forEach(function (wMessage) {
                bubble.popup(wMessage, false);
            });
            message.error_messages.forEach(function (eMessage) {
                showError(eMessage, 10000);
            });

            /**
             * Exceptions handling
             * We build a variable describing the exception
             * that c9 will inject into  "Watch Expressions".
             */
            if (message.exception) {
                showError("IKpdb has detected an unmanaged exception \"" +
                          message.exception.type + "\":" + message.exception.info +
                          ". Execution has stopped!",
                          10000);
                var exception = new Variable({
                    ref: null,
                    name: message.exception.type,
                    value: message.exception.info,
                    type: "Exception",
                    children: false,
                    properties: null,
                    scope: "Locals"
                });
                
                emit("exception", { frame: stack[0], frames: stack, exception: exception });
                debug.getElement("btnSuspend").setAttribute("disabled", true);
                debug.getElement("btnStepOut").setAttribute("disabled", true);
                debug.getElement("btnStepInto").setAttribute("disabled", true);
                debug.getElement("btnStepOver").setAttribute("disabled", true);
            } else {
                emit("break", { frame: stack[0], frames: stack });
                if (stack.length == 1)
                    debug.getElement("btnStepOut").setAttribute("disabled", true);
            }
        }

        /*****
         * Set the debugger state and emit state change
         */
        function setState(_state) {
            if (state === _state) return;
            state = _state;
            emit("stateChange", { state: state });
        }

        /*****
         * we can't use this since breakpoints function are called by cloud9
         * not by user
         * TODO: check with cloud9 a way to intercept user actions
         */ 
        function breakpointManagementWarning(commandSpecificMessage) {
            return;
            if (state == "running") {
                var msg = "IKPdpb Error: You can't manage breakpoints while" +
                          " program is running. Breakpoints can be manipulated " +
                          "before debugger launch or when program is stopped. " +
                          commandSpecificMessage;
                showError(msg, 10000);
                bubble.popup(commandSpecificMessage, false);
            }
        }
        
        function setBreakpoint(bp, callback) {
            // TODO: Check with c9 how we can prevent user to set breakpoint
            breakpointManagementWarning("Breakpoint creation request will be send to debugger at next programm break !.");
            
            bp.data.file_name = bp.data.path.substring(1);  // IKPdb expects a filename so we remove leading /
            bp.data.line_number = bp.data.line + 1;  // IKPdb expects 1 based lines
            sendCommand("setBreakpoint", bp.data, function(err, reply) {
                if (err)
                    return callback && callback(err);
                if (reply.commandExecStatus == "error")
                    return callback && callback(new Error("Can't set breakpoint"));
                bp.id = reply.result.breakpoint_number;
                callback && callback(null, bp, {});
            });
        }

        /**
         * Called by c9 when user clic on enable / disable breakpoints
         */
        function changeBreakpoint(bp, callback) {
            // TODO: Check with c9 how we can prevent user to set breakpoint
            breakpointManagementWarning("Breakpoint modification request will be send to debugger at next programm break !.");
            
            if (!bp.data) {
                console.error("Missing bp.data in changeBreakpoint(", bp, ") ");
            }
                
            bp.data.breakpoint_number = bp.id;
            sendCommand("changeBreakpointState", bp.data, function(err) {
                callback && callback(err, bp);
            });
        }
        
        /**
         * Called by c9 when user remove an existing breakpoint.
         */
        function clearBreakpoint(bp, callback) {
            // TODO: Check with c9 how we can prevent user to set breakpoint
            breakpointManagementWarning("Breakpoint removal request will be send to debugger at next programm break !.");

            bp.data.breakpoint_number = bp.id;
            sendCommand("clearBreakpoint", bp.data, function(err) {
                callback && callback(err, bp);
            });
        }

        /**
         * send breakpoints to debugger and attach when done
         */
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
         
        function sync(begin, callback) {
            // send breakpoints to ikpdb and attach when done
            var localBkpts = emit("getBreakpoints");

            listBreakpoints(function(err, remoteBkpts) {
                if (err) return callback(err);

                /* There exist two sets of breakpoints. One local as shown
                 * in the GUI, L, and one "remote" that already exists in
                 * IKPdb's state, R.
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
                        if (bp.path == rbp.path && bp.line == rbp.line &&
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

                // notify IKPDb of new breakpoints
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
                            runScript(callback);
                        else
                            sendCommand("getStatus", {}, callback);
                    });
                });
            });
        }

        /* 
         * Called by Cloud9 to retreive value of "Watch Expressions" and 
         * results of expressions types in "Immediate (Debuger)"" panel
         * WARNING: Right now only expressions are supported ; user
         * can't type a statement in immediate panel
         */
        function evaluate(expression, frame, global, disableBreak, callback) {
            var args = {
                "expression": expression,
                "frame": (frame && frame.id) || null,
                "thread": (frame && frame.thread) || null,
                "global": global,
                "disableBreak": disableBreak
            };
            sendCommand("evaluate", args, function(err, reply) {
                if (err) {
                    return callback(new Error("No value"));
                }
                /* TODO: remove if unneeded 
                else if (reply.commandExecutionStatus == "error")
                    return callback(new Error(reply.messages.msg));
                */
                callback(null, new Variable({
                    name: expression,
                    value: reply.result.value,
                    type: reply.result.type,
                    children: false
                }));
            });
        }

        function setVariable(variable, value, frame, callback) {
            var args = {
                "frame": frame.id,
                "name": variable.name,
                "value": value
            };
            sendCommand("setVariable", args, function(err, reply) {
                if (err)
                    return callback && callback(err);
                callback && callback(null, variable);
            });
        }


        /**
         * properly handle reconnect
         */
        function reconnectSync(callback) {
            if (!callback) 
                callback = function() {};
                
            sendCommand("reconnect", {}, function(err, reply) {
                var restart = !err && reply.executionStatus == "running";
                sync(restart, callback);
            });
        }

        
        function attach(_socket, reconnect, callback) {
            //console.debug("Entering IKPdb Plugin attach(_socket", _socket, "reconnect=", reconnect," ,callback=", callback,")");
            
            debugger_socket = _socket;
            
            // The back event is fired when the socket reconnects
            debugger_socket.on("back", function() {
                reconnectSync();
            }, plugin);
            
            // The error event is fired when the socket fails to connect
            debugger_socket.on("error", function(err) {
                console.error("IKPb debugger socket error !", err);
                emit("error", err);
            }, plugin);
        
            ikpdbs = new IKPdbService(debugger_socket, programBreak);
        
            ikpdbs.attach(function() {
                emit("connect");

                // if we're reconnecting, check IKPdb's state
                if (reconnect)
                    reconnectSync(callback);
                else
                    sync(true, callback);
            });

            // Update GUI
            emit("frameActivate", { frame: null });
        }        

        /*
         * Clean up the debugger connection
         */
        function detach() {
            // console.log("entering detach()");
            if (ikpdbs)
                ikpdbs.detach();

            emit("frameActivate", { frame: null });
            setState(null);

            debugger_socket = null;
            attached = false;
            ikpdbs = null;

            emit("detach");
        }

        function getProxySource(process) {
            return PROXY.replace(/\/\/.*/g, "")
                        .replace(/[\n\r]/g, "")
                        .replace(/\{DEBUGGED_PROCESS_PORT\}/, process.runner.debugport)
                        .replace(/\{DEBUGGED_PROCESS_HOST\}/, process.runner.debughost || "127.0.0.1");
        }


        /*  Not applicable  */
        function getSources(callback) {
            var sources = [new Source()];
            callback(null, sources);
            emit("sources", { sources: sources });
        }

        /*  Not applicable  */
        function getSource(source, callback) {
            callback(null, new Source());
        }

        function getFrames(callback, silent) {
            var frames = [];
            emit("getFrames", { frames: frames });
            callback(null, frames);            
        }

        function getScope(frame, scope, callback) {
            callback(null, scope.variables, scope, frame);
         }

        /* called by cloud9 when user request to expand variable's children */
        function getProperties(variable, callback) {
            // request children of a variable
            var args = { id: variable.ref, name: variable.name };
            sendCommand("getProperties", args, function(err, reply) {
                if (err)
                    return callback && callback(err);
                else if (reply.result.properties.length === 0)
                    return callback && callback(new Error("No children"));

                var children = [];
                reply.result.properties.forEach(function (child) {
                    children.push(buildVariable(child, variable.scope));
                });
                variable.properties = children;
                callback && callback(null, children, variable);
            });
        }

        /***
         * Retrieves a list of all the breakpoints that are set in the debugger.
         */
        function listBreakpoints(callback) {
            sendCommand("getBreakpoints", {}, function(err, reply) {
                if (err) {
                    console.error("getBreakpoints() error with response=", reply);
                    return callback && callback(err, reply);
                }
                // we reprocess breakpoints list to adjust line numbers and file paths
                reply.result.forEach(function(bp) {
                    bp.line = bp.line_number - 1;
                    bp.id = bp.breakpoint_number;
                    bp.path = util.normalizePath(bp.file_name);
                });  
                var breakpointList = reply.result;
                callback(null, breakpointList);
            });
        }
        
        /***** Register and define API *****/
        
        /**
         * TODO: comment
         * @singleton
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
                updateWatchedVariables: false,
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
             * Besides features and type, there are only four properties for 
             * which we should define property getters. 
             * These are state, attached, breakOnExceptions 
             * and breakOnUncaughtExceptions.

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
            get breakOnUncaughtExceptions() { return true; },
            
            _events: [
                "attach",
                "detach",
                /**
                 * Fires when the current list of breakpoints is needed
                 * @event getBreakpoints
                 */
                "getBreakpoints",
            ],

            /**
             * Attaches the debugger to the started process.
             * @param {Object}                runner        A runner as specified by {@link run#run}.
             * @param {debugger.Breakpoint[]} breakpoints   The set of breakpoints that should be set from the start
             */
            attach: attach,
            detach: detach,
            resume: resume,
            suspend: suspend,
            stepOver: stepOver,

            /**
             * Retrieves and sets the properties of a variable.
             * @param {debugger.Variable}   variable             The variable for which to retrieve the properties.
             * @param {Function}            callback             Called when the properties are loaded
             * @param {Error}               callback.err         The error object if an error occured.
             * @param {debugger.Variable[]} callback.properties  A list of properties of the variable.
             * @param {debugger.Variable}   callback.variable    The variable to which the properties belong.
             */
            getProperties: getProperties,
            
            stepInto: stepInto,
            stepOut: stepOut,
            getProxySource: getProxySource,

            /**
             * Adds a breakpoint to a line in a source file.
             * @param {debugger.Breakpoint} breakpoint           The breakpoint to add.
             * @param {Function}            callback             Called after the expression has executed.
             * @param {Error}               callback.err         The error if any error occured.
             * @param {debugger.Breakpoint} callback.breakpoint  The added breakpoint
             * @param {Object}              callback.data        Additional debugger specific information.
             */
            setBreakpoint: setBreakpoint,


            
            clearBreakpoint: clearBreakpoint,

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
             * Defines how the debugger deals with exceptions.
             * @param {"all"/"uncaught"} type          Specifies which errors to break on.
             * @param {Boolean}          enabled       Specifies whether to enable breaking on exceptions.
             * @param {Function}         callback      Called after the setting is changed.
             * @param {Error}            callback.err  The error if any error occured.
             */
            setBreakBehavior: function() {},

            /**
             * Updates properties of a breakpoint
             * @param {debugger.Breakpoint} breakpoint  The breakpoint to update.
             * @param {Function}            callback             Called after the expression has executed.
             * @param {Error}               callback.err         The error if any error occured.
             * @param {debugger.Breakpoint} callback.breakpoint  The updated breakpoint
             */
            changeBreakpoint: changeBreakpoint,

            /*
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
            
            
            
            

        });

        register(null, {
            "ikpdb": plugin
        });
    }
});