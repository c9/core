define(function(require, exports, module) {
    main.consumes = ["Editor", "editors", "ui", "save", "vfs"];
    main.provides = ["imgview"];
    return main;

    function main(options, imports, register) {
        var ui = imports.ui;
        var vfs = imports.vfs;
        var save = imports.save;
        var Editor = imports.Editor;
        var editors = imports.editors;
        
        /***** Initialization *****/
        
        var extensions = ["gif", "ico"];
                          
        function ImageEditor(){
            var plugin = new Editor("Ajax.org", main.consumes, extensions);
            var editor;
            
            var BGCOLOR = "#3D3D3D";
            
            plugin.on("draw", function(e) {
                // Create UI element
                editor = e.tab.appendChild(new ui.img({
                    flex: "1",
                    anchors: "0 0 0 0",
                    visible: "false",
                    style: "background-color:" + BGCOLOR
                }));
                
                plugin.addElement(editor);
    
                save.on("beforeSave", function(e) {
                    var path = e.document.tab.path;
                    if (!path)
                        return;
    
                    // don't save images for now.
                    if (editor.value == path)
                        return false;
                }, plugin);
        
                editor.show();
            });
            
            /***** Method *****/
            
            function setPath(path, doc) {
                if (!path) return;
                
                // Caption is the filename
                doc.title = (doc.changed ? "*" : "") + 
                    path.substr(path.lastIndexOf("/") + 1);
                
                // Tooltip is the full path
                doc.tooltip = path;
                
                var fullpath = path.match(/^\w+:\/\//)
                    ? path
                    : vfs.url(path);
                    
                editor.setProperty("value", apf.escapeXML(fullpath));
            }
            
            /***** Lifecycle *****/
            
            plugin.on("documentLoad", function(e) {
                var doc = e.doc;
                doc.tab.on("setPath", function(e) {
                    setPath(e.path, doc);
                }, doc.getSession());
                doc.tab.backgroundColor = BGCOLOR;
                doc.tab.classList.add("dark");
            });
            
            plugin.on("documentActivate", function(e) {
                setPath(e.doc.tab.path || e.doc.value, e.doc);
            });
            
            /***** Register and define API *****/
            
            /**
             * The imgview handle, responsible for events that involve all 
             * ImageEditor instances. This is the object you get when you request 
             * the imgview service in your plugin.
             * 
             * Example:
             * 
             *     define(function(require, exports, module) {
             *         main.consumes = ["imgview"];
             *         main.provides = ["myplugin"];
             *         return main;
             *     
             *         function main(options, imports, register) {
             *             var imgviewHandle = imports.imgview;
             *         });
             *     });
             * 
             * 
             * @class imgview
             * @extends Plugin
             * @singleton
             */
            /**
             * Read Only Image Viewer for Cloud9
             * 
             * Example of instantiating a new terminal:
             * 
             *     tabManager.openFile("/test.png", true, function(err, tab) {
             *         if (err) throw err;
             * 
             *         var imgview = tab.editor;
             *     });
             * 
             * @class imgview.ImageEditor
             * @extends Editor
             **/
            /**
             * The type of editor. Use this to create the terminal using
             * {@link tabManager#openEditor} or {@link editors#createEditor}.
             * @property {"imgview"} type
             * @readonly
             */
            plugin.freezePublicAPI({});
            
            plugin.load(null, "imgview");
            
            return plugin;
        }
        ImageEditor.autoload = false;
        
        register(null, {
            imgview: editors.register("imgview", "Image Viewer", 
                                      ImageEditor, extensions)
        });
    }
});