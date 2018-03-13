define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "c9", "settings", "tabManager", "preferences.experimental", "save", "apf"
    ];
    main.provides = ["autosave"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var apf = imports.apf;
        var save = imports.save;
        var tabs = imports.tabManager;
        var prefs = imports["preferences.experimental"];
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        
        var lang = require("ace/lib/lang");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        var CHANGE_TIMEOUT = options.changeTimeout || 1000;
        var SLOW_CHANGE_TIMEOUT = options.slowChangeTimeout || 30000;
        
        var docChangeTimeout;
        var lastSaveTime = 0;
        var sessionId;
        var autosave;
        var saveWhenIdle;
        
        function load() {
            prefs.add({
                "File": {
                    position: 150,
                    "Save": {
                        position: 100,
                        "Auto-Save Files": {
                            type: "dropdown",
                            position: 100,
                            path: "user/general/@autosave",
                            width: 130,
                            items: [
                               { caption: "Off", value: false },
                               { caption: "On Focus Change", value: "onFocusChange" },
                               { caption: "After Delay", value: "afterDelay" },
                           ],
                        }
                    }
                }
            }, plugin);
            
            settings.setDefaults("user/general", [["autosave", false]]);
            settings.on("read", onSettingChange, plugin);
            settings.on("user/general", onSettingChange, plugin);
            save.on("beforeWarn", function(e) {
                if (autosave && saveTab(e.tab))
                    return false;
            }, plugin);
        }
        
        /***** Helpers *****/
        
        function onSettingChange() {
            autosave = settings.get("user/general/@autosave");
            if (autosave == "off" || autosave == "false")
                autosave = false;
            
            disable();
            if (autosave == "afterDelay")
                enableDelay();
            if (autosave)
                enable();
        }
        
        function enableDelay() {
            saveWhenIdle = lang.delayedCall(function() {
                var tab = tabs.focussedTab;
                var ace = tab && tab.editor && tab.editor.ace;
                if (ace && ace.session && sessionId == ace.session.id) {
                    saveTab(tab);
                }
            });
        }
        
        function enable() {
            apf.on("movefocus", scheduleCheck);
            tabs.on("tabAfterActivate", scheduleCheck, plugin);
            if (saveWhenIdle)
                tabs.on("focusSync", attachToTab, plugin);
            window.addEventListener("blur", scheduleCheck);
        }
        
        function disable() {
            sessionId = null;
            if (saveWhenIdle) {
                saveWhenIdle.cancel();
                saveWhenIdle = null;
            }
            if (docChangeTimeout) {
                clearTimeout(docChangeTimeout);
                docChangeTimeout = null;
            }
            apf.off("movefocus", scheduleCheck);
            tabs.off("tabAfterActivate", scheduleCheck);
            tabs.off("focusSync", attachToTab);
            window.removeEventListener("blur", scheduleCheck);
        }
        
        function attachToTab(e) {
            var ace = e.tab && e.tab.editor && e.tab.editor.ace;
            if (ace)
                ace.on("beforeEndOperation", beforeEndOperation);
        }
        
        function beforeEndOperation(e, ace) {
            if (!saveWhenIdle)
                return ace.off("beforeEndOperation", beforeEndOperation);
            if (!ace.isFocused() && !options.ignoreFocusForTesting)
                return;
            sessionId = ace.session.id;
            if (sessionId && ace.curOp.docChanged && ace.curOp.command.name) {
                var timeout = Math.min(Math.max(CHANGE_TIMEOUT, lastSaveTime || 0), SLOW_CHANGE_TIMEOUT);
                saveWhenIdle.delay(timeout);
            }
        }
        
        function scheduleCheck(e) {
            if (docChangeTimeout) 
                return;
            var tab;
            var fromElement = e.fromElement;
            var toElement = e.toElement;
            if (e.type == "blur") {
                tab = tabs.focussedTab;
            }
            else if (fromElement) {
                var fakePage = fromElement.$fake;
                if (toElement && (toElement == fakePage || fromElement == toElement.$fake)) {
                    fakePage = fromElement.$prevFake || toElement.$prevFake;
                    if (fakePage)
                        return;
                }
                
                tab = fromElement.cloud9tab || fakePage && fakePage.cloud9tab;
                if (!tab || !tab.path)
                    return;
                while (toElement) {
                    if (/window|menu|item/.test(toElement.localName))
                        return;
                    toElement = toElement.parentNode;
                }
            }
            else if (e.lastTab) {
                tab = e.lastTab;
            }
            if (!tab || !tab.path)
                return;
            
            docChangeTimeout = setTimeout(function() {
                docChangeTimeout = null;
                var activeElement = apf.document.activeElement;
                var nodeName = activeElement && activeElement.localName;
                // do nothing if the tab is still focused, or is a clone of the focussed tab
                if (nodeName === "page" && tabs.focussedTab && tabs.focussedTab.path === tab.path)
                    return;
                saveTab(tab);
            });
        }
    
        function saveTab(tab, force) {
            if (!autosave) return;
            
            var doc;
            if (!force && (!tab.path 
              || !(doc = tab.document).changed
              || doc.meta.newfile
              || doc.meta.nofs
              || doc.meta.error
              || doc.meta.$saving
              || doc.meta.preview
              || !doc.hasValue()))
                return;
            
            if (!c9.has(c9.STORAGE)) {
                save.setSavingState(tab, "offline");
                return;
            }

            var t = Date.now();
            save.save(tab, {
                silentsave: true,
                noUi: true,
            }, function() {
                lastSaveTime = t - Date.now();
            });
            
            return true;
        }
    
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            disable();
            autosave = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Implements auto save for Cloud9. When the user enables autosave
         * the contents of files are automatically saved when the editor is blurred
         * @singleton
         **/
        plugin.freezePublicAPI({ });
        
        register(null, {
            autosave: plugin
        });
    }
});