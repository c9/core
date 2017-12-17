define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "c9", "settings", "tabManager", "preferences", "save", "apf"
    ];
    main.provides = ["autosave"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var apf = imports.apf;
        var save = imports.save;
        var tabs = imports.tabManager;
        var prefs = imports.preferences;
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        var CHANGE_TIMEOUT = 500;
        var SLOW_CHANGE_TIMEOUT = options.slowChangeTimeout || 30000;
        var SLOW_SAVE_THRESHOLD = 100 * 1024; // 100KB
        
        var docChangeTimeout;
        var autosave;
        
        function load() {
            prefs.add({
                "File": {
                    position: 150,
                    "Save": {
                        position: 100,
                        "Enable Auto-Save On Blur": {
                            type: "checkbox",
                            position: 100,
                            path: "user/general/@autosave"
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
            autosave = settings.getBool("user/general/@autosave");
            if (autosave)
                enable();
            else
                disable();
        }
        
        function enable() {
            apf.on("movefocus", scheduleCheck);
            tabs.on("tabAfterActivate", scheduleCheck, plugin);
            window.addEventListener("blur", scheduleCheck);
        }
        
        function disable() {
            apf.off("movefocus", scheduleCheck);
            tabs.off("tabAfterActivate", scheduleCheck);
            window.removeEventListener("blur", scheduleCheck);
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
            
            if (!c9.has(c9.STORAGE)) {
                save.setSavingState(tab, "offline");
                return;
            }
            
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

            save.save(tab, {
                silentsave: true,
            }, function() {});
            
            return true;
        }
    
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            window.removeEventListener("blur", scheduleCheck);
            autosave = false;
            if (docChangeTimeout) {
                clearTimeout(docChangeTimeout);
                docChangeTimeout = null;
            }
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