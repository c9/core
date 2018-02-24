define(function(require, exports, module) {
    main.consumes = ["Plugin", "c9", "menus", "layout", "ui", "http", "c9.analytics"];
    main.provides = ["help"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var Plugin = imports.Plugin;
        var http = imports.http;
        var ui = imports.ui;
        var menus = imports.menus;
        var analytics = imports["c9.analytics"];
        
        var markup = require("text!./help.xml");
        var css = require("text!./style.css");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var aboutDialog;
        
        function load() {
            menus.addItemByPath("Cloud9/About Cloud9", new ui.item({ 
                onclick: function() { showAbout(); }
            }), 100, plugin);
            
            if (!options.hosted) return;
            
            var mnuHelp = new ui.menu();
            menus.addItemByPath("Support/", mnuHelp, 900, plugin);
            
            // var parent = layout.findParent(plugin);
            // ui.insertByIndex(parent, menus.get("Help").item, 500, plugin);
            // ui.insertByIndex(parent, new ui.divider({ 
            //     skin    : "c9-divider-double", 
            //     "class" : "extrasdivider" 
            // }), 810, plugin);
            
            var c = 0;
            menus.addItemByPath("Support/Check Cloud9 Status", new ui.item({ 
                onclick: function() {window.open('http://status.c9.io'); }
            }), c += 100, plugin);

            menus.addItemByPath("Support/~", new ui.divider(), c += 100, plugin);

            menus.addItemByPath("Support/Get Help (Community)", new ui.item({ 
                onclick: function() { 
                    analytics.track("Visited Cloud9 Community");
                    window.open("https://community.c9.io"); 
                }
            }), c += 100, plugin);
            
            menus.addItemByPath("Support/~", new ui.divider(), c += 300, plugin);
            
            menus.addItemByPath("Support/Read Documentation", new ui.item({ 
                onclick: function() { 
                    window.open("https://docs.c9.io/docs"); 
                }
            }), c += 100, plugin);
            menus.addItemByPath("Support/Request a Feature", new ui.item({
                onclick: function() {
                    // draw();
                    window.open('https://community.c9.io/c/feature-requests');
                }
            }), c += 100, plugin);
            menus.addItemByPath("Support/Go To YouTube Channel", new ui.item({ 
                onclick: function() { 
                    window.open('http://www.youtube.com/user/c9ide/videos?view=pl'); 
                }
            }), c += 100, plugin);

            c = 0;

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
        function draw() {
            if (drawn) return;
            drawn = true;
            
            // Import Skin
            ui.insertSkin({
                name: "help-skin",
                data: require("text!./skin.xml"),
            }, plugin);
            
            // Import CSS
            ui.insertCss(css, null, plugin);
            
            // Create UI elements
            ui.insertMarkup(null, markup.replace(/{YEAR}/g, new Date().getFullYear()), plugin);
            
            aboutDialog = plugin.getElement("aboutDialog");
        
            emit("draw");
        }
        
        /***** Methods *****/
        
        function showAbout() {
            draw();
            
            aboutDialog.show();
            // shorten commit hash in c9.version
            var version = c9.version.replace(/([a-f\d]{10})[a-f\d]{30}/, "$1");
            document.getElementById("c9Version").textContent = "Version " + version;
        }

        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
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