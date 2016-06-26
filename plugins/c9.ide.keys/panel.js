define(function(require, exports, module) {
    main.consumes = [
        "Panel", "ui", "menus", "panels", "commands", "tabManager", "layout",
        "settings"
    ];
    main.provides = ["commands.panel"];
    return main;
    
    function main(options, imports, register) {
        var Panel = imports.Panel;
        var ui = imports.ui;
        var tabs = imports.tabManager;
        var menus = imports.menus;
        var panels = imports.panels;
        var layout = imports.layout;
        var commands = imports.commands;
        var settings = imports.settings;
        
        var markup = require("text!./panel.xml");
        var search = require('../c9.ide.navigate/search');
        var Tree = require("ace_tree/tree");
        var ListData = require("./dataprovider");
        
        /***** Initialization *****/
        
        var plugin = new Panel("Ajax.org", main.consumes, {
            index: options.index || 300,
            caption: "Commands",
            buttonCSSClass: "commands",
            minWidth: 150,
            autohide: true,
            where: options.where || "left"
        });
        // var emit = plugin.getEmitter();
        
        var winCommands, txtFilter, tree, ldSearch;
        var lastSearch;
        
        function load(){
            plugin.setCommand({
                name: "commands",
                hint: "search for a command and execute it",
                bindKey: { mac: "Command-.", win: "Ctrl-." }
            });
            
            panels.on("afterAnimate", function(){
                if (panels.isActive("commands.panel"))
                    tree && tree.resize();
            });
            
            // Menus
            menus.addItemByPath("Goto/Goto Command...", new ui.item({ 
                command: "commands" 
            }), 250, plugin);
        }
        
        var drawn = false;
        function draw(options) {
            if (drawn) return;
            drawn = true;
            
            // Create UI elements
            ui.insertMarkup(options.aml, markup, plugin);
            
            // Import CSS
            ui.insertCss(require("text!./style.css"), plugin);
            
            var treeParent = plugin.getElement("commandsList");
            txtFilter = plugin.getElement("txtFilter");
            winCommands = options.aml;

            // Create the Ace Tree
            tree = new Tree(treeParent.$int);
            ldSearch = new ListData(commands, tabs);
            ldSearch.search = search;
            
            tree.renderer.setScrollMargin(0, 10);

            // @TODO this is probably not sufficient
            layout.on("resize", function(){ tree.resize() }, plugin);
            
            var key = commands.getPrettyHotkey("commands");
            txtFilter.setAttribute("initial-message", key);
            
            tree.textInput = txtFilter.ace.textInput;
            
            txtFilter.ace.commands.addCommands([
                {
                    bindKey: "ESC",
                    exec: function(){ plugin.hide(); }
                }, {
                    bindKey: "Enter",
                    exec: function(){ execCommand(true); }
                }, {
                    bindKey: "Shift-Enter",
                    exec: function(){ execCommand(false, true); }
                }
            ]);
            function forwardToTree() {
                tree.execCommand(this.name);
            }
            txtFilter.ace.commands.addCommands([
                "centerselection",
                "goToStart",
                "goToEnd",
                "pageup",
                "gotopageup",
                "scrollup",
                "scrolldown",
                "goUp",
                "goDown",
                "selectUp",
                "selectDown",
                "selectMoreUp",
                "selectMoreDown"
            ].map(function(name) {
                var command = tree.commands.byName[name];
                return {
                    name: command.name,
                    bindKey: command.editorKey || command.bindKey,
                    exec: forwardToTree
                };
            }));
            
            tree.on("click", function(ev) {
                var e = ev.domEvent;
                if (!e.shiftKey && !e.metaKey  && !e.ctrlKey  && !e.altKey)
                if (tree.selection.getSelectedNodes().length === 1)
                    execCommand(true);
            });
            
            txtFilter.ace.on("input", function(e) {
                var val = txtFilter.getValue();
                filter(val);
                settings.set("state/commandPanel/@value", val);
            });
            
            function onblur(e) {
                if (!winCommands.visible)
                    return;
                
                var to = e.toElement;
                if (!to || apf.isChildOf(winCommands, to, true))
                    return;
                
                // TODO add better support for overlay panels
                setTimeout(function(){ plugin.hide() }, 10);
            }
    
            apf.addEventListener("movefocus", onblur);
    
            // Focus the input field
            setTimeout(function(){
                txtFilter.focus();
            }, 10);
            
            setTimeout(function(){
                // Assign the dataprovider
                tree.setDataProvider(ldSearch);
                tree.selection.$wrapAround = true;
                var val = settings.get("state/commandPanel/@value");
                if (val)
                    txtFilter.ace.setValue(val);
            }, 200);
        }
        
        /***** Methods *****/
    
        /**
         * Searches through the dataset
         *
         */
        function filter(keyword, nosel) {
            keyword = keyword.replace(/\*/g, "");
    
            // Needed for highlighting
            ldSearch.keyword = keyword;
            
            var names = Object.keys(commands.commands);
            
            var searchResults;
            if (!keyword) {
                searchResults = names;
            }
            else {
                tree.provider.setScrollTop(0);
                searchResults = search.fileSearch(names, keyword);
            }
    
            lastSearch = keyword;
    
            if (searchResults)
                ldSearch.updateData(searchResults);
                
            if (nosel || !searchResults.length)
                return;
    
            // select the first item in the list
            tree.select(tree.provider.getNodeAtIndex(0));
        }
        
        function execCommand(noanim, nohide) {
            var nodes = tree.selection.getSelectedNodes();
            // var cursor = tree.selection.getCursor();
    
            nohide || plugin.hide();
            
            for (var i = 0, l = nodes.length; i < l; i++) {
                var name = nodes[i].id;
                commands.exec(name);
            }
        }

        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("draw", function(e) {
            draw(e);
        });
        plugin.on("enable", function(){
            
        });
        plugin.on("disable", function(){
            
        });
        plugin.on("show", function(e) {
            txtFilter.focus();
            txtFilter.select();
        });
        plugin.on("hide", function(e) {
            // Cancel Preview
            tabs.preview({ cancel: true });
        });
        plugin.on("unload", function(){
            drawn = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Commands panel. Allows a user to find and execute commands by searching
         * for a fuzzy string that matches the name of the command.
         * @singleton
         * @extends Panel
         **/
        /**
         * @command commands
         */
        /**
         * Fires when the commands panel shows
         * @event showPanelCommand.panel
         * @member panels
         */
        /**
         * Fires when the commmands panel hides
         * @event hidePanelCommands.panel
         * @member panels
         */
        plugin.freezePublicAPI({
            /**
             * @property {Object}  The tree implementation
             * @private
             */
            get tree() { return tree; }
        });
        
        register(null, {
            "commands.panel": plugin
        });
    }
});