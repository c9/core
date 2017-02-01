define(function(require, exports, module) {
    main.consumes = ["Plugin", "ui", "util", "commands"];
    main.provides = ["Terminal"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var commands = imports.commands;
        
        var Aceterm = require("../c9.ide.terminal/aceterm/aceterm");
        
        /***** Constructors *****/
        
        /*
            plugin.on("copy", function(e) {
                if (e.native) return; // Ace handles this herself
                
                var data = aceterm.getCopyText();
                e.clipboardData.setData("text/plain", data);
            });
            plugin.on("paste", function(e) {
                if (e.native) return; // Ace handles this herself
                
                var data = e.clipboardData.getData("text/plain");
                if (data !== false)
                    aceterm.onPaste(data);
            });
        */
        
        function Terminal(options, forPlugin, baseclass) {
            if (!options) throw new Error("options are required");
            
            var plugin = new Plugin("Ajax.org", main.consumes);
            var emit = plugin.getEmitter();
            if (baseclass) plugin.baseclass();
            
            var rows = options.rows || 0;
            var cols = options.cols || 0;
            
            var aceterm, terminal;
            var redirectEvents;
            var meta = {};
            
            var excludedEvents = { 
                "draw": 1, "load": 1, "unload": 1, "resize": 1,
                "addListener": 1, "removeListener": 1, "input": 1
            };
            var renameEvents = {
                "select": "changeSelection",
                "scroll": "changeScrollTop"
            };
            
            /***** Methods *****/
            
            function send(data) {
                emit("input", { data: data });
            }
            
            function _resize(force) {
                var ace = terminal.aceSession.ace;
                
                var size = ace.renderer.$size;
                var config = ace.renderer.layerConfig;
                
                var h = size.scrollerHeight;
                var w = size.scrollerWidth - 2 * config.padding;
                
                if (!h || config.lineHeight <= 1)
                    return false;

                // top 1px is for cursor outline
                var _rows = Math.floor((h - 1) / config.lineHeight);
                if (_rows <= 2 && !ace.renderer.scrollBarV.isVisible)
                    w -= ace.renderer.scrollBarV.width;
                var _cols = Math.floor(w / config.characterWidth);
                
                if (!_cols || !_rows)
                    return;

                // Don't do anything if the size remains the same
                if (!force && _cols == terminal.cols && _rows == terminal.rows)
                    return;
                    
                if (_cols > 1000 || _rows > 1000) {
                    console.error("invalid terminal size");
                    return;
                }
                
                // do not resize terminal to very small heights during initialization
                rows = Math.max(_rows, 2);
                cols = Math.max(_cols, 2);
                    
                terminal.resize(_cols, _rows);

                emit("resize", { cols: cols, rows: rows });
            }
            
            /***** Life Cycle *****/
            
            var drawn = false;
            function draw(htmlNode) {
                if (drawn) return;
                drawn = true;
                
                aceterm = Aceterm.createEditor(htmlNode, "ace/theme/idle_fingers");
                
                terminal = new Aceterm(cols, rows, send);
                aceterm.setSession(terminal.aceSession);
                
                aceterm.renderer.on("resize", function() {
                    _resize();
                });
                
                var cm = commands;
                // TODO find better way for terminal and ace commands to coexist
                aceterm.commands.addCommands(cm.getExceptionList());
                cm.on("update", function() {
                    aceterm.commands.addCommands(cm.getExceptionList());
                }, plugin);
                
                aceterm.commands.exec = function(command) {
                    return cm.exec(command);
                };
                
                // Set Default Theme
                // if (!options.theme)
                //     options.theme = "custom-tree ace-tree-" + (options.baseName || "list");
                
                // Set properties
                for (var prop in options) {
                    if (prop == "container") continue;
                    if (plugin.hasOwnProperty(prop)) 
                        plugin[prop] = options[prop];
                }
                
                // Configure redirected events
                redirectEvents = {
                    afterRender: aceterm.renderer,
                    title: terminal,
                    afterWrite: terminal
                };
                
                emit.sticky("draw");
            }
            
            plugin.on("load", function() {
                if (options.container)
                    plugin.attachTo(options.container);
                
                forPlugin.once("unload", function() {
                    plugin.unload();
                });
            });
            plugin.on("unload", function() {
                if (aceterm) {
                    var container = aceterm.container;
                    aceterm.destroy();
                    
                    container.innerHTML = "";
                    container.parentNode.removeChild(container);
                }
                
                aceterm = null;
                container = null;
                meta = {};
            });
            plugin.on("newListener", function(type, fn) {
                if (excludedEvents[type]) return;
                
                if (renameEvents[type])
                    type = renameEvents[type];
                
                if (redirectEvents[type])
                    redirectEvents[type].on(type, fn);
                else
                    aceterm.on(type, fn);
            });
            plugin.on("removeListener", function(type, fn) {
                if (excludedEvents[type]) return;
                
                if (renameEvents[type])
                    type = renameEvents[type];
                
                if (redirectEvents[type])
                    redirectEvents[type].removeListener(type, fn);
                else
                    aceterm.removeListener(type, fn);
            });
            
            /**
             * @constructor
             * Creates a new List instance.
             * @param {Object} options
             * @param {Plugin} plugin         The plugin responsible for creating this list.
             */
            plugin.freezePublicAPI({
                // Getter Properties
                /**
                 * @ignore
                 * @readonly
                 */
                get aceterm() { return aceterm; },
                /**
                 * A meta data object that allows you to store whatever you want
                 * in relation to this menu.
                 * @property {Object} meta
                 * @readonly
                 */
                get meta() { return meta; },
                // /**
                //  * 
                //  */
                // get scrollTop(){ return model.getScrollTop(); },
                // set scrollTop(value){ return model.setScrollTop(value); },
                /**
                 * 
                 */
                get focussed() { return aceterm.isFocussed(); },
                /**
                 * 
                 */
                get container() { return aceterm.container; },
                /**
                 * 
                 */
                get renderer() { return aceterm.renderer; },
                /**
                 * 
                 */
                get selection() { return aceterm.selection; },
                /**
                 * 
                 */
                get commands() { return aceterm.commands; },
                /**
                 * 
                 */
                get cols() { return cols; },
                /**
                 * 
                 */
                get rows() { return rows; },
                
                // Getters and Setters for Properties
                /**
                 * 
                 */
                get textInput() { return aceterm.textInput; },
                set textInput(value) { return aceterm.textInput = value; },
                /**
                 *
                 */
                get scrollMargin() { return aceterm.renderer.scrollMargin; },
                set scrollMargin(value) { 
                    aceterm.renderer.setScrollMargin(value[0], value[1]); 
                },
                /**
                 * 
                 */
                get theme() { return aceterm.renderer.theme.cssClass; },
                set theme(value) { aceterm.renderer.setTheme({ cssClass: value }); },
                /**
                 * 
                 */
                get convertEol() { return terminal.convertEol || false; },
                set convertEol(value) { terminal.convertEol = value; },
                
                 // Events
                _events: [
                    /**
                     * @event draw Fires 
                     */
                    "draw",
                    /**
                     * @event click Fires 
                     */
                    "click",
                    /**
                     * @event userSelect Fires 
                     */
                    "userSelect",
                    /**
                     * @event focus Fires 
                     */
                    "focus",
                    /**
                     * @event blur Fires 
                     */
                    "blur",
                    /**
                     * @event select Fires 
                     */
                    "select",
                    /**
                     * @event scroll Fires 
                     */
                    "scroll",
                    /**
                     * @event scrollbarVisibilityChanged Fires 
                     */
                    "scrollbarVisibilityChanged",
                    /**
                     * @event resize Fires 
                     */
                    "resize",
                    /**
                     * @event afterRender Fires
                     */
                    "afterRender",
                    /**
                     * @event title Fires
                     */
                    "title",
                    /**
                     * @event afterWrite Fires
                     */
                    "afterWrite"
                ],
                
                /**
                 * 
                 */
                resize: function() {
                    return aceterm.resize(true);
                },
                /**
                 * 
                 */
                focus: function() {
                    return aceterm.focus();
                },
                /**
                 * 
                 */
                blur: function() {
                    return aceterm.blur();
                },
                /**
                 * 
                 */
                execCommand: function(cmd) {
                    return aceterm.execCommand(cmd);
                },
                /**
                 * 
                 */
                scrollIntoView: function(anchor, lead, offset) { 
                    return aceterm.renderer.scrollCaretIntoView(anchor, lead, offset);
                },
                /**
                 * 
                 */
                enable: function() {
                    return aceterm.enable();
                },
                /**
                 * 
                 */
                disable: function() {
                    return aceterm.enable();
                },
                /**
                 * 
                 */
                write: function(data) {
                    return terminal.write(data);
                },
                /**
                 * 
                 */
                clear: function(data) {
                    terminal.clear();
                },
                /**
                 * 
                 */
                attachTo: function(htmlNode, beforeNode) {
                    var container;
                    if (drawn)
                        container = aceterm.container;
                    else {
                        container = document.createElement("div");
                        container.style.height = "100%";
                    }
                    
                    htmlNode.insertBefore(container, beforeNode);
                        
                    if (!drawn)
                        draw(container);
                }
            });
            
            plugin.load(null, options.baseName || "list");
            
            return plugin;
        }
        
        register(null, {
            Terminal: Terminal
        });
    }
});