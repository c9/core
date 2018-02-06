define(function(require, exports, module) {
"use strict";

    main.consumes = ["CollabPanel", "ui", "MembersPanel", "collab", "panels"];
    main.provides = ["members"];
    return main;

    function main(options, imports, register) {
        var CollabPanel = imports.CollabPanel;
        var collab = imports.collab;
        var MembersPanel = imports.MembersPanel;
        var ui = imports.ui;
        var panels = imports.panels;

        var css = require("text!./members.css");

        var membersPanel;

        var plugin = new CollabPanel("Ajax.org", main.consumes, {
            name: "members",
            index: 100,
            caption: "Workspace Members"
        });

        var loaded = false;
        function load() {
            if (loaded) return;
            loaded = true;

            // Import CSS
            ui.insertCss(css, null, plugin);
            
            membersPanel = new MembersPanel("Ajax.org", main.consumes, {
                showTabs: true,
                autoSize: true
            });
            plugin.on("resize", membersPanel.resize.bind(membersPanel));

            collab.on("show", membersPanel.show.bind(membersPanel));
            collab.on("hide", membersPanel.hide.bind(membersPanel));
        }

        var drawn = false;
        function draw(e) {
            if (drawn) return;
            drawn = true;
            
            membersPanel.draw(e);
            if (panels.isActive("collab"))
                membersPanel.show();
        }
    
        /***** Lifecycle *****/
        plugin.on("load", function() {
            load();
            plugin.once("draw", draw);
        });
        plugin.on("enable", function() {

        });
        plugin.on("disable", function() {
        });

        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
        });

        /***** Register and define API *****/

        /**
         * The members panel inside the collab panel allowing workspace adminstrators
         * to grant/revoke read+write access or kickout memmbers from the workspace
         * and allow non-adminstrators users to see other members of the workspace
         * @singleton
         */
        plugin.freezePublicAPI({
        });

        register(null, {
            members: plugin
        });
    }

});