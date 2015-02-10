define(function(require, exports, module) {
    main.consumes = ["Editor", "editors"];
    main.provides = ["urlview"];
    return main;

    function main(options, imports, register) {
        var Editor = imports.Editor;
        var editors = imports.editors;
        
        /***** Initialization *****/
        
        var extensions = [];
                          
        function UrlView(){
            var plugin = new Editor("Ajax.org", main.consumes, extensions);
            //var emit = plugin.getEmitter();
            var container;
            
            plugin.on("draw", function(e) {
                // Create UI elements
                container = e.htmlNode;
            });
            
            /***** Method *****/
            
            /***** Lifecycle *****/
            
            plugin.on("load", function(){
            });
            
            var currentDocument;
            plugin.on("documentLoad", function(e) {
                var doc = e.doc;
                var session = doc.getSession();
                
                // Value
                doc.on("getValue", function get(e) { 
                    return currentDocument == doc 
                        ? session.iframe.src 
                        : e.value;
                }, session);
                
                doc.on("setValue", function set(e) { 
                    if (currentDocument == doc)
                        session.iframe.src = e.value || "about:blank"; 
                }, session);
                
                session.state = e.state || {};
                
                if (!session.iframe) {
                    var div = document.createElement("div");
                    var iframe = document.createElement("iframe");
                    
                    iframe.setAttribute("nwfaketop", true);
                    iframe.setAttribute("nwdisable", true);

                    iframe.style.width = "100%";
                    iframe.style.height = "100%";
                    iframe.style.border = 0;
                    iframe.src = doc.value || "about:blank";
                    
                    div.style.position = "absolute";
                    div.style.left = 0;
                    div.style.top = 0;
                    div.style.right = 0;
                    div.style.bottom = 0;
                    div.appendChild(iframe);
                    
                    session.iframe = iframe;
                    session.div = div;
                }
                
                container.appendChild(session.div);
                
                session.iframe.style.backgroundColor = 
                doc.tab.backgroundColor =
                    session.state.backgroundColor || "#222222";
                
                if (session.state.dark === false)
                    doc.tab.classList.remove("dark");
                else
                    doc.tab.classList.add("dark");
            });
            plugin.on("documentActivate", function(e) {
                if (currentDocument)
                    currentDocument.getSession().div.style.display = "none";
                    
                currentDocument = e.doc;
                
                e.doc.getSession().div.style.display = "block";
            });
            plugin.on("documentUnload", function(e) {
                container.removeChild(e.doc.getSession().div);
            });
            plugin.on("getState", function(e) {
                var doc = e.doc;
                e.state.backgroundColor = doc.tab.backgroundColor;
                e.state.dark = doc.tab.classList.names.indexOf("dark") > -1;
            });
            plugin.on("setState", function(e) {
                e.doc.tab.backgroundColor = e.state.backgroundColor;
                if (e.state.dark)
                    e.doc.tab.classList.add("dark");
            });
            plugin.on("clear", function(){
            });
            plugin.on("focus", function(){
            });
            plugin.on("enable", function(){
            });
            plugin.on("disable", function(){
            });
            plugin.on("unload", function(){
            });
            
            /***** Register and define API *****/
            
            /**
             * The urlview handle, responsible for events that involve all 
             * UrlView instances. This is the object you get when you request 
             * the urlview service in your plugin.
             * 
             * Example:
             * 
             *     define(function(require, exports, module) {
             *         main.consumes = ["urlview"];
             *         main.provides = ["myplugin"];
             *         return main;
             *     
             *         function main(options, imports, register) {
             *             var urlviewHandle = imports.urlview;
             *         });
             *     });
             * 
             * 
             * @class urlview
             * @extends Plugin
             * @singleton
             */
            /**
             * Simple URL Viewer for Cloud9. This is not an actual editor
             * but instead loads an iframe in an editor tab. This editor can
             * only be instantiated programmatically and should be used when 
             * you need to show a website in Cloud9. 
             * 
             * Note that this plugin is not intended for previewing content,
             * use the {@link Preview} plugin for that purpose.
             * 
             * This example shows how to create a tab that shows c9.io.
             * 
             *     tabManager.open({
             *         value      : "http://www.c9.io",
             *         editorType : "urlview",
             *         active     : true,
             *         document   : {
             *             urlview : {
             *                 backgroundColor : "#FF0000",
             *                 dark            : true
             *             }
             *         }
             *     }, function(err, tab) {
             *          console.log("Done");
             *     })
             * 
             * @class urlview.UrlView
             * @extends Editor
             **/
            /**
             * The type of editor. Use this to create the urlview using
             * {@link tabManager#openEditor} or {@link editors#createEditor}.
             * @property {"urlview"} type
             * @readonly
             */
            /**
             * Retrieves the state of a document in relation to this editor
             * @param {Document} doc  The document for which to return the state
             * @method getState
             * @return {Object}
             * @return {String} return.backgroundColor  The background color of the tab.
             * @return {String} return.dark             Whether the "dark" class is set to the tab.
             */
            plugin.freezePublicAPI({
                
            });
            
            plugin.load("urlview" + counter++);
            
            return plugin;
        }
        
        register(null, {
            urlview: editors.register("urlview", "URL Viewer", 
                                         UrlView, extensions)
        });
    }
});