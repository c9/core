define(function(require, exports, module) {
    main.consumes = [
        "PreferencePanel", "ace", "ui", "configure", "settings", 
        "preferences.experimental", "layout"
    ];
    main.provides = ["preferences.themes"];
    return main;
    
    function main(options, imports, register) {
        var PreferencePanel = imports.PreferencePanel;
        var ui = imports.ui;
        var ace = imports.ace;
        var layout = imports.layout;
        var configure = imports.configure;
        var settings = imports.settings;
        var experimental = imports["preferences.experimental"];
        
        var FLATDARK = experimental.addExperiment("flat-dark", false, "UI/Flat Dark Theme");
        
        /***** Initialization *****/
        
        var plugin = new PreferencePanel("Ajax.org", main.consumes, {
            caption: "Themes",
            className: "flatform",
            form: true,
            noscroll: true,
            colwidth: 150,
            index: 300
        });
        // var emit = plugin.getEmitter();
        
        var intro;
        var themeContainers = {};
        var themes = [];
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            layout.addTheme({
                group: "classic",
                color: "#252525;",
                name: "dark",
                caption: "Classic Dark",
            });
            layout.addTheme({
                group: "classic",
                color: "#3f3f3f;",
                name: "dark-gray",
                caption: "Classic Dark Gray",
            });
            layout.addTheme({
                group: "classic",
                color: "#aaa;", 
                name: "light-gray",
                hidden: !options.lightClassic,
                caption: "Classic Light Gray",
            });
            layout.addTheme({
                group: "classic",
                color: "#dcdbdb;", 
                name: "light",
                hidden: !options.lightClassic,
                caption: "Classic Light",
            });
            layout.addTheme({
                group: "flat",
                color: "#252525;", 
                name: "flat-dark",
                hidden: !FLATDARK,
                caption: "Flat Dark",
            });
            layout.addTheme({
                group: "flat",
                color: "#dcdbdb;", 
                name: "flat-light",
                caption: "Flat Light",
            });
        }
        
        var drawn;
        function draw(e) {
            if (drawn) return;
            drawn = true;
            
            var list = getThemes();

            
            plugin.form.add([
                {
                    type: "custom",
                    title: "Introduction",
                    position: 1,
                    node: intro = new ui.bar({
                        height: 124,
                        "class": "intro",
                        style: "padding:12px;position:relative;"
                    })
                },
                {
                    type: "custom",
                    title: "Flat Theme",
                    position: 1,
                    node: new ui.hsplitbox({
                        height: 49,
                        edge: "10 10 10 10",
                        style: "white-space:nowrap",
                        childNodes: [
                            new ui.label({ 
                                width: 150, 
                                caption: "Flat Theme:", 
                                style: "padding-top:5px" 
                            }),
                            themeContainers.flat = new ui.bar({})
                        ]
                    })
                },
                {
                    type: "custom",
                    title: "Classic Theme",
                    position: 1,
                    node: new ui.hsplitbox({
                        height: 49,
                        edge: "10 10 10 10",
                        style: "white-space:nowrap",
                        childNodes: [
                            new ui.label({ 
                                width: 150, 
                                caption: "Classic Theme:", 
                                style: "padding-top:5px" 
                            }),
                            themeContainers.classic = new ui.bar({})
                        ]
                    })
                },
                {
                    title: "Syntax Theme",
                    type: "dropdown",
                    path: "user/ace/@theme",
                    name: "syntax",
                    width: 165,
                    onchange: function(e) {
                        ace.setTheme(e.value);
                    },
                    items: list,
                    position: 200
                },
            ], plugin);
            
            
            function update() {
                if (!drawn) return;
                
                var list = getThemes();
                plugin.form.update([{
                    id: "syntax",
                    items: list
                }]);
            }
            
            ace.on("addTheme", update, plugin);
            ace.on("removeTheme", update, plugin);
            
            ui.buildDom([
                ["h1", null, "Themes"],
                ["p", null, "You can also style Cloud9 by editing ",
                    ["a", { href: "javascript:void(0)", onclick: function() { configure.editStylesCss(); } },
                        "your stylesheet"]
                ],
                ["p", { class: "hint" }, "Set all the colors free!"]
            ], intro.$int);
            
            
            themeContainers.group = new apf.group();
            
            layout.on("themeAdded", drawThemeSwatches);
            drawThemeSwatches();
            
            var change = function(e) {
                settings.set("user/general/@skin", e.value);
            };
            var setTheme = function(e) {
                [].concat(
                    themeContainers.flat.childNodes,
                    themeContainers.classic.childNodes
                ).some(function(rb) {
                    if (rb.value == e.value) {
                        rb.select();
                        return true;
                    }
                });
            };
            settings.on("user/general/@skin", setTheme, plugin);
            setTheme({ value: settings.get("user/general/@skin") });
            
            themeContainers.group.on("afterchange", change);
        }
        
        /***** Methods *****/

        function getThemes() {
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
            return list;
        }
        
        
        function drawThemeSwatches() {
            var themes = layout.listThemes();
            themeContainers.classic.childNodes.forEach(function(n) {
                n.remove();
            });
            themeContainers.flat.childNodes.forEach(function(n) {
                n.remove();
            });
            
            themes.forEach(function(theme) {
                if (theme.hidden) return;
                var container = theme.group == "flat" ? themeContainers.flat : themeContainers.classic;
                container.appendChild(
                    new ui.radiobutton({
                        group: themeContainers.group, 
                        class: "themepicker", 
                        style: "background:" + theme.color, 
                        value: theme.name,
                        tooltip: theme.name,
                    })
                );
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("draw", function(e) {
            draw(e);
        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
            intro = null;
            themeContainers = {};
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            
        });
        
        register(null, { 
            "preferences.themes": plugin 
        });
    }
});