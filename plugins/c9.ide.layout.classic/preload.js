define(function(require, exports, module) {
    main.consumes = ["Plugin", "http", "ui", "settings"];
    main.provides = ["layout.preload"];
    return main;

    function main(options, imports, register) {
        var settings = imports.settings;
        var Plugin = imports.Plugin;
        var http = imports.http;
        var ui = imports.ui;
        
        var async = require("async");

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);

        var themePrefix = options.themePrefix;
        var packed = ui.packedThemes;

        var themes = {
            "dark"       : "",
            "dark-gray"  : "",
            "light-gray" : "",
            "light"      : "",
            "flat-light" : ""
        };

        /***** Methods *****/
        
        function preload(callback) {
            if (!packed || options.loadTheme) return callback();
            try {
                var theme = settings.get("user/general/@skin") || "dark";
                return getTheme(theme, callback);
            } catch(e) {}
            async.forEach(Object.keys(themes), getTheme, callback);
        }

        function getTheme(name, callback) {
            if (themes[name]) {
                callback(null, themes[name]);
            } else if (options.loadTheme) {
                options.loadTheme(name, function(err, data) {
                    themes[name] = data;
                    callback(err, data);
                });
            } else {
                http.request(themePrefix + "/" + name + ".css", {
                    timeout: 2 * 60 * 1000
                }, function(err, data) {
                    if (err)
                        return callback(err, data);
                    
                    themes[name] = data;
                    callback(err, data);
                });
            }
        }
        
        /***** Register and define API *****/
        
        /**
         * 
         * @singleton
         **/
        plugin.freezePublicAPI({
            getTheme: getTheme,
            packed: packed
        });
        
        preload(function(err) {
            register(null, {
                "layout.preload": plugin
            });
        });
    }
});