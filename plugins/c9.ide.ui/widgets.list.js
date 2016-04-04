define(function(require, exports, module) {
    main.consumes = ["Plugin", "ui", "util"];
    main.provides = ["List"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var util = imports.util;
        
        var AceTree = require("ace_tree/tree");
        var AceTreeEditor = require("ace_tree/edit");
        var ListModel = require("ace_tree/list_data");
        var TreeModel = require("ace_tree/data_provider");
        var search = require("../c9.ide.navigate/search");
        
        ListModel.prototype.getEmptyMessage = function(){
            return this.emptyMessage || "";
        };
        
        ui.on("load", function(){
            ui.insertCss(require("text!./widgets.less"), options.staticPrefix, ui);
        });
        
        /***** Constructors *****/
        
        function List(options, forPlugin, baseclass) {
            if (!options) throw new Error("options are required");
            
            var plugin = new Plugin("Ajax.org", main.consumes);
            var emit = plugin.getEmitter();
            if (baseclass) plugin.baseclass();
            
            var acetree;
            var model;
            var redirectEvents;
            var fRoot;
            var meta = {};
            var dataType = options.model ? "object" : options.dataType;
            var excludedEvents = { 
                "draw": 1, "load":1, "unload":1, 
                "addListener":1, "removeListener":1 
            };
            var renameEvents = {
                "select": "changeSelection",
                "afterRename": "rename",
                "scroll": "changeScrollTop"
            };
            
            var drawn = false;
            function draw(htmlNode) {
                if (drawn) return;
                drawn = true;
                
                acetree = new AceTree(htmlNode);
                model = options.model || (dataType === "object"
                    ? new TreeModel()
                    : new ListModel());
                model.filterCaseInsensitive = true;
                model.$sortNodes = false;
                
                if (!options.rowHeight)
                    options.rowHeight = 23;
                
                // Set Default Theme
                if (!options.theme)
                    options.theme = "custom-tree ace-tree-" + (options.baseName || "list");
                
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
                    afterRender: acetree.renderer,
                    resize: acetree.renderer,
                    afterRender: acetree.renderer,
                    expand: model,
                    collapse: model,
                    check: model,
                    uncheck: model
                };
                
                emit.sticky("draw");
            }
            
            plugin.on("load", function(){
                if (options.container)
                    plugin.attachTo(options.container);
                
                forPlugin.once("unload", function(){
                    plugin.unload();
                });
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
                
                if (renameEvents[type])
                    type = renameEvents[type];
                
                if (redirectEvents[type])
                    redirectEvents[type].on(type, fn);
                else
                    acetree.on(type, fn);
            });
            plugin.on("removeListener", function(type, fn){
                if (excludedEvents[type]) return;
                
                if (renameEvents[type])
                    type = renameEvents[type];
                
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
                 * @ignore
                 * @readonly
                 */
                get acetree(){ return acetree; },
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
                    var sel = (acetree.selection.getSelectedNodes() || []);
                    return dataType == "object"
                        ? sel
                        : sel.map(function(n){ return n.id; });
                },
                /**
                 * 
                 */
                get selectedNode(){ 
                    var item = (acetree.selection.getCursor() || null);
                    return dataType == "object" ? item : item.id;
                },
                /**
                 * 
                 */
                get root(){ return model.cachedRoot; },
                /**
                 * 
                 */
                get scrollTop(){ return model.getScrollTop(); },
                set scrollTop(value){ return model.setScrollTop(value); },
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
                set scrollMargin(value){ 
                    acetree.renderer.setScrollMargin(value[0], value[1]); 
                },
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
                get enableVariableHeight(){ return model.getItemHeight; },
                set enableVariableHeight(value){ 
                    if (!value) throw new Error("Unable to remove variable height");
                    
                    var variableHeightRowMixin = model.constructor.variableHeightRowMixin;
                    variableHeightRowMixin.apply(model);
                },
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
                get enableCheckboxes(){ return model.getCheckboxHTML ? true : false; },
                set enableCheckboxes(value){
                    model.getCheckboxHTML = value 
                        ? function(node){
                            return "<span class='checkbox " 
                                + (node.isChecked == -1 
                                    ? "half-checked " 
                                    : (node.isChecked ? "checked " : ""))
                                + "'></span>";
                        }
                        : null;
                    
                    if (value) {
                        acetree.commands.bindKey("Space", function(e) {
                            var nodes = acetree.selection.getSelectedNodes();
                            var node = acetree.selection.getCursor();
                            node.isChecked = !node.isChecked;
                            nodes.forEach(function(n){ n.isChecked = node.isChecked });
                            model._signal(node.isChecked ? "check" : "uncheck", nodes);
                            model._signal("change");
                        });
                    }
                    else {
                        acetree.commands.bindKey("Space", null);
                    }
                },
                /**
                 * 
                 */
                get filterKeyword(){ return model.keyword; },
                set filterKeyword(value){
                    model.keyword = value;
                    if (!model.keyword) {
                        fRoot = null;
                        model.reKeyword = null;
                        model.setRoot(model.cachedRoot);
                    }
                    else {
                        model.reKeyword = new RegExp("(" 
                            + util.escapeRegExp(model.keyword) + ")", 'i');
                        fRoot = search.treeSearch(
                            model.filterRoot 
                                ? model.filterRoot.items || model.filterRoot
                                : model.cachedRoot.items || model.cachedRoot, 
                            model.keyword, model.filterCaseInsensitive,
                            null, null, model.filterProperty);
                        model.setRoot(fRoot);
                    }
                },
                /**
                 * 
                 */
                get filterCaseInsensitive(){ return model.filterCaseInsensitive; },
                set filterCaseInsensitive(value){ model.filterCaseInsensitive = value; },
                /**
                 * 
                 */
                get filterProperty(){ return model.filterProperty; },
                set filterProperty(value){ model.filterProperty = value; },
                /**
                 * 
                 */
                get filterRoot(){ return model.filterRoot; },
                set filterRoot(value){ model.filterRoot = value; },
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
                set renderRow(fn){ 
                    model.renderRow = fn; 
                    acetree.setDataProvider(model);
                },
                /**
                 * 
                 */
                get getContentHTML(){ return model.getContentHTML; },
                set getContentHTML(fn){ model.getContentHTML = fn; },
                /**
                 * 
                 */
                get getCaptionHTML(){ return model.getCaptionHTML; },
                set getCaptionHTML(fn){ model.getCaptionHTML = fn; },
                /**
                 * 
                 */
                get getIconHTML(){ return model.getIconHTML; },
                set getIconHTML(fn){ model.getIconHTML = fn; },
                /**
                 * 
                 */
                get getCheckboxHTML(){ return model.getCheckboxHTML; },
                set getCheckboxHTML(fn){ model.getCheckboxHTML = fn; },
                /**
                 * 
                 */
                get sort(){ return model.sort; },
                set sort(fn){
                    model.$sortNodes = fn ? true : false;
                    model.$sorted = fn ? true : false;
                    model.sort = fn; 
                },
                /**
                 * 
                 */
                get getClassName(){ return model.getClassName; },
                set getClassName(fn){ model.getClassName = fn; },
                /**
                 * 
                 */
                get getTooltipText(){ return model.getTooltipText; },
                set getTooltipText(fn){ model.getTooltipText = fn; },
                /**
                 * 
                 */
                get getIndex(){ return model.getIndex; },
                set getIndex(fn){ model.getIndex = fn; },
                /**
                 * 
                 */
                get getItemHeight(){ return model.getItemHeight; },
                set getItemHeight(fn){ model.getItemHeight = fn; },
                
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
                     * @event afterRender Fires 
                     */
                    "afterRender",
                    /**
                     * @event check Fires 
                     */
                    "check",
                    /**
                     * @event uncheck Fires 
                     */
                    "uncheck",
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
                    model.cachedRoot = root;
                    if (model.keyword)
                        plugin.filterKeyword = model.keyword;
                    else
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
                blur: function(){
                    return acetree.blur();
                },
                /**
                 * 
                 */
                startRename: function(node, column){
                    return acetree.edit.startRename(node, column);
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
                scrollIntoView: function(anchor, offset){ 
                    return acetree.renderer.scrollCaretIntoView(anchor, offset);
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
                check: function(node, half){
                    node.isChecked = half ? -1 : true;
                    model._signal("check", node);
                    model._signal("change");
                },
                /**
                 * 
                 */
                uncheck: function(node){
                    node.isChecked = false;
                    model._signal("uncheck", node);
                    model._signal("change");
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
                    if (model.keyword)
                        plugin.filterKeyword = model.keyword;
                    else
                        model.setRoot(plugin.root);
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
            
            if (!baseclass)
                plugin.load(null, options.baseName || "list");
            
            return plugin;
        }
        
        register(null, {
            List: List
        });
    }
});