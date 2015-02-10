define(function(require, module, exports) {
    main.consumes = [
        "Plugin", "menus", "ui"
    ];
    main.provides = ["editors"];
    return main;

    function main(options, imports, register) {
        var ui = imports.ui;
        var Plugin = imports.Plugin;
        var menus = imports.menus;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var fileExtensions = {};
        var editors = {};
        var defaultEditor;
        var group;
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
            
            plugin.addElement(group = new ui.group());
            
            menus.addItemByPath("View/Editors/", new ui.menu({
                "onprop.visible" : function(e) {
                    if (!e.value)
                        return;
                    
                    emit("menuShow", { menu: this });
                }
            }), 100, plugin);
            menus.addItemByPath("View/~", new ui.divider(), 200, plugin);
        }
        
        function findEditor(type, editor) {
            if (type)
                editor = editors[type];
            
            // if (!editor) {
            //     util.alert(
            //         "No editor is registered",
            //         "Could not find an editor to display content!",
            //         "There is something wrong with the configuration of \
            //          your IDE. No editor plugin is found.");
            //     return;
            // }
            
            return editor;
        }
        
        function findEditorByFilename(fn) {
            var ext = fn.substr(fn.lastIndexOf(".") + 1).toLowerCase();
            var editor = fileExtensions[fn] && fileExtensions[fn][0]
                || fileExtensions[ext] && fileExtensions[ext][0]
                || defaultEditor;
            
            return findEditor(null, editor);
        }
        
        /***** Methods *****/
        
        function registerPlugin(type, caption, editor, extensions) {
            editors[type] = editor;
            
            var handle = new Plugin("Ajax.org", []);
            handle[type] = editor;
            handle[caption] = caption;
            
            editor.type = type;
            editor.fileExtensions = extensions;
            
            if (extensions.length) {
                //Add a menu item to the list of editors
                menus.addItemByPath("View/Editors/" + caption,
                    new ui.item({
                        type: "radio",
                        value: type,
                        group: group,
                        onclick: function(){
                            emit("menuClick", {value: this.value});
                        }
                    }), 40000, handle);
            }
    
            extensions.forEach(function(ext) {
                // force lower-case, to account for other LowerCase checks below
                ext = ext.toLowerCase();
                (fileExtensions[ext] || (fileExtensions[ext] = [])).push(editor);
            });
    
            if (editor.type == options.defaultEditor)
                defaultEditor = editor;
            
            emit("register", {editor: editor});
            
            handle.on("load", function(){
                if (!editors[type])
                    registerPlugin(type, caption, editor, extensions);
            });
            handle.on("unload", function(){
                unregisterPlugin(type, editor, extensions);
            });
            return handle;
        }
        
        function unregisterPlugin(type, editor, extensions) {
            delete editors[type];
            
            extensions.forEach(function(fe) {
                if (!fileExtensions[fe]) return;
                
                var idx = fileExtensions[fe].indexOf(editor);
                fileExtensions[fe].splice(idx, 1);
                if (!fileExtensions[fe].length)
                    delete fileExtensions[fe];
            });
    
            if (defaultEditor == editor)
                defaultEditor = null;
            
            emit("unregister", {editor: editor});
        }
        
        function createEditor(type, callback) {
            if (!type) type = "default";
            
            var cancelled = false;
            
            function create(){
                if (cancelled) return;
                var constr = editors[type];
                var editor = constr ? new constr() : false;
                editor.type = type;
                callback(null, editor);
                
                emit("create", { editor: editor });
            }
            
            if (editors[type]) create();
            else {
                plugin.on("register", function wait(e) {
                    if (e.editor.type == type) {
                        plugin.off("register", wait);
                        
                        // Delay creation to make sure handle is created
                        setTimeout(create);
                    }
                });
                return function cancel() { cancelled = true };
            }
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
        });
        
        /***** Register and define API *****/

        /**
         * Editor Manager for Cloud9. Editors are automatically registered
         * here when using the {@link Editor} base class. Use this class to
         * instantiate an editor instance for use outside of the normal tabs.
         * If you want to open a tab with an editor to edit file content use
         * {@link tabManager#method-open}.
         * 
         * @singleton
         **/
        plugin.freezePublicAPI({
            /**
             * The editor that is used when no editor is registered for the 
             * file extension in question.
             * 
             * See {@link editors#findEditorByFilename}
             * See {@link tabManager#method-open}
             * 
             * @property {String} defaultEditor
             */
            get defaultEditor(){ return options.defaultEditor; },
            
            /**
             * Array of file extensions supported by the registered editors
             * @property {String[]} fileExtensions  
             */
            get fileExtensions(){ return fileExtensions; },
            
            _events: [
                /**
                 * @event register Fires when an editor registers
                 * @param {Object} e
                 * @param {Editor} e.editor  The editor that is registered
                 * @readonly
                 */
                "register",
                /**
                 * @event unregister Fires when an editor unregisters
                 * @param {Object} e
                 * @param {Editor} e.editor  The editor that is unregistered
                 * @readonly
                 */
                "unregister"
            ],
            
            /**
             * Registers an editor constructor to be available for certain
             * file types
             * @param {Function} editor the editor constructor
             * @param {String[]} fileExtensions the file extensions this editor supports
             */
            register: registerPlugin,
            
            /**
             * Unregisters an editor constructor for certain file types
             * @param {Function} editor the editor constructor
             */
            unregister: unregisterPlugin,
            
            /**
             * Retrieves an editor constructor class based on it's type
             * @param {String} type  The type of the editor to retrieve
             * @return {Function}
             */
            findEditor: findEditor,
            
            /**
             * Retrieves an editor constructor class based on a filename (or path)
             * @param {String} filename the filename that determines the editor to find
             * @return {Function}
             */
            findEditorByFilename: findEditorByFilename,
            
            /**
             * Create an editor instance based on it's type
             * @param {String} type  The type of the editor to create
             * @return {Editor}
             */
            createEditor: createEditor
        });
        
        register(null, {
            editors: plugin
        });
    }
});