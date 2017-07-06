
define(function(require, exports, module) {
    main.consumes = ["Editor", "editors", "ui", "tabManager"];
    main.provides = ["timeview"];
    return main;

    function main(options, imports, register) {
        var Editor = imports.Editor;
        var editors = imports.editors;
        var tabs = imports.tabManager;
        var ui = imports.ui;
        
        /***** Initialization *****/
        
        var extensions = [];
        
        var handle = editors.register("timeview", "Time Viewer", 
                                       TimeViewer, extensions);
        
        handle.addElement(
            tabs.getElement("mnuEditors").appendChild(
                new ui.item({
                    caption: "New Clock",
                    onclick: function(e) {
                        e.pane = tabs.focussedTab.pane;
                        tabs.openEditor("timeview", true, function() {});
                    }
                })
            )
        );
                          
        function TimeViewer() {
            var deps = main.consumes.splice(0, main.consumes.length - 1);
            var plugin = new Editor("Ajax.org", deps, extensions);
            var editor;
            
            plugin.on("draw", function(e) {
                // Create UI elements
                editor = document.createElement("div");
                e.htmlNode.appendChild(editor);
    
                editor.style.display = "block";
                editor.style.position = "absolute";
                editor.style.backgroundColor = "rgba(255,255,255,0.8)";
                editor.style.left = 
                editor.style.right = 
                editor.style.top = 
                editor.style.bottom = 0;
                editor.style.fontSize = "50px";
                editor.style.fontFamily = "Tahoma";
                editor.style.textAlign = "center";
            });
            
            /***** Method *****/
            
            /***** Lifecycle *****/
            
            plugin.on("documentLoad", function(e) {
                var doc = e.doc;
                var session = doc.getSession();
                    
                session.timer = setInterval(function() {
                    var dt = new Date();
                    var time = dt.getHours() + ":" 
                        + dt.getMinutes() + ":" 
                        + dt.getSeconds();
                    
                    if (doc.tab.isActive())
                        editor.textContent = time;
                    doc.title = time;
                }, 1);
            });
            
            plugin.on("documentUnload", function(e) {
                clearTimeout(e.doc.getSession().timer);
            });
            
            plugin.on("unload", function() {
                editor.parentNode.removeChild(editor);
                editor = null;
            });
            
            /***** Register and define API *****/
            
            /**
             * Read Only Image Editor
             **/
            plugin.freezePublicAPI({});
            
            plugin.load(null, "timeview");
            
            return plugin;
        }
        
        register(null, {
            timeview: handle
        });
    }
});