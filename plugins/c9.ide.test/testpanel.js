define(function(require, module, exports) {
    main.consumes = ["Plugin", "ui", "test", "settings"];
    main.provides = ["TestPanel"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var test = imports.test;
        var settings = imports.settings;

        function TestPanel(developer, deps, options) {
            // Editor extends ext.Plugin
            var plugin = new Plugin(developer, deps);
            var emit = plugin.getEmitter();
            emit.setMaxListeners(1000);

            var caption = options.caption;
            var index = options.index || 100;
            var height = options.height || "";
            var style = options.style || "";
            var showTitle = options.showTitle || false;
            var amlFrame;

            plugin.on("load", function() {
                // Draw panel when test panel is drawn
                test.once("drawPanels", draw, plugin);
            });

            function draw(e) {
                amlFrame = showTitle ? ui.frame({
                    buttons: "min",
                    activetitle: "min",
                    "class": "absframe " + options.class,
                    style: "position:relative;" + (style || ""),
                    textselect: options.textselect,
                    // height      : height,
                    caption: caption
                }) : ui.bar({
                    "class": options.class,
                    style: "position:relative;" + (style || ""),
                    textselect: options.textselect
                });
                
                var aml = e.aml;

                if (index == 100)
                    aml.insertBefore(amlFrame, aml.firstChild);
                else
                    aml.appendChild(amlFrame);
                
                if (height)
                    amlFrame.setHeight(height);
                
                // ui.insertByIndex(e.html, amlFrame.$ext, index, false);
                plugin.addElement(amlFrame);

                emit.sticky("draw", { aml: amlFrame, html: amlFrame.$int });

                amlFrame.on("prop.height", function() {
                    emit("resize");
                });
                
                amlFrame.on("afterstatechange", function () {
                    if (amlFrame.parentNode) {
                        amlFrame.parentNode.childNodes.forEach(function(n) {
                            n.emit("resize");
                        });
                        var closed = amlFrame.state != "normal";
                        settings.set("state/test/panel/" + options.name
                            + "/@closed", closed);
                    }
                });
                settings.once("read", function() {
                    var closed = settings.get("state/test/panel/" + options.name
                        + "/@closed", closed);
                    if (closed)
                        setTimeout(function() {amlFrame.minimize();}, 10);
                });
                test.on("show", function() { emit("show"); }, plugin);
                test.on("hide", function() { emit("hide"); }, plugin);
            }

            /***** Methods *****/

            function show() {
                if (amlFrame) {
                    if (amlFrame.restore) amlFrame.restore();
                    else amlFrame.show();
                    emit("show");
                }
            }

            function hide() {
                amlFrame.hide();
                emit("hide");
            }

            /***** Register and define API *****/

            plugin.freezePublicAPI.baseclass();

            /**
             * Test panel base class for the {@link collab}.
             *
             * A test panel is a section of the test pane that allows users to
             * collaborate on a workspace
             *
             * @class TestPanel
             * @extends Plugin
             */
            /**
             * @constructor
             * Creates a new TestPanel instance.
             * @param {String}   developer   The name of the developer of the plugin
             * @param {String[]} deps        A list of dependencies for this
             *   plugin. In most cases it's a reference to `main.consumes`.
             * @param {Object}   options     The options for the test panel
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
                
                /**
                 * 
                 */
                get visible() { return amlFrame.visible; },
                
                /**
                 * @property {Number} height
                 */
                get height() { return amlFrame.getHeight(); },
                set height(v) { 
                    if (height != v) {
                        height = v; 
                        amlFrame.setHeight(v); 
                    }
                },

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
            TestPanel: TestPanel
        });
    }
});
