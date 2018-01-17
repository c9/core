define(function(require, exports, module) {
    main.consumes = [
        "DebugPanel", "settings", "ui", "util", "debugger", "ace", "commands",
        "menus", "Menu", "MenuItem", "Divider", "panels", "layout"
    ];
    main.provides = ["watches"];
    return main;

    function main(options, imports, register) {
        var DebugPanel = imports.DebugPanel;
        var settings = imports.settings;
        var ui = imports.ui;
        var debug = imports.debugger;
        var util = imports.util;
        var layout = imports.layout;
        var menus = imports.menus;
        var commands = imports.commands;
        var ace = imports.ace;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        var panels = imports.panels;
        
        var keys = require("ace/lib/keys");
        var markup = require("text!./watches.xml");
        var Variable = require("./data/variable");
        var Tree = require("ace_tree/tree");
        var TreeData = require("./variablesdp");
        var TreeEditor = require("ace_tree/edit");
        
        /***** Initialization *****/
        
        var plugin = new DebugPanel("Ajax.org", main.consumes, {
            caption: "Watch Expressions",
            index: 100
        });
        var emit = plugin.getEmitter();
        
        var count = 0;
        var watches = [];
        var dirty = false;
        var dbg, model, datagrid, errorWatch;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            model = new TreeData();
            model.emptyMessage = "Type an expression here...";
            model.$sortNodes = false;
            
            model.loadChildren = function(node, callback) {
                if (node.isNew)
                    return callback(true);
                    
                emit("expand", {
                    variable: node,
                    expand: callback
                });
            };
            
            model.columns = [{
                caption: "Expression",
                match: "name",
                value: "name",
                width: "60%",
                icon: true,
                type: "tree",
                editor: "textbox"
            }, { 
                caption: "Value",
                value: "value",
                width: "40%",
                editor: "textbox"
            }, { 
                caption: "Type",
                value: "type",
                width: "55"
            }];
            
            // Set and clear the dbg variable
            debug.on("attach", function(e) {
                dbg = e.implementation;
                updateAll();
            });
            debug.on("detach", function(e) {
                dbg = null;
            });
            debug.on("stateChange", function(e) {
                if (errorWatch)
                    removeWatch(errorWatch);
                
                plugin[e.action]();
                if (e.action == "enable")
                    updateAll();
            });
            debug.on("framesLoad", function(e) {
                // Update Watchers
                updateAll();
            });
            debug.on("exception", function(e) {
                errorWatch = e.exception;
                addWatch(errorWatch);
                model.expand(errorWatch);
            });
            
            plugin.on("expand", function(e) {
                if (e.variable.parent == model.root)
                    return e.expand && e.expand(e.variable.error);
                dbg.getProperties(e.variable, function(err, properties) {
                    updateVariable(e.variable, properties);
                    e.expand && e.expand();
                });
            });
            
            // Add Watch hook into ace
            commands.addCommand({
                name: "addwatchfromselection",
                bindKey: { mac: "Command-Shift-C", win: "Ctrl-Shift-C" },
                hint: "Add the selection as a watch expression",
                isAvailable: function(editor) { 
                    var ace = dbg && editor && editor.ace;
                    return ace && !ace.selection.isEmpty();
                },
                exec: function(editor) { 
                    if (!editor.ace.selection.isEmpty())
                        addWatch(editor.ace.getCopyText());
                }
            }, plugin);
    
            // right click context item in ace
            ace.getElement("menu", function(menu) {
                menus.addItemToMenu(menu, new ui.item({
                    caption: "Add As Watch Expression",
                    command: "addwatchfromselection"
                }), 600, plugin);
            });
            
            // restore the variables from the IDE settings
            settings.on("read", function (e) {
                (settings.getJson("state/watches") || []).forEach(function(name) {
                    watches.push(new Variable({ 
                        name: name, 
                        ref: "fromsettings" + count++ 
                    }));
                });
                
                reloadModel();
                
                if (dbg)
                    updateAll();
            });
            
            settings.on("write", function (e) {
                if (dirty) {
                    settings.setJson("state/watches", watches.filter(function(w) {
                        return w !== errorWatch;
                    }).map(function(w) { 
                        return w.name;
                    }));
                    dirty = false;
                }
            });
        }

        var drawn;
        function draw(options) {
            if (drawn) return;
            drawn = true;
            
            // Create UI elements
            ui.insertMarkup(options.aml, markup, plugin);
        
            var datagridEl = plugin.getElement("datagrid");
            datagrid = new Tree(datagridEl.$ext);
            datagrid.setTheme({ cssClass: "blackdg" });
            datagrid.setOption("maxLines", 200);
            
            layout.on("eachTheme", function(e) {
                var height = parseInt(ui.getStyleRule(".blackdg .row", "height"), 10) || 24;
                // model.rowHeightInner = height - 1;
                model.rowHeight = height;
                
                if (e.changed) datagrid.resize(true);
            });
            
            datagrid.setDataProvider(model);
            datagrid.edit = new TreeEditor(datagrid);
            panels.on("afterAnimate", function(e) {
                if (panels.isActive("debugger"))
                    datagrid && datagrid.resize();
            });
            
            reloadModel();

            var contextMenu = new Menu({
                items: [
                    new MenuItem({ value: "edit1", caption: "Edit Watch Expression" }),
                    new MenuItem({ value: "edit2", caption: "Edit Watch Value" }),
                    new Divider(),
                    new MenuItem({ value: "remove", caption: "Remove Watch Expression" }),
                ]
            }, plugin);
            contextMenu.on("itemclick", function(e) {
                if (e.value == "edit1")
                    datagrid.edit.startRename(null, 0);
                else if (e.value == "edit2")
                    datagrid.edit.startRename(null, 1);
                else if (e.value == "remove")
                    datagrid.execCommand("delete");
            });
            contextMenu.on("show", function(e) {
                var selected = datagrid.selection.getCursor();
                var isNew = selected && selected.isNew;
                var isProp = selected.parent != model.root;
                contextMenu.items[0].disabled = !selected || isProp;
                contextMenu.items[1].disabled = !selected || !!isNew;
                contextMenu.items[3].disabled = !selected || !!isNew || isProp;
            });
            
            datagridEl.setAttribute("contextmenu", contextMenu.aml);
            
            datagrid.on("delete", function(e) {
                var nodes = datagrid.selection.getSelectedNodes();
                nodes.forEach(function (node) {
                    var idx = watches.indexOf(node);
                    if (idx != -1) {
                        model._signal("remove", node);
                        watches.splice(idx, 1);
                    }
                });
                reloadModel();
                dirty = true;
                settings.save();
            });
            
            var justEdited = false;
            
            datagrid.on("rename", function(e) {
                var node = e.node;
                var name = e.value;
                var value = node.value;
                var isNew = node.isNew;
                var column = e.column;
                var parents = [];
                var variable, oldValue;
                
                // Delete a watch by removing the expression
                if (!name) {
                    datagrid.execCommand("delete");
                    return;
                }
                
                // If we've filled a new watch remove the new attribute
                if (isNew) {
                    variable = new Variable({
                        name: name,
                        value: value,
                        ref: node.ref
                    });
                    watches.push(variable);
                }
                else {
                    // variable = node;
                    if (watches.indexOf(node) != -1)
                        variable = node;
                    else if (node.ref)
                        variable = findVariable(node.ref, parents);
                    
                    if (column.value == "value") {
                        oldValue = variable.value;
                        value = variable.value = name;
                    }
                    else {
                        variable.name = name;
                        isNew = true;
                    }
                    
                    if (variable.error) {
                        isNew = true;
                        variable.ref = null;
                    }
                }
                
                dirty = true;
                settings.save();
                reloadModel();
                
                setWatch(variable, value, isNew, oldValue, node, parents);
            });
            
            datagrid.on("beforeRename", function(e) {
                // Don't allow setting the value of new variables
                if (e.column.caption == "Value" 
                  && (e.node.ref + "").substr(0, 3) == "new") {
                    datagrid.edit.startRename(null, 0);
                    return e.preventDefault();
                }
                
                // When editing a property name, always force editing the value
                if (e.column.caption == "Expression"
                  && e.node.parent != model.root) {
                    datagrid.edit.startRename(null, 1);
                    return e.preventDefault();
                }
                
                if (e.column.caption != "Expression"
                  && dbg && !dbg.features.updateWatchedVariables)
                    return e.preventDefault();
            });
            
            datagrid.on("rename", function(e) {
                justEdited = true;
                setTimeout(function() { justEdited = false; }, 500);
            });
            
            datagrid.textInput.getElement().addEventListener("keydown", function(e) {
                var cursor = datagrid.selection.getCursor();
                var key = keys[e.keyCode] || "";
                if (key.length == 1 || key.substr(0, 3) == "num" && cursor && !justEdited)
                    datagrid.edit.startRename(cursor, 0);
            }, true);
            
            datagrid.textInput.getElement().addEventListener("keyup", function(e) {
                var cursor = datagrid.selection.getCursor();
                if (e.keyCode == 13 && cursor && !justEdited)
                    datagrid.edit.startRename(cursor, 0);
            }, true);
        }
        
        /***** Methods *****/
        
        function addWatch(expression) {
            var variable;
            
            if (expression instanceof Variable) {
                variable = expression;
            }
            else {
                variable = new Variable({
                    name: expression,
                    value: "",
                    ref: ""
                });
                setWatch(variable, null, true, null, {}, []);
            }
            watches.push(variable);
            
            reloadModel();
            
            dirty = true;
            settings.save();
        }
        
        function removeWatch(variable) {
            watches.splice(watches.indexOf(variable), 1);
            reloadModel();
            
            dirty = true;
            settings.save();
        }
        
        function setWatch(variable, value, isNew, oldValue, node, parents) {
            if (!dbg)
                return; // We've apparently already disconnected.
            
            variable.status = "pending";
            // Editing watches in the current or global frame
            // Execute expression
            if (isNew) {
                dbg.evaluate(variable.name, debug.activeFrame, 
                  !debug.activeFrame, true, function(err, serverVariable) {
                    if (err) {
                        variable.json = {
                            name: variable.name,
                            value: err.message,
                            error: true
                        };
                        updateVariable(variable, [], node, true);
                        return;
                    }
                        
                    variable.json = serverVariable.json;

                    updateVariable(variable, 
                        variable.properties || [], node);
                });
            }
            // Set new value of a property
            else {
                dbg.setVariable(variable, value, debug.activeFrame, function(err) {
                    if (err) {
                        variable.value = oldValue;
                        updateVariable(variable, [], node, true);
                        return;
                    }
                        
                    // Reload properties of the variable
                    dbg.getProperties(variable, function(err, properties) {
                        updateVariable(variable, properties, node);
                    });
                });
            }
            
            emit("setWatch", {
                name: node.name,
                value: value,
                node: node,
                isNew: isNew,
                variable: variable,
                parents: parents
            });
        }
        
        function updateAll() {
            watches.forEach(function(variable) {
                setWatch(variable, undefined, true, null, variable, []);
            });
        }
        
        function findVariable(ref, parents) {
            if (typeof ref == "object")
                ref = ref.getAttribute("ref");
            
            var result;
            for (var i = 0, l = watches.length; i < l; i++) {
                if (watches[i].ref == ref)
                    return watches[i];
                
                result = watches[i].findVariable(ref, null, parents);
                if (result) return result;
            }
        }
        
        function updateVariable(variable, properties, node, error) {
            // Pass node for recursive trees
            variable.error = error;
            if (!variable.parent || variable.parent == model.root)
                reloadModel();
            else
                model.updateNode(variable);
        }

        function reloadModel() {
            model.newWatchNode = model.newWatchNode || {
                name: model.emptyMessage,
                className: "newwatch",
                fullWidth: true,
                isNew: true,
            };
            model.setRoot({
                items: [].concat(watches, model.newWatchNode),
                $sorted: true
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
            plugin.once("draw", draw);
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * The watch expression panel for the {@link debugger Cloud9 debugger}.
         * 
         * This panel allows a user to add small expressions that are evaluated
         * continuously, displaying the result of the expression in the UI. This
         * allows a user to monitor what is going on while stepping through the
         * code.
         * 
         * @singleton
         * @extends DebugPanel
         **/
        plugin.freezePublicAPI({
            /**
             * A list of variables that are watched.
             * @param {debugger.Variable[]} watches  The list of variables watched.
             */
            get watches() { return watches; },
            
            /**
             * Re-evaluate all watch expressions.
             */
            updateAll: updateAll
        });
        
        register(null, {
            watches: plugin
        });
    }
});