define(function(require, exports, module) {
    main.consumes = [
        "Editor", "editors", "ui", "tabManager", "settings", "Form",
        "commands", "fs", "ace", "layout", "c9", "menus"
    ];
    main.provides = ["welcome"];
    return main;

     /*
        Change Ace Theme
            - Get List from Ace
    */

    function main(options, imports, register) {
        var Editor = imports.Editor;
        var editors = imports.editors;
        var ui = imports.ui;
        var fs = imports.fs;
        var c9 = imports.c9;
        var ace = imports.ace;
        var commands = imports.commands;
        var layout = imports.layout;
        var tabManager = imports.tabManager;
        var settings = imports.settings;
        var Form = imports.Form;
        var menus = imports.menus;

        var join = require("path").join;
        
        /***** Initialization *****/
        
        var handle = editors.register("welcome", "URL Viewer", Welcome, []);
        var intro;
        
        var WELCOME_INTRO = (options.intro || "").replace(/\n/g, "<br />");
        var OS_INTRO = "\n You can now use sudo and apt-get to manage your workspace!";
        
        var defaults = {
            "flat-light": "#F8FDFF", 
            "flat-dark": "#203947",
            "light": "#b7c9d4", 
            "light-gray": "#b7c9d4", 
            "dark": "#203947",
            "dark-gray": "#203947"
        };
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            menus.addItemByPath("Cloud9/Welcome Page", new ui.item({
                onclick: function() { tabManager.openEditor("welcome", true, function() {}); }
            }), 320, handle);

            
            tabManager.once("ready", function() {
                settings.on("read", function(e) {
                    if (e.reset) {
                        settings.set("user/welcome/@first", true);
                        return;
                    }
                    
                    if (!settings.getBool("user/welcome/@first")) {
                        show(function() {
                            settings.set("user/welcome/@first", true);
                        });
                    }
                }, handle);
                
                if (window.location.hash.match(/#openfile-(.*)/)) {
                    var file = "/" + RegExp.$1;
                    fs.exists(file, function(exists) {
                        if (!exists) return;
                        commands.exec("preview", null, {
                            path: file,
                            focus: options.focusOpenFile || false
                        });
                    });
                }
            }, handle);
        }
        
        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;
            
            if (options.checkOS) {
                fs.stat("~/" + c9.projectId, function(err, stat) {
                    if (!err && stat.fullPath == join(c9.home, "workspace")) {
                        if (drawn)
                            intro.innerHTML = WELCOME_INTRO + OS_INTRO;
                        else
                            WELCOME_INTRO += OS_INTRO;
                    }
                });
            }
            
            // Insert CSS
            ui.insertCss(require("text!./style.css"), null, handle);
        }
        
        handle.on("load", load);

        /***** Methods *****/
        
        function search() {
            var found;
            var tabs = tabManager.getTabs();
            tabs.every(function(tab) {
                if (tab.document.meta.welcome) {
                    found = tab;
                    return false;
                }
                return true;
            });
            return found;
        }
        
        function show(cb) {
            var tab = search();
            if (tab)
                return tabManager.focusTab(tab);
            
            tabManager.open({ 
                editorType: "welcome", 
                noanim: true,
                active: true 
            }, cb);
        }
        
        function Welcome() {
            var plugin = new Editor("Ajax.org", main.consumes, []);
            //var emit = plugin.getEmitter();
            
            var container;
            
            plugin.on("draw", function(e) {
                draw();
                
                // Create UI elements
                container = e.htmlNode;
                
                var html = require("text!./welcome.html");
                var nodes = ui.insertHtml(container, html, plugin);
                var node = nodes[0];
                
                intro = node.querySelector(".intro");
                intro.innerHTML = WELCOME_INTRO;
                
                var list = [];
                var themes = ace.themes;
                for (var base in themes) {
                    if (themes[base] instanceof Array)
                        themes[base].forEach(function (n) {
                            var themeprop = Object.keys(n)[0];
                            list.push({ caption: themeprop, value: n[themeprop] });
                        });
                    else
                        list.push({ caption: base, value: themes[base] });
                }
                
                var presetClick = function() {
                    var value = this.id;
                    
                    current.className = "preset";
                    this.className = "preset active";
                    current = this;
                    
                    if (value != "default" && !settings.getBool("user/welcome/@switched")) {
                        setTimeout(function() {
                            var div = container.querySelector(".switched");
                            div.style.display = "block";
                            if (!apf.isMac)
                                div.innerHTML = div.innerHTML.replace(/Command/g, "Ctrl");
                            settings.set("user/welcome/@switched", true);
                        }, 500);
                    }
                    
                    setTimeout(function() {
                        layout.setBaseLayout(value);
                    });
                };
                
                var presets = node.querySelectorAll(".preset");
                var current, preset;
                for (var i = 0; i < presets.length; i++) {
                    if (~(preset = presets[i]).className.indexOf("active"))
                        current = preset;
                    
                    preset.addEventListener("click", presetClick);
                }
                
                var form = new Form({
                    edge: "3 3 8 3",
                    rowheight: 40,
                    colwidth: 150,
                    style: "padding:10px;",
                    form: [
                        {
                            title: "Main Theme",
                            type: "dropdown",
                            path: "user/general/@skin",
                            width: 190,
                            items: [
                                { caption: "Cloud9 Classic Dark Theme", value: "dark" },
                                { caption: "Cloud9 Flat Light Theme", value: "flat-light" }
                                // { caption: "Cloud9 Flat Dark Theme", value: "flat-dark" }
                            ],
                            position: 100
                        },
                        {
                            title: "Split Layout",
                            type: "dropdown",
                            width: 190,
                            defaultValue: "nosplit",
                            onchange: function(e) {
                                commands.exec(e.value);
                            },
                            items: [
                                { caption: "No Split", value: "nosplit" },
                                { caption: "Two Vertical Split", value: "twovsplit" },
                                { caption: "Two Horizontal Split", value: "twohsplit" },
                                { caption: "Four Split", value: "foursplit" },
                                { caption: "Three Split (Left)", value: "threeleft" },
                                { caption: "Three Split (Right)", value: "threeright" }
                            ],
                            position: 150
                        },
                        {
                            title: "Editor (Ace) Theme",
                            type: "dropdown",
                            path: "user/ace/@theme",
                            width: 190,
                            onchange: function(e) {
                                ace.setTheme(e.value);
                            },
                            items: list,
                            position: 180
                        },
                        {
                            title: "Keyboard Mode",
                            type: "dropdown",
                            path: "user/ace/@keyboardmode",
                            width: 190,
                            items: [
                                { caption: "Default", value: "default" },
                                { caption: "Vim", value: "vim" },
                                { caption: "Emacs", value: "emacs" },
                                { caption: "Sublime", value: "sublime" }
                            ],
                            position: 190
                        },
                        {
                            title: "Soft Tabs",
                            type: "checked-spinner",
                            checkboxPath: "project/ace/@useSoftTabs",
                            path: "project/ace/@tabSize",
                            min: "1",
                            max: "64",
                            width: "50",
                            position: 200
                        }
                    ]
                });
                
                form.attachTo(container.querySelector(".configure .form"));
                
                container.querySelector(".configure .more").onclick = function() {
                    commands.exec("openpreferences");
                };
                container.querySelector(".openterminal").onclick = function() {
                    tabManager.openEditor("terminal", true, function() {});
                };
                container.querySelector(".openconsole").onclick = function() {
                    commands.exec("toggleconsole");
                };
                container.querySelector(".newfile").onclick = function() {
                    commands.exec("newfile");
                };
            });
            
            /***** Method *****/
            
            /***** Lifecycle *****/
            
            plugin.on("load", function() {
                
            });
            plugin.on("documentLoad", function(e) {
                var doc = e.doc;
                var tab = doc.tab;
                
                function setTheme(e) {
                    var isDark = e.theme == "dark";
                    var backgroundColor = defaults[e.theme];
                    if (!backgroundColor) return;
                    tab.backgroundColor = backgroundColor;
                    if (isDark) tab.classList.add("dark");
                    else tab.classList.remove("dark");
                }
                
                layout.on("themeChange", setTheme, doc);
                setTheme({ theme: settings.get("user/general/@skin") });
                
                doc.title = "Welcome", 
                doc.meta.welcome = true;
            });
            
            /***** Register and define API *****/
            
            plugin.freezePublicAPI({
                
            });
            
            plugin.load(null, "welcome");
            
            return plugin;
        }
        
        register(null, {
            welcome: handle
        });
    }
});