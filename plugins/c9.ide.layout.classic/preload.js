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
            "flat-light" : "",
            "flat-dark" : ""
        };

        /***** Methods *****/
        
        function preload(callback) {
            settings.setDefaults("user/general", [
                ["skin", options.defaultTheme || "flat-dark"]
            ]);
            if (!packed || options.loadTheme) return callback();
            try {
                var theme = settings.get("user/general/@skin");
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
                var url = themePrefix + "/" + name + ".css";
                require(["text!" + url], function(data) {
                    // set sourceurl so that sourcemaps work when theme is inserted as a style tag
                    data += "\n/*# sourceURL=" + url + " */";
                    themes[name] = data;
                    callback(null, data);
                }, function(err) {
                    callback(err);
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