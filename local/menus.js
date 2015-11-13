
function MenuManager(){
    var windowManager, connection, win, gui;
    var nativeMenuBar;
    
    // Lookup table for the menus
    var menus = {};
    var timers = {};
    
    var TIMEOUT = 500;
    
    function checkNativeItems(menu, name) {
        var id = windowManager.activeWindowId;
        if (id === 0) {
            menu.items.forEach(function(item){
                if (item.key != "q")
                    item.enabled = false;
            });
            gui.App.doneMenuShow();
            return;
        }
        
        // Lets wait TIMEOUT ms before we force show the window
        clearTimeout(timers[name]);
        timers[name] = setTimeout(function(){
            var menu = menus[name].submenu;
            var nodes = menu.items.map(function(i){
                return { 
                    name: i.originalName, 
                    disabled: i.originalName != "Cloud9/Quit Cloud9", 
                    visible: true 
                }
            });
            updateMenu(name, nodes);
        }, TIMEOUT);
        
        // The window needs to send "showMenu" back - which calls updateMenu
        connection.sendToWindow(id, "menuShow", { name: name });
    }
    
    function menuReady(name){
        clearTimeout(timers[name]);
        gui.App.doneMenuShow();
    }
    
    function updateMenu(name, nodes){
        var menu = menus[name].submenu;
        var item;
        
        var found = {};
        
        for (var n, i = nodes.length - 1; i >= 0; i--) {
            n = nodes[i];
            item = menus[n.name];
            found[n.name] = true;
            
            if (!item) {
                if (n.submenu)
                    setSubMenu(n);
                else
                    setMenuItem(n);
                continue;
            }
            
            // Disabled
            item.enabled = !n.disabled;
            
            // This is for internal use
            if (!n.caption) 
                continue;
            
            // Toggle visibility
            if (n.visible && menu.items.indexOf(item) == -1) {
                nativeInsertByIndex(menu, item, n.index);
                item.index = n.index;
            }
            else if (!n.visible && menu.items.indexOf(item) != -1) {
                item.visible = false;
                menu.remove(item);
            }
            
            // Don't update items that are not visible
            if (!n.visible)
                continue;
            
            if (item.label != n.caption)
                item.label = n.caption.replace(/\u2044/g, "/").trim();
            
            // Update hotkey if needed
            if (n.key != item.key || n.modifiers != item.modifiers) {
                item.key = n.key;
                item.modifiers = n.modifiers;
            }
            
            // Checkboxes and Radiobuttons
            if (item.type == "checkbox")
                item.checked = n.checked;
        }
        
        // Hide the menu items that are not found
        var items = menu.items;
        for (var i = items.length - 1; i >= 0; i--) {
            if (!found[items[i].originalName]) {
                items[i].visible = false;
                menu.remove(items[i]);
            }
        }
        
        menuReady(name);
    }
    
    function decorateMenu(menu, path) {
        // Add show event
        menu.on("show", checkNativeItems.bind(this, menu, path));
    }
    
    function nativeInsertByIndex(parent, item, index) {
        item.$position = index;

        var beforeNode, diff = 100000000, nodes = parent.items;
        for (var i = 0, l = nodes.length; i < l; i++) {
            var d = nodes[i].$position - index;
            if (d > 0 && d < diff) {
                beforeNode = i;
                diff = d;
            }
        }
        
        parent.insert(item, isNaN(beforeNode) ? nodes.length : beforeNode);
        
        item.visible = true;
        
        return item;
    }
    
    function incrementIfExist(name, forceVisible) {
        if (!menus[name]) return false;
        var item = menus[name];
        item.increment++;
        
        if (forceVisible && !item.visible)
            nativeInsertByIndex(findParent(name), item, forceVisible.index);
        
        return true;
    }
    
    function addItem(name, item) {
        menus[name] = item;
        item.increment = 1;
        item.originalName = name;
    }
    
    function setRootMenu(e){
        var item = nativeInsertByIndex(nativeMenuBar, new gui.MenuItem({
            label: e.name,
            submenu: new gui.Menu()
        }), e.index);
        
        decorateMenu(item.submenu, e.name);
        
        addItem(e.name, item);
        
        // Assign Menu Bar to Window
        if (!win.menu)
            win.menu = nativeMenuBar;
    }
    
    function setSubMenu(e){
        var parent = findParent(e.name);
        var item = nativeInsertByIndex(parent, new gui.MenuItem({
            label: e.name.split("/").pop(),
            submenu: new gui.Menu()
        }), e.index);
        
        decorateMenu(item.submenu, e.name);
        
        addItem(e.name, item);
    }
    
    function setMenuItem(e){
        var item;
        var itemName = e.name.split("/").pop();
        var parent = findParent(e.name);
        
        if (itemName.charAt(0) == "~") {
            item = new gui.MenuItem({ type: "separator" });
        } else {
            // Special Cases see https://github.com/rogerwang/node-webkit/compare/mac#diff-945bfbb0fd440b87cfe8ebf76f11c970R161
            if (e.name.slice(0, 4) == "Edit") {
                if (itemName == "Cut") {
                    e.selector = "cut:";
                    e.key = "x";
                }
                else if (itemName == "Copy") {
                    e.selector = "copy:";
                    e.key = "c";
                }
                else if (itemName == "Paste") {
                    e.selector = "paste:";
                    e.key = "v";
                }
                else if (itemName == "Select All") {
                    e.selector = "selectAll:";
                    e.key = "a";
                }
                else if (itemName == "Undo") {
                    e.selector = "undo:";
                    e.key = "z";
                }
                else if (itemName == "Redo") {
                    e.selector = "redo:";
                    e.key = "z";
                    e.modifiers = "cmd-shift";
                }
            }
            
            var options = {
                label: itemName.replace(/\u2044/g, "-"),
                enabled: !e.disabled,
                type: e.itemtype == "check" 
                    || e.itemtype == "radio" ? "checkbox" : "normal",
                selector: e.selector,
                key: e.key,
                modifiers: e.modifiers,
                click: function(){
                    var id = windowManager.activeWindowId;
                    if (id === undefined) return;
                    
                    connection.sendToWindow(id, "menuClick", {
                        name: e.name
                    });
                }
            };
                
            item = new gui.MenuItem(options);
            item.index = e.index;
        }
        
        nativeInsertByIndex(parent, item, e.index);
            
        addItem(e.name, item);
    }
    
    function removeItem(path) {
        if (menus[path] && --menus[path].increment === 0) {
            menus[path].menu.remove(menus[path]);
            delete menus[path];
        }
    }
    
    function findParent(path) {
        var p = path.split("/"); p.pop(); 
        var parent = menus[p.join("/")];
        return parent.submenu;
    }
    
    this.init = function(wm) {
        windowManager = wm;
        
        windowManager.registerSharedModule("nativeMenuBar", function(windowManager, cn) {
            win = windowManager.$allWindows.root;
            gui = win.window.nwGui;
            
            // Assign Connection
            connection = cn;
            
            // Create Menu Bar
            nativeMenuBar = new gui.Menu({ type: "menubar" });
            
            setRootMenu({name: "Cloud9", index: 50});
            setRootMenu({name: "File", index: 100});
            setRootMenu({name: "Edit", index: 200});
            setRootMenu({name: "Find", index: 300});
            setRootMenu({name: "View", index: 400});
            setRootMenu({name: "Goto", index: 500});
            setRootMenu({name: "Run", index: 600});
            setRootMenu({name: "Tools", index: 700});
            setRootMenu({name: "Window", index: 800});
            setRootMenu({name: "Help", index: 900});
            
            // Set Up Message Listeners
            connection.on("setRoot", function(e) {
                if (incrementIfExist(e.name)) return;
                
                setRootMenu(e);
            });
            
            connection.on("setSubMenu", function(e) {
                if (incrementIfExist(e.name)) return;
                
                setSubMenu(e);
            });
            
            connection.on("setMenuItem", function(e) {
                if (incrementIfExist(e.name, e)) return;
                
                setMenuItem(e);
            });
            
            connection.on("remove", function(e) {
                removeItem(e.name);
            });
            
            connection.on("showMenu", function(e) {
                updateMenu(e.name, e.items);
            });
            
            connection.on("enableUndoRedo", function(e) {
                var menu = menus["Edit"].submenu;
                
                ["Edit/Undo", "Edit/Redo"].forEach(function(path){
                    var item = menus[path];
                    if (item && menu.items.indexOf(item) == -1)
                        nativeInsertByIndex(menu, item, item.index);
                });
            });
            
            connection.on("builtin", function(e) {
                if (!win.hasBuiltIn) {
                    while (nativeMenuBar.items.length) {
                        nativeMenuBar.remove(nativeMenuBar.items[0]);
                    }
                    
                    nativeMenuBar.createMacBuiltin("Cloud9");
                    win.menu = nativeMenuBar;
                    win.hasBuiltIn = true;
                }
            });
        });
    };
}

module.exports = new MenuManager();