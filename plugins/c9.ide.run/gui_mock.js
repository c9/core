define(function(require, module, exports) {
    main.consumes = [
        "c9", "Plugin"
    ];
    main.provides = ["run.gui"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        var lastRun;
        
        function load() {}


        /***** Helper Methods *****/

        function transformButton(to) {}


        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {

        });
        plugin.on("disable", function() {

        });
        plugin.on("unload", function() {
            
        });

        /***** Register and define API *****/

        /**
         * UI for the {@link run} plugin. This plugin is responsible for the Run
         * menu in the main menu bar, as well as the settings and the
         * preferences UI for the run plugin.
         * @singleton
         */
        /**
         * @command run Runs the currently focussed tab.
         */
        /**
         * @command stop Stops the running process.
         */
        /**
         * @command runlast Stops the last run file
         */
        plugin.freezePublicAPI({
            get lastRun() { return lastRun; },
            set lastRun(lr) { lastRun = lr; },

            /**
             *
             */
            transformButton: transformButton
        });

        register(null, {
            "run.gui": plugin
        });
    }
});
