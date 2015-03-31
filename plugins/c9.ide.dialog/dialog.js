define(function(require, module, exports) {
    main.consumes = ["Plugin", "ui", "commands", "focusManager"];
    main.provides = ["Dialog"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var commands = imports.commands;
        var focusManager = imports.focusManager;
        
        var EventEmitter = require("events").EventEmitter;
        
        Dialog.queue = [];
        Dialog.addToQueue = function(dialog, fn, force) {
            var emitter = new EventEmitter();
            emitter.visible = undefined;
            
            function queueItem(){
                fn(function(){
                    Dialog.queue.splice(Dialog.queue.indexOf(queueItem), 1);
                    
                    emitter.emit("hide");
                    emitter.visible = 0;
                    
                    if (Dialog.queue.length)
                        Dialog.queue[0]();
                    else {
                        // Timeout to prevent the editor 
                        // from getting the key stroke
                        setTimeout(function(){ 
                            // Return last focussed element
                            focusManager.focus(Dialog.lastFocus);
                            delete Dialog.lastFocus;
                        });
                    }
                });
                
                if (emitter.emit("show") === false)
                    dialog.hide();
                else
                    emitter.visible = 1;
            }
            
            if (force)
                queueItem();
            else {
                Dialog.queue.push(queueItem);
                
                // Save last focussed element
                if (!Dialog.lastFocus)
                    Dialog.lastFocus = focusManager.activeElement;
                
                // Timeout to make sure events can be set on the emitter.
                if (Dialog.queue.length == 1)
                    setTimeout(Dialog.queue[0]);
            }
            
            return emitter;
        };
        
        function Dialog(developer, deps, options) {
            var plugin = new Plugin(developer, deps.concat(main.consumes));
            var emit = plugin.getEmitter();
            
            var name = options.name;
            var left = options.left;
            var top = options.top;
            var width = options.width || 512;
            var height = options.height;
            var title = options.title;
            var heading = options.heading;
            var body = options.body;
            var className = options.class;
            var modal = options.modal;
            var zindex = options.zindex;
            var allowClose = options.allowClose;
            var elements = options.elements || [];
            var resizable = false;
            var widths = options.widths || {};
            var count = 0;
            
            var dialog, buttons, titles;
            
            var drawn = false;
            function draw(htmlNode) {
                if (drawn) return;
                drawn = true;
                
                // Create UI elements
                dialog = new ui.modalwindow({
                    id: "window",
                    title: title,
                    icon: "",
                    center: "true",
                    modal: modal,
                    buttons: allowClose ? "close" : "",
                    width: width,
                    height: height,
                    zindex: zindex || "",
                    skin: "bk-window2",
                    class: "dialog " 
                        + (height ? "" : "relative") 
                        + (options.dark ? " dark" : "") 
                        + (className ? " " + className : ""),
                    childNodes: [
                        new ui.vbox({
                            id: "titles",
                            padding: 10,
                            edge: "15 20 25 20",
                        }),
                        new ui.hbox({
                            id: "buttons",
                            class: "dialog-buttons",
                            pack: "end",
                            padding: "8",
                            height: "46",
                            edge: "11 10 10"
                        })
                    ]
                });
                apf.document.documentElement.appendChild(dialog);
                plugin.addElement(dialog);
                
                dialog.on("prop.visible", function(e) {
                    if (e.value) emit("show");
                    else emit("hide");
                });
                dialog.on("keydown", function(e) {
                    if (allowClose && e.keyCode == 27)
                        dialog.hide();
                });
                
                commands.addCommand({
                    name: plugin.name,
                    bindKey: { mac: "ESC", win: "ESC" },
                    group: "ignore",
                    isAvailable: function(){
                        return dialog.visible;
                    },
                    exec: function(){
                        dialog.dispatchEvent("keydown", { keyCode : 27 });
                    }
                }, plugin);
                
                titles = plugin.getElement("titles");
                buttons = plugin.getElement("buttons");
                
                // Create dynamic UI elements
                if (elements.length) {
                    elements.forEach(function(item) {
                        createItem(null, null, item);
                    });
                }
                else {
                    buttons.parentNode.removeChild(buttons);
                }
                
                emit.sticky("draw", {
                    aml: titles,
                    html: titles.$int
                });
                
                if (options.resizable)
                    plugin.resizable = options.resizable;
            }
            
            /***** Method *****/
            
            function queue(implementation, force) {
                if (!plugin.loaded) 
                    return;
                
                return Dialog.addToQueue(dialog, function(next) {
                    // Draw everything if needed
                    draw();
                    
                    // Call the show implementation
                    implementation();
                    
                    // Update UI
                    var custom = options.custom || !(heading || body);
                    if (!custom) {
                        titles.$int.innerHTML = "<h3 style='margin:0 0 10px 0'>" 
                            + heading + "</h3><div class='alertMsg'>" 
                            + body + "</div>";
                    }
                    
                    // allow selecting dialog message text
                    titles.textselect = !custom;
                    
                    // When the dialog closes the next dialog can appear
                    plugin.once("hide", next);
                    
                    // Show UI
                    dialog.show();
                    
                    // Focus UI
                    focusManager.focus(dialog, true);
                }, force);
            }
            
            function show() {
                return plugin.queue(function(){}, true);
            }
            
            function hide(){
                dialog && dialog.hide();
            }
            
            // @todo this looks very similar to forms.js. Perhaps able to merge?
            function update(items) {
                items.forEach(function(item) {
                    if (!drawn) {
                        elements.every(function(el) {
                            if (el.id == item.id) {
                                for (var prop in item) {
                                    el[prop] = item[prop];
                                }
                                return false;
                            }
                            return true;
                        });
                        return;
                    }
                    
                    var el = plugin.getElement(item.id);
                    switch(el.type) {
                        case "dropdown":
                            var dropdown = el.lastChild;
                            
                            var data = item.items.map(function(item) {
                                return "<item value='" + item.value 
                                  + "'><![CDATA[" + item.caption + "]]></item>";
                            }).join("");
                            if (data) 
                                dropdown.$model.load("<items>" + data + "</items>");
                            if (item.value)
                                dropdown.setAttribute("value", item.value);
                        break;
                        default:
                            if ("value" in item)
                                el.setAttribute('value', item.value);
                            if ("onclick" in item)
                                el.onclick = item.onclick;
                            if ("visible" in item)
                                el.setAttribute("visible", item.visible)
                            if ("zindex" in item)
                                el.setAttribute("zindex", item.zindex)
                        break;
                    }
                })
            }
            
            // @todo this looks very similar to forms.js. Perhaps able to merge?
            function createItem(heading, name, options) {
                var position = options.position || count++;
                var node;
                
                switch(options.type) {
                    case "checkbox":
                        node = new ui.checkbox({
                            label: options.caption,
                            value: options.defaultValue || "",
                            values: options.values,
                            skin: "checkbox_black",
                        });
                    break;
                    case "dropdown":
                        var model = options.model || new ui.model();
                        var data = options.items && options.items.map(function(item) {
                            return "<item value='" + item.value + "'><![CDATA[" + item.caption + "]]></item>";
                        }).join("");
                        if (data) model.load("<items>" + data + "</items>");
                        
                        node = new ui.dropdown({
                            model: model,
                            width: options.width || widths.dropdown,
                            skin: "black_dropdown",
                            value: options.defaultValue || "",
                            each: options.each || "[item]",
                            caption: options.caption || "[text()]",
                            eachvalue: options.eachvalue || "[@value]",
                            "empty-message" : options["empty-message"]
                        });
                    break;
                    case "textbox":
                        node = new ui.textbox({
                            skin: "searchbox",
                            "initial-message": options.message || "",
                            width: options.width || widths.textbox,
                            value: options.defaultValue || "",
                            realtime: options.realtime || 1
                        });
                    break;
                    case "button":
                        node = new ui.button({
                            skin: "btn-default-css3",
                            "class"   : options.color ? "btn-" + options.color : "",
                            margin: options.margin,
                            caption: options.caption || "",
                            submenu: options.submenu && options.submenu.aml 
                                || options.submenu || "",
                            width: options.width || widths.button,
                            "default" : options["default"] ? "1" : ""
                        });
                    break;
                    case "label":
                        node = new ui.label({
                            caption: options.caption,
                            style: options.style,
                            width: options.width || ""
                        });
                    break;
                    case "image":
                        node = new ui.img({
                            skin: "simpleimg",
                            src: options.src,
                            margin: options.margin,
                            width: options.width,
                            height: options.height
                        });
                    break;
                    case "divider":
                        node = new ui.divider({ 
                            skin: "c9-divider-hor",
                            margin: "5 0 5 0"
                        });
                    break;
                    case "filler":
                        node = new ui.filler();
                    break;
                    case "custom":
                        node = options.node;
                    break;
                    default:
                        throw new Error("Unknown form element type: " 
                            + options.type);
                }
                
                if (options.id || options.name)
                    node.setAttribute("id", options.id || options.name);
                if (options.visible !== undefined)
                    node.setAttribute("visible", options.visible);
                if (options.onclick)
                    node.onclick = options.onclick;
                if (options.hotkey) {
                    dialog.on("keydown", function(e) {
                        if (options.hotkey == "ESC" && e.keyCode == 27
                          || String.fromCharCode(e.keyCode) == options.hotkey)
                            node.dispatchEvent("click");
                    });
                }
                
                ui.insertByIndex(buttons, node, position, plugin);
                plugin.addElement(node);
                
                return node;
            }
            
            plugin.on("unload", function(){
                drawn = false;
                resizable = false;
            });
            
            /***** Register and define API *****/
            
            plugin.freezePublicAPI.baseclass();
            
            /**
             * Dialog Builder for Cloud9. Use this class to create dialogs.
             * 
             * Example:
             * 
             *     var dialog = new Dialog("Developer Name", main.consumes, {
             *         allowClose : true,
             *         modal      : false,
             *         elements   : [
             *             { type: "checkbox", caption: "Apply to all open files" },
             *             { type: "filler" },
             *             { type: "button", id: "keepmine",  color: "blue",  caption: "Keep Mine" },
             *             { type: "button", id: "useremote", color: "blue",  caption: "User Remote" },
             *             { type: "button", id: "mergeboth", color: "green", caption: "Merge Both", "default": true }
             *         ]
             *     });
             */
            /**
             * @constructor
             * Creates a new Dialog instance based on an abstract definition of
             * the dialog elements.
             * 
             * @param {Object}      [options]            The definition of the dialog.
             */
            plugin.freezePublicAPI({
                /**
                 * The APF element that is the parent to all form elements.
                 * @property {AMLElement} aml
                 * @private
                 * @readonly
                 */
                get aml(){ return dialog; },
                
                /**
                 * @property {Number} width
                 */
                get width(){ return width; }, 
                set width(v) { 
                    width = v; 
                    dialog && dialog.setAttribute("width", width);
                }, 
                /**
                 * @property {Number} left
                 */
                get left(){ return left; }, 
                set left(v) { 
                    left = v; 
                    dialog && dialog.setAttribute("left", left);
                }, 
                /**
                 * @property {Number} top
                 */
                get top(){ return top; },
                set top(v) { 
                    top = v;
                    dialog && dialog.setAttribute("top", top);
                },
                /**
                 * @property {Number} title
                 */
                get title(){ return title; },
                set title(v) { 
                    title = v;
                    dialog && dialog.setAttribute("title", title);
                },
                /**
                 * @property {Boolean} resizable
                 */
                get resizable(){ return resizable; },
                set resizable(v) { 
                    if (v === resizable) return;
                    resizable = v;
                    if (!dialog) return;
                    
                    if (!height)
                        dialog.setAttribute("height", v ? dialog.getHeight() : "");
                    if (!width)
                        dialog.setAttribute("width", v ? dialog.getWidth() : "");
                        
                    dialog.setAttribute("class", "dialog " 
                        + (v ? "" : "relative")
                        + (options.dark ? " dark" : "") 
                        + (className ? " " + className : ""));
                        
                    // titles.setAttribute("anchors", v ? "0 0 46 0" : "");
                    // buttons.setAttribute("bottom", v ? "0" : "");
                    // buttons.setAttribute("left", v ? "0" : "");
                    // buttons.setAttribute("right", v ? "0" : "");
                    dialog.setAttribute("resizable", v);
                },
                /**
                 * @property {Number} heading
                 */
                get heading(){ return heading; },
                set heading(v) { 
                    heading = v;
                },
                /**
                 * @property {Number} body
                 */
                get body(){ return body; },
                set body(v) { 
                    body = v;
                },
                /**
                 * @property {Boolean} modal
                 * @readonly
                 */
                get modal(){ return modal; },
                /**
                 * @property {Boolean} visible
                 * @readonly
                 */
                get visible(){ return dialog && dialog.visible; },
                /**
                 * @property {Boolean} allowClose
                 */
                get allowClose(){ return allowClose; },
                set allowClose(v) { 
                    allowClose = v;
                    dialog && dialog.setAttribute("buttons", v ? "close" : "");
                },
                
                _events: [
                    /**
                     * Fires when the form is drawn.
                     * @event draw
                     */
                    "draw",
                    /**
                     * Fires when the form becomes visible. This happens when
                     * it's attached to an HTML element using the {@link #attachTo}
                     * method, or by calling the {@link #method-show} method.
                     * @event show
                     */
                    "show",
                    /**
                     * Fires when the form becomes hidden. This happens when
                     * it's detached from an HTML element using the {@link #detach}
                     * method, or by calling the {@link #method-hide} method.
                     * @event hide
                     */
                    "hide"
                ],
    
                /**
                 * Updates form elements with new values. This method currently
                 * only supports updating the items of a dropdown element.
                 * 
                 * Example: 
                 * 
                 *     dialog.update([
                 *         { id: "keepmine", onclick: function(){} },
                 *         { id: "useremote", onclick: function(){} },
                 *         { id: "mergeboth", onclick: function(){} }
                 *     ]);
                 * 
                 * @param {Array} items
                 */
                update: update,
    
                /**
                 * Show the dialog when no other dialogs are there. 
                 * @param {Function} callback
                 * @fires show
                 */
                queue: queue,
    
                /**
                 * Show the dialog. When using queing overwrite this method
                 * with your own show function.
                 * @fires show
                 */
                show: show,
    
                /**
                 * Hide the dialog.
                 * @fires hide
                 */
                hide: hide
            });
            
            plugin.load(name, "dialog");
    
            return plugin;
        }
        
        register("", {
            Dialog: Dialog
        });
    }
});