define(function(require, exports, module) {
    main.consumes = [
        "PreferencePanel", "ace", "ui", "configure", "settings", 
        "preferences.experimental"
    ];
    main.provides = ["preferences.themes"];
    return main;
    
    function main(options, imports, register) {
        var PreferencePanel = imports.PreferencePanel;
        var ui = imports.ui;
        var ace = imports.ace;
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
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            function update() {
                if (!drawn) return;
                
                var list = getThemes();
                plugin.form.update([{
                    id: "syntax",
                    items: list
                }]);
            }
            
            ace.on("addTheme", update);
            ace.on("removeTheme", update);
        }
        
        var drawn;
        function draw(e) {
            if (drawn) return;
            drawn = true;
            
            var list = getThemes();
            
            var rb1, rb2, rb3, rb4, rb5, rb6;
            
            var flatThemes = [];
            rb6 = new ui.radiobutton({ 
                group: "theme-color", 
                class: "themepicker", 
                style: "background:#252525;", 
                value: "flat-dark"
            });
            rb5 = new ui.radiobutton({ 
                group: "theme-color", 
                class: "themepicker", 
                style: "background:#dcdbdb;", 
                value: "flat-light"
            });
            if (FLATDARK) flatThemes.push(rb6);
            flatThemes.push(rb5);
            
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
                            new ui.bar({
                                childNodes: flatThemes
                            })
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
                            new ui.bar({
                                childNodes: [
                                    rb1 = new ui.radiobutton({ 
                                        group: "theme-color", 
                                        class: "themepicker", 
                                        style: "background:#252525;", 
                                        value: "dark" 
                                    }),
                                    rb2 = new ui.radiobutton({ 
                                        group: "theme-color", 
                                        class: "themepicker", 
                                        style: "background:#3f3f3f;", 
                                        value: "dark-gray" 
                                    }),
                                    // rb3 = new ui.radiobutton({ 
                                    //     group: "theme-color", 
                                    //     class: "themepicker", 
                                    //     style: "background:#aaa;", 
                                    //     value: "light-gray" 
                                    // }),
                                    // rb4 = new ui.radiobutton({ 
                                    //     group: "theme-color", 
                                    //     class: "themepicker", 
                                    //     style: "background:#dcdbdb;", 
                                    //     value: "light"
                                    // })
                                ]
                            })
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
            
            var change = function(e) {
                settings.set("user/general/@skin", e.value);
            };
            var setTheme = function(e) {
                [rb1, rb2, rb5, rb6].some(function(rb) {
                    if (rb.value == e.value) {
                        rb.select();
                        return true;
                    }
                });
            };
            settings.on("user/general/@skin", setTheme);
            setTheme({ value: settings.get("user/general/@skin") });
            
            rb1.$group.on("afterchange", change);
            
            intro.$int.innerHTML = 
                '<h1>Themes</h1><p>You can also style Cloud9 by editing '
                + ' <a href="javascript:void(0)">your stylesheet</a>.</p>'
                + '<p class="hint">Set all the colors free!</p>';
            
            intro.$int.querySelector("a").onclick = function() { 
                configure.editStylesCss(); 
            };
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