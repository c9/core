/**
 * Show helpful welcome notification for onlinedev developers!
 */
define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "Plugin", "ui", "dialog.notification", "pubsub"
    ];
    main.provides = ["onlinedev_helper"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var notification = imports["dialog.notification"];
        var pubsub = imports.pubsub;
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            var suffix = options.baseUrl.replace(/.*:\/\//, "");
            if (suffix === "c9.dev")
                return; // bail out, we have a cert for that
            
            var hide = notification.show('<div class="c9-readonly">Welcome Cloud9 developer! Please authorize certificates of these pages: '
                + '<a href="https://api.' + suffix + '" target="_blank">api.' + suffix + '</a> '
                + '<a href="https://vfs.' + suffix + '" target="_blank">vfs.' + suffix + '</a> '
                + "</div>");
                
            pubsub.once("connected", function() {
                hide();
            });
        }
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            loaded = false;
        });
        
        register(null, { "onlinedev_helper": plugin });
    }
});