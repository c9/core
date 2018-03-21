/*
 * Cloud9 Language Foundation
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "c9", "settings", "ace", "tabManager", "preferences",
        "commands", "error_handler"
    ];
    main.provides = ["language"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var aceHandle = imports.ace;
        var tabs = imports.tabManager;
        
        var prefs = imports.preferences;
        var commands = imports.commands;
        var WorkerClient = require("ace/worker/worker_client").WorkerClient;
        var UIWorkerClient = require("ace/worker/worker_client").UIWorkerClient;
        var net = require("ace/lib/net");

        var async = require("async");

        var BIG_FILE_LINES = 5000;
        var BIG_FILE_DELAY = 500;
        var UI_WORKER_DELAY = 3000; // longer delay to wait for plugins to load with require()
        var INITIAL_DELAY = 2000;
        var UI_WORKER = window.location && /[?&]noworker=(\w+)|$/.exec(window.location.search)[1]
            || options.useUIWorker;

        var delayedTransfer;
        var lastWorkerMessage = {};
        var refreshAllPending = 0;
        var isContinuousCompletionEnabledSetting;
        var initedTabs;
        var ignoredMarkers;
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        emit.setMaxListeners(50); // avoid warnings during initialization
        
        var worker;
        
        function onCursorChange(e, sender, now) {
            if (!worker.$doc)
                return;
            var cursorPos = worker.$doc.selection.getCursor();
            var line = worker.$doc.getDocument().getLine(cursorPos.row);
            emit("cursormove", {
                doc: worker.$doc,
                pos: cursorPos,
                line: line,
                selection: worker.$doc.selection,
                now: now
            });
        }
        function onChange(e) {
            worker.changeListener(e);
            worker._signal("change", e);
        }
        function onChangeMode() {
            var tab = worker && worker.$doc && worker.$doc.c9doc && worker.$doc.c9doc.tab;
            if (tab) {
                notifyWorker("switchFile", { tab: tab });
            }
        }
        
        /**
         * Notify the worker that the document changed
         *
         * @param type  the event type, documentOpen or switchFile
         * @param e     the originating event, should have an e.tab.path and e.tab.document
         */
        function notifyWorker(type, e) {
            if (!worker)
                return plugin.once("initWorker", notifyWorker.bind(null, type, e), plugin);
            
            var tab = e.tab;
            var path = getTabPath(tab);
            var c9session = tab.document.getSession();
            if (tab.document.hasValue && !tab.document.hasValue()) {
                tab.document.once("setValue", function() {
                    setTimeout(function() { // wait for event to be consumed by others
                        notifyWorker(type, e);
                    });
                }, plugin);
                return;
            }
            var session = c9session && c9session.loaded && c9session.session;
            if (!session)
                return;
            var immediateWindow = session.repl ? tab.name : null;
            
            if (session !== worker.$doc && type === "switchFile") {
                if (worker.$doc) {
                    worker.$doc.off("change", onChange);
                    worker.$doc.off("changeMode", onChangeMode);
                    worker.$doc.c9doc.tab.off("setPath", onChangeMode);
                    worker.$doc.selection.off("changeCursor", onCursorChange);
                }
                
                worker.$doc = session;
                
                session.selection.on("changeCursor", onCursorChange);
                session.c9doc.tab.on("setPath", onChangeMode);
                session.on("changeMode", onChangeMode);
                session.on("change", onChange);
            }
            
            var syntax = session.syntax;
            if (!syntax && session.$modeId) {
                syntax = /[^\/]*$/.exec(session.$modeId)[0] || syntax;
                session.syntax = syntax;
            }
            
            // Avoid sending duplicate messages
            var last = lastWorkerMessage;
            if (last.type === type && last.path === path && last.immediateWindow === immediateWindow
                && last.syntax === syntax)
                return;
            lastWorkerMessage = {
                type: type,
                path: path,
                immediateWindow: immediateWindow,
                syntax: syntax
            };
            
            var value = e.value || session.doc.$lines || [];

            draw();

            clearTimeout(delayedTransfer);
            
            if (type === "switchFile" && value.length > BIG_FILE_LINES) {
                delayedTransfer = setTimeout(
                    notifyWorkerTransferData.bind(null, type, path, immediateWindow, syntax, value),
                    BIG_FILE_DELAY
                );
                return delayedTransfer;
            }

            return notifyWorkerTransferData(type, path, immediateWindow, syntax, value, e.force);
        }
        
        function notifyWorkerTransferData(type, path, immediateWindow, syntax, value, force) {
            if (!force && type === "switchFile" && getTabPath(getActiveTab()) !== path)
                return;
            // console.log("[language] Sent to worker (" + type + "): " + path + " length: " + value.length);
            if (options.workspaceDir === undefined)
                console.error("[language] options.workspaceDir is undefined!");
            // background tabs=open document, foreground tab=switch to file
            if (type === "switchFile" && worker.deltaQueue) {
                value = worker.$doc.$lines; // in case we are called async
                worker.deltaQueue = null;
            }
            worker.call(type, [
                path, immediateWindow, syntax, value, null, 
                options.workspaceDir
            ]);
            if (type === "switchFile")
                worker._signal("changeMode");
            return true;
        }
        
        function getTabPath(tab) {
            return tab && (tab.path || tab.name);
        }
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            var id = "plugins/c9.ide.language.core/worker";
            if (options.workerPrefix)
                var path = options.workerPrefix.replace(/\/?$/, "/") + id + ".js";
            
            // Create main worker for language processing
            if (UI_WORKER) {
                worker = new UIWorkerClient(["treehugger", "ace", "c9", "plugins"], id, "LanguageWorker", path);
                if (UI_WORKER === "sync")
                    worker.setEmitSync(true);
            }
            else {
                try {
                    worker = new WorkerClient(
                        ["treehugger", "ace", "c9", "plugins", "acorn", "tern"],
                        id,
                        "LanguageWorker",
                        path || (options.staticPrefix || "/static") + "/lib/ace/lib/ace/worker/worker.js"
                    );
                } catch (e) {
                    if (e.code === 18 && window.location && window.location.origin === "file://")
                        throw new Error("Cannot load worker from file:// protocol, please host a server on localhost instead "
                            + "or use ?noworker=1 to use a worker in the UI thread (can cause slowdowns)");
                    throw e;
                }
                worker.reportError = function(err) {
                    console.error(err.stack || err);
                    imports.error_handler.reportError(err, {}, ["worker"]);
                };
                worker.$worker.onerror = function(e) {
                    e.preventDefault();
                };
            }
            
            worker.call("setStaticPrefix", [net.qualifyURL(options.staticPrefix || c9.staticUrl || "/static")]);
            if (document.location.hostname.match(/c9.dev|cloud9beta.com|localhost|127.0.0.1/))
                worker.call("setDebug", [true]);

            aceHandle.on("create", function(e) {
                e.editor.on("createAce", function (ace) {
                    emit("attachToEditor", ace);
                }, plugin);
            }, plugin);
            
            tabs.on("tabDestroy", function(e) {
                var path = e.tab.path;
                if (path)
                    worker.emit("documentClose", { data: path });
                var c9session = e.tab.document.getSession();
                if (c9session && c9session.session === worker.$doc)
                    worker.$doc = null;
            }, plugin);
            
            // Hook all newly opened files
            tabs.on("open", function(e) {
                if (isEditorSupported(e.tab)) {
                    notifyWorker("documentOpen", e);
                    if (!tabs.getPanes) // single-pane minimal UI
                        notifyWorker("switchFile", { tab: e.tab });
                }
            }, plugin);
            
            // Switch to any active file
            tabs.on("focusSync", function(e) {
                if (isEditorSupported(e.tab))               
                    notifyWorker("switchFile", e);
            }, plugin);
            
            emit.sticky("initWorker", { worker: worker });

            settings.on("read", function() {
                setTimeout(function() { updateSettings(); });
            }, plugin);
            
            settings.once("read", function() {
                settings.setDefaults("user/language", [
                    ["hints", true],
                    ["continuousCompletion", true],
                    ["instanceHighlight", true],
                    ["enterCompletion", true]
                ]);
                settings.setDefaults("project/language", [
                    ["warnLevel", "info"],
                    ["undeclaredVars", true],
                    ["eslintrc", true],
                    ["semi", true],
                    ["unusedFunctionArgs", false]
                ]);
                settings.on("user/language", updateSettings, plugin);
                settings.on("project/language", updateSettings, plugin);
            }, plugin);
    
            // Preferences
            prefs.add({
                "Project": {
                    "Hints & Warnings": {
                        position: 700,
                        "Warning Level": {
                            type: "dropdown",
                            path: "project/language/@warnLevel",
                            items: [
                               { caption: "Error", value: "error" },
                               { caption: "Warning", value: "warning" },
                               { caption: "Info", value: "info" }
                            ],
                            position: 5000
                        },
                        "Mark Missing Optional Semicolons": {
                            type: "checkbox",
                            path: "project/language/@semi",
                            position: 7000
                        },
                        "Mark Undeclared Variables": {
                            type: "checkbox",
                            path: "project/language/@undeclaredVars",
                            position: 8000
                        },
                        "Mark Unused Function Arguments": {
                            type: "checkbox",
                            path: "project/language/@unusedFunctionArgs",
                            position: 9000
                        },
                        "Ignore Messages Matching Regex": {
                            title: [null, "Ignore Messages Matching ", ["a", { 
                                href: "http://en.wikipedia.org/wiki/Regular_expression", target: "blank"}, "Regex"]],
                            type: "textbox",
                            path: "project/language/@ignoredMarkers",
                            width: 300,
                            position: 11000
                        },
                    },
                    "JavaScript Support": {
                        position: 1100,
                        "Customize JavaScript Warnings With .eslintrc": {
                            title: [null, "Customize JavaScript Warnings With ", ["a", { 
                                href: "http://eslint.org/docs/user-guide/configuring", target: "blank"}, ".eslintrc"]],
                            position: 210,
                            type: "checkbox",
                            path: "project/language/@eslintrc",
                        },
                    }
                }
            }, plugin);
            
            prefs.add({
                "Language": {
                    position: 500,
                    "Input": {
                        position: 100,
                        "Complete As You Type": {
                            type: "checkbox",
                            path: "user/language/@continuousCompletion",
                            position: 4000
                        },
                        "Complete On Enter": {
                            type: "checkbox",
                            path: "user/language/@enterCompletion",
                            position: 5000
                        },
                        "Highlight Variable Under Cursor": {
                            type: "checkbox",
                            path: "user/language/@instanceHighlight",
                            position: 6000
                        },
                    },
                    "Hints & Warnings": {
                        position: 200,
                        "Enable Hints and Warnings": {
                            type: "checkbox",
                            path: "user/language/@hints",
                            position: 1000
                        },
                        "Ignore Messages Matching Regex": {
                            title: [null, "Ignore Messages Matching ", ["a", { 
                                href: "http://en.wikipedia.org/wiki/Regular_expression", target: "blank"}, "Regex"]],
                            type: "textbox",
                            path: "user/language/@ignoredMarkers",
                            position: 3000
                        },
                    }
                }
            }, plugin);
            
            // commands
            commands.addCommand({
                name: "expandSnippet",
                bindKey: "Tab",
                exec: function(editor) {
                    return editor && editor.ace.expandSnippet();
                },
                isAvailable: function(editor) {
                    var ace = editor && editor.ace;
                    if (ace && ace.selection.isEmpty())
                        return ace.expandSnippet({ dryRun: true });
                },
            }, plugin);
        }
        
        // Initialize an Ace editor
        aceHandle.on("create", function(e) {
            var editor = e.editor;
            
            if (!initedTabs && tabs.getPanes) { // not in single-pane minimal UI
                tabs.once("ready", function() {
                    if (initedTabs)
                        return;
                    tabs.getTabs().forEach(function(tab) {
                        if (isEditorSupported(tab)) {
                            setTimeout(function() {
                                if (tab.value)
                                    return notifyWorker("documentOpen", { tab: tab, value: tab.value });
                                var value = tab.document.value;
                                if (value)
                                    return notifyWorker("documentOpen", { tab: tab, value: value });
                                tab.document.once("valueSet", function(e) {
                                    notifyWorker("documentOpen", { tab: tab, value: e.value });
                                });
                            }, UI_WORKER ? UI_WORKER_DELAY : INITIAL_DELAY);
                        }
                    });
                    var activeTab = getActiveTab();
                    if (isEditorSupported(activeTab))
                        notifyWorker("switchFile", { tab: activeTab });

                    initedTabs = true;
                });
            }
            
            editor.on("documentLoad", function(e) {
                var session = e.doc.getSession().session;
                
                notifyWorker("documentOpen", { tab: e.doc.tab });
                session.once("changeMode", function() {
                    if (tabs.focussedTab === e.doc.tab)
                        notifyWorker("switchFile", { tab: e.doc.tab });
                });

            });
            editor.on("documentUnload", function(e) {
            });
        }, plugin);
        
        function getActiveTab() {
            return isEditorSupported(tabs.focussedTab)
                ? tabs.focussedTab
                : tabs.getPanes().map(function(p) {
                    return p.activeTab;
                }).filter(function(t) {
                    return isEditorSupported(t);
                })[0];
        }
        
        var drawn;
        function draw() {
            if (drawn) return;
            emit("draw");
            drawn = true;
        }
        
        function getWorker(callback) {
            if (worker)
                return setTimeout(callback.bind(null, null, worker)); // always async
            plugin.once("initWorker", function() {
                callback(null, worker);
            }, plugin);
        }
        
        function updateSettings(e) {
            if (!worker)
                return plugin.once("initWorker", updateSettings, plugin);
            
            function updateFeatures(type, names) {
                names.forEach(function(s) {
                    worker.call(
                        "enableFeature",
                        [s, settings.getBool(type + "/language/@" + s)]
                    );
                });
            }
            updateFeatures("user", ["instanceHighlight", "hints"]);
            updateFeatures("project", ["unusedFunctionArgs", "undeclaredVars", "eslintrc", "semi"]);
            worker.call("setWarningLevel", 
                [settings.get("project/language/@warnLevel")]);
                
            // var cursorPos = editor.getCursorPosition();
            // cursorPos.force = true;
            // worker.emit("cursormove", {data: cursorPos});
            
            isContinuousCompletionEnabledSetting = 
                settings.get("user/language/@continuousCompletion");
            ignoredMarkers =
                (settings.get("user/language/@ignoredMarkers") || "(?!NONE)NONE")
                + "|"
                + (settings.get("project/language/@ignoredMarkers") || "(?!NONE)NONE");
            
            refreshAllMarkers();
        }
        
        function refreshAllMarkers() {
            refreshAllPending++;
            if (refreshAllPending > 1)
                return;
            
            var activeTabs = tabs.getPanes().map(function(pane) {
                return pane.getTab();
            });
            
            var focussedTab = tabs.focussedTab;
            activeTabs = activeTabs.filter(function(tab) {
                return tab !== focussedTab;
            }).concat(focussedTab);
            
            async.forEachSeries(activeTabs, function(tab, next) {
                if (!isEditorSupported(tab) || tab === focussedTab)
                    return next();
                
                lastWorkerMessage = {};
                
                if (!notifyWorker("switchFile", { tab: tab, force: true }))
                    return next();
                
                worker.once("markers", function(e) {
                    next();
                });
            }, function() {
                if (refreshAllPending > 1) {
                    refreshAllPending = 0;
                    return setTimeout(function() {
                        refreshAllPending = 0;
                        refreshAllMarkers();
                    }, 100);
                }
                refreshAllPending = 0;
                lastWorkerMessage = {};
                tabs.focussedTab &&
                    notifyWorker("switchFile", { tab: tabs.focussedTab });
            });
        }
        
        function isEditorSupported(tab) {
            return tab && ["ace", "immediate"].indexOf(tab.editor ? tab.editor.type : tab.editorType) !== -1;
        }
    
        function isInferAvailable() {
            return c9.hosted; // || !!req uire("core/ext").extLut["ext/jsinfer/jsinfer"];
        }
        
        function isContinuousCompletionEnabled() {
            return isContinuousCompletionEnabledSetting;
        }
        
        function getIgnoredMarkers() {
            return ignoredMarkers;
        }
    
        function setContinuousCompletionEnabled(value) {
            isContinuousCompletionEnabledSetting = value;
        }
    
        function registerLanguageHandler(modulePath, contents, callback, plugin) {
            if (typeof contents === "function") {
                plugin = callback;
                callback = contents;
                contents = null;
            }
            
            getWorker(function(err, worker) {
                if (err) return console.error("Could not find worker", err);
                
                worker.on("registered", function reply(e) {
                    if (e.data.path !== modulePath)
                        return;
                    worker.removeEventListener(reply);
                    
                    plugin && plugin.on("unload", unregisterLanguageHandler.bind(null, modulePath));
                    
                    callback && callback(e.data.err, createEmitter(modulePath));
                });
                if (modulePath)
                    updateRequireConfig(modulePath, worker);
                worker.call("register", [modulePath, contents]);
            });
        }
    
        function unregisterLanguageHandler(modulePath) {
            getWorker(function(err, worker) {
                if (err) return console.error(err);
                if (!worker.$worker) return; // already destroyed
                worker.call("unregister", [modulePath]);
            });
        }
        
        function createEmitter(modulePath) {
            return {
                on: function(event, listener) {
                    worker.on(modulePath + "/" + event, function(e) {
                        listener(e.data);
                    });
                },
                once: function(event, listener) {
                    worker.once(modulePath + "/" + event, function(e) {
                        listener(e.data);
                    });
                },
                off: function(event, listener) {
                    worker.off(modulePath + "/" + event, listener);
                },
                emit: function(event, data) {
                    worker.emit(modulePath + "/" + event, { data: data });
                }
            };
        }
        
        function updateRequireConfig(modulePath, worker) {
            var config = window.requirejs.getConfig();
            worker.call("updateRequireConfig", [config]);
        }
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
            loaded = false;
            worker.terminate();
            clearTimeout(delayedTransfer);
            delayedTransfer = null;
            lastWorkerMessage = {};
            refreshAllPending = 0;
            isContinuousCompletionEnabledSetting = undefined;
            initedTabs = false;
            ignoredMarkers = undefined;
            drawn = false;
        });
        
        /**
         * The language foundation for Cloud9, controlling language
         * handlers that implement features such as content completion
         * for various languages.
         * 
         * See the Cloud9 SDK documentation for more information.
         * 
         * @singleton
         **/
        plugin.freezePublicAPI({
            /**
             * @ignore
             */
            isEditorSupported: isEditorSupported,

            /**
             * Returns true if the "continuous completion" IDE setting is enabled
             * @ignore
             * @return {Boolean}
             */
            isContinuousCompletionEnabled: isContinuousCompletionEnabled,
            
            /**
             * Sets whether the "continuous completion" IDE setting is enabled
             * @ignore
             * @param {Boolean} value
             */
            setContinuousCompletionEnabled: setContinuousCompletionEnabled,
            
            /**
             * Returns whether type inference for JavaScript is available.
             * @ignore
             */
            isInferAvailable: isInferAvailable,
            
            /**
             * Registers a new language handler in the web worker.
             * Clients should specify a module path where the handler can be loaded.
             * Normally, it can be loaded in the web worker using a regular require(),
             * but if it is not available in the context of the web worker (perhaps
             * because it is hosted elsewhere), clients can also specify a string
             * source for the handler.
             * 
             * @param {String} modulePath      The require path of the handler
             * @param {String} [contents]      The contents of the handler script
             * @param {Function} [callback]    An optional callback called when the handler is initialized
             * @param {String} callback.err    Any error that occured when loading this handler
             * @param {Object} callback.worker The worker object (see {@link #getWorker})
             * @param {Function} callback.worker.emit
             * @param {String} callback.worker.emit.event
             * @param {Object} callback.worker.emit.payload
             * @param {Object} callback.worker.emit.payload.data
             * @param {Plugin} [plugin]        The plugin registering this language handler.
             */
            registerLanguageHandler: registerLanguageHandler,
            
            /**
             * Unregister a language handler
             * @param {String} modulePath
             */
            unregisterLanguageHandler: unregisterLanguageHandler,
            
            /**
             * Gets the current worker, or waits for it to be ready and gets it.
             * 
             * @param {Function} callback                         The callback
             * @param {String} callback.err                       Any error
             * @param {Function} callback.result                  Our result
             * @param {Function} callback.result.on               Event handler for worker events
             * @param {String} callback.result.on.event           Event name
             * @param {Function} callback.result.on.listener      Event listener
             * @param {Function} callback.result.once             One-time event handler for worker events
             * @param {String} callback.result.once.event         Event name
             * @param {Function} callback.result.once.listener    Event listener
             * @param {Object} callback.result.once.listener.data Event data
             * @param {String} callback.result.off.event          Event name
             * @param {Function} callback.result.off.listener     Event listener
             * @param {Function} callback.result.emit             Event emit function for worker
             * @param {String} callback.result.on.event           Event name
             * @param {Object} callback.result.on.data            Event data
             */
            getWorker: getWorker,
            
            /** @ignore */
            onCursorChange: onCursorChange,
            
            /** @ignore */
            getIgnoredMarkers: getIgnoredMarkers,
            
            /**
             * Refresh all language markers in open editors.
             */
            refreshAllMarkers: refreshAllMarkers,

            _events: []
        });
        
        register(null, { language: plugin });
    }
});