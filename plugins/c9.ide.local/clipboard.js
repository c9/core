/*global nativeRequire*/
define(function(require, exports, module) {
    main.consumes = ["Plugin"];
    main.provides = ["clipboard.provider"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var clipboard;
        function getClipboard() {
            if (clipboard) return clipboard;
            // Get System Clipbaord
            return clipboard = nativeRequire('nw.gui').Clipboard.get();
        }
        
        /***** Methods *****/
        
        function clear() {
            getClipboard().clear();
        }
        
        function set(type, data) {
            if (supported(type))
                getClipboard().set(data, "text");
        }
        
        function get(type) {
            if (supported(type))
                return getClipboard().get("text");
        }
        
        function supported(type) {
            return /text($|\/)/.test(type);
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
            clipboard = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Clipboard Provider Using the node-webkit interface
         **/
        plugin.freezePublicAPI({
            wrap: function() {},
            unwrap: function() {},
            
            /**
             * Clears the clipboard
             * @param {Function} callback(err)
             */
            clear: clear,
            
            /**
             * Sets the clipboard
             * @param {String} type
             * @param {String} data
             * @param {Function} callback(err)
             */
            set: set,
            
            /**
             * Gets the current value of the clipboard
             * @param {String} type
             * * @param {Function} callback(err, data)
             */
            get: get
        });
        
        register(null, {
            "clipboard.provider": plugin
        });
    }
});