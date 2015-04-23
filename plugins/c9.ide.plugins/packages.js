define(function(require, exports, module) {
    main.consumes = [
        "Editor", "editors", "ui", "commands", "menus", "layout", 
        "tabManager", "util", "settings", "api", "c9"
    ];
    main.provides = ["plugin.packages"];
    return main;
    
    function main(options, imports, register) {
        var Editor = imports.Editor;
        var editors = imports.editors;
        var tabs = imports.tabManager;
        var commands = imports.commands;
        var settings = imports.settings;
        var api = imports.api;
        var c9 = imports.c9;
        var menus = imports.menus;
        var util = imports.util;
        var layout = imports.layout;
        var ui = imports.ui;
        
        /***** Initialization *****/
        
        var extensions = [];
        var packages = {};
        
        var handle = editors.register("plugin.packages", "Package Browser", 
                                      PackageBrowser, extensions);
        var emit = handle.getEmitter();
        emit.setMaxListeners(1000);
        
        var HASSDK = c9.location.indexOf("sdk=0") === -1;
        
        function focusOpenPackages(){
            var pages = tabs.getTabs();
            for (var i = 0, tab = pages[i]; tab; tab = pages[i++]) {
                if (tab.editorType == "plugin.packages") {
                    tabs.focusTab(tab);
                    return true;
                }
            }
        }
        
        handle.on("load", function(){
            if (!HASSDK) return;
            
            settings.on("read", function(){
                settings.setDefaults("user/general", [["animateui", true]]);
            });
            
            commands.addCommand({
                name: "openpackagebrowser",
                hint: "open the package browser",
                group: "General",
                // bindKey: { mac: "Command-,", win: "Ctrl-," },
                exec: function () {
                    var tab = tabs.focussedTab;
                    if (tab && tab.editor.type == "plugin.packages") {
                        tab.close();
                        return;
                    }
                    if (focusOpenPackages())
                        return;
    
                    tabs.open({
                        editorType: "plugin.packages",
                        active: true
                    }, function(){});
                }
            }, handle);
            
            menus.addItemByPath("Cloud9/~", new ui.divider(), 1000, handle);
            menus.addItemByPath("Cloud9/Package Browser", new ui.item({
                command: "openpackagebrowser"
            }), 1100, handle);
        });
        
        /***** Methods *****/
        
        function installPlugin(name, target, callback){
            var config = packages[name];
            if (!config) 
                return callback(new Error("Could not find plugin: " + name));
            
            if (target != "project" && target != "user")
                return callback(new Error("Invalid installation target: " + target));
                
            api[target].put("install/" + name, function(err, state){
                callback(err);
            });
        }
        
        function uninstallPlugin(name, target, callback){
            var config = packages[name];
            if (!config) 
                return callback(new Error("Could not find plugin: " + name));
            
            if (target != "project" && target != "user")
                return callback(new Error("Invalid installation target: " + target));
                
            api[target].put("uninstall/" + name, function(err, state){
                callback(err);
            });
        }
        
        /***** Register and define API *****/
        
        /**
         * 
         * @extends Plugin
         * @singleton
         */
        handle.freezePublicAPI({
            /**
             * 
             */
            installPlugin: installPlugin,
            
            /**
             * 
             */
            uninstallPlugin: uninstallPlugin
        });
        
        /***** Editor *****/
        
        function PackageBrowser(){
            var plugin = new Editor("Ajax.org", main.consumes, extensions);
            //var emit = plugin.getEmitter();
            var tab, iframe;
            
            plugin.on("resize", function(e) {
                emit("resize", e);
            });
            
            plugin.on("draw", function(e) {
                tab = e.tab;
                var htmlNode = e.htmlNode;
                
                iframe = htmlNode.appendChild(document.createElement("iframe"));
                iframe.style.position = "absolute";
                iframe.style.top = 0;
                iframe.style.left = 0;
                iframe.style.width = "100%";
                iframe.style.height = "100%";
                iframe.style.border = 0;
                
                iframe.src = location.origin + "/profile/packages?nobar=1&pid=" + c9.projectId;
            });
            
            plugin.on("getState", function(e) {
            });
            plugin.on("setState", function(e) {
            });
            
            /***** Lifecycle *****/
            
            plugin.on("documentLoad", function(e) {
                var doc = e.doc;
                doc.title = "Package Browser";
                
                function setTheme(){
                    // var bg = ui.getStyleRule(".bar-preferences .container .header", "backgroundColor") || "#F0F0F0";
                    var bg = "#FFF";
                    doc.tab.backgroundColor = bg; //"#2d2d2d";
                    
                    if (util.shadeColor(bg, 1).isLight)
                        doc.tab.classList.remove("dark");
                    else
                        doc.tab.classList.add("dark");
                }
                
                layout.on("themeChange", setTheme, e.doc);
                setTheme();
            });
            
            plugin.on("documentActivate", function(e) {
                e.doc.tab.on("unload", function(){
                    if (parent.parentNode == tab)
                        tab.removeChild(parent);
                });
                
                tab.appendChild(parent);
                
                emit("show");
            });
            
            /***** Register and define API *****/
            
            /**
             * 
             * @extends Editor
             */
            plugin.freezePublicAPI({
                
            });
            
            plugin.load(null, "plugin.packages");
            
            return plugin;
        }
        
        register(null, {
            "plugin.packages": handle
        });
    }
});