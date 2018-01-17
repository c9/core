define(function(require, exports, module) {
    main.consumes = [
        "DebugPanel", "ui", "util", "debugger", "callstack", "panels", "layout"
    ];
    main.provides = ["variables"];
    return main;

    function main(options, imports, register) {
        var DebugPanel = imports.DebugPanel;
        var ui = imports.ui;
        var callstack = imports.callstack;
        var debug = imports.debugger;
        var util = imports.util;
        var layout = imports.layout;
        var panels = imports.panels;
        
        var markup = require("text!./variables.xml");
        var Tree = require("ace_tree/tree");
        var TreeData = require("./variablesdp");
        var TreeEditor = require("ace_tree/edit");
        
        /***** Initialization *****/
        
        var plugin = new DebugPanel("Ajax.org", main.consumes, {
            caption: "Local Variables",
            index: 300
        });
        var emit = plugin.getEmitter();
        
        var activeFrame, dbg, cached = {};
        var model, datagrid; // UI Elements
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            model = new TreeData();
            model.emptyMessage = "No variables to display";
            
            model.columns = [{
                caption: "Variable",
                value: "name",
                defaultValue: "Scope",
                width: "40%",
                icon: true,
                type: "tree"
            }, {
                caption: "Value",
                value: "value",
                width: "60%",
                editor: "textbox" 
            }, {
                caption: "Type",
                value: "type",
                width: "55"
            }];
            
            model.loadChildren = function(node, callback) {
                emit("expand", {
                    node: node,
                    expand: callback
                });
            };

            // Set and clear the dbg variable
            debug.on("attach", function(e) {
                dbg = e.implementation;
            });
            debug.on("detach", function(e) {
                dbg = null;
            });
            debug.on("stateChange", function(e) {
                plugin[e.action]();
            });
            
            callstack.on("scopeUpdate", function(e) {
                updateScope(e.scope, e.variables);
            });
            callstack.on("framesLoad", function(e) {
                // Clear the cached states of the variable datagrid
                clearCache();
            });
            
            // When clicking on a frame in the call stack show it 
            // in the variables datagrid
            callstack.on("frameActivate", function(e) {
                // @todo reload the clicked frame recursively + keep state
                loadFrame(e.frame);
            }, plugin);
            
            // Variables
            plugin.on("expand", function(e) {
                if (e.node.tagName == "variable") {
                    if (!e.node.children) return e.expand();
                    
                    dbg.getProperties(e.node, function(err, properties) {
                        if (err) return console.error(err);
                        
                        //updateVariable(e.node, properties);
                        e.expand();
                    });
                }
                // Local scope
                // else if (e.scope.type == 1) {
                //     //updateScope(e.scope);
                //     e.expand();
                // }
                // Other scopes
                else if (e.node.tagName == "scope") {
                    dbg.getScope(model.frame/*debug.activeFrame*/, e.node, function(err, vars) {
                        if (err) return console.error(err);
                        
                        //updateScope(e.node, vars);
                        e.expand();
                    });
                }
            }, plugin);
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
            
            datagridEl.on("contextmenu", function() {
                return false;
            });
            
            datagrid.on("rename", function(e) {
                var node = e.node;
                var value = e.value;
                
                var variable = node;
                var oldValue = variable.value;
                
                model.setAttribute(variable, "value", value);
                
                function undo() {
                    model.setAttribute(variable, "value", oldValue);
                }
                
                // Set new value
                dbg.setVariable(variable, value, debug.activeFrame, function(err) {
                    if (err)
                        return undo();
                        
                    // Reload properties of the variable
                    dbg.getProperties(variable.parent, function() {
                        updateVariable(variable.parent);
                        
                        emit("variableEdit", {
                            value: value,
                            oldValue: oldValue,
                            node: node,
                            variable: variable,
                            frame: activeFrame,
                        });
                    });
                });
            });
            
            datagrid.on("beforeRename", function(e) {
                if (!plugin.enabled)
                    return e.preventDefault();
                
                if (!dbg.features.updateScopeVariables)
                    return e.preventDefault();
                
                // Don't allow setting the value of scopes
                if (e.node.tagName == "scope")
                    return e.preventDefault();
                
                // Don't allow setting "this"
                if (e.node.name == "this")
                    return e.preventDefault();
            });
        }
        
        /***** Methods *****/
        
        function loadFrame(frame) {
            if (frame == activeFrame)
                return;
            
            model.frame = frame;

            if (!frame) {
                model.setRoot({});
            }
            else {
                if (cached[frame.id])
                    model.setRoot(cached[frame.id]);
                else {
                    model.setRoot([].concat(frame.variables, frame.scopes).filter(Boolean));
                    cached[frame.id] = model.root;
                }
            }
            
            activeFrame = frame;
        }
        
        function updateNode(node, variable, oldVar) {
            var isOpen = node.isOpen;
            model.close(node, null, false);
            if (isOpen)
                model.open(node, null, false);
            else
                model._signal("change", node);
        }
        
        function updateScope(scope, variables) {
            updateNode(scope);
        }
        
        function updateVariable(variable, properties, node) {
            updateNode(variable);
        }
        
        function clearCache() {
            cached = {};
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
            plugin.once("draw", draw);
        });
        plugin.on("enable", function() {
            drawn && datagrid.enable();
        });
        plugin.on("disable", function() {
            drawn && datagrid.disable();
        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * The local variables and scopes panel for the 
         * {@link debugger Cloud9 debugger}.
         * 
         * This panel displays the local variables and scopes to the user. A
         * user can expand variables and scopes to inspect properties and 
         * variables and edit them.
         * 
         * @singleton
         * @extends DebugPanel
         **/
        plugin.freezePublicAPI({
            /**
             * @ignore
             */
            get model() { return model; },
            /**
             * Sets the frame that the variables and scopes are displayed for.
             * @param {debugger.Frame} frame  The frame to display the variables and scopes from.
             */
            loadFrame: loadFrame,
            
            /**
             * Clears the variable/scope cache
             */
            clearCache: clearCache
        });
        
        register(null, {
            variables: plugin
        });
    }
});
