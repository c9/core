define(function(require, exports, module) {
    "use strict";

    main.consumes = ["Plugin", "ui", "metrics", "dialog.error"];
    main.provides = ["dialog.info"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var plugin = new Plugin("Ajax.org", main.consumes);
        var error = imports["dialog.error"];
        
        function show(message, timeout) {
            var visible = error.visible;
            if (visible && visible.indexOf("infolabel") === -1) {
                return -1; // already showing error instead
            }
            
            var options = typeof message === "string"
                ? { message: message }
                : message;
            options.className = "infolabel";
            options.noError = true;
            return error.show(options, timeout);
        }
        
        /**
         * Show error messages to the user
         * 
         * This plugin provides a way to display error messages to the user.
         * 
         * @singleton
         **/
        plugin.freezePublicAPI({
            /**
             * Displays an info message in the main info reporting UI.
             * @param {String} message    The message to display.
             * @param {Number} [timeout]   A custom timeout for this error to hide, or -1 for no hiding.
             * @returns a cookie for use with hide()
             */
            show: show,
            
            /**
             * Hides the main error reporting UI.
             * 
             * @param [cookie] A cookie indicating the popup to hide
             */
            hide: error.hide.bind(error),
        });
        
        register(null, { "dialog.info": plugin });
    }
});