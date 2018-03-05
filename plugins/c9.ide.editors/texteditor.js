define(function(require, exports, module) {
    main.consumes = ["Editor", "editors"];
    main.provides = ["texteditor"];
    return main;

    function main(options, imports, register) {
        var Editor = imports.Editor;
        var editors = imports.editors;
        
        /***** Initialization *****/
        
        var extensions = ["txt"];
        var handle = editors.register(
            "texteditor", "Text Editor", TextEditor, extensions);
                          
        function TextEditor() {
            var plugin = new Editor("Ajax.org", main.consumes, extensions);
            var emit = plugin.getEmitter();
            
            var editor;
            
            plugin.on("draw", function(e) {
                // Create UI elements
                editor = document.createElement("textarea");
                e.htmlNode.appendChild(editor);
    
                editor.style.display = "block";
                editor.style.position = "absolute";
                editor.style.borderRadius = "6px 0 0 0";
                editor.style.left = 
                editor.style.top = 
                editor.style.bottom = 
                editor.style.right = "3px";
                
                // @todo UndoManager integration
            });
            
            /***** Method *****/
            
            /***** Lifecycle *****/
            
            plugin.on("load", function() {
            });
            
            var currentDocument;
            plugin.on("documentLoad", function(e) {
                var doc = e.doc;
                var session = doc.getSession();
                
                // Value
                doc.on("getValue", function get(e) { 
                    return currentDocument == doc && editor
                        ? editor.value 
                        : e.value;
                }, session);
                
                doc.on("setValue", function set(e) { 
                    if (currentDocument == doc && editor)
                        editor.value = e.value || ""; 
                }, session);
                
                // Title & Tooltip
                function setTitle(e) {
                    var path = doc.tab.path;
                    if (!path) return;
                    
                    // Caption is the filename
                    doc.title = path.substr(path.lastIndexOf("/") + 1);
                    
                    // Tooltip is the full path
                    doc.tooltip = path;
                }
                doc.tab.on("setPath", setTitle, session);
                
                setTitle({ path: doc.tab.path || "" });
                
                var tab = doc.tab;
                tab.backgroundColor = "rgb(255,255,255)";
            });
            plugin.on("documentActivate", function(e) {
                editor.value = e.doc.value;
                currentDocument = e.doc;
            });
            plugin.on("documentUnload", function(e) {
                
            });
            plugin.on("getState", function(e) {
                if (editor)
                    e.state.scrollTop = editor.scrollTop;
            });
            plugin.on("setState", function(e) {
                if (e.state.scrollTop)
                    editor.scrollTop = e.state.scrollTop;
            });
            plugin.on("clear", function() {
                editor.value = "";
            });
            plugin.on("focus", function() {
                editor.focus();
            });
            plugin.on("blur", function() {
            });
            plugin.on("resize", function() {
            });
            plugin.on("cut", function(e) {
                if (e.native) return; // Handled by the textarea
                
                var sel = window.getSelection();
                var range = sel.getRangeAt(0);
                var data = range.toString();
                
                // Remove contents
                range.deleteContents();
                
                // Add data to clipboard
                e.clipboardData.setData("text/plain", data);
            });
            plugin.on("copy", function(e) {
                if (e.native) return; // Handled by the textarea
                
                var sel = window.getSelection();
                var range = sel.getRangeAt(0);
                var data = range.toString();
                
                // Add data to clipboard
                e.clipboardData.setData("text/plain", data);
            });
            plugin.on("paste", function(e) {
                if (e.native) return; // Handled by the textarea
                
                var data = e.clipboardData.getData("text/plain");
                if (data === false) return;
                
                var sel = window.getSelection();
                var range = sel.getRangeAt(0);
                
                // Delete contents
                range.deleteContents();
                
                // Add pasted data
                range.insertNode(document.createTextNode(data));
            });
            plugin.on("enable", function() {
                editor.disabled = false;
            });
            plugin.on("disable", function() {
                editor.disabled = true;
            });
            plugin.on("unload", function() {
                editor.parentNode.removeChild(editor);
                editor = null;
            });
            
            /***** Register and define API *****/
            
            /**
             * The texteditor handle, responsible for events that involve all 
             * TextEditor instances. This is the object you get when you request 
             * the texteditor service in your plugin.
             * 
             * Example:
             * 
             *     define(function(require, exports, module) {
             *         main.consumes = ["texteditor"];
             *         main.provides = ["myplugin"];
             *         return main;
             *     
             *         function main(options, imports, register) {
             *             var texteditorHandle = imports.texteditor;
             *         });
             *     });
             * 
             * 
             * @class texteditor
             * @extends Plugin
             * @singleton
             */
            /**
             * Simple Text Editor for Cloud9. This editor is not actually
             * used by Cloud9, but rather serves as an example of how to create
             * a simple editor for Cloud9. Check out the source code and
             * use it as a template for creating your own editor.
             * 
             * @class texteditor.TextEditor
             * @extends Editor
             **/
            /**
             * The type of editor. Use this to create the terminal using
             * {@link tabManager#openEditor} or {@link editors#createEditor}.
             * @property {"texteditor"} type
             * @readonly
             */
            plugin.freezePublicAPI({
                
            });
            
            plugin.load(null, "texteditor");
            
            return plugin;
        }
        
        register(null, {
            texteditor: handle
        });
    }
});