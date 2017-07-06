define(function(require, exports, module) {
"use strict";

module.exports = function(options) {
    var plugins = require("./default")(options);
    
    // TODO: cleanup unneeded plugins?
    var includes = [];
    var excludes = {};
    
    plugins.forEach(function(p) {
        if (p.packagePath && p.packagePath.indexOf("c9.core/settings") >= 0) {
            p.settings = "defaults";
            p.template = {
                user: {},
                project: {},
                state: {
                    console: {
                        "@maximized": true,
                        type: "pane", 
                        nodes: []
                    }
                }
            };
        }
        else if (p.packagePath == "plugins/c9.ide.console/console") {
            p.defaultState = {
                type: "pane", 
                nodes: [{
                    type: "tab",
                    editorType: "terminal",
                    active: "true"
                }]
            };
        }
    });
    
    plugins = plugins
        .concat(includes)
        .filter(function (p) {
            return !excludes[p] && !excludes[p.packagePath];
        });

    return plugins;
};

});