define(function(require, exports, module) {
    main.consumes = ["Plugin", "ui", "panels.Area", "menus", "layout"];
    main.provides = ["panels"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var menus = imports.menus;
        var layout = imports.layout;
        var Area = imports["panels.Area"];

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        var panels = {};
        var areas = {};
        var showing;

        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;

            layout.findParent(plugin); // Make sure layout has a ref to plugins

            areas.left = new Area("left", options.defaultActiveLeft, plugin, emit);
            areas.right = new Area("right", options.defaultActiveRight, plugin, emit);
            
            plugin.on("draw", draw);
        }

        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;

            // Import Skin
            ui.insertSkin({
                name: "panels",
                data: require("text!./skin.xml"),
            }, plugin);
            
            menus.addItemByPath("Window/~", new ui.divider(), 40, plugin);
        }

        /***** Methods *****/

        function registerPanel(panel) {
            emit("register", {
                panel: panel
            });

            panels[panel.name] = panel;
        }

        function unregisterPanel(panel) {
            emit("unregister", {
                panel: panel
            });

            delete panels[panel.name];
        }

        function isActive(name) {
            return areas.left.activePanel == name
                || areas.right.activePanel == name;
        }

        function activate(name, noAnim) {
            var options = panels[name];
            if (!options) return false;
            
            areas[options.where].activate(name, noAnim);
        }

        function deactivate(name) {
            var options = panels[name];
            if (!options) return false;
            
            areas[options.where].deactivate();
        }

        function enablePanel(name) {
            var options = panels[name];
            if (!options) return false;
            
            areas[options.where].enablePanel(name);
            return true;
        }

        function disablePanel(name, noAnim, keep) {
            var panel = panels[name];
            if (!panel) return false;// Called during unload, even when not registered
            
            areas[panel.where].disablePanel(name, noAnim, keep);
            return true;
        }

        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {

        });
        plugin.on("disable", function() {

        });
        plugin.on("unload", function() {
            Object.keys(panels).forEach(function(name) {
                panels[name].unload();
            });
            
            Object.keys(areas).forEach(function(name) {
                areas[name].unload();
            });
            
            loaded = false;
            drawn = false;
        });

        /***** Register and define API *****/

        /**
         * Manages the panels on the left and right side of the UI. Panels can
         * be hidden and shown. Users can also show/hide the panel button via 
         * the Window menu.
         * 
         * Panels are located in different {@link panels.Area areas}. By 
         * default these areas are on the left and right of the screen.
         * 
         * * **panels - Manages all areas and panels**
         *   * {@link panels.Area Area} - Manages a single area of panels. 
         *   By default there is a panel area on the left and on the right side 
         *   of the UI.
         *     * {@link Panel} - A single panel that lives in an area.
         * 
         * This example shows how you can activate the tree plugin automatically:
         * 
         *     panels.activate("tree");
         * 
         * @singleton
         */
        plugin.freezePublicAPI({
            /**
             * Returns an array of all the panels that are currently active.
             */
            get activePanels() {
                var panels = [];
                if (areas.left.activePanel)
                    panels.push(areas.left.activePanel);
                if (areas.right.activePanel)
                    panels.push(areas.right.activePanel);
                return panels;
            },
            
            /**
             * A hash of {@link panels.Area areas}, indexed by there location. 
             * By default the locations area "left" and "right".
             */
            get areas() { return areas; },
            
            /**
             * A hash of panels, indexed by their name.
             */
            get panels() { return panels; },
            
            /**
             * Boolean specifying whether a panel is in the process of being shown
             */
            get showing() { return showing; },
            set showing(v) { showing = v; },
            
            _event: [
                /**
                 * Fires after the Panels is drawn
                 * @event draw
                 */
                "draw",
                /**
                 * Fires after a {@link Panel panel} is registered
                 * @event register
                 * @param {Object} e
                 * @param {Panel}  e.panel   the panel that is registered
                 */
                "register",
                /**
                 * Fires after a {@link Panel panel} is unregistered
                 * @event unregister
                 * @param {Object} e
                 * @param {Panel}  e.panel   the panel that is unregistered
                 */
                "unregister",
                /**
                 * Fires after a panel has animated
                 * @event animate
                 * @param {Object}   e
                 * @param {Boolean}  e.noanim    Specifies whether the animation was forced off.
                 * @param {Object}   e.win       Specifies the name of the window that is animated closed.
                 * @param {Object}   e.toWin     Specifies the name of the window that is animated open.
                 * @param {Number}   e.toWidth   Specifies the new width of the panenl
                 * @param {Function} e.onfinish  The function to be called when the animation finishes.
                 */
                "animate",
                /**
                 * Fires when the animation is completed
                 * @event afterAnimate
                 */
                "afterAnimate"
            ],

            /**
             * Adds a panel to the list of known panels.
             * 
             * *N.B. The {@link Panel} base class already calls this method.*
             * 
             * @param {Panel} panel  the panel to register.
             * @fires register
             * @private
             */
            register: registerPanel,

            /**
             * Removes a panel from the list of known panels. 
             * 
             * *N.B. The {@link Panel} base class already calls this method.*
             * 
             * @param {Panel} panel  the panel to unregister.
             * @fires unregister
             * @private
             */
            unregister: unregisterPanel,

            /**
             * Activates a panel, showing it as the only visible
             * panel in it's area.
             * @param {String} name  The name of the panel to activate
             */
            activate: activate,

            /**
             * Dectivates the `activePanel` in it's area, hiding the
             * entire area, except the buttons, as a result.
             * @param {String} name  The name of the panel to activate
             */
            deactivate: deactivate,

            /**
             * Add the button to it's button bar. If the bar was hidden, the
             * bar is shown.
             * @param {String} name  The name of the panel to enable.
             */
            enablePanel: enablePanel,

            /**
             * Remove the button from it's button bar. If the bar is empty, the
             * bar is hidden.
             * @param {String} name  The name of the panel to disable.
             */
            disablePanel: disablePanel,

            /**
             * Check whether the panel is active within it's area.
             */
            isActive: isActive
        });

        register(null, {
            panels: plugin
        });
    }
});