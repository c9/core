define(function(require, exports, module) {
    main.consumes = [
        "Editor", "editors", "ui", "commands", "menus", "layout", 
        "tabManager", "util", "settings", "api", "c9"
    ];
    main.provides = ["plugin.market"];
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
        
        var handle = editors.register("plugin.market", "Market Place", 
                                      MarketPlace, extensions);
        var emit = handle.getEmitter();
        emit.setMaxListeners(1000);
        
        var HASSDK = c9.location.indexOf("sdk=1") > -1;
        
        function focusOpenMarket(){
            var pages = tabs.getTabs();
            for (var i = 0, tab = pages[i]; tab; tab = pages[i++]) {
                if (tab.editorType == "plugin.market") {
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
                name: "openmarketplace",
                hint: "open the market place",
                group: "General",
                // bindKey: { mac: "Command-,", win: "Ctrl-," },
                exec: function () {
                    var tab = tabs.focussedTab;
                    if (tab && tab.editor.type == "plugin.market") {
                        tab.close();
                        return;
                    }
                    if (focusOpenMarket())
                        return;
    
                    tabs.open({
                        editorType: "plugin.market",
                        active: true
                    }, function(){});
                }
            }, handle);
            
            menus.addItemByPath("Cloud9/Plugin Store", new ui.item({
                command: "openmarketplace"
            }), 301, handle);
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
        
        function MarketPlace(){
            var plugin = new Editor("Ajax.org", main.consumes, extensions);
            //var emit = plugin.getEmitter();
            var tab;
            
            plugin.on("resize", function(e) {
                emit("resize", e);
            });
            
            plugin.on("draw", function(e) {
                tab = e.tab;
                var htmlNode = e.htmlNode;
                
                api.packages.get("", function(err, list){
                    if (c9.standalone) {
                        err = null;
                        list = [{ name: "example", apikey:"0000000000000000000000000000=", packagePath: "plugins/c9.example/example" }];
                    }
                    
                    if (err) return;
                    
                    var sHtml = "";
                    list.forEach(function(plugin){ // @todo use react instead in an iframe
                        packages[plugin.name] = plugin;
                    
                        sHtml += "<div>"
                            + "<span>" + plugin.name + "</span> | "
                            + "<a href='javascript:void(0)' plugin-name='" + plugin.name + "' target='project'>Install In Workspace</a> | "
                            + "<a href='javascript:void(0)' plugin-name='" + plugin.name + "' target='user'>Install To User</a>"
                            + "</div>";
                    });
                    
                    htmlNode.innerHTML = sHtml;
                    htmlNode.addEventListener("click", function(e){
                        if (e.target.tagName == "A") {
                            installPlugin(e.target.getAttribute("plugin-name"), 
                                e.target.getAttribute("target"), function(){});
                        }
                    });
                });
            });
            
            plugin.on("getState", function(e) {
            });
            plugin.on("setState", function(e) {
            });
            
            /***** Lifecycle *****/
            
            plugin.on("documentLoad", function(e) {
                var doc = e.doc;
                doc.title = "Plugin Store";
                
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
            
            plugin.load(null, "plugin.market");
            
            return plugin;
        }
        
        register(null, {
            "plugin.market": handle
        });
    }
});