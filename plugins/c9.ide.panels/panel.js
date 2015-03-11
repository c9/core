define(function(require, module, exports) {
    main.consumes = [
        "Plugin", "panels", "settings", "menus", "commands", "ui", "tabManager"
    ];
    main.provides = ["Panel"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var panels = imports.panels;
        var menus = imports.menus;
        var ui = imports.ui;
        var commands = imports.commands;
        var settings = imports.settings;
        var tabs = imports.tabManager;
        
        var uCaseFirst = require("c9/string").uCaseFirst;
        
        function Panel(developer, deps, options) {
            var plugin = new Plugin(developer, deps);
            var emit = plugin.getEmitter();
            
            var autohide = options.autohide || false;
            var index = options.index || 100;
            var buttonCSSClass = options.buttonCSSClass;
            var panelCSSClass = options.panelCSSClass;
            var caption = options.caption;
            var width = options.width;
            var minWidth = options.minWidth;
            
            var mnuItem, button, area, lastPanel, xpath, where, aml;
            
            plugin.on("load", function(){
                xpath = "state/panels/" + plugin.name;
                where = settings.get(xpath + "/@where") || options.where || "left";
                
                panels.register(plugin);
    
                mnuItem = new ui.item({
                    type: "check",
                    value: plugin.name,
                    onclick: function(){
                        var area = panels.areas[panels.panels[plugin.name].where];

                        if (this.checked)
                            area.enablePanel(plugin.name);
                        else
                            area.disablePanel(plugin.name);
                    }
                });
                menus.addItemByPath("Window/" + caption, mnuItem, index, plugin);
                
                panels.on("showPanel" + uCaseFirst(plugin.name), function(e) {
                    lastPanel = e.lastPanel;
                    if (lastPanel && panels.panels[lastPanel].autohide)
                        lastPanel = panels.panels[lastPanel].lastPanel;
                    
                    if (button)
                        button.setValue(true);
                    
                    emit("show", e);
                }, plugin);
                panels.on("hidePanel" + uCaseFirst(plugin.name), function(e) {
                    if (button)
                        button.setValue(false);
                    
                    emit("hide");
                }, plugin);
                
                settings.on("read", function(){
                    settings.setDefaults(xpath, [
                        ["name", plugin.name],
                        ["enabled", "true"]
                    ]);
                    
                    // Start disabled
                    plugin.disable();
    
                    // Attach to area
                    var areas = panels.areas;
                    attachTo(panels.areas[where]);
    
                    // Enable panel
                    if (settings.getBool(xpath + "/@enabled")) {
                        areas[where].enablePanel(plugin.name);
                        mnuItem.setAttribute("checked", true);
                    }
                    
                    // Activate Panel
                    ["left", "right"].forEach(function(where) {
                        var active = settings.get("state/panels/@active-" + where);
                        if ((!active && areas[where].defaultActive == plugin.name
                          || active == plugin.name))
                            areas[where].activate(plugin.name, true, "restoreSettings");
                    });
                });
            });
            
            plugin.on("unload", function(){
                panels.deactivate(plugin.name);
                
                button = null;
                mnuItem = null;
                button = null;
                area = null;
                lastPanel = null;
                xpath = null;
                where = null;
                drawn = false;
    
                if (button)
                    button.destroy(true, true);
                if (mnuItem)
                    mnuItem.destroy(true, true);
    
                menus.remove("View/Panels/" + caption);
                
                panels.unregister(plugin);
            });
            
            /***** Methods *****/
            
            function setCommand(options) {
                var command = commands.addCommand({
                    name: options.name,
                    group: "Panels",
                    hint: options.hint,
                    bindKey: options.bindKey,
                    exec: options.exec ||
                        function(){ 
                            if (autohide)
                                panels.activate(plugin.name); 
                            else {
                                if (panels.isActive(plugin.name))
                                    panels.deactivate(plugin.name);
                                else
                                    panels.activate(plugin.name);
                            }
                            
                            if (options.extra)
                                options.extra.apply(this, arguments);
                        }
                }, plugin);
                
                mnuItem.setAttribute("hotkey",
                  "{commands.commandManager." + options.name + "}");
                return command;
            }
            
            var drawn;
            function draw(){
                if (drawn) return false;
                drawn = true;
                
                aml = area.aml.appendChild(new ui.bar({
                    "skin": "panel-bar",
                    "class" : panelCSSClass || "",
                    "visible": false
                }));
                plugin.addElement(aml);
                
                emit.sticky("draw", { 
                    html: aml.$int, 
                    aml: aml 
                });
                
                aml.$ext.style.zIndex = 100;
                aml.$ext.style.minWidth = ""; //Needed for the anims
                aml.$ext.style.position = "absolute";
                aml.$ext.style.left = where == "left" ? area.width + "px" : 0;
                aml.$ext.style.top = 0;
                aml.$ext.style.right = where == "right" ? area.width + "px" : 0;
                aml.$ext.style.bottom = 0;
                
                aml.$display = apf.CSSPREFIX + "Flex";
                
                return true;
            }
            
            function attachTo(toArea) {
                area = toArea;
                
                try {
                    if (aml)
                        area.aml.appendChild(aml);
                } catch (e) {}
                
                if (plugin.enabled)
                    enable(); // Move the button
            }
            
            function detach(){
                disable();
                area = null;
            }
            
            function enable(){
                // Draw button container
                var container = area.draw();
                
                if (!button) {
                    // Insert button
                    button = new ui.button({
                        skinset: "panels",
                        state: true,
                        caption: caption,
                        auto: false,
                        "class" : buttonCSSClass || "",
                        onmousedown: function(){
                            panels.areas[where].toggle(plugin.name, autohide, true);
                        },
                    });
                    plugin.addElement(button);
                }
                
                ui.insertByIndex(container, button, index, false);
                
                button.show();
                
                if (area.activePanel == plugin.name)
                    button.setValue(true);
                
                mnuItem.setAttribute("checked", true);
            }
            
            function disable(){
                button && button.hide();
                mnuItem.setAttribute("checked", false);
            }
            
            function show() {
                panels.activate(plugin.name);
            }
            
            function hide(){
                if (panels.isActive(plugin.name)) {
                    if (autohide && lastPanel)
                        panels.activate(lastPanel);
                    else
                        panels.deactivate(plugin.name);
                    
                    if (tabs.focussedTab && !panels.showing)
                        tabs.focussedTab.editor.focus();
                }
            }
            
            /***** LifeCycle *****/
            
            plugin.on("enable", function(){
                enable();
            });
            plugin.on("disable", function(){
                disable();
            });
            
            /***** Register and define API *****/
            
            plugin.freezePublicAPI.baseclass();
            
            /**
             * Panel base class for the Cloud9 UI. Panels can
             * be hidden and shown. Users can also show/hide the panel button via 
             * the Window menu.
             * 
             * Panels are located in different {@link panels.Area areas}. By 
             * default these areas are on the left and right of the screen.
             * 
             * * {@link panels} - Manages all areas and panels
             *   * {@link panels.Area Area} - Manages a single area of panels. 
             *   By default there is a panel area on the left and on the right side 
             *   of the UI.
             *     * **Panel - A single panel that lives in an area.**
             * 
             * Implementing your own panel takes a new Panel() object rather
             * than a new Plugin() object. Here's a short example:
             * 
             *     var plugin = new Panel("(Company) Name", main.consumes, {
             *         index    : 100,
             *         width    : 250,
             *         caption  : "Cool Caption",
             *         minWidth : 130,
             *         where    : "right"
             *     });
             *     var emit = plugin.getEmitter();
             * 
             *     plugin.on("load", function(){
             *         plugin.setCommand({
             *             name    : "coolpanel",
             *             hint    : "being cool",
             *             bindKey : { mac: "Command-H", win: "Ctrl-H" }
             *         });
             *     });
             * 
             *     plugin.on("draw", function(e) {
             *         e.html.innerHTML = "Hello World!";
             *     });
             *     
             *     plugin.freezePublicAPI({
             *         example: function(){
             *             
             *         }
             *     });
             */
            /**
             * @constructor
             * Creates a new Panel instance.
             * @param {String}   developer             The name of the developer of the plugin
             * @param {String[]} deps                  A list of dependencies for this 
             *   plugin. In most cases it's a reference to main.consumes.
             * @param {Object}   options               The options for this panel
             * @param {Number}   options.index         Specifies the position in the order of the panels
             * @param {String}   options.caption       Specifies the text displayed on the button
             * @param {Boolean}  [options.autohide]    Specifies whether this is an
             *   autohiding panel. The developer is responsible for hiding
             *   the panel. This behavior will animate the panel during
             * @param hide and show over other panels, if there are any.
             * @param {String}   [options.buttonCSSClass]   Specifies the name of the css class that is applied to the button
             * @param {String}   [options.panelCSSClass]   Specifies the name of the css class that is applied to the panel
             * @param {Number}   [options.width]       Specifies the default width of the panel
             * @param {Number}   [options.minWidth]    Specifies the minimal width of the panel
             * @param {String}   [options.where]       Accepts "left" or "right" to determine where the panel is added
             */
            plugin.freezePublicAPI({
                /**
                 * @ignore
                 */
                get lastPanel(){ return lastPanel; },
                /**
                 * Retrieves whether this is an auto-hiding panel. i.e. if
                 * this panel hides when it looses focus.
                 * @property {Boolean} autohide
                 */
                get autohide(){ return autohide; },
                set autohide(value){ autohide = value; },
                /**
                 * Retrieves the width in pixels of this panel
                 * @property {Number} width
                 * @readonly
                 */
                get width(){ return width; },
                /**
                 * Retrieves the minimal width in pixels of this panel
                 * @property {Number} minWidth
                 * @readonly
                 */
                get minWidth(){ return minWidth; },
                /**
                 * The APF UI element that is presenting the panel in the UI.
                 * This property is here for internal reasons only. *Do not 
                 * depend on this property in your plugin.*
                 * @property {AMLElement} aml
                 * @private
                 * @readonly
                 */
                get aml(){ return aml; },
                /**
                 * @property {HTMLElement} container
                 */
                get container(){ return aml.$ext; },
                
                /**
                 * The area that this panel is a part of.
                 * @property {panels.Area} area
                 * @readonly
                 */
                get area(){ return area; },
                
                /**
                 * Retrieves the position of the panel. This can be "left" 
                 * or "right".
                 * @property {String} where
                 * @readonly
                 */
                get where(){ return where; },
                
                /**
                 * @ignore for testing purpose
                 */
                get button(){ return button; },
                
                _events: [
                    /**
                     * Fires when the panel is drawn.
                     * @event draw
                     * @param {Object}      e
                     * @param {AMLElement}  e.aml
                     * @param {HTMLElement} e.html
                     */
                    "draw",
                    /**
                     * Fires when the panel is shown
                     * @event show
                     */
                    "show",
                    /**
                     * Fires when the panel is shown
                     * @event hide
                     */
                    "hide"
                ],
                
                /**
                 * Adds a command that toggles this panel to be active or not.
                 * @param {Object}   options
                 * @param {String}   options.name        Specifies the name of a new command to create, which will show the panel
                 * @param {String}   [options.hint]      Specifies the description of the command
                 * @param {Object}   [options.bindKey]   Specifies the key combination for the command. See `commands.addCommand`
                 * @param {Function} [options.exec]      Overrides the default action of the command
                 */
                setCommand: setCommand,
                
                /**
                 * Attaches this panel to an {@link panels.Area area}.
                 * @param {panels.Area} area  The area to attach this panel to.
                 */
                attachTo: attachTo,
                
                /**
                 * Detaches this panel from it's area.
                 */
                detach: detach,
                
                /**
                 * Draws the panel
                 * @private
                 */
                draw: draw,
                
                /**
                 * Shows the panel
                 */
                show: show,
                
                /**
                 * Hides the panel
                 */
                hide: hide
            });
            
            return plugin;
        }
        
        /***** Register and define API *****/
        
        register(null, {
            Panel: Panel
        });
    }
});
