define(function(require, exports, module) {
    main.consumes = ["Plugin", "debugger", "util", "c9"];
    main.provides = ["chromedebugger"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var util = imports.util;
        var debug = imports["debugger"];
        var c9 = imports.c9;
        var async = require("async");
        
        var Frame = debug.Frame;
        var Source = debug.Source;
        var Breakpoint = debug.Breakpoint;
        var Variable = debug.Variable;
        var Scope = debug.Scope;
        
        var DevtoolsProtocol = require("./DevtoolsProtocol");

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        emit.setMaxListeners(1000);

        var stripPrefix = c9.toInternalPath((options.basePath || "").replace(/[\/\\]$/, ""));
        var breakOnExceptions = false;
        var breakOnUncaughtExceptions = false;
        
        var NODE_PREFIX = "(function (exports, require, module, __filename, __dirname) { ";
        var NODE_POSTFIX = "\n});";
        
        var RE_NODE_PREFIX = new RegExp("^" + util.escapeRegExp(NODE_PREFIX));
        var RE_NODE_POSTFIX = new RegExp(util.escapeRegExp(NODE_POSTFIX) + "$");
        
        var TYPE = "chrome";
        
        var attached = false;
        var v8dbg, state, activeFrame, sources, socket, pathMap;
        
        var hasChildren = {
            "regexp": 32,
            "error": 16,
            "object": 8,
            "function": 4
        };
        
        /***** Helper Functions *****/
        
        /**
         * Syncs the debug state to the client
         */
        function sync(breakpoints, reconnect, callback) {
            if (!v8dbg)
                return console.error("Sync called without v8dbg");
            getSources(function(err, sources) {
                if (err) return callback(err);
                
                updateBreakpoints(breakpoints, reconnect, function(err, breakpoints) {
                    if (err) return callback(err);
                    
                    handleDebugBreak(breakpoints, reconnect, null, function(canAttach) {
                        attached = canAttach;
                        emit("attach", { breakpoints: breakpoints });
                    }, 
                    function(isResumed) {
                        callback();
                    });
                });
            });
        }
        
        function updateBreakpoints(breakpoints, reconnect, callback) {
            function find(bp) {
                for (var i = 0, l = breakpoints.length; i < l; i++) {
                    if (breakpoints[i].equals(bp))
                        return breakpoints[i];
                }
            }
            
            var list = breakpoints.slice(0);
            if (list.length == 0) {
                // node v9.5 segfaults when there are no breakpoints
                list.push({
                    path: "_c9_node_segfault_workaround_",
                    line: 100,
                    enabled: true,
                });
            }
            
            listBreakpoints(function handleBps(err, remoteBreakpoints) {
                if (err) return callback(err);
                
                var found = [];
                var notfound = [];
                
                remoteBreakpoints.forEach(function(rbp) {
                    var bp;
                    if ((bp = find(rbp))) {
                        if (rbp.enabled == bp.enabled)
                            found.push(bp);
                    }
                    else
                        notfound.push(rbp);
                });
                
                async.each(list, function(bp, next) {
                    if (found.indexOf(bp) == -1)
                        setBreakpoint(bp, next);
                    else
                        next();
                }, done);
                
                function done() {
                    notfound.forEach(function(bp) { 
                        bp.serverOnly = true;
                        list.push(bp);
                    });
                    
                    list.sort(function(a, b) {
                        if (!a.id && !b.id) return 0;
                        if (!a.id && b.id) return 1;
                        if (a.id && !b.id) return -1;
                        return a.id - b.id;
                    });
                    
                    callback(null, list);
                }
            });
        }
        
        /**
         * Detects a break on a frame or a known breakpoint, otherwise resumes
         */
        function handleDebugBreak(breakpoints, reconnect, frame, attach, callback) {
            if (!v8dbg) {
                console.error("No debugger is set");
                attach();
                return callback();
            }
            
            wait();
            reconnect = true;
            
            function wait() {
                // Check if there is a real breakpoint here, so we don't resume
                function resumeIfNeeded(callback) {
                    if (!activeFrame) {
                        return v8dbg.$waitForBreak = function(frame) {
                            activeFrame = frame;
                            v8dbg.$waitForBreak = null;
                            resumeIfNeeded(function() {
                                callback();
                            });
                            return true;
                        };
                    }
                    var onBreakpoint = breakpoints.some(function(bp) { 
                        return bp.enabled && activeFrame.path === bp.path && bp.line == activeFrame.line;
                    });
                    if (!onBreakpoint) {
                        resume(callback);
                    } else {
                        onChangeRunning();
                        onBreak({frame: activeFrame});
                    }
                }
                
                // Resume the process
                if (reconnect) {
                    onChangeFrame(frame);
                    attach(true);
                    callback(false);
                }
                else {
                    // onChangeFrame(null);
                    attach(true);
                    resumeIfNeeded(callback.bind(this, true));
                }
            }
        }
        
        /**
         * Removes the path prefix from a string
         */
        function strip(str) {
            if (!str) return "";
            str = c9.toInternalPath(str);
            str = applyPathMap(str, "toInternal");
            return str && str.lastIndexOf(stripPrefix, 0) === 0
                ? util.normalizePath(str.slice(stripPrefix.length))
                : util.normalizePath(str || "");
        }
    
        /**
         * Returns the unique id of a frame
         */
        function getFrameId(frame) {
            return frame.func.name + ":" + frame.func.inferredName 
                + ":" + frame.func.scriptId + ":" 
                + (frame.received && frame.received.ref || "")
                + frame.arguments.map(function(a) {return a.value.ref;}).join("-");
                
            //return (frame.func.name || frame.func.inferredName || (frame.line + frame.position));
        }
    
        function formatType(value) {
            if (value.description)
                return value.description;
            switch (value.type) {
                case "undefined":
                case "null":
                    return value.type;
                
                case "error":
                    return value.value || "[Error]";
                    
                case "regexp":
                    return value.text;
    
                case "boolean":
                case "number":
                    return value.value + "";
                    
                case "string":
                    return JSON.stringify(value.value);
    
                case "object":
                    // text: "#<Student>"
                    var name = value.className || (value.text 
                        ? value.text.replace(/#<(.*)>/, "$1") 
                        : "Object");
                    return "[" + name + "]";
    
                case "function":
                    return "function " + value.inferredName + "()";
    
                default:
                    return value.type;
            }
        }
        
        function isTruthy(variable) {
            if ("undefined|null".indexOf(variable.type) > -1)
                return false;
            if ("false|NaN|\"\"".indexOf(variable.value) > -1)
                return false;
            return true;
        }
        
        
        function getPathFromScriptId(scriptId) {
            for (var i = 0; i < sources.length; i++) {
                if (sources[i].id == scriptId)
                    return sources[i].path;
            }
        }
        
        function getScriptIdFromPath(path) {
            for (var i = 0; i < sources.length; i++) {
                if (sources[i].path == path)
                    return sources[i].id;
            }
        }

        function getLocalScriptPath(script) {
            var scriptName = script.url || ("-anonymous-" + script.scriptId);
            scriptName = c9.toExternalPath(scriptName);
            scriptName = strip(scriptName);
            return scriptName;
        }
        
        function createFrame(frameData, index) {
            var options = frameData[index];
            var frame = options._frame || new Frame({
                istop: index == 0,
                index: index,
                name: options.functionName || "(anonymous)",
                line: options.location.lineNumber,
                column: options.location.columnNumber,
                id: options.callFrameId,
                script: options.location.scriptId,
                path: getLocalScriptPath(v8dbg.$scripts[options.location.scriptId]),
                sourceId: options.location.scriptId
            });
            options._frame = frame;
            
            var vars = [];

            frame.variables = frame.variables || vars;
            
             /*
             0: Global
             1: Local
             2: With
             3: Closure
             4: Catch >,
                if (scope.type > 1) {*/
            
            frame.scopes = options.scopeChain.map(function(scope, i) {
                return new Scope({
                    id: scope.object.objectId,
                    type: scope.type,
                    frame: frame,
                    index: i
                });
            });
            if (frame.scopes[0])
                frame.scopes[0].isOpen = true;
            
            return frame;
        }
        
        function createVariable(options, name, scope, variable) {
            var value = options.value || options;
            
            if (!variable) {
                if (value.subtype == "null")
                    value.type = value.subtype;
                variable = new Variable({
                    name: name || options.name,
                    scope: scope,
                    value: formatType(value),
                    type: value.type,
                    ref: value.objectId,
                    children: options.children === false 
                        ? false : (hasChildren[value.type] ? true : false),
                    options: options,
                });
            }
            return variable;
        }
        
        function createSource(options) {
            var path = getLocalScriptPath(options);
            // isLiveEdit: false,
            // sourceMapURL: "",
            // hasSourceURL: false,
            // isModule: false,
            return new Source({
                id: options.scriptId,
                name: options.url || "anonymous",
                path: path,
                text: strip(options.text || "anonymous"),
                debug: path.charAt(0) != "/" || path.match(/ \(old\)$/) ? true : false,
                lineOffset: options.lineOffset,
                customSyntax: "javascript",
                threadId: options.executionContextId,
            });
        }
        
        function createBreakpoint(options, serverOnly) {
            return new Breakpoint({
                id: options.number,
                path: getPathFromScriptId(options.script_id),
                line: options.line,
                column: options.column,
                condition: options.condition,
                enabled: options.active,
                ignoreCount: options.ignoreCount,
                serverOnly: serverOnly || false
            });
        }
        
        /***** Event Handler *****/
    
        function onChangeRunning(e) {
            if (!v8dbg) {
                state = null;
            } else {
                state = v8dbg.isRunning() ? "running" : "stopped";
            }
            
            if (attached) {
                emit("stateChange", { state: state });
        
                if (state != "stopped")
                    onChangeFrame(null);
            }
        }
    
        function onBreak(e) {
            var frame = e.frame || createFrame(e.callFrames, 0);
            if (v8dbg.$waitForBreak && v8dbg.$waitForBreak(frame)) {
                return;
            }
            onChangeFrame(frame, !attached);
            if (attached)
                emit("break", { frame: frame });
        }
    
        function onException(e) {
            var frame = createFrame(e.callFrames, 0);
            
            var options = e.data;
            var m = /^(\w+):(.*)$/m.exec(options.description);
            var name = m && m[1] || options.className;
            var value = m && m[2] || options.description;
            
            options.name = name;
            options.value = { 
                value: value, 
                type: "error",
                objectId: options.objectId,
            };
            options.children = true;
            
            var variable = createVariable(options);
            variable.error = true;
            
            emit("exception", {
                frame: frame, 
                exception: variable
            });
        }
    
        function onAfterCompile(e) {
            emit("sourcesCompile", { source: createSource(e) });
        }
    
        function onChangeFrame(frame, silent) {
            activeFrame = frame;
            if (!silent)
                emit("frameActivate", { frame: frame });
        }
    
        /***** Methods *****/
        
        function getProxySource(_process) {
            return false;
        }
        
        function attach(s, reconnect, callback) {
            if (v8dbg)
                v8dbg.detach();
            
            socket = s;
            
            // socket.connect();
            
            socket.on("back", function(err) {
                sync(emit("getBreakpoints"), true, callback);
            }, plugin);
            socket.on("error", function(err) {
                emit("error", err);
            }, plugin);
            
            v8dbg = new DevtoolsProtocol(socket);
            attached = false;
            v8dbg.attach(s, function(err, msg) {
                if (err) return callback(err);

                // register event listeners
                v8dbg.on("changeRunning", onChangeRunning);
                v8dbg.on("break", onBreak);
                v8dbg.on("exception", onException);
                v8dbg.on("afterCompile", onAfterCompile);
                
                onChangeFrame(null);
                
                if (msg && msg.type == "connect")
                    reconnect = false;
                // This fixes reconnecting. I dont understand why, but without
                // this timeout during reconnect the getSources() call never
                // returns
                setTimeout(function() {
                    sync(emit("getBreakpoints"), reconnect, callback);
                });
            });
        }
    
        function detach() {
            onChangeFrame(null);
            onChangeRunning();
            
            if (v8dbg) {
                v8dbg.detach();
                // on detach remove all event listeners
                v8dbg.off("changeRunning", onChangeRunning);
                v8dbg.off("break", onBreak);
                v8dbg.off("exception", onException);
                v8dbg.off("afterCompile", onAfterCompile);
            }
            
            socket = null;
            v8dbg = null;
            attached = false;
            
            emit("detach");
        }
        
        function getSources(callback) {
            v8dbg.scripts(function(scriptMap) {
                sources = [];
                for (var i in scriptMap) {
                    var script = scriptMap[i];
                    if ((script.name || "").indexOf("chrome-extension://") === 0)
                        continue;
                    sources.push(createSource(script));
                }
                callback(null, sources);
                
                emit("sources", { sources: sources });
            });
        }
        
        function getSource(source, callback) {
            v8dbg.getScriptSource(source.id, function(script) {
                if (!script || !script.scriptSource)
                    return callback(new Error("File not found : " + source.path));
                    
                var source = script.scriptSource
                    .replace(RE_NODE_PREFIX, "")
                    .replace(RE_NODE_POSTFIX, "");

                callback(null, source);
            });
        }
        
        function getFrames(callback, silent) {
            v8dbg.backtrace(function(data) {
                var frames = data.callFrames.map(function(frameData, index) {
                    return createFrame(data.callFrames, index);
                });
                
                emit("getFrames", { frames: frames });
                callback(null, frames);
            });
        }
        
        function getScope(frame, scope, callback) {
            v8dbg.getProperties({
                objectId: scope.id,
                ownProperties: false,
                accessorPropertiesOnly: false,
                generatePreview: true
            }, function(body, error) {
                if (error)
                    return callback(error);
                
                var variables = (body.result || []).map(function(prop) {
                    return createVariable(prop);
                });
                
                scope.variables = variables;
                
                callback(null, variables, scope, frame);
            });
        }
        
        function getProperties(variable, callback) {
            if (!variable.ref)
                return callback(null, []);
            v8dbg.getProperties({
                objectId: variable.ref,
                ownProperties: true,
                accessorPropertiesOnly: false,
                generatePreview: true
            }, function(body, error) {
                if (error)
                    return callback(error);
                
                var properties = (body.result || []).map(function(prop) {
                    return createVariable(prop);
                });
                
                variable.properties = properties;
                
                callback(null, properties);
            });
        }
        
        function stepInto(callback) {
            v8dbg.stepInto(callback);
        }
        
        function stepOver(callback) {
            v8dbg.stepOver(callback);
        }
        
        function stepOut(callback) {
            v8dbg.stepOut(callback);
        }
    
        function resume(callback) {
            v8dbg.resume(callback);
        }
    
        function suspend(callback) {
            v8dbg.suspend(function() {
                emit("suspend");
                callback && callback();
            });
        }
    
        function setScriptSource(script, newSource, previewOnly, callback) {
            newSource = NODE_PREFIX + newSource.replace(/^#!.*/, "") + NODE_POSTFIX;
            
            v8dbg.changelive(script.id, newSource, previewOnly, function(data, error) {
                var errorMessage = "Debugger could not update source of saved file."
                if (error)
                    return callback(new Error(errorMessage));
                if (data && data.exceptionDetails)
                    return callback(new Error(errorMessage + " " + data.exceptionDetails.text));
                    
                emit("setScriptSource", data);
                callback(null, data);
            });
        }
        
        function restartFrame(frame, callback) {
            v8dbg.restartframe(frame.id, function(result, error) {
                stepInto(callback);
            });
        }
        
        function evaluate(expression, frame, global, disableBreak, callback) {
            v8dbg.evaluate(expression, frame, global, disableBreak, function(data) {
                var value = data.result;
                var error = data.error;
                var name = expression.trim();
                if (error) {
                    var err = new Error(error.message);
                    err.name = name;
                    err.stack = error.stack;
                    return callback(err);
                }
                
                var variable = createVariable({
                    name: name,
                    value: value,
                });
                
                callback(null, variable);
            });
        }
        
        function setBreakpoint(bp, callback) {
            var sm = bp.sourcemap || {};
            var path = sm.source || bp.path;
            var line = sm.line || bp.line;
            var column = sm.column || bp.column;
            
            if (!path) {
                // TODO find out why this happens
                callback && callback(new Error("Ignoring breakpoint with invalid path."));
                return false;
            }
            
            path = applyPathMap(path, "toExternal");
            
            if (path[0] == "/")
                path = stripPrefix + path;
            else if (path[0] == "~")
                path = c9.home + path.substr(1);
            
            path = c9.toExternalPath(path);

            v8dbg.setbreakpoint(path, line, column, bp.enabled, bp.condition, function(info) {
                if (!info)
                    return callback && callback(new Error());
                
                bp.id = info.breakpointId;
                if (info.locations) {
                    var loc = info.locations[0];
                    bp.actual = loc && {
                        line: loc.lineNumber,
                        column: loc.columnNumber,
                        scriptId: loc.scriptId,
                    };
                    emit("breakpointUpdate", { breakpoint: bp });
                }
                callback && callback(null, bp, info);
            });
            
            return true;
        }
        
        function changeBreakpoint(bp, callback) {
            setBreakpoint(bp, callback);
        }
        
        function clearBreakpoint(bp, callback) {
            v8dbg.clearbreakpoint(bp.id, callback);
        }
        
        function listBreakpoints(callback) {
            v8dbg.listbreakpoints(function(data) {
                if (!data) return callback(new Error("Not Connected"));
                
                breakOnExceptions = data.breakOnExceptions;
                breakOnUncaughtExceptions = data.breakOnUncaughtExceptions;
                
                callback(null, data.breakpoints.map(function(bp) {
                    return createBreakpoint(bp);
                }));
            });
        }
        
        function setVariable(variable, value, frame, callback) {
            v8dbg.setvariablevalue(variable, value, frame, callback);
        }
        
        function serializeVariable(variable, callback) {
            return callback(variable.value);
        }
        
        function setBreakBehavior(type, enabled, callback) {
            breakOnExceptions = enabled ? type == "all" : false;
            breakOnUncaughtExceptions = enabled ? type == "uncaught" : false;
            
            v8dbg.setexceptionbreak(enabled ? type : "none", callback);
        }
        
        function setPathMap(v) {
            if (!Array.isArray(v)) v = null;
            pathMap = v && v.map(function(x) {
                if (!x.toInternal || !x.toExternal) return;
                var map = {
                    toInternal: {},
                    toExternal: {}
                };
                if (typeof x.toInternal.regex == "string")
                    map.toInternal.regex = new RegExp(x.toInternal.regex, "g");
                map.toInternal.replacement = x.toInternal.replacement;
                if (typeof x.toExternal.regex == "string")
                    map.toExternal.regex = new RegExp(x.toExternal.regex, "g");
                map.toExternal.replacement = x.toExternal.replacement;
                return map;
            }).filter(Boolean);
        }
        
        function applyPathMap(path, dir) {
            if (!pathMap)
                return path;
            pathMap.forEach(function(record) {
                var mapping = record[dir];
                path = path.replace(mapping.regex, mapping.replacement);
            });
            return path;
        }
    
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
        });
        plugin.on("unload", function() {
            breakOnExceptions = null;
            breakOnUncaughtExceptions = null;
            attached = false;
            v8dbg = null;
            state = null;
            activeFrame = null;
            sources = null;
            socket = null;
            pathMap = null;
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
                scripts: true,
                conditionalBreakpoints: true,
                liveUpdate: true,
                updateWatchedVariables: true,
                updateScopeVariables: true,
                setBreakBehavior: true,
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
                 * Fires when the debugger is attached.
                 * @event attach
                 * @param {Object}  e
                 * @param {debugger.Breakpoint[]}   e.breakpoints        A list of breakpoints that is set in the running process
                 */
                "attach",
                /**
                 * Fires when the debugger is detached.
                 * @event detach
                 */
                "detach",
                /**
                 * Fires when execution is suspended (paused)
                 * @event suspend
                 */
                "suspend",
                /**
                 * Fires when the source of a file is updated
                 * @event setScriptSource
                 * @param {Object} e
                 */
                "setScriptSource",
                /**
                 * Fires when the socket experiences an error
                 * @event error
                 */
                "error",
                /**
                 * Fires when the current list of breakpoints is needed
                 * @event getBreakpoints
                 */
                "getBreakpoints",
                /**
                 * Fires when a breakpoint is updated. This can happen when it
                 * is set at a location which is not an expression. Certain
                 * debuggers (such as v8) will move the breakpoint location to
                 * the first expression that's next in source order.
                 * @event breakpointUpdate
                 * @param {Object}               e
                 * @param {debugger.Breakpoint}  e.breakpoint  
                 */
                "breakpointUpdate",
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
            setScriptSource: setScriptSource,
            
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
             * Starts a frame (usually a function) from the first expression in that frame.
             * @param {debugger.Frame}   frame          The frame to restart.
             * @param {Function}         callback
             * @param {Function}         callback       Called when the frame is restarted.
             */
            restartFrame: restartFrame,
            
            /**
             * Retrieve the value of a variable
             * @param {debugger.Variable} variable       The variable for which to retrieve the value
             * @param {Function}          callback
             * @param {Function}          callback       Called when the value is retrieved
             * @param {String}            callback.value The value of the variable
             */
            serializeVariable: serializeVariable,
            
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
            getProxySource: getProxySource,
            
            /**
             * @ignore
             * Experimental method for meteor runner
             */
            setPathMap: setPathMap
        });
        
        return plugin;
    }
});