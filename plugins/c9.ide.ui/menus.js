define(function(require, exports, module) {
    main.consumes = ["Plugin", "settings", "commands", "layout", "anims", "ui", "c9"];
    main.provides = ["menus", "Menu", "MenuItem", "Divider"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var commands = imports.commands;
        var anims = imports.anims;
        var layout = imports.layout;
        var ui = imports.ui;
        var c9 = imports.c9;
        var assert = require("c9/assert");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var items = {};
        var menus = {};
        var queue = [];
        var count = 0;
        var debug = location.href.indexOf('menus=1') > -1;
        var minimized;
        var inited, height = 31, minimizedHeight = 12;
        
        var menubar, logobar; // UI elements
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            draw();
            
            commands.addCommand({
                name: "toggleMenubar",
                group: "General",
                exec: function(e){
                    if (!minimized)
                        minimize();
                    else
                        restore();
                }
            }, plugin);
            
            // Hook deep into APF to make hotkeys work as we want
            
            apf.button.prototype.$propHandlers["hotkey"] = function(value) {
                if (this.$hotkey)
                    apf.setNodeValue(this.$hotkey, apf.isMac
                          ? apf.hotkeys.toMacNotation(this.hotkey) : this.hotkey);
    
                if (this.tooltip)
                    apf.GuiElement.propHandlers.tooltip.call(this, this.tooltip);
            };
    
            apf.item.prototype.$propHandlers["hotkey"] = function(value) {
                if (!this.$amlLoaded) {
                    var _self = this;
                    this.addEventListener("DOMNodeInsertedIntoDocument", function(e) {
                        if (_self.$hotkey && _self.hotkey)
                            apf.setNodeValue(this.$hotkey, apf.isMac
                              ? apf.hotkeys.toMacNotation(this.hotkey) : this.hotkey);
                    });
                }
                else if (this.$hotkey)
                    apf.setNodeValue(this.$hotkey,
                        apf.isMac ? apf.hotkeys.toMacNotation(value || "") : value);
            };
    
            apf.splitbutton.prototype.$propHandlers["command"] =
            apf.button.prototype.$propHandlers["command"] =
            apf.item.prototype.$propHandlers["command"] = function(value) {
                if (!value) {
                    this.removeAttribute("hotkey");
                    this.onclick = null;
                    return;
                }
    
                this.setAttribute("hotkey",
                    value && "{commands.commandManager." + value + "}" || "");
    
                this.onclick = function(e) {
                    if (e && e.htmlEvent && e.htmlEvent.button) return;
                    commands.exec(value, null, {source: "click"});
                    var command = commands.commands[value];
                    if (command && command.focusContext)
                        emit("focusEditor");
                } || null;
            };
    
            settings.on("read", function(e) {
                settings.setDefaults("state/menus", [["minimized", "false"]]);
    
                if (settings.getBool("state/menus/@minimized")) {
                    minimize(true, true);
                    minimized = true;
                }
                else {
                    minimized = false;
                }
            }, plugin);
            
            if (options.autoInit)
                init();
        }
        
        function draw(){
            // Create UI elements
            logobar = layout.findParent(plugin);
            
            menubar = logobar.insertBefore(new apf.bar({
                "id"    : "menubar",
                "class" : "fakehbox aligncenter menubar",
                "style" : "padding : 0 5px 0 3px;position:static",
            }), logobar.firstChild);
            
            menubar.insertBefore(new apf.button({
                "class"   : "c9-mbar-minimize",
                "skin"    : "c9-simple-btn",
                "onmousedown" : function(e) {
                    if (!minimized)
                        minimize();
                    else
                        restore();
                }
            }), menubar.firstChild);
            
            // Mark menu bar
            menubar.menubar = true;
            
            plugin.addElement(menubar);
    
            logobar.$ext.addEventListener("mousedown", function(){
                restore();
            });
    
            /*var logoCorner = document.querySelector(".c9-mbar-round");
    
            logobar.$ext.addEventListener("mouseover",function(e) {
                if (!minimized || !ide.inited
                  || apf.isChildOf(logobar.$ext, e.fromElement, true)
                  || apf.isChildOf(logoCorner, e.toElement, true))
                    return;
    
                clearTimeout(timer);
                timer = setTimeout(function(){
                    restore(true);
                }, 500);
            });
            logobar.$ext.addEventListener("mouseout",function(e) {
                if (!minimized || !c9.inited
                  || apf.isChildOf(logobar.$ext, e.toElement, true))
                    return;
    
                clearTimeout(timer);
                
                if (apf.popup.isShowing(apf.popup.last)) {
                    timer = setTimeout(function wait(){
                        if (apf.popup.isShowing(apf.popup.last))
                            timer = setTimeout(wait, 500);
                        else
                            minimize(true);
                    }, 500);
                }
                else {
                    timer = setTimeout(function(){
                        minimize(true);
                    }, 500);
                }
            });*/
            
            emit("draw");

            if (c9.local)
                apf.popup.setMargin({top: 50});
        }
        
        /***** Methods *****/
        
        function splitSafe(path){
           var pieces = [], escaped;
           path.split("/").forEach(function(n){
               if (escaped) n = escaped + "/" + n;
               escaped = n.substr(-1) == "\\" ? n : false; //.substr(n, n.length - 1)
               if (!escaped) pieces.push(n);
           });
           if (escaped) pieces.push(escaped);
           return pieces;
        }
        
        function popSafe(path){
            return splitSafe(path).pop().replace(/\\\//g, "/");
        }
        
        function init(){
            inited = true;
            layout.initMenus(plugin);
            
            addItemByPath("View/Menu Bar", new ui.item({
                type: "check",
                command: "toggleMenubar",
                isAvailable: function(){
                    !settings.getBool("state/menus/@minimized")
                        ? this.check() : this.uncheck();
                    return true;
                }
            }), 250, plugin);
            
            if (queue) {
                queue.forEach(function(args){
                    addItemByPath.apply(null, args);
                });
                
                queue = null;
            }
            
            emit.sticky("ready");
        }
        
        function checkItems(e) {
            if (e.value) {
                var editor = emit("getEditor");
    
                var nodes = this.childNodes;
                for (var n, prev, i = nodes.length - 1; i >= 0; i--) {
                    var cmd = (n = nodes[i]).command;

                    if (!n.visible) continue;
                    
                    // prevent dividers two consecutive dividers and dividers
                    // at bottom and top
                    if (n.localName == "divider") {
                        if (!prev || prev.localName == "divider")
                            n.hide();
                        else
                            n.show();
                        
                        prev = n;
                        continue;
                    }
                    prev = n;
                    
                    var c = cmd && commands.commands[cmd];
                    var fn = c && c.isAvailable;
                    var a = (!n.isAvailable || n.isAvailable(editor))
                      && (!fn || fn(editor));
                     
                    if (!cmd) 
                        cmd = n.command;
                    if (!cmd && !n.isAvailable)
                        continue;

                    n[a ? "enable" : "disable"]();
                }
                if (prev && prev.localName == "divider") {
                    prev.hide();
                }
            }
            
            toggleIframes(e);
        }
        
        function toggleIframes(e) {
            var frames = document.getElementsByTagName("iframe");
            for (var i = 0; i < frames.length; i++)
                frames[i].style.pointerEvents = e.value ? "none" : "";
        }
        
        function decorate(menu) {
            menu.addEventListener("prop.visible", checkItems);
        }
        
        function setRootMenu(name, index, item, menu, plugin) {
            if (item instanceof Menu) {
                menu = item.aml;
                plugin = menu;
                item = null;
            }
            else if (typeof item == "object" && !item.nodeFunc) {
                plugin = item;
                item = null;
            }
            
            if (menu instanceof Menu)
                menu = menu.aml;
            else if (!plugin && menu && !menu.nodeFunc) {
                plugin = menu;
                menu = null;
            }
            
            if (menu) {
                // if (!menu)
                //     menu.setAttribute("id", "mnuMenus" + (++count));
                menu.addEventListener("prop.visible", checkItems);
                menus[name] = menu;
            }
            else {
                menu = menus[name];
                if (!menu) {
                    menu = menus[name] = new ui.menu({
                        id: "mnuMenus" + (++count),
                        "onprop.visible" : checkItems
                    });
                }
            }
            
            var drawIt = emit("root", {
                name: name,
                menu: menu,
                index: index
            }) !== false;
            
            if (item != -1) {
                if (item) {
                    item.setAttribute("submenu", menu || "mnuMenus" + count);
                    items[name] = item;
                }
                else {
                    item = items[name];
                    if (!item && drawIt) {
                        item = items[name] = new ui.button({
                            skin: "c9-menu-btn",
                            submenu: menu,
                            margin: "0 0 0 0",
                            caption: (debug ? "(" + index + ") " : "") + name
                        });
                    }
                }
        
                if (typeof index == "number" && drawIt)
                    ui.insertByIndex(menubar, item, index, plugin);
                
                item && lifeCycleHooks(item, items, name, plugin);
            }
            
            lifeCycleHooks(menu, menus, name, plugin);
    
            return menu;
        }
    
        function setSubMenu(parent, name, index, item, menu, plugin, force) {
            if (item && !item.nodeFunc) {
                plugin = item;
                item = null;
            }
            else if (menu && !menu.nodeFunc) {
                plugin = menu;
                menu = null;
            }
            
            if (menu) {
                //Switch old menu for new menu
                if (menus[name]) {
                    var nodes = menus[name].childNodes;
                    for (var i = nodes.length - 1; i >= 0; i--) {
                        ui.insertByIndex(menu, nodes[i], nodes[i].$position, plugin);
                    }
    
                    menus[name].destroy(true, true);
                }
    
                if (!menu)
                    menu.setAttribute("id", "mnuMenus" + (++count));
                menus[name] = menu;
            }
            else {
                menu = menus[name];
                if (!menu) {
                    menu = menus[name] = new ui.menu({
                        id: "mnuMenus" + (++count),
                        "onprop.visible" : checkItems
                    });
                }
            }
            
            if (item) {
                item.setAttribute("submenu", menu);
                item.setAttribute("caption",
                    apf.escapeXML((debug ? "(" + index + ")" : "") 
                    + popSafe(name)));
                items[name] = item;
            }
            else {
                item = items[name];
                if (!item) {
                    item = items[name] = new apf.item({
                        submenu: menu,
                        caption: (debug ? "(" + index + ") " : "") +
                            popSafe(name)
                    });
                }
                else {
                    item.setAttribute("submenu", menu);
                }
            }
            
            emit("submenu", {
                name: name,
                parent: parent,
                menu: menu,
                item: item,
                index: index
            });
            
            if (typeof index == "number")
                ui.insertByIndex(parent, item, index, plugin);
            
            lifeCycleHooks(item, items, name, plugin);
            lifeCycleHooks(menu, menus, name, plugin);
    
            return menu;
        }
    
        function setMenuItem(parent, name, menuItem, index, item, plugin) {
            if (item && !item.nodeFunc) plugin = item, item = null;
            
            var itemName = popSafe(name);
            if (itemName == "~")
                name += index;
    
            item = items[name];
            if (!item) {
                item = items[name] = menuItem;
    
                if (itemName != "~") {
                    if (debug)
                        itemName = "(" + index + ") " + itemName;
                    item.setAttribute("caption", itemName.replace(/[\[\]]/, "\\$&"));
                }
            }

            item.on("DOMNodeInsertedIntoDocument", function(){
                emit("menuitem", {
                    name: name,
                    parent: parent,
                    item: item,
                    index: index
                });
            })

            //index...
            if (typeof index == "number")
                ui.insertByIndex(parent, item, index, plugin);
            else
                parent.appendChild(item);
            
            lifeCycleHooks(item, items, name, plugin);
        }
        
        function lifeCycleHooks(item, items, name, plugin) {
            if (plugin)
                plugin.addElement(item);
            
            item.on("DOMNodeRemovedFromDocument", function(){
                delete items[name];
            });
        }
    
        function addItemByPath(path, menuItem, index, menu, plugin) {
            if (!inited && index < 1000) {
                queue.push([path, menuItem, index, menu, plugin]);
                return;
            }
            
            if (index && typeof index == "object") 
                plugin = index, index = null;
            else if (menu instanceof Menu)
                menu = menu.aml;
            else if (menu && !menu.nodeFunc) 
                plugin = menu, menu = null;
            
            if (menuItem instanceof MenuItem || menuItem instanceof Divider)
                menuItem = menuItem.aml;
            
            assert(plugin !== undefined, "addItemByPath requires a plugin argument");
            
            var steps = splitSafe(path), name, p = [], isLast;
            var curpath;
    
            if (!menuItem)
                menuItem = "";
            
            for (var i = 0, l = steps.length; i < l; i++) {
                name = steps[i];
                p.push(name);
                curpath = p.join("/");
    
                //Menubar button & menu
                if (i === 0 && !menu) {
                    isLast = !steps[i + 1];
                    menu = !isLast && menus[curpath]
                      || setRootMenu(name, i == l - 1  || isLast ? index : null,
                        isLast && (!menuItem.nodeFunc && menuItem.item || menuItem.localName == "button" && menuItem),
                        isLast && (!menuItem.nodeFunc && menuItem.menu || menuItem.localName == "menu" && menuItem),
                        plugin);
                }
                //Submenu item & menu
                else if (i != l - 1 || !menuItem.nodeFunc || menuItem.localName == "menu") { // || !menuItem.nodeFunc
                    isLast = !steps[i + 1];
                    menu = !isLast && menus[curpath]
                      || setSubMenu(menu, curpath, i == l - 1 || isLast ? index : null,
                        isLast && (!menuItem.nodeFunc ? menuItem.item : menuItem.localName != "menu" && menuItem),
                        isLast && (!menuItem.nodeFunc && menuItem.menu || menuItem.localName == "menu" && menuItem),
                        plugin);
                }
                //Leaf
                else {
                    setMenuItem(menu, p.join("/"), menuItem, index, plugin);
                }
    
                if (isLast) break;
            }
    
            // return menuItem || menu;
        }
        
        function addItemToMenu(menu, menuItem, index, plugin) {
            return ui.insertByIndex(menu, menuItem, index, plugin);
        }
        
        function getMenuId(path) {
            var menu = menus[path];
            return menu && menu.id;
        }
    
        function restore(preview, noAnim) {
            if (!minimized && !preview) return;
            
            apf.setStyleClass(logobar.$ext, "", ["minimized"]);
    
            logobar.$ext.style.overflow = "hidden";
    
            anims.animateSplitBoxNode(logobar, {
                height         : height + "px",
                timingFunction : "cubic-bezier(.10, .10, .25, .90)",
                duration       : 0.15,
                immediate      : noAnim
            }, 
            function(){
                // tabs.getPanes().forEach(function(pane) {
                //     apf.layout.forceResize(pane.aml.$ext);
                // });
                logobar.$ext.style.overflow = "";
            });
    
            if (!preview) {
                settings.set("state/menus/@minimized", false);
                minimized = false;
    
                emit("restore");
            }
        }
    
        function minimize(preview, noAnim) {
            if (minimized && !preview) return;
            
            logobar.$ext.style.overflow = "hidden";
    
            anims.animateSplitBoxNode(logobar, {
                height          : minimizedHeight + "px",
                timingFunction  : "cubic-bezier(.10, .10, .25, .90)",
                duration        : 0.15,
                immediate       : noAnim
            }, 
            function(){
                apf.setStyleClass(logobar.$ext, "minimized");
                apf.layout.forceResize();
                logobar.$ext.style.overflow = "";
            });
    
            if (!preview) {
                settings.set("state/menus/@minimized", true);
                minimized = true;
    
                emit("minimize");
            }
        }
        
        function expand(path) {
            if (!items[path])
                throw new Error("Could not find menu item " + path);
            
            var steps = splitSafe(path), p = [], item;
            var curpath;
    
            for (var name, i = 0, l = steps.length; i < l; i++) {
                name = steps[i];
                p.push(name);
                curpath = p.join("/");
                
                item = items[curpath];
                item.localName == "button"
                    ? item.showMenu()
                    : item.$submenu();
            }
            
            return menus[path] || items[path];
        }
        
        function collapse(path) {
            if (!items[path])
                throw new Error("Could not find menu item " + path);
            
            var item = items[path];
            if (item.localName == "button") {
                item.hideMenu();
                item.$setState("Out", {}, "mouseout");
            }
            else {
                item.$submenu(true);
            }
        }
        
        function click(path) {
            if (!items[path])
                throw new Error("Could not find menu item " + path);
            
            var item = items[path];
            item.localName == "button"
                ? item.dispatchEvent("click")
                : item.$up();
        }
        
        function enableItem(path) {
            if (!items[path])
                throw new Error("Could not find menu item " + path);
            
            var item = items[path];
            item.enable();
            
            var menu = menus[path];
            menu && menu.enable();
        }
    
        function disableItem(path) {
            if (!items[path])
                throw new Error("Could not find menu item " + path);
            
            var item = items[path];
            item.disable();
            
            var menu = menus[path];
            menu && menu.disable();
        }
    
        function remove(path) {
            var removed = false;
            var i = path.length;
            if (path[i - 1] == "/") i -= 1; 
            
            Object.keys(items).forEach(function(p) {
                if (p.indexOf(path) === 0 && (!p[i] || p[i] === "/")) {
                    items[p].destroy(true, true);
                    delete items[p];
                    removed = true;
                }
            });
            
            Object.keys(menus).forEach(function(p) {
                if (p.indexOf(path) === 0 && (!p[i] || p[i] === "/")) {
                    menus[p].destroy(true, true);
                    delete menus[p];
                    removed = true;
                }
            });
            
            return removed;
        }
        
        function get(path) {
            return {
                item: items[path],
                menu: menus[path]
            };
        }
        
        function escape(name) {
            return name.replace(/[/]/g, "\u2044");
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("enable", function(){
            
        });
        plugin.on("disable", function(){
            
        });
        plugin.on("unload", function(){
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Draws the main application menu bar and provides an API for adding
         * and removing menus and menu items to the menu bar.
         * 
         * Example:
         * 
         *     // Add the main Edit menu button
         *     menus.setRootMenu("Edit", 200, plugin);
         * 
         *     // Add a divider to the Edit menu at position 300
         *     menus.addItemByPath("Edit/~", new Divider(), 300, plugin);
         * 
         *     // Add the cut, copy and paste menu items below the divider at positions 400 - 600
         *     menus.addItemByPath("Edit/Cut", new MenuItem({ command : "cut" }), 400, plugin);
         *     menus.addItemByPath("Edit/Copy", new MenuItem({ command : "copy" }), 500, plugin);
         *     menus.addItemByPath("Edit/Paste", new MenuItem({ command : "paste" }), 600, plugin);    
         * 
         * You can visualize the index numbers that are used by the menus by
         * starting Cloud9 with ?menus=1. This will show the index number as
         * caption of the menu items and buttons. It's always a good practice
         * to leave space between the numbers. That way other plugins can add 
         * menu items in between the ones you create. It is also good practice
         * to choose a unique range to prevent obvious collisions with other
         * plugins (e.g. 312, 315, 318).
         * 
         * @singleton
         **/
        plugin.freezePublicAPI({
            /**
             * The HTML Element for the menu bar.
             * @property {HTMLElement} container
             * @readonly
             */
            get container(){ return menubar.$ext; },
            
            /**
             * 
             */
            get minimized(){ return minimized; },
            
            /**
             * 
             */
            get height(){ return height; },
            set height(v) {
                height = v;
                if (minimized === false) restore(true, true);
            },
            get minimizedHeight(){ return minimizedHeight; },
            set minimizedHeight(v){
                minimizedHeight = v;
                if (minimized === true) minimize(true, true);
            },
            
            _events: [
                /**
                 * Fires when a reference to the focussed editor is requested.
                 * This happens when a menu is shown, to check the availability
                 * of the commands.
                 * @event getEditor
                 * @private
                 */
                "getEditor",
                /**
                 * Fires when the menus are expanded to their original height.
                 * @event restore
                 */
                "restore",
                /**
                 * Fires when the menus are collapsed to a minimal size.
                 * @event minimize
                 */
                "minimize"
            ],
            
            /**
             * Creates a button in the menu bar and adds an empty menu that
             * is shown when a user clicks the button.
             * 
             * The {@link layout} plugin creates the default menu buttons. These
             * are File, Edit, Find, View, Goto, Run, Tools, Windows. Use this
             * method to add more buttons. If you are implementing your own
             * layout plugin, use this method to define the menus yourself.
             * 
             * @param {String}     name    The caption of the menu button.
             * @param {Number}     index   Determines the position of the button. Higher indexes are more to the right.
             * @param {Menu}       [menu]  An alternative menu to attach to the button. 
             * @param {Plugin}     plugin  The plugin responsible for creating 
             *   the root menu. This is needed for proper 
             *   {@link Plugin#cleanUp} when the plugin is unloaded.
             */
            setRootMenu: setRootMenu,
            
            /**
             * Adds sub menus and menu items to the 
             * {@link #setRootMenu root menus}. You can add items many levels
             * deep. 
             * 
             * Example:
             * 
             *     var item = new MenuItem({ command: "saveas" });
             *     menus.addItemByPath("File/Save As...", item, 400, plugin);
             * 
             * Your item will only show up if the higher elements are
             * created. In the following example, the item won't show up, 
             * because the "Extra" item is not created.
             * 
             *     var item = new MenuItem({ command: "test" });
             *     menus.addItemByPath("File/Extra/Test", item, 100, plugin);
             * 
             * Any time after executing the code above you can create the
             * "Extra" item:
             * 
             *     menus.addItemByPath("File/Extra", null, 300, plugin);
             * 
             * @param {String}        path      The captions of all elements 
             *   that lead to the item to add, separated by a "/".
             * @param {MenuItem/null} menuItem  The menu item placed at the 
             *   location specified by `path`.
             * @param {Number}        index     The position of the menu item 
             *   within in the menu. Higher means lower in the menu.
             * @param {Number}        plugin    The plugin responsible for 
             *   creating the menu item. This is needed for proper 
             *   {@link Plugin#cleanUp} when the plugin is unloaded.
             */
            addItemByPath: addItemByPath,
            
            /**
             * Adds an instance of ui.item to an instance of ui.menu.
             * @param {AMLElement} menu
             * @param {AMLElement} menuItem
             * @param {Number}     index
             * @param {Plugin}     plugin
             * @private
             */
            addItemToMenu: addItemToMenu,
            
            /**
             * Enables a menu item.
             * @param {String} path  The path pointing to the item.
             */
            enableItem: enableItem,
            
            /**
             * Disables a menu item.
             * @param {String} path  The path pointing to the item.
             */
            disableItem: disableItem,
            
            /**
             * Removes a menu item.
             * @param {String} path  The path pointing to the item.
             */
            remove: remove,
            
            /**
             * Retrieves the id of a menu item. 
             * @param {String} path  The path pointing to the item.
             * @private
             */
            getMenuId: getMenuId,
            
            /**
             * Expands a menu.
             * @param {String} path  The path pointing to the menu.
             */
            expand: expand,
            
            /**
             * Collapses a menu.
             * @param {String} path  The path pointing to the menu.
             */
            collapse: collapse,
            
            /**
             * Executes the click event handlers on a menu item.
             * @param {String} path  The path pointing to the item.
             */
            click: click,
            
            /**
             * Retrieves the AMLElements for the menu and menu item for a path
             * @param {String} path  The path pointing to the menu / item.
             * @return {Object}
             * @return {AMLElement} return.menu
             * @return {AMLElement} return.item
             * @private
             */
            get: get,
            
            /**
             * @ignore
             */
            init: init,
            
            /**
             * Expands the menu bar to it's normal size
             * @fires expand
             */
            restore: restore,
            
            /**
             * Collapses the menu bar to it's smallest size
             * @fires collapse
             */
            minimize: minimize,
            
            /**
             * @ignore
             */
            decorate: decorate,
            
            /**
             * Escapes / in menu item name.
             * @param {String} name  A name of menu item.
             */
            escape: escape
        });
        
        /***** Constructors *****/
        
        function Menu(options, forPlugin) {
            var plugin = new Plugin("Ajax.org", main.consumes);
            var emit = plugin.getEmitter();
            
            var items = [], meta = {};
            var aml, lastCoords;
            
            if (!options) options = 0;
            
            function append(item) {
                ui.insertByIndex(aml, item.aml, item.position, item.plugin || forPlugin);
                
                item.menu = plugin;
                items.push(item);
                
                item.aml.on("DOMNodeRemoveFromDocument", function(){
                    items.splice(items.indexOf(item), 1);
                });
                
                return item;
            }
            
            function remove(item){
                aml.removeChild(item.aml);
            }
            
            function show(x, y, type) {
                if (type == "context") {
                    x += 2;
                    y += 2;
                }
                lastCoords = { x : x, y : y };
                aml.display(x, y);
            }
            
            plugin.on("load", function(){
                aml = new ui.menu({
                    id: options.id,
                    zindex: options.zindex,
                    visible: options.visible,
                    width: options.width,
                    height: options.height,
                    minWidth: options.minWidth,
                    minHeight: options.minHeight,
                    "onprop.visible" : function(e) {
                        emit(e.value ? "show" : "hide", lastCoords);
                        checkItems.call(this, e);
                    },
                    "onitemclick" : function(e) {
                        emit("itemclick", { value : e.value, item: e.relatedNode });
                    }
                });
                aml.cloud9menu = plugin;
                (forPlugin || plugin).addElement(aml);
                
                var items = options.items;
                if (items) {
                    for (var i = 0; i < items.length; i++)
                        append(items[i]);
                }
                
                if (typeof options.onitemclick == "function")
                    plugin.on("itemclick", options.onitemclick);
                
                aml.on("DOMNodeRemovedFromDocument", function(){
                    plugin.unload();
                });
            });
            
            /**
             * Menu Class for Cloud9. Menus can be used anywhere throughout
             * Cloud9, this includes the top menu bar as well as context menus 
             * and any other place where menus are required.
             * 
             * Menus work together with two other classes:
             * 
             * * **Menu - The container of menu items and dividers**
             *   * {@link MenuItem} - A clickable item in a menu
             *   * {@link Divider} - A break between clickable items, indicating a new logical section
             * 
             * This example shows how to create a menu with 3 menu items:
             * 
             *     var menu = new Menu({ items: [
             *         new MenuItem({ command: "open", caption: "Open..." }),
             *         new MenuItem({ command: "save", caption: "Save" }),
             *         new MenuItem({ command: "saveas", caption: "Save As..." }),
             *     ]}, plugin);
             * 
             * This example shows how to add menu items using the {@link #append} 
             * method:
             * 
             *     var menu = new Menu({}, plugin);
             *     var item = new MenuItem({ value: "unix", caption: "Unix" });
             *     menu.append(item);
             * 
             * The following code shows a menu as a context menu:
             * 
             *     document.addEventListener("mousedown", function(e) {
             *         if (e.button == 2)
             *             menu.show(e.x, e.y);
             *     }, false);
             */
            /**
             * @constructor
             * Creates a new Menu instance.
             * @param {Object} options
             * @param {Array}  options.items  The menu items to add. See {@link #items}.
             * @param {Plugin} plugin         The plugin responsible for creating this menu.
             */
            plugin.freezePublicAPI({
                /**
                 * The APF UI element that is presenting the menu in the UI.
                 * This property is here for internal reasons only. *Do not 
                 * depend on this property in your plugin.*
                 * @property {ui.menu} aml
                 * @private
                 * @readonly
                 */
                get aml(){ return aml; },
                /**
                 * A meta data object that allows you to store whatever you want
                 * in relation to this menu.
                 * @property {Object} meta
                 * @readonly
                 */
                get meta(){ return meta; },
                /**
                 * The HTMLElement representing the menu
                 * @property {HTMLElement} html
                 * @readonly
                 */
                get html(){ return aml && aml.$ext; },
                /**
                 * The button or item responsible for displaying this menu
                 * @property {HTMLElement} opener
                 * @readonly
                 */
                get opener(){ return aml.opener && aml.opener.cloud9item; },
                /**
                 * Specifies whether the menu is shown
                 * @property {Boolean} visible
                 * @readonly
                 */
                get visible(){ return aml.visible; },
                /**
                 * Specifies the zindex of the menu
                 * @property {Number} zindex
                 */
                get zindex(){ return aml && ui.getStyle(aml.$ext, "z-index"); },
                set zindex(value) { aml && aml.setAttribute("zindex", value); },
                /**
                 * Specifies the width of the menu
                 * @property {Number} width
                 */
                get width(){ return aml && aml.getWidth(); },
                set width(value) { aml && aml.setAttribute("width", value); },
                /**
                 * Specifies the height of the menu
                 * @property {Number} height
                 */
                get height(){ return aml && aml.getHeight(); },
                set height(value) { aml && aml.setAttribute("height", value); },
                /**
                 * Specifies the minimal width of the menu
                 * @property {Number} width
                 */
                get minWidth(){ return aml && aml.getAttribute("minwidth"); },
                set minWidth(value) { aml && aml.setAttribute("minwidth", value); },
                /**
                 * Specifies the minimal height of the menu
                 * @property {Number} height
                 */
                get minHeight(){ return aml && aml.getAttribute("minheight"); },
                set minHeight(value) { aml && aml.setAttribute("minheight", value); },
                /**
                 * The menu items appended to this menu
                 * @property {MenuItem[]} items
                 * @readonly
                 */
                get items(){ return items.slice(0); },
                
                _events: [
                    /**
                     * Fires when a user clicks on one of the menu items
                     * @event itemclick
                     * @param {Object} e
                     * @param {Object} e.value  The value of the menu item that was clicked.
                     */
                    "itemclick",
                    /**
                     * Fires when the menu is shown
                     */
                    "show",
                    /**
                     * Fires when the menu is hidden
                     */
                    "hide"
                ],
                
                /**
                 * Append a menu item to this menu at the position specified
                 * by the {@link MenuItem#position item's position property}.
                 * @param {MenuItem} item  The item to add to this menu.
                 */
                append: append,
                
                /**
                 * Remove a menu item from this menu
                 * @param {MenuItem} item  The item to remove from this menu.
                 */
                remove: remove,
                
                /**
                 * Show the menu at the specified position
                 * @param {Number} x  The x coordinate specified in pixels from the left of the browser window.
                 * @param {Number} y  The y coordinate specified in pixels from the top of the browser window.
                 */
                show: show
            });
            
            plugin.load(null, "menu");
            
            return plugin;
        }
        
        function MenuItem(options, forPlugin) {
            var plugin = new Plugin("Ajax.org", main.consumes);
            var emit = plugin.getEmitter();
            
            var aml, menu, position = options.position;
            
            plugin.on("load", function(){
                var opts = {
                    "onmousedown" : function(e){ emit("mousedown"); },
                    "onmousemove" : function(e){ emit("mousemove"); },
                    "onmouseup"   : function(e){ emit("onmouseup"); },
                    "onclick"     : function(e){ emit("click"); }
                };
                
                for (var prop in options) {
                    if (prop.substr(0, 2) == "on")
                        plugin.on(prop.substr(2), options[prop]);
                    else if (prop == "submenu") {
                        if (options.submenu)
                            opts.submenu = options.submenu.aml || options.submenu;
                    }
                    else if (prop != "isAvailable")
                        opts[prop] = options[prop];
                }
                
                aml = new ui.item(opts);
                aml.cloud9item = plugin;
                plugin.addElement(aml);
                
                if (options.isAvailable)
                    aml.isAvailable = options.isAvailable;
                
                aml.on("DOMNodeRemoveFromDocument", function(){
                    plugin.unload();
                });
            });
            
            /**
             * MenuItem Class for Cloud9. Menu items should always be 
             * appended to {@link Menu Menus}. A menu item can offer a way for 
             * a user to execute a function, toggle a feature or select an item
             * out of several choices. See {@link #type} for more
             * information. A menu item can also be the anchor for a 
             * {@link #submenu sub menu}.
             * 
             * MenuItems work together with two other classes:
             * 
             * * {@link Menu} - The container of menu items and dividers
             *   * **MenuItem - A clickable item in a menu**
             *   * {@link Divider} - A break between clickable items, indicating a new logical section
             * 
             * This example shows how to create a menu with 3 menu items of
             * which only one can be selected at the same time:
             * 
             *     var menu = new Menu({ items: [
             *         new MenuItem({ type: "radio", value: "1", caption: "#1" }),
             *         new MenuItem({ type: "radio", value: "2", caption: "#2" }),
             *         new MenuItem({ type: "radio", value: "3", caption: "#3" }),
             *     ]}, plugin);
             * 
             * This example shows how to create a menu item with an icon and
             * a method that is called when the user clicks on the item:
             * 
             *     var item = new MenuItem({ 
             *         caption : "Alert" 
             *         icon    : "alert.png" 
             *         onclick : function(){
             *             alert("Alert!");
             *         }
             *     });
             */ 
            /** 
             * @constructor
             * Creates a new MenuItem instance.
             * @param {Object}   options
             * @param {Boolean}  options.disabled     See {@link #disabled}.
             * @param {String}   options.icon         See {@link #icon}.
             * @param {String}   options.type         See {@link #type}.
             * @param {String}   options.value        See {@link #value}.
             * @param {String}   options.caption      See {@link #caption}.
             * @param {String}   options.group        See {@link #group}.
             * @param {Boolean}  options.checked      See {@link #checked}.
             * @param {Menu}     options.submenu      See {@link #submenu}.
             * @param {String}   options.command      See {@link #command}.
             * @param {Number}   options.position     See {@link #position}.
             * @param {Plugin}   plugin               The plugin responsible for creating this menu item.
             */
            plugin.freezePublicAPI({
                /**
                 * The APF UI element that is presenting the menu item in the UI.
                 * This property is here for internal reasons only. *Do not 
                 * depend on this property in your plugin.*
                 * @property {ui.item} aml
                 * @private
                 * @readonly
                 */
                get aml(){ return aml; },
                /**
                 * The HTMLElement representing the menu item
                 * @property {HTMLElement} html
                 * @readonly
                 */
                get html(){ return aml && aml.$ext; },
                /**
                 * The plugin that is responsible for creating this menu item.
                 * @property {Plugin} plugin
                 * @readonly
                 */
                get plugin(){ return forPlugin; },
                
                /**
                 * Sets or retrieves the menu that this menu item is appended to
                 * @property {Menu} menu
                 * @readonly
                 */
                get menu(){ return menu },
                set menu(m){ menu = m },
                
                /**
                 * Sets or retrieves whether this item is disabled. When the 
                 * item is disabled, the caption is grayed out and the user is 
                 * unable to click the item.
                 * @property {Boolean} [disabled=false]
                 */
                get disabled(){ return aml.disabled; },
                set disabled(v){ aml.setAttribute("disabled", v); },
                
                /**
                 * Sets or retrieves he url pointing to the icon that is shown 
                 * next to the caption of this menu item.
                 * @property {String} icon
                 */
                get icon(){ return aml.icon; },
                set icon(v){ aml.setAttribute("icon", v); },
                
                /**
                 * Sets or retrieves the type of interaction this menu item 
                 * offers to the user. A menu item can have three different 
                 * behaviors:
                 * 
                 * <table>
                 * <tr><td>Type</td><td>    Behavior</td></tr>
                 * <tr><td>"radio"</td><td> This item shows a closed circle in 
                 *   front of the caption when selected. Only one item can be 
                 *   selected in the {@link #group} that it belongs to.</td></tr>
                 * <tr><td>"check"</td><td> This item shows a check in front of
                 *   the caption when in the {@link #checked} state. The user 
                 *   can click on the item to change the state of 
                 *   the item.</td></tr>
                 * <tr><td>null</td><td>    This item has no state and behaves
                 *   as if the type property was never set.</td></tr>
                 * </table>
                 * 
                 * This example shows two different sets of radio menu items in 
                 * the same menu:
                 * 
                 *     var menu = new Menu({ items: [
                 *         new MenuItem({ type: "radio", group: "nr", value: "1", caption: "#1" }),
                 *         new MenuItem({ type: "radio", group: "nr", value: "2", caption: "#2" }),
                 *         new MenuItem({ type: "radio", group: "nr", value: "3", caption: "#3" }),
                 *         new Divider(),
                 *         new MenuItem({ type: "radio", group: "alpha", value: "a", caption: "A" }),
                 *         new MenuItem({ type: "radio", group: "alpha", value: "b", caption: "B" }),
                 *     ]}, plugin);
                 * 
                 * This example shows a check menu item:
                 * 
                 *     var item = new MenuItem({
                 *         type    : "check"
                 *         caption : "Status Bar"
                 *         checked : true
                 *     });
                 * 
                 * This example shows a menu item that gets it's checked state
                 * from the {@link settings}.
                 * 
                 *     var item = new MenuItem({
                 *         type    : "check"
                 *         caption : "Status Bar"
                 *         checked : "user/statusbar/@show"
                 *     });
                 * 
                 * * See also {@link MenuItem#checked}
                 * * See also {@link MenuItem#group}
                 * 
                 * @property {String} type
                 */
                get type(){ return aml.type; },
                set type(v){ aml.setAttribute("type", v); },
                
                /**
                 * Sets or retrieves the string that is used to uniquely 
                 * identify this item
                 * @property {String} value
                 */
                get value(){ return aml.value; },
                set value(v){ aml.setAttribute("value", v); },
                
                /**
                 * Sets or retrieves the text displayed in the UI on this 
                 * menu item
                 * @property {String} caption
                 */
                get caption(){ return aml.caption; },
                set caption(v){ aml.setAttribute("caption", v); },
                
                /**
                 * Sets or retrieves the group of a radio menu item set. 
                 * See also {@link #type}
                 * @property {String} group
                 */
                get group(){ return aml.group; },
                set group(v){ aml.setAttribute("group", v); },
                
                /**
                 * Sets or retrieves whether this item has a checkbox or is 
                 * the selected item in a radio group.
                 * 
                 * This example shows a menu item that gets it's checked state
                 * from the {@link settings}.
                 * 
                 *     var item = new MenuItem({
                 *         type    : "check"
                 *         caption : "Status Bar"
                 *         checked : "user/statusbar/@show"
                 *     });
                 * 
                 * @property {Boolean} checked
                 */
                get checked(){ return aml.checked; },
                set checked(v){ aml.setAttribute(
                    aml.type == "radio" ? "selected" : "checked", v); },
                
                /**
                 * Sets or retrieves the submenu shown when the user hovers
                 * over this menu item.
                 * @property {MenuItem} submenu
                 */
                get submenu(){ return aml.submenu && aml.submenu.cloud9menu; },
                set submenu(v){ aml.setAttribute("submenu", v.aml || v); },
                
                /**
                 * Sets or retrieves the name of the command to execute when
                 * the user clicks on the menu item.
                 * @property {String} command
                 */
                get command(){ return aml.command; },
                set command(v){ aml.setAttribute("command", v); },
                
                /**
                 * Retrieves the position of the menu item in the menu.
                 * @property {Number} position
                 * @readonly
                 */
                get position(){ return position; },
                
                show: function(){ aml.show(); },
                hide: function(){ aml.hide(); }
            });
            
            plugin.load(null, "menuitem");
            
            return plugin;
        }
        
        function Divider(options, forPlugin) {
            var plugin = new Plugin("Ajax.org", main.consumes);
            // var emit = plugin.getEmitter();
            
            var aml, menu, position = options && options.position;
            
            plugin.on("load", function(){
                aml = new ui.divider();
                aml.cloud9item = plugin;
                plugin.addElement(aml);
                
                aml.on("DOMNodeRemoveFromDocument", function(){
                    plugin.unload();
                });
            });
            
            /**
             * Divider Class for Cloud9. 
             * 
             * Dividers work together with two other classes:
             * 
             * * {@link Menu} - The container of menu items and dividers
             *   * {@link MenuItem} - A clickable item in a menu
             *   * **Divider - A break between clickable items, indicating a new logical section**
             * 
             * This example shows a menu with 2 dividers.
             * 
             *     var menu = new Menu({ items: [
             *         new MenuItem({ type: "radio", group: "nr", value: "1", caption: "#1" }),
             *         new MenuItem({ type: "radio", group: "nr", value: "2", caption: "#2" }),
             *         new MenuItem({ type: "radio", group: "nr", value: "3", caption: "#3" }),
             *         new Divider(),
             *         new MenuItem({ value: "a", caption: "A" }),
             *         new MenuItem({ value: "b", caption: "B" }),
             *         new Divider(),
             *         new MenuItem({ value: "test",    caption: "Test" }),
             *         new MenuItem({ value: "example", caption: "Example" }),
             *     ]}, plugin);
             * 
             * This example shows how to append a divider to a menu
             * 
             *     var menu = new Menu({}, plugin);
             *     menu.append(new Divider({ position: 100 }, plugin));
             * 
             */
            /**
             * @constructor
             * Creates a new Divider instance.
             * @param {Object} options
             * @param {Array}  options.position     See {@link #position}.
             * @param {Plugin} plugin               The plugin responsible for creating this divider.
             */
            plugin.freezePublicAPI({
                /**
                 * The APF UI element that is presenting the menu item in the UI.
                 * This property is here for internal reasons only. *Do not 
                 * depend on this property in your plugin.*
                 * @property {ui.divider} aml
                 * @private
                 * @readonly
                 */
                get aml(){ return aml; },
                /**
                 * The HTMLElement representing the menu item
                 * @property {HTMLElement} html
                 * @readonly
                 */
                get html(){ return aml && aml.$ext; },
                /**
                 * The plugin that is responsible for creating this menu item.
                 * @property {Plugin} plugin
                 * @readonly
                 */
                get plugin(){ return forPlugin; },
                /**
                 * Sets or retrieves the menu that this menu item is appended to
                 * @property {Menu} menu
                 * @readonly
                 */
                get menu(){ return menu },
                set menu(m){ menu = m },
                /**
                 * Retrieves the position of the menu item in the menu.
                 * @property {Number} position
                 * @readonly
                 */
                get position(){ return position; },
                
                show: function(){ aml.show(); },
                hide: function(){ aml.hide(); }
            });
            
            plugin.load(null, "divider");
            
            return plugin;
        }
        
        register(null, {
            menus: plugin,
            Menu: Menu,
            MenuItem: MenuItem,
            Divider: Divider,
        });
    }
});