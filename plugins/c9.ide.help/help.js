define(function(require, exports, module) {
    main.consumes = ["Plugin", "c9", "menus", "layout", "ui", "http"];
    main.provides = ["help"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var Plugin = imports.Plugin;
        var http = imports.http;
        var ui = imports.ui;
        var menus = imports.menus;
        
        var markup = require("text!./help.xml");
        var css = require("text!./style.css");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var aboutDialog;
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            var mnuHelp = new ui.menu();
            menus.addItemByPath("Support/", mnuHelp, 900, plugin);
            
            // var parent = layout.findParent(plugin);
            // ui.insertByIndex(parent, menus.get("Help").item, 500, plugin);
            // ui.insertByIndex(parent, new ui.divider({ 
            //     skin    : "c9-divider-double", 
            //     "class" : "extrasdivider" 
            // }), 810, plugin);
            
            menus.addItemByPath("Cloud9/About Cloud9", new ui.item({ 
                onclick: function(){ showAbout(); }
            }), 100, plugin);

            var c = 0;
            menus.addItemByPath("Support/Status Page", new ui.item({ 
                onclick: function(){window.open('http://status.c9.io'); }
            }), c += 100, plugin);

            // menus.addItemByPath("Support/~", new ui.divider(), c += 100, plugin);
            // ide.addEventListener("hook.ext/keybindings_default/keybindings_default", function(c, e) {
            //     menus.addItemByPath("Support/Keyboard Shortcuts", new ui.item({ onclick : function(){ e.ext.keybindings(); }}), c);
            // }.bind(this, c += 100), plugin);
            menus.addItemByPath("Support/~", new ui.divider(), c += 100, plugin);

            menus.addItemByPath("Support/Learning/", null, c += 100, plugin);
            menus.addItemByPath("Support/Get Help/", null, c += 100, plugin);
            menus.addItemByPath("Support/Get in Touch/", null, c += 100, plugin);

            c = 0;
            menus.addItemByPath("Support/Learning/Cloud9 Documentation", new ui.item({ 
                onclick: function(){ 
                    window.open("https://docs.c9.io"); 
                }
            }), c += 100, plugin);
            menus.addItemByPath("Support/Learning/YouTube Channel for Cloud9", new ui.item({ 
                onclick: function(){ 
                    window.open('http://www.youtube.com/user/c9ide/videos?view=pl'); 
                }
            }), c += 100, plugin);

            c = 0;
            menus.addItemByPath("Support/Get in Touch/Blog", new ui.item({ 
                onclick: function(){ window.open('https://blog.c9.io/'); }
            }), c += 100, plugin);
            menus.addItemByPath("Support/Get in Touch/Twitter (for Cloud9 Support)", new ui.item({ 
                onclick: function(){ window.open('https://twitter.com/C9Support'); }
            }), c += 100, plugin);
            menus.addItemByPath("Support/Get in Touch/Twitter (for general Cloud9 tweets)", new ui.item({ 
                onclick: function(){ window.open('https://twitter.com/Cloud9IDE'); }
            }), c += 100, plugin);
            menus.addItemByPath("Support/Get in Touch/Facebook", new ui.item({ 
                onclick: function(){ window.open('https://www.facebook.com/Cloud9IDE'); }
            }), c += 100, plugin);

            if (c9.hosted || c9.local) {
                c9.on("state.change", fetchBlog);
                fetchBlog();
            }
            
            var fetched = false;
            function fetchBlog() {
                if (fetched || !c9.has(c9.NETWORK))
                    return;
    
                fetched = true;
                var blogURL = "https://c9.io/site/?json=get_tag_posts&tag_slug=changelog&count=1";
    
                http.jsonP(blogURL, function(jsonBlog) {
                    if (!jsonBlog) return;
                    
                    var latestDate = "";
                    try {
                        // date format is 2012-11-06 21:41:07; convert it to something better lookin'
                        latestDate = " (" + jsonBlog.posts[0].date.split(" ")[0].replace(/-/g, ".") + ")";
                    } catch (e) {
                        console.error("Changelog JSON parse failed: " + e);
                    }
    
                });
            }
        }
        
        var drawn = false;
        function draw(){
            if (drawn) return;
            drawn = true;
            
            // Import Skin
            ui.insertSkin({
                name: "help-skin",
                data: require("text!./skin.xml"),
                "media-path" : options.staticPrefix + "/images/",
                "icon-path"  : options.staticPrefix + "/icons/"
            }, plugin);
            
            // Import CSS
            ui.insertCss(css, options.staticPrefix, plugin);
            
            // Create UI elements
            ui.insertMarkup(null, markup, plugin);
            
            aboutDialog = plugin.getElement("aboutDialog");
        
            emit("draw");
        }
        
        /***** Methods *****/
        
        function showAbout() {
            draw();
            
            aboutDialog.show();
            // shorten commit hash in c9.version
            var version = c9.version.replace(/([a-f\d]{10})[a-f\d]{30}/, "$1");
            document.getElementById("c9Version").innerHTML 
                = ui.escapeXML("Version " + version);
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
            drawn = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Renders the help menu in the top menu bar.
         * @singleton
         **/
        plugin.freezePublicAPI({
            /**
             * Shows Cloud9 about dialog 
             */
            showAbout: showAbout
        });
        
        register(null, {
            help: plugin
        });
    }
});