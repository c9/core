define(function(require, exports, module) {
    main.consumes = [
        "Panel", "settings", "ui", "immediate", "run", "panels", "tabManager", 
        "commands", "dialog.confirm", "dialog.error", "debugger.socket"
    ];
    main.provides = ["debugger"];
    return main;

    function main(options, imports, register) {
        var Panel = imports.Panel;
        var Socket = imports["debugger.socket"];
        var settings = imports.settings;
        var ui = imports.ui;
        var tabs = imports.tabManager;
        var panels = imports.panels;
        var commands = imports.commands;
        var run = imports.run;
        var showError = imports["dialog.error"].show;
        var confirm = imports["dialog.confirm"].show;
        
        var Frame = require("../data/frame");
        var Source = require("../data/source");
        var Breakpoint = require("../data/breakpoint");
        var Variable = require("../data/variable");
        var Scope = require("../data/scope");
        var Data = require("../data/data");
        
        var markup = require("text!./debugger.xml");
        var css = require("text!./debugger.css");
        
        /***** Initialization *****/
        
        var plugin = new Panel("Ajax.org", main.consumes, {
            index: options.index || 100,
            caption: "Debugger",
            buttonCSSClass: "debugger",
            panelCSSClass: "debugcontainer",
            minWidth: 165,
            // autohide: true,
            width: 300,
            where: options.where || "right"
        });
        var emit = plugin.getEmitter();
        
        var debuggers = {};
        var pauseOnBreaks = 0;
        var state = "disconnected";
        var sources = [];
        var running, activeFrame, dbg, name, process, socket, disabledFeatures;
        
        var container, btnResume, btnStepOver, btnStepInto, btnStepOut, 
            btnSuspend, btnPause, btnOutput, btnImmediate, btnSnapshots; // ui elements
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            settings.on("read", function() {
                settings.setDefaults("user/debug", [
                    ["pause", 0],
                    ["autoshow", true]
                ]);
                
                pauseOnBreaks = settings.getNumber("user/debug/@pause");
                togglePause(pauseOnBreaks);
            });
            
            // Register this panel on the left-side panels
            plugin.setCommand({
                name: "toggledebugger",
                hint: "show the debugger panel",
                // bindKey      : { mac: "Command-U", win: "Ctrl-U" }
            });
            
            // Commands
            
            commands.addCommand({
                name: "resume",
                group: "Run & Debug",
                hint: "resume the current paused process",
                bindKey: { mac: "F8|Command-\\", win: "F8" },
                exec: function() {
                    dbg && dbg.resume();
                }
            }, plugin);
            commands.addCommand({
                name: "suspend",
                group: "Run & Debug",
                hint: "suspend the current running process",
                // bindKey : {mac: "F8", win: "F8"},
                exec: function() {
                    dbg && dbg.suspend();
                }
            }, plugin);
            commands.addCommand({
                name: "stepinto",
                group: "Run & Debug",
                hint: "step into the function that is next on the execution stack",
                bindKey: { mac: "F11|Command-;", win: "F11" },
                exec: function() {
                    dbg && dbg.stepInto();
                }
            }, plugin);
            commands.addCommand({
                name: "stepover",
                group: "Run & Debug",
                hint: "step over the current expression on the execution stack",
                bindKey: { mac: "F10|Command-'", win: "F10" },
                exec: function() {
                    dbg && dbg.stepOver();
                }
            }, plugin);
            commands.addCommand({
                name: "stepout",
                group: "Run & Debug",
                hint: "step out of the current function scope",
                bindKey: { mac: "Shift-F11|Command-Shift-'", win: "Shift-F11" },
                exec: function() {
                    dbg && dbg.stepOut();
                }
            }, plugin);
            
            // Load CSS
            ui.insertCss(css, plugin);
        }
        
        var drawn;
        function draw(opts) {
            if (drawn) return;
            drawn = true;
            
            // Import Skin
            ui.insertSkin({
                name: "debugger",
                data: require("text!./skin.xml"),
            }, plugin);
            
            // Create UI elements
            var bar = opts.aml;
            
            var scroller = bar.$ext.appendChild(document.createElement("div"));
            scroller.className = "scroller";
            
            // Create UI elements
            var parent = bar;
            ui.insertMarkup(parent, markup, plugin);
            
            container = plugin.getElement("hbox");
            
            btnResume = plugin.getElement("btnResume");
            btnStepOver = plugin.getElement("btnStepOver");
            btnStepInto = plugin.getElement("btnStepInto");
            btnStepOut = plugin.getElement("btnStepOut");
            btnSuspend = plugin.getElement("btnSuspend");
            btnPause = plugin.getElement("btnPause");
            btnOutput = plugin.getElement("btnOutput");
            btnImmediate = plugin.getElement("btnImmediate");
            
            // @todo move this to F8 and toggle between resume
            // btnSuspend.on("click", function(){
            //     suspend();
            // });
            
            togglePause(pauseOnBreaks);
            
            btnPause.on("click", function() {
                togglePause();
            });
            
            btnOutput.on("click", function() {
                commands.exec("showoutput", null, {
                    id: name
                });
            });
            
            btnImmediate.on("click", function() {
                commands.exec("showimmediate", null, {
                    evaluator: "debugger"
                });
            });
            
            // Update button state
            plugin.on("stateChange", function(e) {
                state = e.state;
                
                updateButtonState(state);
            });
            
            updateButtonState(state);
            
            emit.sticky("drawPanels", { html: scroller, aml: bar });
        }
        
        /***** Methods *****/
        
        function updateButtonState(state) {
            if (!drawn)
                return;
            
            var notConnected = state == "disconnected" || state == "away";
            
            btnResume.$ext.style.display = state == "stopped" 
                ? "inline-block" : "none";
            btnSuspend.$ext.style.display = notConnected 
                || state != "stopped" ? "inline-block" : "none";
                
            btnSuspend.setAttribute("disabled", notConnected);
            btnStepOver.setAttribute("disabled", notConnected || state != "stopped");
            btnStepInto.setAttribute("disabled", notConnected || state != "stopped");
            btnStepOut.setAttribute("disabled", notConnected || state != "stopped");
            btnOutput.setAttribute("disabled", notConnected);
            
            if (!dbg) return;
            // can't use visible true since it changes display to block
            btnStepOver.$ext.style.display = 
            btnStepInto.$ext.style.display = 
            btnStepOut.$ext.style.display = dbg.features.snapshotDebugger ? "none" : "";
            
            if (dbg.features.snapshotDebugger) {
                btnResume.$ext.style.display = 
                btnSuspend.$ext.style.display = "none";
                updateSnapshotList();
                btnSnapshots.$ext.style.display = "";
            }
            else {
                if (btnSnapshots)
                    btnSnapshots.$ext.style.display = "none";
            }
            
            btnPause.$ext.style.display = dbg.features.setBreakBehavior ? "" : "none";
            btnImmediate.$ext.style.display = dbg.features.executeCode ? "" : "none";
        }
        
        function updateSnapshotList(snapshots) {
            if (!btnSnapshots) {
                btnSnapshots = ui.dropdown({ skin: "black_dropdown", "empty-message": "Waiting for snapshot..." });
                btnResume.parentNode.insertBefore(btnSnapshots, btnResume.parentNode.firstChild);
                plugin.addElement(btnSnapshots);
                btnSnapshots.on("afterchange", function(e) {
                    if (dbg.features.snapshotDebugger) {
                        dbg.selectSnapshot(e.value && e.value.data);
                        dbg.getFrames(function(err, frames) {
                            if (!err && frames.length) {
                                emit("framesLoad", {
                                    frames: frames,
                                    frame: findTopFrame(frames)
                                });
                            }
                        });
                    }
                });
            }
            if (snapshots) {
                while (btnSnapshots.lastChild)
                    btnSnapshots.removeChild(btnSnapshots.lastChild);
                snapshots.forEach(function(x) {
                    var item = ui.item({ caption: x.caption, value: x });
                    btnSnapshots.appendChild(item);
                });
                btnSnapshots.select(btnSnapshots.firstChild);
            }
        }
        
        function initializeDebugger() {
            // State Change
            var stateTimer;
            dbg.on("stateChange", function(e) {
                var action = e.state == "running" ? "disable" : "enable";
                
                // Wait for 500ms in case we are step debugging
                clearTimeout(stateTimer);
                if (action == "disable")
                    stateTimer = setTimeout(function() {
                        updatePanels(action, e.state);
                    }, 500);
                else {
                    updatePanels(action, e.state);
                }
            }, plugin);
            
            // Receive the breakpoints on attach
            dbg.on("attach", function(e) {
                e.implementation = dbg;
                togglePause(pauseOnBreaks);
                
                emit("attach", e);
                updateButtonState();
            }, plugin);
            
            dbg.on("detach", function(e) {
                updateButtonState("detached");
                
                //@todo
                emit("detach", e);
            }, plugin);
            
            dbg.on("error", function(err) {
                if (!process || !process.checkState) return;
                
                process.checkState(function() {
                    if (err.code == "ECONNREFUSED" || err.code == "ECONNRESET") {
                        // Ignore error if process has stopped
                        if (process.running >= process.STARTING)
                            showError("Could not connect debugger to the debugger proxy");
                    }
                    else if (err.code) {
                        showError(err.message || "Debugger connection error " + err.code);
                    }
                    if (process.running >= process.STARTING)
                        socket.connect();
                });
            });
            
            dbg.on("getBreakpoints", function() {
                return emit("getBreakpoints");
            });
            
            // When hitting a breakpoint or exception or stepping
            function startDebugging(e) {
                if (settings.getBool("user/debug/@autoshow"))
                    panels.activate("debugger");
                
                // Reload Frames
                emit("framesLoad", e);
                
                // Process Exception
                if (e.exception) {
                    emit("exception", e);
                }
                
                emit("break", e);
            }
            dbg.on("break", startDebugging, plugin);
            dbg.on("exception", startDebugging, plugin);
            dbg.on("suspend", function() {
                dbg.getFrames(function(err, frames) {
                    if (frames.length) {
                        startDebugging({
                            frames: frames,
                            frame: findTopFrame(frames)
                        });
                    }
                });
            }, plugin);
            
            // When a new frame becomes active
            dbg.on("frameActivate", function(e) {
                activeFrame = e.frame;
                emit("frameActivate", e);
            }, plugin);
            
            dbg.on("sources", function(e) {
                sources = e.sources.slice();
                emit("sources", e);
            }, plugin);
            
            dbg.on("sourcesCompile", function(e) {
                sources.push(e.source);
                emit("sourcesCompile", e);
            }, plugin);
            
            dbg.on("breakpointUpdate", function(e) {
                emit("breakpointUpdate", {
                    breakpoint: e.breakpoint
                });
            }, plugin);
            
            if (dbg.features.snapshotDebugger) {
                dbg.on("snapshotUpdate", function(e) {
                    if (settings.getBool("user/debug/@autoshow"))
                        panels.activate("debugger");
                    updateSnapshotList(e.snapshots);
                    updatePanels("enable", dbg.state);
                }, plugin);
            }
        }
        
        function updatePanels(action, runstate) {
            state = running != run.STOPPED && dbg && dbg.attached ? runstate : "disconnected";
            emit("stateChange", { state: state, action: action });
        }
        
        function togglePause(force) {
            pauseOnBreaks = force !== undefined
                ? force
                : (pauseOnBreaks > 1 ? 0 : pauseOnBreaks + 1);

            if (btnPause) {
                btnPause.setAttribute("class", "pause" + pauseOnBreaks + " nosize exception_break");
                btnPause.setAttribute("tooltip", 
                    pauseOnBreaks === 0
                        ? "Don't pause on exceptions"
                        : (pauseOnBreaks == 1
                            ? "Pause on all exceptions"
                            : "Pause on uncaught exceptions")
                );
            }
            
            if (state !== "disconnected" || force && dbg) {
                dbg.setBreakBehavior(
                    pauseOnBreaks === 1 ? "all" : "uncaught",
                    pauseOnBreaks === 0 ? false : true
                );
            }
            
            pauseOnBreaks = pauseOnBreaks;
            settings.set("user/debug/@pause", pauseOnBreaks);
        }
        
        function registerDebugger(type, debug) {
            debuggers[type] = debug;
        }
        
        function unregisterDebugger(type, debug) {
            if (debuggers[type] == debug)
                delete debuggers[type];
        }

        function findTopFrame(frames) {
            var top = frames.find(function (frame) {
                return frame.istop;
            });
            return (top) ? top : frames[0];
        }

        function showDebugFrame(frame, callback) {
            openFile({
                scriptId: frame.sourceId,
                line: frame.line - 1,
                column: frame.column,
                text: frame.name,
                path: frame.path
            }, callback);
        }
    
        function showDebugFile(script, row, column, callback) {
            openFile({
                scriptId: script.id,
                line: row, 
                column: column
            }, callback);
        }
    
        function openFile(options, callback) {
            var row = options.line + 1;
            var column = options.column;
            var path = options.path;
            var scriptId = options.script ? options.script.id : options.scriptId;
            var source;
            
            if (options.source)
                source = options.source;
            
            sources.every(function(src) {
                if (scriptId && src.id == scriptId) {
                    path = src.path;
                    source = src;
                    return false;
                }
                if (path && src.path == path) {
                    scriptId = src.scriptId;
                    source = src;
                    return false;
                }
                return true;
            });
            
            if (!source)
                source = { id: scriptId };
            
            var state = {
                path: path,
                active: true,
                value: source.debug ? -1 : undefined,
                document: {
                    title: path.substr(path.lastIndexOf("/") + 1),
                    meta: {
                        ignoreState: source.debug ? 1 : 0
                    },
                    ace: {
                        scriptId: scriptId,
                        lineoffset: 0,
                        customSyntax: source.customSyntax
                    }
                }
            };
            if (typeof row == "number" && !isNaN(row)) {
                state.document.ace.jump = {
                    row: row,
                    column: column
                };
            }
            
            if (emit("beforeOpen", {
                source: source,
                state: state,
                generated: options.generated,
                callback: callback || function() {}
            }) === false)
                return;

            tabs.open(state, function(err, tab, done) {
                if (err)
                    return console.error(err);
                
                tabs.focusTab(tab);
                if (!done)
                    return;
                    
                // If we need to load the contents ourselves, lets.
                dbg.getSource(source, function(err, value) {
                    if (err) return;
                    
                    tab.document.value = value;
                    
                    var jump = state.document.ace.jump;
                    if (tab.isActive() && jump) {
                        tab.document.editor
                          .scrollTo(jump.row, jump.column, jump.select);
                    }
                                    
                    done();
                    callback && callback(null, tab);
                });
                
                tab.document.getSession().readOnly = true;
            });
        }
        
        function switchDebugger(runner) {
            var debuggerId = runner["debugger"];
            
            // Only update debugger implementation if switching or not yet set
            if (!dbg || dbg != debuggers[debuggerId]) {
                
                // Currently only supporting one debugger at a time
                if (dbg) {
                    // Detach from runner
                    dbg.detach();
                    
                    // Unload the socket
                    socket.unload();
                    
                    // Remove all the set events
                    plugin.cleanUp("events", dbg);
                }
                
                // Find the new debugger
                dbg = debuggers[debuggerId];
                if (!dbg) {
                    var err = new Error(debuggerId
                        ? "Unable to find a debugger with type " + debuggerId
                        : "No debugger type specified in runner");
                    err.code = "EDEBUGGERNOTFOUND";
                    return err;
                }
                
                // Attach all events necessary
                initializeDebugger();
            }
        }
        
        function doRun(runner, options, name, callback) {
            if (options.debug)
                switchDebugger(runner);
            
            options.deferred = true;
            
            var process = run.run(runner, options, name, function(err, pid) {
                if (err) return callback(err);
                
                if (!process || process.running < process.STARTING)
                    return;
                    
                var hasListeningDebugger = options.debug && (dbg && dbg.features.listeningDebugger);
                
                if (hasListeningDebugger) {
                    dbg.once("connect", function() {
                        process.run(callback);
                    }, plugin);
                }
                else {
                    process.run(callback);
                }
                    
                if (options.debug) {
                    debug(process, function(err) {
                        if (err) {
                            window.console.warn(err);
                            return; // Either the debugger is not found or paused
                        }
                    });
                }
            });
            
            return process;
        }
        
        function debug(p, reconnect, callback) {
            if (reconnect && process == p && dbg && dbg.connected) {
                return; // We're already connecting / connected
            }
            
            process = p;
            
            if (typeof reconnect == "function") {
                callback = reconnect;
                reconnect = null;
            }
            
            var runner = process.runner;
            if (runner instanceof Array)
                runner = runner[runner.length - 1];
            
            // Switch to the right debugger
            var err = switchDebugger(runner);
            if (err) return callback(err);
            
            if (process.running == process.STARTED)
                running = process.STARTED;
            else {
                process.on("started", function() {
                    running = run.STARTED;
                }, plugin);
            }
            
            if (!process.meta.$debugger) {
                process.on("away", function() {
                    updatePanels("disable", "away");
                });
                
                process.on("back", function() {
                    updatePanels("enable", dbg.state);
                    // debug(process, true, function(){});
                });
                
                process.on("stopped", function() {
                    stop();
                }, plugin);
                
                process.meta.$debugger = true;
            }
            
            name = process.name;
            
            // Hook for plugins to delay or cancel debugger attaching
            // Whoever cancels is responible for calling the callback
            if (emit("beforeAttach", {
                process: process,
                reconnect: reconnect,
                runner: runner, 
                callback: callback
            }) === false)
                return;
                
            disabledFeatures = runner.disabled || {};
            
            // Create the socket
            socket = new Socket(runner.debugport, dbg.getProxySource(process), reconnect);
            
            if (dbg.setPathMap)
                dbg.setPathMap(runner.pathMap);
            // Attach the debugger to the running process
            dbg.attach(socket, reconnect, callback);
        }
        
        function stop() {
            if (!dbg) return;
            
            running = run.STOPPED;
            
            // Detach from runner
            dbg && dbg.detach();
            
            // Unload the socket
            socket.unload();
            
            updatePanels("disable", "disconnected");
            
            if (settings.getBool("user/debug/@autoshow"))
                panels.deactivate("debugger");
        }
        
        function checkAttached(callback, callbackCancel) {
            if (callbackCancel == undefined)
                callbackCancel = function() {};

            if (state != "disconnected") {
                confirm("Debugger",
                    "The debugger is already connected to another process.",
                    "Would you like to stop the current debugger process?",
                    function() { // Confirm
                        process.stop(function() {
                            callback();
                        });
                    },
                    callbackCancel, // Cancel
                    { yes: "Stop current process", no: "Cancel" }
                );
            }
            else {
                callback();
            }
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("draw", function(e) {
            draw(e);
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
            
            pauseOnBreaks = null;
            state = null;
            sources = null;
            running = null;
            activeFrame = null;
            dbg = null;
            name = null;
            process = null;
            socket = null;
            disabledFeatures = null;
            container = null;
            btnResume = null;
            btnStepOver = null;
            btnStepInto = null;
            btnStepOut = null;
            btnSuspend = null;
            btnPause = null;
            btnOutput = null;
            btnImmediate = null;
            btnSnapshots = null;
        });
        
        /***** Register and define API *****/
        
        /**
         * Generic Debugger for Cloud9. This plugin is responsible for 
         * binding the different debug panels to a debugger implementation.
         * 
         * The default debug panels are:
         * 
         * * {@link breakpoints}
         * * {@link callstack}
         * * {@link variables}
         * * {@link watches}
         * 
         * You can create your own debug panel using the {@link DebugPanel}
         * base class.
         * 
         * #### Remarks
         * 
         * * The debugger also works together with the {@link immediate Immediate Panel}.
         * * If you want to create a debugger for your platform, check out the
         * {@link debugger.implementation} reference specification.
         * * The debugger implementation is choosen based on configuration
         * variables in the runner. See {@link #debug} and {@link run#run} for
         * more information on runners.
         * 
         * The following example shows how to start a debugger and 
         * programmatically work with breakpoints and breaks:
         * 
         *     // Start a process by executing example.js with the 
         *     // default runner for that extension (Node.js)
         *     var process = run.run("auto", {
         *         path  : "/example.js",
         *         debug : true
         *     }, function(err, pid) {
         *     
         *         // When a breakpoint is hit, ask if the user wants to break.
         *         debug.on("break", function(){
         *             if (!confirm("Would you like to break here?"))
         *                 debug.resume();
         *         });
         *         
         *         // Set a breakpoint on the first line of example.js
         *         debug.setBreakpoint({
         *             path       : "/example.js",
         *             line       : 0,
         *             column     : 0,
         *             enabled    : true
         *         });
         *         
         *         // Attach a debugger to the running process
         *         debug.debug(process.runner, function(err) {
         *             if (err) throw err.message;
         *         });
         *     });
         *
         * @singleton
         * @extends Panel
         */
        plugin.freezePublicAPI({
            Frame: Frame,
            Source: Source,
            Breakpoint: Breakpoint,
            Variable: Variable,
            Scope: Scope,
            Data: Data,
            
            /**
             * The source of the default proxy
             * @property {String} proxySource
             */
            proxySource: require("text!./netproxy.js"),
            
            /**
             * When the debugger has hit a breakpoint or an exception, it breaks
             * and shows the active frame in the callstack panel. The active
             * frame represents the scope at which the debugger is stopped.
             * @property {debugger.Frame} activeFrame
             */
            get activeFrame() { return activeFrame; },
            set activeFrame(frame) { 
                activeFrame = frame; 
                emit("frameActivate", { frame: frame });
            },
            /**
             * 
             */
            get disabledFeatures() { return disabledFeatures || {}; },
            /**
             * The state of the debugger
             * @property {"running"|"stopped"|"disconnected"} sources
             * @readonly
             */
            get state() { return state; },
            /**
             * A list of sources that are available from the debugger. These
             * can be files that are loaded in the runtime as well as code that
             * is injected by a script or by the runtime itself.
             * @property {debugger.Source[]} sources
             * @readonly
             */
            get sources() { return sources; },
            /**
             * Retrieves if the debugger will break on exceptions
             * @property {Boolean} breakOnExceptions
             * @readonly
             */
            get breakOnExceptions() { return dbg.breakOnExceptions; },
            /**
             * Retrieves whether the debugger will break on uncaught exceptions
             * @property {Boolean} breakOnUncaughtExceptions
             * @readonly
             */
            get breakOnUncaughtExceptions() { return dbg.breakOnUncaughtExceptions; },
            
            _events: [
                /**
                 * Fires prior to a debugger attaching to a process.
                 * 
                 * This event serves as a hook for plugins to delay or 
                 * cancel a debugger attaching. Whoever cancels is responible 
                 * for calling the callback.
                 * 
                 * @event beforeAttach
                 * @cancellable
                 * @param {Object}   e
                 * @param {Object}   e.runner    The object that is running the process. See {@link #debug}.
                 * @param {Function} e.callback  The callback with which {@link #debug} was called.
                 */
                "beforeAttach",
                /**
                 * Fires when the debugger has attached itself to the process.
                 * @event attach
                 * @param {Object}                  e
                 * @param {debugger.Breakpoint[]}   e.breakpoints     The breakpoints that are currently set.
                 * @param {debugger.implementation} e.implementation  The used debugger implementation
                 */
                "attach",
                /**
                 * Fires when the debugger has detached itself from the process.
                 * @event detach
                 */
                "detach",
                /**
                 * Fires when the callstack frames have loaded for current 
                 * frame that the debugger is breaked at.
                 * @event framesLoad
                 * @param {Object}           e
                 * @param {debugger.Frame[]} e.frames  The frames of the callstack.
                 */
                "framesLoad",
                /**
                 * Fires when the debugger hits a breakpoint or an exception.
                 * @event break
                 * @param {Object}           e
                 * @param {debugger.Frame}   e.frame        The frame where the debugger has breaked at.
                 * @param {debugger.Frame[]} [e.frames]     The callstack frames.
                 * @param {Error}            [e.exception]  The exception that the debugger breaked at.
                 */
                "break",
                /**
                 * Fires prior to opening a file from the debugger.
                 * @event beforeOpen
                 * @cancellable
                 * @param {Object}          e
                 * @param {debugger.Source} e.source     The source file to open.
                 * @param {Object}          e.state      The state object that is passed to the {@link tabManager#method-open} method.
                 * @param {Boolean}         e.generated  Specifies whether the file is a generated file.
                 */
                "beforeOpen",
                /**
                 * Fires when a file is opened from the debugger.
                 * @event open
                 * @cancellable
                 * @param {Object}          e
                 * @param {debugger.Source} e.source      The source file to open.
                 * @param {String}          e.path        The path of the source file to open
                 * @param {String}          e.value       The value of the source file.
                 * @param {Function}        e.done        Call this function if you are cancelling the event.
                 * @param {Function}        e.done.value  The value of the source file
                 * @param {Tab}             e.tab         The created tab for the source file.
                 */
                "open",
                /**
                 * Fires when the panels are being drawn.
                 * @event drawPanels
                 * @param {Object}      e       
                 * @param {HTMLElement} e.html  The html container for the panel.
                 * @param {AMLElement}  e.aml   The aml container for the panel.
                 * @private
                 */
                "drawPanels",
                /**
                 * Fires when the state of the debugger changes.
                 * @event stateChange
                 * @param {Object} e
                 * @param {"disconnected"|"running"|"stopped"} e.state  The state of the debugger.
                 * <table>
                 * <tr><td>Value</td><td>           Description</td></tr>
                 * <tr><td>"disconnected"</td><td>  Not connected to a process</td></tr>
                 * <tr><td>"stopped"</td><td>       paused on breakpoint</td></tr>
                 * <tr><td>"running"</td><td>       process is running</td></tr>
                 * </table>
                 */
                "stateChange",
                /**
                 * Fires when the active frame changes. See also {@link #activeFrame}.
                 * @event frameActivate
                 * @param {Object}         e
                 * @param {debugger.Frame} e.frame  The frame that is currently active.
                 */
                "frameActivate",
                /**
                 * Fires when a new list of sources comes in from the debugger.
                 * @event sources
                 * @param {Object}            e
                 * @param {debugger.Source[]} e.sources  The list of sources
                 */
                "sources",
                /**
                 * Fires when a new source file is compiled.
                 * @event sourcesCompile
                 * @param {Object}          e
                 * @param {debugger.Source} e.source  The compiled source file.
                 */
                "sourcesCompile",
                /**
                 * Fires when a breakpoint is updated (for instance with location info).
                 * @event breakpointUpdate
                 * @param {Object}              e
                 * @param {debugger.Breakpoint} e.breakpoint  The breakpoint that is updated.
                 */
                "breakpointUpdate",
                /**
                 * Fires when the debugger needs a list of breakpoints.
                 * @event getBreakpoints
                 * @private
                 */
                "getBreakpoints"
            ],
            
            /**
             * 
             */
            run: doRun,
            
            /**
             * Attaches the debugger that is specified by the runner to the
             * running process that is started using the same runner.
             * 
             * *N.B.: There can only be one debugger attached at the same time.*
             * 
             * @param {run.Process} process        The process that will be debugger.
             * @param {Boolean}     [reconnect]    Specifies whether the debugger should reconnect to an existing debug session.
             * @param {Function}    callback       Called when the debugger is attached.
             * @param {Error}       callback.err   Error object with information on an error if one occured.
             */
            debug: debug,
            
            /**
             * Detaches the started debugger from it's process.
             */
            stop: stop,
            
            /**
             * Registers a {@link debugger.implementation debugger implementation}
             * with a unique name. This name is used as the "debugger" property
             * of the runner.
             * @param {String}                  name      The unique name of this debugger implementation.
             * @param {debugger.implementation} debugger  The debugger implementation.
             */
            registerDebugger: registerDebugger,
            
            /**
             * Unregisters a {@link debugger.implementation debugger implementation}.
             * @param {String}                  name      The unique name of this debugger implementation.
             * @param {debugger.implementation} debugger  The debugger implementation.
             */
            unregisterDebugger: unregisterDebugger,
            
            /**
             * Continues execution of a process after it has hit a breakpoint.
             */
            resume: function() { dbg.resume(); },
            
            /**
             * Pauses the execution of a process at the next statement.
             */
            suspend: function() { dbg.suspend(); },
            
            /**
             * Step into the next statement.
             */
            stepInto: function() { dbg.stepInto(); },
            
            /**
             * Step out of the current statement.
             */
            stepOut: function() { dbg.stepOut(); },
            
            /**
             * Step over the next statement.
             */
            stepOver: function() { dbg.stepOver(); },
            
            /**
             * Retrieves the contents of a source file from the debugger (not 
             * the file system).
             * @param {debugger.Source} source         The source file.
             * @param {Function}        callback       Called when the contents is retrieved.
             * @param {Function}        callback.err   Error object if an error occured.
             * @param {Function}        callback.data  The contents of the file.
             */
            getSource: function(source, callback) { 
                dbg.getSource(source, callback);
            },
            
            /**
             * Defines how the debugger deals with exceptions.
             * @param {"all"/"uncaught"} type          Specifies which errors to break on.
             * @param {Boolean}          enabled       Specifies whether to enable breaking on exceptions.
             * @param {Function}         callback      Called after the setting is changed.
             * @param {Error}            callback.err  The error if any error occured.
             */
            setBreakBehavior: function(type, enabled, callback) { 
                // dbg.setBreakBehavior(type, enabled, callback); 
                togglePause(enabled ? (type == "uncaught" ? 1 : 2) : 0);
            },
            
            /**
             * Evaluates an expression in a frame or in global space.
             * @param {String}            expression         The expression.
             * @param {debugger.Frame}    frame              The stack frame which serves as the context of the expression.
             * @param {Boolean}           global             Specifies whether to execute the expression in global space.
             * @param {Boolean}           disableBreak       Specifies whether to disabled breaking when executing this expression.
             * @param {Function}          callback           Called after the expression has executed.
             * @param {Error}             callback.err       The error if any error occured.
             * @param {debugger.Variable} callback.variable  The result of the expression.
             */
            evaluate: function(expression, frame, global, disableBreak, callback) { 
                dbg.evaluate(expression, frame, global, disableBreak, callback); 
            },
            
            /**
             * Check whether a debugger is already attached. If the debugger is
             * already attached it will present a dialog to the user asking 
             * how to handle the situation.
             * @param {Function} callback  Called when the user chooses to run
             * the new process.
             */
            checkAttached: checkAttached,

            /**
             * Returns the topmost frame from a set of frames
             * @param {debugger.Frame[]} frames  The stack of frames
             */
            findTopFrame: findTopFrame,

            /**
             * Displays a frame in the ace editor.
             * @param {debugger.Frame} frame  The frame to display
             */
            showDebugFrame: showDebugFrame,
            
            /**
             * Displays a debugger source file in the ace editor
             * @param {debugger.Source} script  The source file to display
             * @param {Number}          row     The row (zero bound) to scroll to.
             * @param {Number}          column  The column (zero bound) to scroll to.
             */
            showDebugFile: showDebugFile,
            
            /**
             * Opens a file from disk or from the debugger.
             * @param {Number}          [row]         The row (zero bound) to scroll to.
             * @param {Number}          [column]      The column (zero bound) to scroll to.
             * @param {String}          [path]        The path of the file to open
             * @param {debugger.Source} [script]      The source file to open
             * @param {String}          [scriptId]    The script id of the file to open
             * @param {Boolean}         [generated]   
             */
            openFile: openFile
        });
        
        register(null, {
            "debugger": plugin
        });
    }
});