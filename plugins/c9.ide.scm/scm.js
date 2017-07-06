define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "Menu", "MenuItem", "Divider", "settings", "ui", "c9", 
        "watcher", "panels", "util", "save", "preferences", "commands", "Tree",
        "Datagrid", "tabManager", "layout", "preferences.experimental"
    ];
    main.provides = ["scm"];
    return main;
    
    /*
        LEGEND:
            * = done (item should be removed)
            / = half done
            - = not done
    
        # LOW HANGING FRUIT 
            - conflicts
                - save
            - tree
                - add watcher to .git/HEAD
            - fix errors with added/removed files
        
        # TODO
            - commit
                - do dry-run 
                    - add status message for ammend 
                    - display branch to commit to 
                - amend doesnt work
            - pull
                - pull --rebase
            - detail    
                - afterChoose should stage/unstage files instead of opening diff view
                - drag to staged doesnt work sometimes (rowheight issue?)
            - conflicts
                - add commands? detect, next, prev, use 1/ 2 
            - branches
                - Harutyun: Resize properly when expanding/collapsing
                - Harutyun: scrollMargin for left, right and bottom doesn't work (same for log, detail)
                - Use icon
            - log
                - Setting indent to 0 doesn't work
                - Remove arrow in title
            - add discard changes to context menu
            - resize issues
            - hotkeys should show bars in dialog
            - conflicts
                - dark theme (Ruben)
            - toolbar
                / pull (or fetch - split button
                    / add fetch dialog (Ruben)
                        / dropdown for remotes
                        - output
                    - Merge doesn't work (no UI for merge message)
                    - Handle error states
                    - Change to splitbutton with form only shown on arrow
                    - reload of log doesn't work after pull
                / push button - split button
                    / add push dialog (Ruben) 
                        / dropdown for remotes/branches
                        - output
                    - Handle error states
                    - Change to splitbutton with form only shown on arrow
                    - reload of log doesn't work after push
        
        # LATER
            # Ruben
                - Choose Git Path - use file dialog
                    - support multiple git roots
                - Add setting to collapse tree to only see roots
            - tree
                - solve edge line cases
            - Compare view
                - save the right file (use ace session clone)
                - git add the left file 
                - undo doesn't work 
                - scrolling doesn't work well. It should scroll the sides as 
                    slowly as the side with most lines would go when scrolling there
            - conflicts
                - automatically add to staging on save
                - dialog for one deleted and one saved file 
                - undo
            - branches
                - When updating, only do a partial update (maintain selection, expanded state - see test/data/data.js)
                - make a datagrid?
    */
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var Tree = imports.Tree;
        var Menu = imports.Menu;
        var Datagrid = imports.Datagrid;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        var settings = imports.settings;
        var ui = imports.ui;
        var c9 = imports.c9;
        var tabManager = imports.tabManager;
        var watcher = imports.watcher;
        var panels = imports.panels;
        var util = imports.util;
        var save = imports.save;
        var layout = imports.layout;
        var prefs = imports.preferences;
        var commands = imports.commands;
        var experimental = imports["preferences.experimental"];
        
        // var Tooltip = require("ace_tree/tooltip");
        var DataProvider = require("ace_tree/data_provider");
        var escapeHTML = require("ace/lib/lang").escapeHTML;
        
        /***** Initialization *****/
        
        var ENABLED = experimental.addExperiment("git", !c9.hosted, "Panels/Source Control Management");
        if (!ENABLED)
            return register(null, { "scm": { on: function() {} }});
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var scms = {};
        var scm;
        
        var workspaceDir = c9.workspaceDir; // + "/plugins/c9.ide.scm/mock/git";
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            commands.addCommand({
                name: "blame",
                group: "scm",
                exec: function() {
                    var tab = tabManager.focussedTab || tabManager.getPanes()[0].activeTab;
                    if (!tab || !tab.path || tab.editorType != "ace")
                        return;
                    var blameAnnotation, err, data;
                    var ace = tab.editor.ace;
                    var session = ace.session;
                    require(["./blame"], function(blameModule) {
                        if (ace.session != session)
                            return;
                        blameAnnotation = blameModule.annotate(ace);
                        done();
                    });
                    
                    var path = tab.path;
                    scm.getBlame(path, function(err, blameInfo) {
                        if (err) return console.error(err);
                        data = blameInfo;
                        done();
                    });
                    
                    function done() {
                        if (!blameAnnotation) return;
                        if (data === null) return;
                        
                        blameAnnotation.setData(data);
                    }
                },
                isAvailable: function() {
                    var tab = tabManager.focussedTab || tabManager.getPanes()[0].activeTab;
                    if (!tab || !tab.path || tab.editorType != "ace")
                        return false;
                    return true;
                }
            }, plugin);
            
            // commands.addCommand({
            //     name: "addall",
            //     group: "scm",
            //     exec: function(){ addAll(); }
            // }, plugin);
            
            // commands.addCommand({
            //     name: "unstageall",
            //     group: "scm",
            //     exec: function(){ unstageAll(); }
            // }, plugin);
            
            // commands.addCommand({
            //     name: "fetch",
            //     group: "scm",
            //     exec: function(){ fetch(); }
            // }, plugin);
            
            // commands.addCommand({
            //     name: "push",
            //     group: "scm",
            //     exec: function(){ push({}); }
            // }, plugin);
            
            // commands.addCommand({
            //     name: "pull",
            //     group: "scm",
            //     exec: function(){ pull({}); }
            // }, plugin);
            
            c9.on("ready", function _() {
                if (scm) return;
                
                if (!isDetecting)
                    emit.sticky("scm", null);
                else
                    setTimeout(_, 100);
            }, plugin);
        }
        
        /***** Methods *****/
        
        var isDetecting = 0;
        function registerSCM(name, scmPlugin) {
            scms[name] = scmPlugin;
            if (!scm) scm = scmPlugin;
            
            emit("register", { plugin: scmPlugin });
            
            isDetecting++;
            scmPlugin.detect("/", function(err, active) {
                isDetecting--;
                if (err || !active) return;
                emit.sticky("scm", scmPlugin);
            });
        }
        
        function unregisterSCM(name, scmPlugin) {
            delete scms[name];
            
            emit("unregister", { plugin: scmPlugin });
        }
        
        function openDiff(options, callback) {
            var found;
            if (tabManager.getTabs().some(function(tab) {
                if (tab.editorType == "diff.unified") {
                    if (tab.document.getSession().isEqual(options)) {
                        found = tab;
                        return true;
                    }
                }
                return false;
            })) return tabManager.focusTab(found);
            
            tabManager[options.preview ? "preview" : "open"]({
                newfile: true,
                editorType: "diff.unified",
                focus: true,
                document: {
                    "title": "Compare View",
                    "diff.unified": options
                }
                // path: "/compare.diff"
            }, function(err, tab) {
                callback && callback(err, tab);
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        plugin.freezePublicAPI({
            /**
             * 
             */
            register: registerSCM,
            
            /**
             * 
             */
            unregister: unregisterSCM,
            
            /**
             * 
             */
            openDiff: openDiff
        });
        
        register(null, {
            "scm": plugin
        });
    }
});
