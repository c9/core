define(function(require, exports, module) {
    main.consumes = ["List"];
    main.provides = ["Tree"];
    return main;

    function main(options, imports, register) {
        var List = imports.List;
        
        var TreeModel = require("ace_tree/data_provider");
        
        /***** Constructors *****/
        
        function Tree(options, forPlugin, baseclass) {
            if (!options) throw new Error("options are required");
            
            if (!options.baseName)
                options.baseName = "tree";
            
            var model = options.model;
            if (!model) {
                model = new TreeModel();
                options.model = model;
            }
            
            var plugin = new List(options, forPlugin, true);
            // var emit = plugin.getEmitter();
            if (baseclass) plugin.baseclass();
            
            /**
             */
            /**
             * @constructor
             * Creates a new Tree instance.
             * @param {Object} options
             * @param {Plugin} plugin         The plugin responsible for creating this tree.
             */
            plugin.freezePublicAPI({
                
                // Properties
                /**
                 * 
                 */
                get indentSize(){ return model.indentSize },
                set indentSize(value){ model.indentSize = value },
                
                // Events
                _events : [
                    /**
                     * @event expand
                     */
                    "expand",
                    /**
                     * @event collapse
                     */
                    "collapse"
                ],
                
                // Getters and Setters for Functions
                /**
                 * 
                 */
                get getRowIndent(){ return model.getRowIndent; },
                set getRowIndent(fn){ model.getRowIndent = fn; },
                /**
                 * 
                 */
                get hasChildren(){ return model.hasChildren; },
                set hasChildren(fn){ model.hasChildren = fn; },
                /**
                 * 
                 */
                get getChildren(){ return model.getChildren; },
                set getChildren(fn){ model.getChildren = fn; },
                /**
                 * 
                 */
                get loadChildren(){ return model.loadChildren; },
                set loadChildren(fn){ model.loadChildren = fn; },
                /**
                 * 
                 */
                get shouldLoadChildren(){ return model.shouldLoadChildren; },
                set shouldLoadChildren(fn){ model.shouldLoadChildren = fn; },
                
                // Methods
                toggle: function(node, deep, silent){
                    return model.toggleNode(node, deep, silent);
                },
                open: function(node, deep, silent, justLoaded){
                    return model.open(node, deep, silent, justLoaded);
                },
                close: function(node, deep, silent){
                    return model.close(node, deep, silent);
                },
                isOpen: function(node){
                    return model.isOpen(node);
                },
                isVisible: function(node){
                    return model.isVisible(node);
                },
                getNodePosition: function(node){
                    return model.getNodePosition(node);
                }
            });
            
            if (!baseclass)
                plugin.load(null, options.baseName || "tree");
            
            return plugin;
        }
        
        register(null, {
            Tree: Tree
        });
    }
});