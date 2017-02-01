
define(function(require, exports, module) {
    main.consumes = ["Editor", "editors", "ui"];
    main.provides = ["htmlview"];
    return main;

    function main(options, imports, register) {
        var Editor = imports.Editor;
        var editors = imports.editors;
        
        /***** Initialization *****/
        
        var extensions = [];
                          
        function HtmlView() {
            var plugin = new Editor("Ajax.org", main.consumes, extensions);
            var container;
            
            plugin.on("draw", function(e) {
                // Create UI element
                container = e.htmlNode;
            });
            
            /***** Method *****/
            
            /***** Lifecycle *****/
            
            plugin.on("documentLoad", function(e) {
                var session = e.doc.getSession();
                session.value = e.state.value;
            });
            
            plugin.on("documentActivate", function(e) {
                var session = e.doc.getSession();
                container.innerHTML = session.value;
            });
            
            /***** Register and define API *****/
            
            /**
             * Read Only Image Editor
             **/
            plugin.freezePublicAPI({});
            
            plugin.load(null, "htmlview");
            
            return plugin;
        }
        HtmlView.autoload = false;
        
        register(null, {
            htmlview: editors.register("htmlview", "Html View", 
                                      HtmlView, extensions)
        });
    }
});