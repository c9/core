define(function(require, exports, module) {
    main.consumes = ["Plugin"];
    main.provides = ["List"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        
        var AceTree = require("ace_tree/tree");
        var AceTreeEditor = require("ace_tree/edit");
        var ListModel = require("ace_tree/list_data");
        
        ListModel.prototype.getEmptyMessage = function(){
            return this.emptyMessage || "";
        };
        
        /***** Constructors *****/
        
        function List(options, forPlugin, baseclass) {
            if (!options) throw new Error("options are required");
            
            var plugin = new Plugin("Ajax.org", main.consumes);
            var emit = plugin.getEmitter();
            if (baseclass) plugin.baseclass();
            
            var acetree;
            var model;
            var redirectEvents;
            var meta = {};
            var excludedEvents = { 
                "draw": 1, "load":1, "unload":1, 
                "addListener":1, "removeListener":1 
            };
            
            var drawn = false;
            function draw(htmlNode) {
                if (drawn) return;
                drawn = true;
                
                acetree = new AceTree(htmlNode);
                model = options.model || new ListModel();
                
                // Set model
                acetree.setDataProvider(model);
                
                // Set properties
                for (var prop in options) {
                    if (prop == "container") continue;
                    if (plugin.hasOwnProperty(prop)) 
                        plugin[prop] = options[prop];
                }
                
                // Configure redirected events
                redirectEvents = {
                    scroll: model,
                    scrollbarVisibilityChanged: acetree.renderer,
                    resize: acetree.renderer,
                    expand: model,
                    collapse: model
                };
                
                emit.sticky("draw");
            }

            plugin.on("load", function(){
                if (options.container)
                    plugin.attachTo(options.container);
            });
            plugin.on("unload", function(){
                if (acetree) {
                    var container = acetree.container;
                    
                    model.setRoot(null);
                    acetree.destroy();
                    
                    container.innerHTML = "";
                    container.parentNode.removeChild(container);
                }
                meta = {};
            });
            plugin.on("newListener", function(type, fn){
                if (excludedEvents[type]) return;
                if (redirectEvents[type])
                    redirectEvents[type].on(type, fn);
                else
                    acetree.on(type, fn);
            });
            plugin.on("removeListener", function(type, fn){
                if (excludedEvents[type]) return;
                if (redirectEvents[type])
                    redirectEvents[type].removeListener(type, fn);
                else
                    acetree.removeListener(type, fn);
            });
            
            /**
             * 
             */
            /**
             * @constructor
             * Creates a new List instance.
             * @param {Object} options
             * @param {Plugin} plugin         The plugin responsible for creating this list.
             */
            plugin.freezePublicAPI({
                // Getter Properties
                /**
                 * A meta data object that allows you to store whatever you want
                 * in relation to this menu.
                 * @property {Object} meta
                 * @readonly
                 */
                get meta(){ return meta; },
                /**
                 * 
                 */
                get model(){ return model; },
                /**
                 * 
                 */
                get selectedNodes(){ 
                    return (acetree.selection.getSelectedNodes() || []);/*.map(function(n){
                        return n.id;
                    }); */
                },
                /**
                 * 
                 */
                get selectedNode(){ 
                    return (acetree.selection.getCursor() || null); //.id || null;
                },
                /**
                 * 
                 */
                get root(){ return model.root; },
                /**
                 * 
                 */
                get scrollTop(){ return model.getScrollTop(); },
                /**
                 * 
                 */
                get focussed(){ return acetree.isFocussed(); },
                /**
                 * 
                 */
                get container(){ return acetree.container; },
                /**
                 * 
                 */
                get renderer(){ return acetree.renderer; },
                /**
                 * 
                 */
                get selection(){ return acetree.selection; },
                /**
                 * 
                 */
                get commands(){ return acetree.commands; },
                
                // Getters and Setters for Properties
                /**
                 * 
                 */
                get textInput(){ return acetree.textInput; },
                set textInput(value){ return acetree.textInput = value; },
                /**
                 * 
                 */
                get emptyMessage(){ return model.emptyMessage; },
                set emptyMessage(value){ model.emptyMessage = value; },
                /**
                 *
                 */
                get scrollMargin(){ return acetree.renderer.scrollMargin; },
                set scrollMargin(value){ acetree.renderer.setScrollMargin(value[0], value[1]); },
                /**
                 *
                 */
                get rowHeight(){ return model.rowHeight; },
                set rowHeight(value){ model.rowHeight = value; },
                /**
                 *
                 */
                get rowHeightInner(){ return model.rowHeightInner; },
                set rowHeightInner(value){ model.rowHeightInner = value; },
                /**
                 * 
                 */
                get theme(){ return acetree.renderer.theme.cssClass; },
                set theme(value){ acetree.renderer.setTheme({cssClass: value}); },
                /**
                 * 
                 */
                get animatedScroll(){ return acetree.getOption("animatedScroll"); },
                set animatedScroll(value){ acetree.setOption("animatedScroll", value); },
                /**
                 * 
                 */
                get enableDragdrop(){ return acetree.getOption("enableDragDrop"); },
                set enableDragdrop(value){ acetree.setOption("enableDragDrop", value); },
                /**
                 * 
                 */
                get enableRename(){ return acetree.edit ? true : false; },
                set enableRename(value){ 
                    acetree.edit = value 
                        ? new AceTreeEditor(acetree)
                        : null;
                },
                /**
                 * 
                 */
                get maxLines(){ return acetree.getOption("maxLines"); },
                set maxLines(value){ acetree.setOption("maxLines", value); },
                /**
                 * 
                 */
                get minLines(){ return acetree.getOption("minLines"); },
                set minLines(value){ acetree.setOption("minLines", value); },
                /**
                 * 
                 */
                get scrollSpeed(){ return acetree.getOption("scrollSpeed"); },
                set scrollSpeed(value){ acetree.setOption("scrollSpeed", value); },
                /**
                 * 
                 */
                get wrapAround(){ return acetree.selection.$wrapAround; },
                set wrapAround(value){ acetree.selection.$wrapAround = value; },
                
                // Getters and Setters for Functions
                /**
                 * 
                 */
                get isLoading(){ return model.isLoading; },
                set isLoading(fn){ model.isLoading = fn; },
                /**
                 * 
                 */
                get getEmptyMessage(){ return model.getEmptyMessage; },
                set getEmptyMessage(fn){ model.getEmptyMessage = fn; },
                /**
                 * 
                 */
                get renderRow(){ return model.renderRow; },
                set renderRow(fn){ model.renderRow = fn; },
                /**
                 * 
                 */
                get sort(){ return model.sort; },
                set sort(fn){ model.sort = fn; },
                /**
                 * 
                 */
                get getClassName(){ return model.getClassName; },
                set getClassName(fn){ model.getClassName = fn; },
                /**
                 * 
                 */
                get getIndex(){ return model.getIndex; },
                set getIndex(fn){ model.getIndex = fn; },
                
                 // Events
                _events: [
                    /**
                     * @event draw Fires 
                     */
                    "draw",
                    /**
                     * @event click Fires 
                     */
                    "click",
                    /**
                     * @event drop Fires 
                     */
                    "drop",
                    /**
                     * @event dragIn Fires 
                     */
                    "dragIn",
                    /**
                     * @event dragOut Fires 
                     */
                    "dragOut",
                    /**
                     * @event dragMoveOutside Fires 
                     */
                    "dragMoveOutside",
                    /**
                     * @event folderDragLeave Fires 
                     */
                    "folderDragLeave",
                    /**
                     * @event folderDragEnter Fires 
                     */
                    "folderDragEnter",
                    /**
                     * @event drop Fires 
                     */
                    "drop",
                    /**
                     * @event dropOutside Fires 
                     */
                    "dropOutside",
                    /**
                     * @event userSelect Fires 
                     */
                    "userSelect",
                    /**
                     * @event afterChoose Fires 
                     */
                    "afterChoose",
                    /**
                     * @event delete Fires 
                     */
                    "delete",
                    /**
                     * @event beforeRename Fires 
                     */
                    "beforeRename",
                    /**
                     * @event afterRename Fires 
                     */
                    "afterRename",
                    /**
                     * @event select Fires 
                     */
                    "select",
                    /**
                     * @event select Fires 
                     */
                    "select",
                    /**
                     * @event scroll Fires 
                     */
                    "scroll",
                    /**
                     * @event scrollbarVisibilityChanged Fires 
                     */
                    "scrollbarVisibilityChanged",
                    /**
                     * @event resize Fires 
                     */
                    "resize"
                ],
                
                // Models
                /**
                 * 
                 */
                setRoot: function(root){
                    return model.setRoot(root);
                },
                /**
                 * 
                 */
                resize: function(force){
                    return acetree.resize(force);
                },
                /**
                 * 
                 */
                select: function(node){
                    if (node instanceof Array)
                        return acetree.selection.setSelection(node);
                    else
                        return acetree.selection.selectNode(node);
                },
                /**
                 * 
                 */
                focus: function(){
                    return acetree.focus();
                },
                /**
                 * 
                 */
                setScrollTop: function(scrollTop){
                    return model.setScrollTop(scrollTop);
                },
                /**
                 * 
                 */
                startRename: function(node){
                    return acetree.edit.startRename(node);
                },
                /**
                 * 
                 */
                execCommand: function(cmd){
                    return acetree.execCommand(cmd);
                },
                /**
                 * 
                 */
                scrollIntoView: function(anchor, lead, offset){ 
                    return acetree.renderer.scrollCaretIntoView(anchor, lead, offset);
                },
                /**
                 * 
                 */
                enable: function(){
                    return acetree.enable();
                },
                /**
                 * 
                 */
                disable: function(){
                    return acetree.enable();
                },
                /**
                 * 
                 */
                getNodeAtIndex: function(idx){
                    return model.getNodeAtIndex(idx);
                },
                /**
                 * 
                 */
                getIndexForNode: function(node){
                    return model.getIndexForNode(node);
                },
                /**
                 * 
                 */
                refresh: function(){
                    plugin.setRoot(plugin.root);
                },
                /**
                 * 
                 */
                attachTo: function(htmlNode, beforeNode){
                    var container;
                    if (drawn)
                        container = acetree.container;
                    else {
                        container = document.createElement("div");
                        container.style.height = "100%";
                    }
                    
                    htmlNode.insertBefore(container, beforeNode);
                        
                    if (!drawn)
                        draw(container);
                }
            });
            
            plugin.load(null, options.baseName || "list");
            
            return plugin;
        }
        
        register(null, {
            List: List
        });
    }
});