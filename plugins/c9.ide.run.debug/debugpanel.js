define(function(require, module, exports) {
    main.consumes = ["Plugin", "ui", "debugger"];
    main.provides = ["DebugPanel"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var debug = imports.debugger;
        
        function DebugPanel(developer, deps, options) {
            // Editor extends ext.Plugin
            var plugin = new Plugin(developer, deps);
            var emit = plugin.getEmitter();
            emit.setMaxListeners(1000);
            
            var caption = options.caption;
            var index = options.index || 100;
            var amlFrame;
            
            plugin.on("load", function() {
                // Draw panel when debugger is drawn
                debug.once("drawPanels", draw, plugin);
            });
            
            function draw(e) {
                amlFrame = ui.frame({
                    htmlNode: e.html,
                    buttons: "min",
                    activetitle: "min",
                    caption: caption
                });
                ui.insertByIndex(e.html, amlFrame.$ext, index, false);
                plugin.addElement(amlFrame);
                
                emit.sticky("draw", { aml: amlFrame, html: amlFrame.$int });
            }
            
            /***** Methods *****/
            
            function show() {
                draw();
                amlFrame.show();
            }
            
            function hide() {
                amlFrame.hide();
            }
            
            /***** Register and define API *****/
            
            plugin.freezePublicAPI.baseclass();
            
            /**
             * Debug panel base class for the {@link debugger Cloud9 debugger}.
             * 
             * A debug panel is a section of the debugger that allows users to
             * interact with the debugger. Debuggers in Cloud9 are pluggable
             * and there are many different debuggers available as a 
             * {@link debugger.implementation debugger implementation}.
             * 
             * The debugger UI is re-used for all these debugger 
             * implementations. Panels can decide for which debugger they should
             * be shown:
             * 
             *     var debug = imports.debugger;
             *     
             *     debug.on("attach", function(e) {
             *         if (e.implementation.type == "html5")
             *             plugin.show();
             *         else
             *             plugin.hide();
             *     });
             * 
             * Implementing your own debug panel takes a new DebugPanel() object 
             * rather than a new Plugin() object. Here's a short example:
             * 
             *     var plugin = new DebugPanel("(Company) Name", main.consumes, {
             *         caption  : "Cool Caption"
             *     });
             *     var emit = plugin.getEmitter();
             * 
             *     plugin.on("draw", function(e) {
             *         e.html.innerHTML = "Hello World!";
             *     });
             *     
             *     plugin.freezePublicAPI({
             *     });
             * 
             * @class DebugPanel
             * @extends Plugin
             */
            /**
             * @constructor
             * Creates a new DebugPanel instance.
             * @param {String}   developer   The name of the developer of the plugin
             * @param {String[]} deps        A list of dependencies for this 
             *   plugin. In most cases it's a reference to `main.consumes`.
             * @param {Object}   options     The options for the debug panel
             * @param {String}   options.caption  The caption of the frame.
             */
            plugin.freezePublicAPI({
                /**
                 * The APF UI element that is presenting the pane in the UI.
                 * This property is here for internal reasons only. *Do not 
                 * depend on this property in your plugin.*
                 * @property {AMLElement} aml
                 * @private
                 * @readonly
                 */
                get aml() { return amlFrame; },
                
                _events: [
                    /**
                     * Fired when the panel container is drawn.
                     * @event draw
                     * @param {Object}      e
                     * @param {HTMLElement} e.html  The html container.
                     * @param {AMLElement}  e.aml   The aml container.
                     */
                    "draw"
                ],
                    
                /**
                 * Shows the panel.
                 */
                show: show,
                
                /**
                 * Hides the panel.
                 */
                hide: hide
            });
            
            return plugin;
        }
        
        /***** Register and define API *****/
        
        register(null, {
            DebugPanel: DebugPanel
        });
    }
});