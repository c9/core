define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "preferences", "ui", "Datagrid", "settings",
        "preferences.experimental", "language.tern"
    ];
    main.provides = ["language.tern.ui"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var prefs = imports.preferences;
        var ui = imports.ui;
        var settings = imports.settings;
        var Datagrid = imports.Datagrid;
        var tern = imports["language.tern"];
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        var datagrid;
        var defs;
        
        var loaded = false;
        function load() {
            if (loaded) return;
            loaded = true;
            
            prefs.add({
                "Project": {
                    "JavaScript Support": {
                        position: 1100,
                        "Tern Completions": {
                            position: 220,
                            type: "custom",
                            name: "ternCompletions",
                            node: new ui.bar({
                                style: "padding:10px"
                            })
                        },
                    }
                }
            }, plugin);
            
            plugin.getElement("ternCompletions", initPreferences);
        }
        
        function initPreferences(elem) {
            var container = elem.$ext.appendChild(document.createElement("div"));
            datagrid = new Datagrid({
                container: container,
                enableCheckboxes: true,
                emptyMessage: "Loading...",
                minLines: 3,
                maxLines: 10,
                sort: function(array) {
                    return array.sort(function compare(a, b) {
                        if (a.label === "Main")
                            return -1;
                        return a.label.toLowerCase() > b.label.toLowerCase() ? 1 : -1;
                    });
                },
                columns: [
                    {
                        caption: "JavaScript Library Code Completion",
                        value: "name",
                        width: "100%",
                        type: "tree"
                    }, 
                    // {
                    //     caption: "Description",
                    //     value: "description",
                    //     width: "65%",
                    // }
                ],
            }, plugin);
            
            var getCheckboxHTML = datagrid.getCheckboxHTML;
            datagrid.getCheckboxHTML = function(node) {
                return ["Main", "Experimental"].indexOf(node.label) > -1
                    ? ""
                    : getCheckboxHTML(node);
            };
            
            datagrid.once("draw", function() {
                tern.once("ready", function() {
                    var config = settings.getJson("project/language/tern_defs");
                    defs = tern.getDefs();
                    datagrid.on("check", onChange.bind(null, true));
                    datagrid.on("uncheck", onChange.bind(null, false));
                    datagrid.setRoot([
                        {
                            label: "Main",
                            description: "",
                            items: Object.keys(defs)
                                .filter(function(d) { return !defs[d].hidden && !defs[d].experimental; })
                                .map(toCheckbox)
                        }, 
                        {
                            label: "Experimental",
                            description: "",
                            items: Object.keys(defs)
                                .filter(function(d) { return !defs[d].hidden && defs[d].experimental; })
                                .map(toCheckbox)
                        }
                    ]);
                    datagrid.open(datagrid.root[0]);
        
                    function toCheckbox(def) {
                        return {
                            label: def,
                            description: '<a href="' + defs[def].url + '">' + defs[def].url + '</a>',
                            isChecked: config[def] && config[def].enabled,
                        };
                    }
                });
            });
        }
        
        function onChange(value, nodes) {
            var config = settings.getJson("project/language/tern_defs");
            nodes.forEach(function(n) {
                tern.setDefEnabled(n.label, n.isChecked);
                if (n.isChecked)
                    config[n.label] = { enabled: true };
                else
                    config[n.label] = { enabled: false };
            });
            settings.setJson("project/language/tern_defs", config);
        }
        
        plugin.on("load", load);
        plugin.on("unload", function() {
            loaded = false;
            datagrid = null;
            defs = null;
        });
        
        plugin.freezePublicAPI({
        });
        
        /**
         * Tern-based code completion for Cloud9.
         */
        register(null, {
            "language.tern.ui": plugin
        });
    }

});