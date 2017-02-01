define(function(require, exports, module) {
    main.consumes = ["Tree", "layout", "ui"];
    main.provides = ["Datagrid"];
    return main;

    function main(options, imports, register) {
        var Tree = imports.Tree;
        var layout = imports.layout;
        var ui = imports.ui;
        
        var TreeModel = require("ace_tree/data_provider");
        
        /***** Constructors *****/
        
        function Datagrid(options, forPlugin, baseclass) {
            if (!options) throw new Error("options are required");
            
            if (!options.baseName)
                options.baseName = "datagrid";
                
            if (!options.theme)
                options.theme = "blackdg ace-tree-" + options.baseName;
            
            var model = new TreeModel();
            model.columns = options.columns;
            options.model = model;
            
            var plugin = new Tree(options, forPlugin, true);
            // var emit = plugin.getEmitter();
            if (baseclass) plugin.baseclass();
            
            if (!options.rowHeight) {
                layout.on("eachTheme", function(e) {
                    var cls = "." + options.theme.replace(/ /g, " .") + " .row";
                    var height = parseInt(ui.getStyleRule(cls, "height"), 10) || 23;
                    // model.rowHeightInner = height - 1;
                    model.rowHeight = height;
                    
                    if (e.changed) plugin.resize(true);
                });
            }
            
            /**
             */
            /**
             * @constructor
             * Creates a new Datagrid instance.
             * @param {Object} options
             * @param {Array}  options.columns
             * @param {Plugin} plugin           The plugin responsible for creating this datagrid.
             */
            plugin.freezePublicAPI({
                // Properties
                /**
                 * 
                 */
                get columns() { throw new Error("Columns can only be set."); },
                set columns(c) {
                    model.columns = c;
                    if (plugin.acetree)
                        plugin.acetree.renderer.setDataProvider(model);
                }
            });
            
            if (!baseclass)
                plugin.load(null, options.baseName || "datagrid");
            
            return plugin;
        }
        
        register(null, {
            Datagrid: Datagrid
        });
    }
});