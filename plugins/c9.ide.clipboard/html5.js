define(function(require, exports, module) {
    main.consumes = ["Plugin", "dialog.error"];
    main.provides = ["clipboard.provider"];
    return main;

    /*
        Recommended Types:
        text/plain
        text/uri-list
        text/csv
        text/css
        text/html
        application/xhtml+xml
        image/png
        image/jpg, image/jpeg
        image/gif
        image/svg+xml
        application/xml, text/xml
        application/javascript
        application/json
        application/octet-stream
    */

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);

        var nativeObject;
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
        }
        
        /***** Methods *****/
        
        function clear(){
            if (nativeObject)
                nativeObject.clearData();
            else {
                var data = get("");
                if (data !== false)
                    set("", "", data.types);
            }
        }
        
        function set(type, data, list) {
            if (notSupported(type))
                return;
                
            type = convertType(type);
            
            if (nativeObject) {
                nativeObject.setData(type, data);
                return true;
            }
            
            var setData = function(e) {
                if (list) {
                    list.forEach(function(type) {
                        e.clipboardData.setData(type, data);
                    });
                }
                e.clipboardData.setData(type, data);
                
                e.preventDefault();
                e.stopPropagation();
            };
            document.addEventListener("copy", setData, true);
            
            var result = execCommand("copy");
            
            document.removeEventListener("copy", setData, true);
            
            return !!result;
        }
            
        function get(type, full) {
            if (notSupported(type))
                return;
                
            type = convertType(type);
            
            if (!full && nativeObject)
                return nativeObject.getData(type);
            
            var data;
            var getData = function(e) {
                data = full
                    ? e.clipboardData
                    : e.clipboardData.getData(type);
                e.preventDefault();
                e.stopPropagation();
            };
            document.addEventListener("paste", getData, true);
            
            var result = execCommand("paste");
            
            document.removeEventListener("paste", getData, true);
            
            if (!result)
                return false;
            
            return data;
        }
        
        function execCommand(commandName) {
            try {
                return document.execCommand(commandName, null, null);
            } catch (e) {
                return false; // firefox throws
            }
        }
        
        function notSupported(type) {
            return !/text($|\/)/.test(type);
        }
        
        function convertType(type) {
            return document.all ? "Text" : type;
        }
        
        function wrap(obj) {
            nativeObject = obj;
        }
        
        function unwrap(){
            nativeObject = window.clipboardData; // for ie and firefox addon
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("enable", function(){
            
        });
        plugin.on("disable", function(){
            
        });
        plugin.on("unload", function(){
            loaded = false;
            nativeObject = null;
        });
        
        /***** Register and define API *****/
        
        /**
         * Implements the clipboard for a specific system. 
         * 
         * *N.B.: Cloud9 supports two native clipboard APIs. One for HTML5
         * browsers and one for node-webkit. If you are looking to add native
         * clipboard support for another system, reimplement this service.*
         * 
         * @singleton
         **/
        plugin.freezePublicAPI({
            /**
             * @ignore
             */
            wrap: wrap,
            /**
             * @ignore
             */
            unwrap: unwrap,
            
            /**
             * Clears the clipboard
             */
            clear: clear,
            
            /**
             * Sets the clipboard
             * @param {String}   type       The content type for this data. To be 
             *   compatible with the native clipboard for all platforms use "text".
             * @param {Mixed}    data       The actual data. This can be a string
             *   or a more complex object. Complex objects cannot be stored using
             *   the native clipboard.
             */
            set: set,
            
            /**
             * Gets the current value of the clipboard
             * @param {String}   type           The content type for this data. To be 
             *   compatible with the native clipboard for all platforms use "text".
             */
            get: get
        });
        
        register(null, {
            "clipboard.provider": plugin
        });
    }
});