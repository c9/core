define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "remote"
    ];
    main.provides = ["JSDocument"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var remote = imports.remote;
        
        function JSDocument(path) {
            var exists = remote.findDocument(path);
            if (exists) return exists;
            
            /***** Initialization *****/
            
            var plugin = new Plugin("Ajax.org", main.consumes);
            // var emit = plugin.getEmitter();
            
            var transports = [];
            var tab;
            
            var loaded = false;
            function load() {
                if (loaded) return false;
                loaded = true;
                
                remote.register(plugin);
            }
            
            /***** Methods *****/
            
            function addTransport(transport) {
                if (transports.indexOf(transport) == -1) {
                    transports.push(transport);
                    
                    transport.addOther(function() {
                        var idx = transports.indexOf(transport);
                        if (~idx) {
                            transports.splice(idx, 1);
                            
                            if (transports.length === 0)
                                plugin.unload();
                        }
                    });
                }
                
                return plugin;
            }
            
            function initTab(t) {
                tab = t;
                if (!tab) return;
                
                var undo = t.document.undoManager;
                undo.on("change", function() {
                    if (undo.isAtBookmark()) {
                        transports.forEach(function(transport) {
                            transport.reload();
                        });
                    }
                }, tab);
            }
            
            function remove() {
                transports.forEach(function(transport) {
                    transport.deleteStyleSheet(path);
                });
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
                loaded = false;
            });
            
            /***** Register and define API *****/
            
            /**
             * 
             **/
            plugin.freezePublicAPI({
                /**
                 * 
                 */
                get path() { return path; },
                
                /**
                 * 
                 */
                get tab() { return tab; },
                
                /**
                 * 
                 */
                set tab(tab) { initTab(tab); },
                
                _events: [
                    /**
                     * @event draw
                     */
                    "draw"
                ],
                
                /**
                 * 
                 */
                addTransport: addTransport,
                
                /**
                 * 
                 */
                remove: remove
            });
            
            plugin.load(null, "jsdocument");
            
            return plugin;
        }
        
        register(null, {
            JSDocument: JSDocument
        });
    }
});