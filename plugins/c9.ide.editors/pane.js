define(function(require, module, exports) {
    main.consumes = [
        "Plugin", "ui", "Tab", "settings", "menus", "editors", "anims", "apf",
        "layout"
    ];
    main.provides = ["Pane"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var settings = imports.settings;
        var menus = imports.menus;
        var layout = imports.layout;
        var editors = imports.editors;
        var anims = imports.anims;
        var apf = imports.apf;
        
        function Pane(options) {
            var amlPane, queue, cancelEditorCreate, isFixedHeight;
            
            /***** Initialization *****/
            
            var plugin = new Plugin("Ajax.org", main.consumes);
            var emit = plugin.getEmitter();
            
            var name = options.name;
            var visible = true;
            var meta;
            
            function load(){
                var btnPlus, btnMenu, closing = 0;
                
                meta = {};
                
                amlPane = new ui.tab({
                    skin: options && options.skin || "editor_tab",
                    skinset: options && options.skinset || "default",
                    style: "height : 100%",
                    width: options && options.width,
                    height: options && options.height,
                    activepage: options.preventAutoActivate ? -1 : 0, // Prevent first pane from becoming active
                    minwidth: 60,
                    minheight: 60,
                    buttons: "close,scale,order",
                    anims: settings.getBool("user/general/@animateui") ? "add|remove|sync" : "",
                    onbeforeswitch: function(e) {
                        var tab = e.nextPage.cloud9tab;
                        var lastTab = e.previousPage && e.previousPage.cloud9tab;
                        
                        // Small hack to prevent hover transition during tab switch
                        if (e.previousPage) {
                            var html = e.previousPage.$button;
                            ui.setStyleClass(html, "notrans")
                            setTimeout(function(){
                                ui.setStyleClass(html, "", ["notrans"])
                            }, 200);
                        }
                        
                        // Emit event
                        emit("beforeSwitch", {
                            tab: tab,
                            lastTab: lastTab,
                            pane: plugin
                        });
                    },
                    onafterswitch: function(e) {
                        var tab = e.nextPage.cloud9tab;
                        var lastTab = e.previousPage && e.previousPage.cloud9tab;
                        
                        // Get editor and create it if it's not in the current pane
                        createEditor(tab.editorType, function(err, editor) {
                            editor.loadDocument(tab.document);
                            
                            // Resize editor
                            tab.editor && tab.editor.resize({ type: "switch" });
                            
                            // Call switch event
                            emit("afterSwitch", {
                                tab: tab,
                                lastTab: lastTab,
                                pane: plugin
                            });
                        });
                    },
                    onclose: function(e) {
                        var amlTab = e.page;
                        if (amlTab.$amlDestroyed) return;
                        
                        var tab = amlTab.cloud9tab;
                        var event = { tab: tab, htmlEvent: e.htmlEvent };

                        event.last = amlPane.getPages().length == ++closing;
                        
                        if (emit("beforeClose", event) === false 
                          || tab.beforeClose(event) === false) {
                            closing--;
                            return false;
                        }
                        
                        tab.meta.$closing = true;
                        
                        emit("afterClose", event);
                        
                        if (tab.aml.$amlDestroyed) {
                            tab.unload(event);
                            closing--;
                        }
                        else if (tab.meta.$skipAnimation) {
                            closeNow();
                        }
                        else {
                            tab.aml.on("afterclose", function(){
                                closeNow();
                            });
                        }
                        
                        function closeNow(){
                            if (tab.meta.$closeSync) {
                                tab.unload(event);
                                closing--;
                            }
                            else {
                                setTimeout(function(){
                                    tab.unload(event);
                                    closing--;
                                });
                            }
                        }
                    },
                    overactivetab: true,
                    childNodes: [
                        btnPlus = new ui.button({
                            id: "btnPlus",
                            "class" : "plus_tab_button",
                            skin: "c9-simple-btn",
                        }),
                        btnMenu = new apf.button({
                            skin: "c9-simple-btn",
                            "class" : "tabmenubtn",
                            onmouseover: function(){
                                this.setAttribute("submenu", 
                                    menus.get('Window/Tabs').menu);
                            }
                        })
                    ]
                });
                
                plugin.addElement(amlPane);
                
                settings.on("user/general/@animateui", function(value) {
                    amlPane.setAttribute("anims", 
                        apf.isTrue(value) ? "add|remove|sync" : "");
                }, plugin);
        
                amlPane.cloud9pane = plugin;
                amlPane.btnMenu = btnMenu;
                amlPane.btnPlus = btnPlus;
        
                // Small hack to get buttons inside button area of pane
                amlPane.on("DOMNodeInsertedIntoDocument", function(){
                    setTimeout(function(){
                        amlPane.$buttons.appendChild(btnPlus.$ext);
                        amlPane.$buttons.appendChild(btnMenu.$ext);
                    });
                });
                
                amlPane.on("DOMNodeInserted",function(e) {
                    var amlNode = e.currentTarget;
                    
                    if (e.$isMoveWithinParent) {
                        if (amlNode.localName != "page" || e.relatedNode != amlPane 
                          || amlNode.nodeType != 1)
                            return;
                        
                        // Record position in settings
                        settings.save();
                        
                        emit("tabOrder", { 
                            tab: amlNode.cloud9tab,
                            next: (amlNode.nextSibling || 1).cloud9tab
                        });
                    }
        
                    if (e.relatedNode == amlPane && amlNode.localName == "page") {
                        // See if we are put into a fixed height container
                        var pNode = amlNode.parentNode;
                        while (pNode.localName != "bar")
                            pNode = pNode.parentNode;
                        isFixedHeight = pNode.height 
                            && parseInt(pNode.height, 10) == pNode.height;
                        
                        // Make sure the plus button is on the end
                        amlPane.$buttons.appendChild(btnPlus.$ext);
                    }
                });
            }
            
            /***** Methods *****/
            
            function createEditor(type, callback) {
                var tab = amlPane.getPage("editor::" + type);
                if (cancelEditorCreate)
                    cancelEditorCreate();
                if (!tab) {                    
                    cancelEditorCreate = editors.createEditor(type, function(err, editor) {
                        editor.attachTo(amlPane.cloud9pane);
                        callback(null, editor);
                        cancelEditorCreate = null;
                    });
                }
                else
                    callback(null, tab.editor);
            }
            
            function getTab(id) {
                var tab = amlPane.getPage(id);
                return tab && tab.cloud9tab;
            }
            
            function getTabs(){
                return amlPane.getPages().map(function(tab) {
                    return tab.cloud9tab;
                })
            }
            
            function getEditors(){
                return (amlPane.childNodes || [])
                    .filter(function(p){ return p.localName == "page" && p.$ext })
                    .map(function(e){ return e.editor });
            }
            
            function focus(){
                amlPane.focus();
            }
            
            function hasFocus(){
                return ui.isChildOf(apf.document.activeElement, amlPane, 1);
            }
            
            function vsplit(far, v, split) {
                return hsplit(far, true, split);
            }
            
            function hsplit(far, vertically, split, ignore) {
                if (!$isValidSplit(split) || !split.parentNode) split = amlPane;
                
                queue = []; // Used for resizing later
                
                var opt = {
                    splitter: true,
                    padding: 1
                };
                
                var psize = split.parentNode.$vbox ? "height" : "width";
                opt[psize] = split[psize];
                
                var splitbox = new ui[vertically ? "vsplitbox" : "hsplitbox"](opt);
                var parent = split.parentNode;
                parent.insertBefore(splitbox, split);
                splitbox.appendChild(split);
                parent.register && parent.register(splitbox);
                split.setAttribute(psize, "");
                var ratio = balance(splitbox, vertically, 1, ignore);
                
                var state = {};
                var size = vertically ? "height" : "width";
                state[size] = (ratio ? (100 * ratio) : 50) + "%";
                state.skinset = split.skinset;
                state.skin = split.skin;
                
                var newtab = options.createPane(state).aml;
                if (far)
                    splitbox.appendChild(newtab);
                else
                    splitbox.insertBefore(newtab, split);
                split.setAttribute(vertically ? "height" : "width", "");
                
                queue.push(splitbox);
                
                resizeAll();
                
                return newtab.cloud9pane;
            }
            
            function $isValidSplit(container) {
                // would be better to use tabmanager.containers instead
                while (container) {
                    if (container.localName == "bar")
                        break;
                    container = container.parentNode;
                }
                return !!container;
            }
            
            // Resize all editors in the queue
            function resizeAll(){
                queue.forEach(function(node) {
                    (node.localName == "tab"
                        ? [node]
                        : node.getElementsByTagNameNS(apf.ns.aml, "tab")
                    ).forEach(function(n) {
                        var pane = n.cloud9pane;
                        pane.getEditors().forEach(function(editor) {
                            editor.resize({ type: "split" });
                        });
                    });
                });
            }
            
            function balance(splitbox, vertically, diff, ignore) {
                var splits = [], type = splitbox.localName, node = splitbox;
                var last, ignoreIsTopLevel;
                do {
                    splits.push(node);
                    if (!ignoreIsTopLevel)
                        ignoreIsTopLevel = node.childNodes.indexOf(ignore) > -1;
                    node = (last = node).parentNode;
                } while (node.localName == type);
                
                //Resize all left elements of the before 
                var total = count(last, type, ignore);
                var igd = (ignoreIsTopLevel ? 1 : 0);
                var factor = (total + igd) / (total + diff);
                
                if (splits.length == 1)
                    return 1 / (total + 1);
                
                var child, prop = vertically ? "height" : "width";
                var split, children, inverse, value;
                for (var i = 1, l = splits.length; i < l; i++) {
                    split = splits[i];
                    child = splits[i - 1];
                    children = split.childNodes.filter(function(x) { 
                        return x.localName != "splitter"; 
                    });
                    
                    inverse = children[0] == child;
                    if (children[0][prop] || !children[1]) {
                        node = children[0];
                    }
                    else {
                        inverse = !inverse;
                        node = children[1];
                    }
                    
                    value = parseFloat(node[prop]);
                    node.setAttribute(prop, inverse
                        ? (value + (100 - value) * (1 - factor)) + "%"
                        : (value * factor) + "%");
                    queue.push(node);
                }
            }
            
            function count(splitbox, type, ignore) {
                var total = 0;
                (function walk(node) {
                    var nodes = node.childNodes;
                    for (var n, i = 0, l = nodes.length; i < l; i++) {
                        if ((n = nodes[i]).localName == "splitter"
                          || n == ignore) 
                            continue;
                        
                        if (n.localName == "tab" || n.localName != type)
                            total++;
                        else
                            walk(n);
                    }
                })(splitbox);
                
                return total;
            }
            
            var config = { 
                "left"  : [hsplit, false, "hsplitbox"],
                "right" : [hsplit, true,  "hsplitbox"],
                "up"    : [vsplit, false, "vsplitbox"],
                "down"  : [vsplit, true,  "vsplitbox"]
            }
            
            function moveTabToSplit(tab, direction, keep) {
                var isEmpty = amlPane.getPages().length == 1;
                var parent = amlPane.parentNode;
                
                var split = config[direction][0];
                var far = config[direction][1];
                var kind = config[direction][2];
                
                queue = []; // For resizing later
                
                if (!isEmpty) {
                    // Split the current pane and attach the tab
                    tab.attachTo(split(far), null, true);
                    tab.activate();
                    return;
                }
                
                var next, grandpa = parent, tabs, node = amlPane, force, test;
                if (grandpa.localName != kind) {
                    // Find the right stack to go to
                    while (grandpa.parentNode.localName != kind 
                      && grandpa.parentNode.localName != "bar") {
                        grandpa = (node = grandpa).parentNode;
                    }
                    next = grandpa; //grandpa.localName == "bar" ? grandpa.firstChild : grandpa;
                    force = true;
                }
                
                if (!next) {
                    // Find pane to move to
                    do {
                        tabs = grandpa.childNodes.filter(function(x) { 
                            return x.localName != "splitter"; 
                        });
                        if (tabs[far ? 0 : 1] == node) {
                            next = tabs[far ? 1 : 0];
                            break;
                        }
                        node = node.parentNode;
                        grandpa = grandpa.parentNode;
                    } while (grandpa && grandpa.localName != "bar")
                }
                
                if (next) {
                    if (!$isValidSplit(next)) 
                        return;
                    // Moving from horizontal to vertical or vice verse
                    if (force || next.parentNode.localName != amlPane.parentNode.localName) {
                        var tosplit = force || next.parentNode.localName == "bar"
                            ? next : next.parentNode;
                        tab.attachTo(split(far, null, tosplit), null, true);
                        tab.activate();
                        
                        var bparent = tab.pane.aml.parentNode;
                        balance(bparent, bparent.localName == "vsplitbox", 0, amlPane);
                    }
                    // Move to next pane
                    else {
                        // Find the most first/last pane
                        if (next.localName != "tab") {
                            while (next.localName != "tab")
                                next = next.childNodes[far ? 1 : 2];
                        }
                        tab.attachTo(next.cloud9pane, 
                            far ? (next.getPages()[0] || 1).cloud9tab : null, true);
                        tab.activate();
                        
                        balance(amlPane.parentNode, split == vsplit, 0, amlPane);
                    }
                }
                else {
                    var type = parent.localName;
                    do {
                        parent = parent.parentNode;
                    } while (parent.localName == type);
                    
                    if (parent.localName == "bar")
                        return;
                        
                    tab.attachTo(split(far, null, parent, amlPane), null, true);
                }
                amlPane.cloud9pane.unload();
                
                resizeAll();
            }
            
            /***** Resizing *****/
            
            // Resize when window resizes
            function windowResize(){
                var tab = getTab();
                if (tab && tab.editor)
                    tab.editor.resize({ type: "window" });
            }
            
            layout.on("resize", windowResize, plugin);
            
            // Resize when resizing using a splitter
            function splitterResize(e) {
                var parent = e.splitter.parentNode;
                
                // Resize only vertically in realtime (really?)
                if (!parent.$vbox && !e.final) 
                    return;
                
                if (ui.isChildOf(parent, amlPane) && getTab()) {
                    getTab().editor.resize({
                        type: "splitter",
                        final: e.final
                    });
                }
            }
            
            apf.addEventListener("splitter.resize", splitterResize);
            plugin.addOther(function(){
                apf.removeEventListener("splitter.resize", splitterResize);
            });
            
            // Resize when an animation happens
            anims.on("animate", function(e) {
                var delta, result, size;
                if (e.type == "editor") {
                    delta = e.delta;
                    result = { delta: delta, vertical: true };
                }
                else if (e.type == "splitbox") {
                    if (e.options.height !== undefined) {
                        if (ui.isChildOf(e.other, amlPane, true)) {
                            size = e.which.getHeight();
                            delta = isFixedHeight ? 0 : size - parseInt(e.options.height, 10);
                            result = { vertical: true, own: e.other == amlPane };
                        }
                        else if (ui.isChildOf(e.which, amlPane, true)) {
                            size = e.which.getHeight();
                            delta = parseInt(e.options.height, 10) - size;
                            result = { vertical: true, own: e.which == amlPane  };
                        }
                    }
                    else if (e.options.width !== undefined) {
                        if (ui.isChildOf(e.other, amlPane, true)) {
                            size = e.which.getWidth();
                            delta = size - parseInt(e.options.width, 10);
                            result = { vertical: false, own: e.other == amlPane };
                        }
                        else if (ui.isChildOf(e.which, amlPane, true)) {
                            size = e.which.getWidth();
                            delta = parseInt(e.options.width, 10) - size;
                            result = { vertical: false, own: e.which == amlPane };
                        }
                    }
                    
                    if (result) {
                        result.current = size;
                        result.delta = delta;
                    }
                }
                
                if (!result) 
                    return; //result = { type: "generic-anim" };
                else if (result)
                    result.type = "anim";
                
                // Grow the area prior to the animation
                if (delta > 0) {
                    var tab = getTab();
                    if (tab && tab.editor)
                        tab.editor.resize(result);
                }
                
                // Emit the resize event after the animation is completed to 
                // hide whatever the result has covered
                e.on("finish", function(){
                    var tab = getTab();
                    if (tab && tab.editor)
                        tab.editor.resize({ type: "afteranim" });
                });
            }, plugin);
            
            /***** Lifecycle *****/
            
            plugin.on("load", function(){ 
                load();
            });
            
            plugin.on("beforeUnload", function(){
                var idx, next, last;
                var parent = amlPane.parentNode;
                if (!parent) return;
                var nodes = parent.selectNodes("tab|hsplitbox|vsplitbox");
                
                // find the next available tab
                if (nodes.length > 1) {
                    idx = nodes.indexOf(amlPane);
                    next = last = nodes[idx === 0 ? 1 : 0];
                }
                else {
                    var p = parent.parentNode;
                    idx = p.childNodes.indexOf(parent);
                    next = last = nodes[idx === 0 ? 1 : 0];
                }
                
                // element is a splitbox - search for a tab
                var op = idx === 0 ? "shift" : "pop";
                while (next && next.tagName != "tab") {
                    next = next.selectNodes("tab|hsplitbox|vsplitbox")[op]();
                }
                
                if (next) {
                    // move all pages to another pane if there is one
                    getTabs().forEach(function(tab) {
                        tab.attachTo(next.cloud9pane, null, true);
                    });
                }
                // destroy aml element
                amlPane.destroy(true, true);
                
                // Clean up tree
                if (last) {
                    var place = parent.nextSibling;
                    var grandpa = parent.parentNode;
                    parent.removeChild(last);
                    if (parent != options.container)
                        parent.destroy(true, true);
                    grandpa.insertBefore(last, place);
                    
                    queue = [grandpa]
                    
                    var size = grandpa.$vbox ? "height" : "width";
                    last.setAttribute(size, parent[size]);
                    size = grandpa.$vbox ? "width" : "height";
                    last.setAttribute(size, "");
                }
                else {
                    queue = [parent];
                }
                
                if (last && last.parentNode.localName == "bar") {
                    last.$ext.style.width = "100%";//setAttribute("width", "100%");
                    last.$ext.style.height = "100%";//.setAttribute("height", "100%");
                }
                
                // This is needed because other panes will need resizing
                resizeAll();
            });
            
            /***** Register and define API *****/
            
            /**
             * Represents a pane containing tabs in Cloud9. Cloud9
             * generally has a main area that contain tabs and an area in the
             * console. Both areas start of as a single pane. These panes
             * can then be split using menu items or drag&drop operations. The
             * splits can also be made programmatically using APIs on this class.
             * 
             * The pane relates to other objects as such:
             * 
             * * **Pane - Represent a single pane, housing multiple tabs**
             *   * {@link Tab} - A single tab (button) in a pane
             *     * {@link Editor} - The editor responsible for displaying the file in the tab
             *     * {@link Document} - The representation of a file in the tab
             *       * {@link Session} - The session information of the editor
             *       * {@link UndoManager} - The object that manages the undo stack for this document
             * 
             * Panes can live in certain areas of Cloud9. By default these areas are:
             * 
             * * {@link panes}      - The main area where editor panes are displayed
             * * {@link console}    - The console in the bottom of the screen
             * 
             * Tabs are managed by the {@link tabManager}. The default way to
             * open a new file in an editor uses the tabManager:
             * 
             *     var pane = tabManager.getPanes()[0];
             *     var newPane = pane.splitv();
             *     
             *     tabManager.open({
             *         path: "/file.js",
             *         pane: newPane
             *     }, function(err, tab) {});
             * 
             **/
            plugin.freezePublicAPI({
                /**
                 * The APF UI element that is presenting the pane in the UI.
                 * This property is here for internal reasons only. *Do not 
                 * depend on this property in your plugin.*
                 * @property {AMLElement} aml
                 * @private
                 * @readonly
                 */
                get aml(){ return amlPane; },
                
                /**
                 * The DOM element that is presenting the pane in the UI.
                 * @property {DOMElement} container
                 * @readonly
                 */
                get container(){ return amlPane.$int; },
                
                /**
                 * Retrieves the two elements (one of which is this pane) with
                 * which this panel forms a split.
                 * @return Array
                 * @readonly
                 */
                get group(){
                    var pNode = amlPane.parentNode;
                    
                    if (pNode.localName.indexOf("splitbox") == -1)
                        return false;
                        
                    var result = [];
                    pNode.childNodes.forEach(function(aml) {
                        if (aml.cloud9pane)
                            result.push(aml.cloud9pane);
                    });
                    
                    return result;
                },
                
                /**
                 * The active {@link Tab} of this pane. Note that "active" is
                 * different from "focus" (See {@link tabManager#focusTab}).
                 * @property {Tab} activeTab
                 * @readonly
                 */
                get activeTab(){ return getTab(); },
                
                /**
                 * The width of the pane in pixels. It only makes sense to set
                 * the width of the pane in a splitview situation.
                 * @property {Number} width
                 */
                get width(){ return amlPane.width; },
                set width(v){ amlPane.setProperty("width", v); },
                
                /**
                 * The height of the pane in pixels. It only makes sense to set
                 * the height of the pane in a splitview situation.
                 * @property {Number} height
                 */
                get height(){ return amlPane.height; },
                set height(v){ amlPane.setProperty("height", v); },
                
                /**
                 * Specifies whether the panel is currently being shown.
                 * @property {Boolean} visible
                 * @readonly
                 */
                get visible(){ return visible; },
                set visible(v){ amlPane.setProperty("visible", v); visible = v; },
                set _visible(v){ visible = v; },
                
                /**
                 * Retrieves the meta object for this panel
                 * @property {Object} meta
                 */
                get meta(){ return meta; },
                
                _events: [
                    /** 
                     * Fires when a tab becomes the active tab of this pane.
                     * 
                     * See also {@link tabManager#tabAfterActivate}.
                     * 
                     * @event afterSwitch
                     * @param {Object} e
                     * @param {Tab}    e.tab      the tab that has become active
                     * @param {Tab}    e.lastTab  the tab that is no longer active
                     */
                    "afterSwitch",
                    /**
                     * Fires prior to a tab becoming the active tab of this pane.
                     * 
                     * See also {@link tabManager#tabBeforeActivate}.
                     * 
                     * @event beforeSwitch
                     * @param {Object} e
                     * @param {Tab}    e.tab  the tab that will become active
                     * @cancellable
                     */
                    "beforeSwitch",
                    /**
                     * Fires prior to closing a tab in this pane.
                     * 
                     * See also {@link tabManager#tabBeforeClose}.
                     * 
                     * @event beforeClose
                     * @cancellable
                     */
                    "beforeClose",
                    /**
                     * Fires after closing a tab in this pane.
                     * 
                     * See also {@link tabManager#tabAfterClose}.
                     * 
                     * @event afterClose
                     * @cancellable
                     */
                    "afterClose",
                    /**
                     * Fires when a tab is moved inside this pane.
                     * 
                     * See also {@link tabManager#tabOrder}.
                     * 
                     * @event tabOrder
                     * @param {Object}  e
                     * @param {Tab}     e.tab   the tab that has been moved
                     * @param {Tab}     e.next  the tab on the right of e.tab.
                     */
                    "tabOrder"
                ],
                
                /**
                 * Returns an array of all the tabs in this pane.
                 * 
                 *     var titles = pane.getTabs().map(function(tab) {
                 *         return tab.document.title;
                 *     });
                 *     
                 *     console.log(titles);
                 * 
                 * @returns {Tab[]} 
                 */
                getTabs: getTabs,
                
                /**
                 * Retrieves a tab by it's path or id. When no argument is 
                 * specified, the active tab is returned.
                 * 
                 * See also {@link tabManager#findTab}
                 * 
                 * @param {String} id  The path or id of the tab to fetch.
                 * @return {Tab}
                 */
                getTab: getTab,
                
                /**
                 * Returns an array of all the editors that have been 
                 * initialized in this pane.
                 * 
                 * Editors are initialized when the first tab that requires that
                 * editor becomes active. This means that you can have 20 tabs
                 * in one pane with 4 different editors, yet this function only
                 * returns one entry, because the other tabs have not yet been
                 * active. 
                 * 
                 * @return {Editor[]}
                 */
                getEditors: getEditors,
                
                /**
                 * Retrieves the editor instance for this pane. If the editor
                 * of that type has not yet been created for this pane then
                 * it will be instantiated.
                 * 
                 * @param {String}   type             the {@link Editor#type} of the editor.
                 * @param {Function} callback
                 * @param {Error}    callback.err     an error which made have occured.
                 * @param {Editor}   callback.editor  the editor requested.
                 */
                createEditor: createEditor,
                
                /**
                 * Gives focus to the active tab of this pane (if any).
                 */
                focus: focus,
                
                /**
                 * Whether a tab in this pane has the focus.
                 */
                hasFocus: hasFocus,
                
                /**
                 * Splits a pane vertically into two tabs occupying the same area.
                 * @param {Boolean}  far  When set to true the new pane is
                 *   created in the bottom of the split, otherwise it's created
                 *   as the top pane.
                 * @return {Pane}
                 */
                vsplit: vsplit,
                
                /**
                 * Splits a pane horizontally into two tabs occupying the same area.
                 * @param {Boolean}  far  When set to true the new pane is
                 *   created on the right of the split, otherwise it's created
                 *   as the left pane.
                 * @return {Pane}
                 */
                hsplit: hsplit,
                
                /**
                 * Moves a tab to a "split". This is generally achieved by the
                 * user using keybindings. A tab can travel across the panes and
                 * is inserted in newly created panes at the intersection 
                 * between panes and to existing panes when moved even further.
                 * @param {Tab}    tab        The tab to move
                 * @param {String} direction  Any of these strings: "left", 
                 *   "right", "up", "down".
                 */
                moveTabToSplit: moveTabToSplit
            });
            
            plugin.load(name, "pane");
            
            return plugin;
        }
        
        /***** Register and define API *****/
        
        register(null, {
            Pane: Pane
        });
    }
});