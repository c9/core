define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "layout.preload", "c9", "ui", "dialog.alert", "settings",
        "commands", "dialog.question", "anims"
    ];
    main.provides = ["layout"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var commands = imports.commands;
        var alert = imports["dialog.alert"].show;
        var question = imports["dialog.question"];
        var preload = imports["layout.preload"];
        var anims = imports.anims;
        var ui = imports.ui;
        
        var markup = require("text!./layout.xml");
        
        // pre load themes
        require("text!./themes/default-dark.less");
        require("text!./themes/default-dark-gray.less");
        require("text!./themes/default-light-gray.less");
        require("text!./themes/default-light.less");
        require("text!./themes/default-flat-light.less");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var dashboardUrl = options.dashboardUrl || "/dashboard.html";
        
        var logobar, removeTheme, theme;
        var c9console, menus, tabManager, panels;
        var userLayout, ignoreTheme, notify;
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            settings.on("read", function(){
                updateTheme(true);
                
                userLayout = settings.get("user/general/@layout");
                settings.on("user/general", function(){
                    var newlayout = settings.get("user/general/@layout");
                    if (newlayout != userLayout) {
                        userLayout = newlayout;
                        setBaseLayout(userLayout);
                    }
                });
            }, plugin);
            
            settings.on("user/general/@skin", function(){
                !ignoreTheme && updateTheme();
            }, plugin);
            
            plugin.on("newListener", function(type, listener){
                if (type == "eachTheme")
                    listener({});
            }, plugin);
            
            if (!ui.packedThemes) {
                var theme = settings.get("user/general/@skin");
                
                ui.defineLessLibrary(require("text!./themes/default-" + theme + ".less"), plugin);
                ui.defineLessLibrary(require("text!./less/lesshat.less"), plugin);
                
                ui.insertCss(require("text!./keyframes.css")
                  .replace(/@\{image-path\}/g, options.staticPrefix + "/images"), 
                  false, plugin);
                
                ui.insertCss(require("text!./less/main.less"), 
                    options.staticPrefix, plugin);
            }
            
            draw();
        }
        
        var drawn = false;
        function draw(){
            if (drawn) return;
            drawn = true;
            
            // Load the skin
            ui.insertSkin({
                "data"       : require("text!./skins.xml"),
                "media-path" : options.staticPrefix + "/images/",
                "icon-path"  : options.staticPrefix + "/icons/"
            }, plugin);
            
            // Create UI elements
            ui.insertMarkup(null, markup, plugin);
            
            var hboxMain = plugin.getElement("hboxMain");
            var colRight = plugin.getElement("colRight");
            hboxMain.$handle.setAttribute("id", "splitterPanelLeft");
            colRight.parentNode.$handle.setAttribute("id", "splitterPanelRight");
            plugin.addElement(hboxMain.$handle);
            plugin.addElement(colRight.parentNode.$handle);

            // Intentionally global
            window.sbShared = plugin.getElement("sbShared");
            
            // update c9 main logo link
            logobar = plugin.getElement("logobar");
            if (c9.hosted) {
                var mainlogo = logobar.$ext.getElementsByClassName('mainlogo');
                if (mainlogo && (mainlogo = mainlogo[0])) {
                    mainlogo.title = "back to dashboard";
                    mainlogo.href = dashboardUrl;
                    mainlogo.innerHTML = "Dashboard";
                }
            }
            
            // Offline
            // preload the offline images programmatically:
            [
                "noconnection.png", "close_tab_btn.png"
            ].forEach(function(p) {
                var img = new Image();
                img.src = options.staticPrefix + "/images/" + p;
            });
            
            window.addEventListener("resize", resize, false);
            window.addEventListener("focus", resize, false);
            
            plugin.addOther(function(){
                window.removeEventListener("resize", resize, false);
                window.removeEventListener("focus", resize, false);
            });
            
            emit("draw");
        }
        
        var allowedThemes = { 
            "dark": 1, 
            "dark-gray": 1, 
            "light-gray": 1, 
            "light": 1,
            "flat-light": 1 
        };
        
        function updateTheme(noquestion, type) {
            var sTheme = settings.get("user/general/@skin");
            if (!allowedThemes[sTheme])
                sTheme = "dark";
            
            if (noquestion === undefined)
                noquestion = !theme;
            
            var oldTheme = theme;
            
            if (sTheme !== theme) {
                // Set new Theme
                theme = sTheme;
                
                if (ui.packedThemes) {
                    preload.getTheme(theme, function(err, theme) {
                        if (err)
                            return;
                        // Remove Current Theme
                        if (removeTheme)
                            removeTheme();
                        var url = options.staticPrefix.replace(/c9.ide.layout.classic\/?$/, "");
                        theme = theme.replace(/(url\(["']?)\/static\/plugins\//g, function(_, x) {
                            return x + url;
                        });
                        // Load the theme css
                        ui.insertCss(theme, false, {
                            addOther: function(remove){ removeTheme = remove; }
                        });
                        changeTheme();
                    });
                } else
                    changeTheme();
            }
            function changeTheme() {
                if (!oldTheme) return;
                
                emit("eachTheme", { changed: true });
                
                var auto = emit("themeChange", { 
                    theme: theme, 
                    oldTheme: oldTheme,
                    type: type
                }) !== false;
                
                if (noquestion) return;
                
                if (auto)
                    return emit("themeDefaults", { theme: theme, type: type });
                
                question.show("Set default colors?", 
                    "Would you like to reset colors to their default value?",
                    "Plugins like the terminal, the output window and others "
                    + "have default colors based on the main theme. Click Yes to "
                    + "reset the colors to the default colors for this theme.",
                    function(){ // yes
                        emit("themeDefaults", { theme: theme, type: type });
                    },
                    function(){ // no
                    });
            }
        }
        
        function proposeLayoutChange(kind, force, type) {
            if (!force && settings.getBool("user/general/@propose"))
                return;
            
            question.show("Change the Main Cloud9 Theme", 
                "Would you like to change the main theme to a " + kind + " theme?",
                "Click Yes to change the theme or No to keep the current theme.",
                function(){ // yes
                    ignoreTheme = true;
                    settings.set("user/general/@skin", kind);
                    updateTheme(false, type);
                    ignoreTheme = false;
                    settings.set("user/general/@propose", question.dontAsk);
                },
                function(){ // no
                    settings.set("user/general/@propose", question.dontAsk);
                },
                { showDontAsk: true });
        }
        
        /***** Methods *****/
        
        function findParent(obj, where) {
            if (obj.name == "menus") {
                menus = obj;
                return plugin.getElement("logobar");
            }
            if (obj.name == "save") 
                return plugin.getElement("barTools");
            if (obj.name == "run.gui") 
                return plugin.getElement("barTools");
            else if (obj.name == "console") {
                c9console = obj;
                return  plugin.getElement("consoleRow");
            }
            else if (obj.name == "panels") {
                panels = obj;
            }
            else if (obj.name == "tabManager") {
                tabManager = obj;
                return  plugin.getElement("colMiddle");
            }
            else if (obj.name == "area-left")
                return plugin.getElement("colLeft");
            else if (obj.name == "area-right")
                return plugin.getElement("colRight");
            else if (obj.name == "preview")
                return  plugin.getElement("barTools");
            else if (obj.name == "runpanel")
                return  plugin.getElement("barTools");
            else if (obj.name == "vim.cli")
                return  plugin.getElement("searchRow");
            else if (obj.name == "findinfiles")
                return  plugin.getElement("searchRow");
            else if (obj.name == "findreplace")
                return  plugin.getElement("searchRow");
            else if (obj.name == "help")
                return  plugin.getElement("barExtras");
            else if (obj.name == "preferences")
                return  plugin.getElement("barExtras");
            else if (obj.name == "login")
                return  plugin.getElement("barExtras");
            else if (obj.name == "dragdrop")
                return  plugin.getElement("colMiddle");
            else if (obj.name == "dialog.notification") {
                notify = obj.show;
                return  plugin.getElement("barQuestion");
            }
        }
        
        function initMenus(menus) {
            // Menus
            menus.setRootMenu("Cloud9", 50, plugin);
            menus.setRootMenu("File", 100, plugin);
            menus.setRootMenu("Edit", 200, plugin);
            menus.setRootMenu("Find", 300, plugin);
            menus.setRootMenu("View", 400, plugin);
            menus.setRootMenu("Goto", 500, plugin);
            // run plugin adds: menus.setRootMenu("Run", 600, plugin);
            menus.setRootMenu("Tools", 700, plugin);
            menus.setRootMenu("Window", 800, plugin);
            
            var amlNode = menus.get("Cloud9").item;
            if (amlNode && amlNode.$ext)
                amlNode.$ext.className += " c9btn";
            
            menus.addItemByPath("File/~", new apf.divider(), 1000000, plugin);

            if (!c9.local) {
                menus.addItemByPath("Cloud9/~", new apf.divider(), 2000000, plugin);
                menus.addItemByPath("Cloud9/Quit Cloud9", new apf.item({
                    onclick: function(){
                        location.href = "http://c9.io";
                    }
                }), 2000100, plugin);
            }
    
            menus.addItemByPath("View/~", new apf.divider(), 9999, plugin);
            
            menus.addItemByPath("Window/Presets", null, 10200, plugin);
            menus.addItemByPath("Window/Presets/Full IDE", new ui.item({
                onclick: function(){ setBaseLayout("default"); }
            }), 100, plugin);
            menus.addItemByPath("Window/Presets/Minimal Editor", new ui.item({
                onclick: function(){ setBaseLayout("minimal"); }
            }), 200, plugin);
            menus.addItemByPath("Window/Presets/Sublime Mode", new ui.item({
                onclick: function(){ setBaseLayout("sublime"); }
            }), 300, plugin);
        }
        
        function resize(){
            if (c9console && tabManager) {
                var tRect = tabManager.container.$ext.getBoundingClientRect();
                var cRect = c9console.container.$ext.getBoundingClientRect();
                
                if (cRect.top - tRect.top < 30) {
                    c9console.container.setAttribute("height", 
                        Math.max(60, window.innerHeight - tRect.top - 30));
                }
            }
            
            emit("resize");
        }
        
        function setBaseLayout(type) {
            if (type == "sublime") {
                // Hide all side panes
                Object.keys(panels.panels).forEach(function(name) {
                    panels.disablePanel(name, null, name == "tree");
                });
                
                // Hide console
                c9console && c9console.hide();
                
                // Minimize menus
                menus.minimize();
                
                // Active tree
                // setTimeout(function(){
                //     panels.activate("tree");
                // }, 300);
                
                // Set Sublime Like Defaults
                settings.set("user/ace/@cursorStyle", "smooth slim");
                settings.set("user/ace/@theme", "ace/theme/monokai");
                settings.set("user/ace/@keyboardmode", "sublime");
                settings.set("user/general/@preview-tree", true);
                settings.set("user/general/@preview-navigate", true);
                settings.set("user/ace/@wrapBehavioursEnabled", true);
                settings.set("user/language/@overrideMultiselectShortcuts", false);
                settings.set("user/openfiles/@show", true);
            }
            else {
                // Set Cloud9 Defaults
                settings.set("user/ace/@cursorStyle", "ace");
                settings.set("user/ace/@theme", "ace/theme/cloud9_night");
                settings.set("user/ace/@keyboardmode", "default");
                settings.set("user/general/@preview-tree", false);
                settings.set("user/general/@preview-navigate", false);
                settings.set("user/ace/@wrapBehavioursEnabled", false);
                settings.set("user/language/@overrideMultiselectShortcuts", true);
                settings.set("user/openfiles/@show", c9.local);
                
                if (type == "default") {
                    // Hide all side panes
                    Object.keys(panels.panels).forEach(function(name) {
                        panels.enablePanel(name, true);
                    });
                    
                    // Hide console
                    commands.exec("toggleconsole", null, { show: true });
                    
                    // Minimize menus
                    menus.restore();
                    
                    // Active tree
                    panels.activate("tree");
                }
                else if (type == "minimal") {
                    // Hide all side panes
                    Object.keys(panels.panels).forEach(function(name) {
                        panels.disablePanel(name, null, name == "tree");
                    });
                    
                    // Hide console
                    c9console && c9console.hide();
                    
                    // Minimize menus
                    menus.minimize();
                    
                    // Active tree
                    // setTimeout(function(){
                    //     panels.activate("tree");
                    // }, 300);
                }
            }
        }
        
        var activeFindArea, defaultFindArea, activating;
        function setFindArea(amlNode, options, callback) {
            var animate = options.animate;
            if (animate == undefined)
                animate = settings.getBool("user/general/@animateui");
            
            var toHide = activeFindArea || defaultFindArea;
            if (options.isDefault)
                defaultFindArea = amlNode;
            var toShow = amlNode || defaultFindArea;
            activeFindArea = amlNode;
            
            if (toShow == toHide)
                return;
            
            var searchRow = plugin.getElement("searchRow");
            activating = true;
            if (toShow) {
                searchRow.appendChild(toShow);
                toShow.show();
                toShow.$ext.style.overflow = "hidden";
                toShow.$ext.style.height = 
                    toShow.$ext.offsetHeight + "px";
            }
            hide(toHide, function() {
                show(toShow, function() {
                    activating = false;
                    callback && callback();
                });
            });
            
            function show(amlNode, callback) {
                if (!amlNode)
                    return callback();

                anims.animateSplitBoxNode(amlNode, {
                    height: amlNode.$ext.scrollHeight + "px",
                    duration: 0.2,
                    timingFunction: "cubic-bezier(.10, .10, .25, .90)"
                }, function() {
                    amlNode.$ext.style.height = "";
                    ui.layout.forceResize(null, true);
                    callback && callback();
                });
            }
            function hide(amlNode, callback) {
                if (!amlNode)
                    return callback();
                
                amlNode.visible = false;
                amlNode.$ext.style.height
                    = amlNode.$ext.offsetHeight + "px";
                
                if (animate) {
                    anims.animateSplitBoxNode(amlNode, {
                        height: "0px",
                        duration: 0.2,
                        timingFunction: "ease-in-out"
                    }, function(){
                        amlNode.visible = true;
                        amlNode.hide();
                        if (amlNode.parentNode)
                            amlNode.parentNode.removeChild(amlNode);
    
                        callback && callback();
                    });
                }
                else {
                    amlNode.visible = true;
                    amlNode.setHeight(0);
                    amlNode.hide();
                    amlNode.parentNode.removeChild(amlNode);
                    callback && callback();
                }
            }
        }
        
        var hideFlagUpdate;
        function flagUpdate(callback) {
            if (hideFlagUpdate) return;
            
            hideFlagUpdate = notify("<div class='c9-update'>A new version of "
                + "Cloud9 is available. Click this bar to update to the new "
                + "version (requires a restart).</div>", true);
            
            document.querySelector(".c9-update").addEventListener("click", function(){
                hideFlagUpdate();
                hideFlagUpdate = null;
                callback();
            }, false);
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("enable", function(){
            
        });
        plugin.on("disable", function(){
            
        });
        plugin.on("unload", function(){
            loaded = false;
            window.removeEventListener("resize", resize);
            
            if (removeTheme) removeTheme();
            
            logobar = null;
            removeTheme = null;
            theme = null;
            c9console = null;
            menus = null;
            tabManager = null;
            panels = null;
            userLayout = null;
            ignoreTheme = null;
            notify = null;
            hideFlagUpdate = null;
            activeFindArea = null;
            defaultFindArea = null;
            activating = null;
        });
        
        /***** Register and define API *****/
        
        /**
         * Manages the layout of the Cloud9 UI. 
         * 
         * If you wish to build your own IDE, with a completely different 
         * layout (for instance for a tablet or phone) reimplement this plugin.
         * This plugin is capable of telling plugins where to render.
         * 
         * The layout plugin also provides a way to display error messages to
         * the user.
         * 
         * @singleton
         **/
        plugin.freezePublicAPI({
            get maxConsoleHeight(){
                var tRect = tabManager.container.$ext.getBoundingClientRect();
                return window.innerHeight - tRect.top - 30;
            },
            
            get theme(){
                return theme;
            },
            
            /**
             * Returns an AMLElement that can server as a parent.
             * @param {Plugin} plugin  The plugin for which to find the parent.
             * @param {String} where   Additional modifier to influence the decision of the layout manager.
             * @return {AMLElement}
             */
            findParent: findParent,
            
            /**
             * Initializes the main menus
             * This method is called by the menus plugin.
             * @private
             */
            initMenus: initMenus,
            
            /**
             * Sets the layout in one of two default modes:
             * @param {"default"|"minimal"} type 
             */
            setBaseLayout: setBaseLayout,
            
            /**
             * 
             */
            setFindArea: setFindArea,
            
            /**
             * 
             */
            proposeLayoutChange: proposeLayoutChange,
            
            /**
             * 
             */
            flagUpdate: flagUpdate
        });
        
        register(null, {
            layout: plugin
        });
    }
});