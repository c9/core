define(function(require, exports, module) {

    main.consumes = [
        "Plugin", "layout", "app",
        "util", "tabManager", "ace",
    ];
    main.provides = ["theme.jett"];
    return main;

    /**
     * Client-side plugin for jett theme
     * @method main
     * @param {} options
     * @param {} imports
     * @param {} register
     * @return
     */
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var layout = imports.layout;
        var tabs = imports.tabManager;
        var ace = imports.ace;
        var services = imports.app.services;
        
        var escapeHTML = require("ace/lib/lang").escapeHTML;

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        var themeEnabled = false;

        /**
         * Called when plugin is loaded
         * @method load
         * @return
         */
        function load() {
            ace.addTheme({
                caption: "Jett",
                id: "plugins/c9.ide.theme.jett/ace.themes/jett"
            }, plugin);
            layout.addTheme({
                group: "flat",
                color: "rgb(41, 58, 86)",
                name: "jett-dark",
                caption: "Jett Dark",
                defaults: {
                    output: {
                        backgroundColor: "#2b303b",
                        foregroundColor: "#767B85",
                        selectionColor: "#343d46",
                    },
                    
                }
            });

            layout.on("themeChange", function(e) {
                if (e.theme == "jett-dark")
                    enableJett(true);
                else if (themeEnabled)
                    enableJett(false);
            });

            layout.on("themeDefaults", function(e) {
            });
        }

        /**
         * Toggle the jett theme on/off
         * @str an identifiable attribute
         * @method enableJett
         * @param {} enabled If true then jett theme is on
         * @return
         */
        function enableJett(enabled) {
            // Update settings
            themeEnabled = enabled;
            
            // If the jett theme is enabled set some defaults and theme specific prefs
            if (enabled) {
                // Anytime the user switches tabs or themes make sure we have the correct tab colors
                ace.on("themeChange", styleTabs, plugin);
                tabs.on("focusSync", styleTabs, plugin);
                // Set file icon when the tabs are drawn
                tabs.on("tabCreate", onTabCreate, plugin);
                enableFileIcons();
            }
            else {
                ace.off("themeChange", styleTabs, plugin);
                tabs.off("focusSync", styleTabs, plugin);
                tabs.off("tabCreate", onTabCreate, plugin);
            }
            styleTabs();
            // Refresh file icons
            var tree = services.tree && services.tree.tree;
            tree && tree.resize(true);
        }

        function onTabCreate(e) {
            if (themeEnabled && e.tab.title && e.tab.path) {
                setTabIcon(e.tab);
            }
        }
        
        function enableFileIcons() {
            if (enableFileIcons.called)
                return;
            enableFileIcons.called = true;

            /**
             * Add file icons to the file search results
             */
            var navigate = services.navigate;
            navigate && navigate.once("draw", function() {
                var dp = navigate.tree.provider;

                override(dp, 'renderRow', function(original) {
                    return function(row, html, config) {

                        // If jett is not enabled then return
                        if (!themeEnabled) {
                            return original.apply(this, arguments);
                        }

                        var path = dp.visibleItems[row];
                        var isSelected = dp.isSelected(row);
                        var filename = path.substr(path.lastIndexOf("/") + 1);
                        var icon = getIconClass(filename);

                        html.push("<div class='item " + (isSelected ? "selected " : "")
                            + dp.getClassName(row) + "' style='height:" + dp.innerRowHeight + "px'><span class='filetree-icon " + icon + "'>"
                            + dp.replaceStrong(filename) + "</span><small class='path'>" + dp.replaceStrong(path) + "</small></div>");
                    };
                });
            });

            /*
             * Customize file icons on the file tree
             */
            var tree = services.tree;
            tree.once("draw", function(e) {
                override(tree.tree.model, 'getIconHTML', function(original) {
                    return function(node) {
                        // If jett is not enabled then return
                        if (!themeEnabled) {
                            return original.apply(this, arguments);
                        }

                        var icon = node.isFolder ? "folder" : getIconClass(node.label);

                        if (node.status === "loading") icon = "loading";
                        return "<span class='filetree-icon " + icon + "'></span>";
                    };
                });
            });
        }

        /**
         * Helper function to help us extend current cloud9 events
         * @method override
         * @param {} object
         * @param {} methodName
         * @param {} callback
         * @return
         */
        function override(object, methodName, callback) {
            object[methodName] = callback(object[methodName]);
        }

        /**
         * Reusable function to get the CSS class of a file type
         * @method getIconClass
         * @param {} filename
         * @return icon
         */
        function getIconClass(filename) {
            if (!filename) return '';

            // Remove the path if it's a directory string
            filename = filename.split("/").pop();
            // Get the file.extention
            var icon = filename.split(".").pop().toLowerCase();

            filename = filename.toLowerCase();
            if (filename == "package.json") icon = "npm";
            if (filename == "composer.json") icon = "composer";
            if (filename == "bower.json") icon = "bower";
            if (filename == "gulpfile.js") icon = "gulp";
            if (filename == "gruntfile.js") icon = "grunt";

            return icon;
        }


        /***** Methods *****/
        
        /**
         * Active tabs with ACE editor get the same color as the current ACE theme
         * @method styleTab
         * @param {} e
         * @return
         */
        function styleTabs(e) {
            var panes = tabs.getPanes();

            panes.forEach(function(pane) {
                // Add a file icon to the tab if jett is enabled
                pane.getTabs().forEach(function(tab) {
                    setTabIcon(tab);
                    if (themeEnabled && tab.isActive()) {
                        if (ace.theme && ace.theme.bg && ace.theme.fg) {
                            // Color tabs based on their tab.aml.type
                            var colorHash = {
                                "editor::ace": ace.theme.bg,
                                "editor::terminal": "#000",
                                "editor::output": "#000",
                                "editor::preferences": "#25272C",
                                "editor::immediate": "#1C1D21"
                            };
    
                            tab.aml.$button.style.backgroundColor = (colorHash[tab.aml.type] || "iherit");
                            tab.aml.$button.style.color = ace.theme.fg;
                        }
                    }
                    else {
                        tab.aml.$button.style.backgroundColor = '';
                        tab.aml.$button.style.color = '';
                    }
                    
                });
            });
        }

        /**
         * Tabs get file icons!
         * @method setTabIcon
         * @param {} tab
         * @return
         */
        function setTabIcon(tab) {
            if (!tab.path) return;

            var iconHTML = (themeEnabled ? '<span class="filetree-icon '
                + getIconClass(tab.path)
                + '"></span>' : "")
                + escapeHTML(tab.title);
            tab.aml.$button.querySelector(".sessiontab_title").innerHTML = iconHTML;

        }

        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            enableJett(false);
            themeEnabled = false;
        });

        /***** Register and define API *****/

        /**
         *
         **/
        plugin.freezePublicAPI({

        });

        register(null, {
            "theme.jett": plugin
        });

    }
});
