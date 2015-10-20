define(function(require, exports, module) {
    main.consumes = ["ui", "Plugin", "settings"];
    main.provides = ["Form"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var ui = imports.ui;
        
        /***** Initialization *****/
        
        function Form(options, forPlugin) {
            var plugin = new Plugin("Ajax.org", main.consumes);
            var emit = plugin.getEmitter();

            var model = options.model;
            var edge = options.edge || "10 10 10 10";
            var rowheight = options.rowheight || 40;
            var width = options.colwidth || 300;
            var maxwidth = options.colmaxwidth || 300;
            var widths = options.widths || {};
            var skins = options.skins || {};
            var elements = {};
            var container, meta = {};

            var debug = location.href.indexOf('menus=1') > -1;
            var headings = {};
            
            if (!Form.proxy) {
                Form.proxy = new apf.Class().$init();
                apf.nameserver.register("all", "Form", Form);
            }

            var loaded;
            function load(){
                if (loaded) return;
                loaded = true;

                if (options.html)
                    draw(options.html);

                if (options.form)
                    add(options.form);
                
                if (forPlugin)
                    forPlugin.addOther(function(){ plugin.unload(); });
            }
        
            var drawn = false;
            function draw(htmlNode) {
                if (drawn) return;
                drawn = true;
                
                // Create UI elements
                container = new ui.bar({ 
                    htmlNode: htmlNode || document.body,
                    "class"  : options.className,
                    style: options.style || ""
                });
                plugin.addElement(container);
                
                if (model)
                    container.setAttribute("model", model);
                
                emit("draw");
            }
            
            /***** Method *****/
            
            function add(state, foreign) {
                if (!drawn) {
                    plugin.on("draw", function wait(){
                        add(state, foreign);
                        plugin.off("draw", wait);
                    });
                    return;
                }
                
                // An array of items
                if (state instanceof Array) {
                    state.forEach(function(item) {
                        createItem({ container: container }, item.title, item, foreign);
                    });
                    return;
                }
                
                // A simple object as items
                for (var caption in state) {
                    if (caption == "position") continue;
                    
                    var first = state[caption];
                    var heading = createHeading(caption, 
                        // basegroup + 
                        first.position, 
                        Object.keys(first).length < 1, foreign);
                    
                    if (first instanceof Array) {
                        first.forEach(function(item) {
                            createItem(heading, item.title, item, foreign);
                        });
                    }
                    else {
                        for (var title in first) {
                            if (title == "position") {
                                continue;
                            }

                            var second = first[title];
                            createItem(heading, title, second, foreign);
                        }
                    }
                }
            }
            
            function createHeading(name, position, hack, foreign) {
                if (!foreign) foreign = plugin;

                var heading = headings[name];
                if (!heading) {
                    if (!hack) {
                        var aml = container.appendChild(new apf.bar());
                        aml.$int.innerHTML = '<div class="header"><span></span><div>'
                            + apf.escapeXML((debug 
                                ? "\[" + (position || "") + "\] " 
                                : "") + name) 
                            + '</div></div>';
                    }
                    
                    heading = headings[name] = {
                        container: aml
                    };
                    
                    foreign.addOther(function(){
                        heading.container.destroy(true, true);
                        // heading.nav.parentNode.removeChild(ns.nav);
                        delete headings[name];
                    });
                }
                
                if (position && position != heading.container.$position) {
                    !hack && ui.insertByIndex(container, heading.container, position, foreign);
                }
                
                return heading;
            }
            
            function getName(path) {
                var parts = path.split("/");
                var name = "";
                parts.forEach(function(part) { 
                    name += part.uCaseFirst().replace(/[-\.]/g, "_"); 
                });
                if (~name.indexOf("@"))
                    name = name.replace(/@(.*)/, "$1Attribute");
                return name;
            }
            
            function createBind(path) {
                var name = getName(path);
                Form.proxy.setProperty(name, settings.get(path));
                Form.proxy.on("prop." + name, function(e) {
                    settings.set(path, e.value);
                });
                settings.on(path, function(value) {
                    if (Form.proxy[name] != value)
                        Form.proxy.setProperty(name, value);
                }, plugin);
                return "{Form.proxy." + name + "}";
            }

            function createItem(heading, name, options, foreign) {
                if (!foreign) foreign = plugin;

                var position = options.position;
                var node, childNodes;
                
                if (options.setting && !options.path)
                    options.path = options.setting;
                
                if (debug)
                    name = "\\[" + (position || "") + "\\] " + name;
                
                switch (options.type) {
                    case "checkbox":
                        childNodes = [
                            new ui.label({ width : width, maxwidth: maxwidth, caption: name + ":" }),
                            new ui.checkbox({
                                value: options.path 
                                    ? createBind(options.path) 
                                    : (options.defaultValue || ""),
                                values: options.values,
                                skin: "cboffline"
                                // width: "55"
                            })
                        ];
                    break;
                    case "dropdown":
                        var model = options.model || new ui.model();
                        var data = options.items && options.items.map(function(item) {
                            return "<item value='" + item.value + "'><![CDATA[" + item.caption + "]]></item>";
                        }).join("");
                        if (data) model.load("<items>" + data + "</items>");
                        
                        var dd;
                        childNodes = [
                            new ui.label({ width : width, maxwidth: maxwidth, caption: name + ":" }),
                            dd = new ui.dropdown({
                                model: model,
                                width: options.width || widths.dropdown,
                                skin: "black_dropdown",
                                margin: "-1 0 0 0",
                                zindex: 100,
                                onafterchange: function(e) {
                                    if (options.path)
                                        settings.set(options.path, e.value);
                                    
                                    if (options.onchange)
                                        options.onchange({ value: e.value || e.args[2] });
                                }, 
                                value: options.path
                                    ? settings.get(options.path)
                                    : (options.defaultValue || ""),
                                each: options.each || "[item]",
                                caption: options.caption || "[text()]",
                                eachvalue: options.eachvalue || "[@value]",
                                "empty-message" : options["empty-message"]
                            })
                        ];
                        
                        settings.on(options.path, function(){
                            dd.setValue(settings.get(options.path));
                        }, plugin);
                    break;
                    case "spinner":
                        childNodes = [
                            new ui.label({ width : width, maxwidth: maxwidth, caption: name + ":" }),
                            new ui.spinner({
                                width: options.width || widths.spinner,
                                value: options.path 
                                    ? createBind(options.path) 
                                    : (options.defaultValue || ""),
                                min: options.min || 0,
                                max: options.max || 10,
                                realtime: typeof options.realtime !== "undefined" ? options.realtime : 1,
                                onafterchange: function(e) {
                                    if (options.onchange)
                                        options.onchange({ value: e.value });
                                }, 
                            })
                        ];
                    break;
                    case "checked-spinner":
                        childNodes = [
                            new ui.checkbox({
                                value: options.checkboxPath 
                                    ? createBind(options.checkboxPath) 
                                    : (options.defaultCheckboxValue || ""),
                                width: width, maxwidth: maxwidth, 
                                label: name + ":",
                                skin: "checkbox_black",
                                onafterchange: function(e) {
                                    if (options.onchange)
                                        options.onchange({ value: e.value, type: "checkbox" });
                                }, 
                            }),
                            new ui.spinner({
                                width: options.width || widths["checked-spinner"],
                                value: options.path 
                                    ? createBind(options.path) 
                                    : (options.defaultValue || ""),
                                min: options.min || 0,
                                max: options.max || 10,
                                realtime: typeof options.realtime !== "undefined" ? options.realtime : 1,
                                onafterchange: function(e) {
                                    if (options.onchange)
                                        options.onchange({ value: e.value, type: "spinner" });
                                }, 
                            })
                        ];
                    break;
                    case "checkbox-single":
                        childNodes = [
                            new ui.checkbox({
                                value: options.path
                                    ? createBind(options.path) 
                                    : (options.defaultValue || ""),
                                width: options.width || widths["checked-single"], 
                                label: name,
                                skin: "checkbox_black",
                                onafterchange: function(e){
                                    if (options.onchange)
                                        options.onchange({ value: e.value });
                                } 
                            })
                        ];
                    break;
                    case "textbox":
                        childNodes = [
                            new ui.label({ width : width, maxwidth: maxwidth, caption: name + ":" }),
                            new ui.textbox({
                                skin: skins.textbox || "searchbox",
                                margin: "-3 0 0 0",
                                "initial-message": options.message || "",
                                width: options.width || widths.textbox,
                                value: options.path 
                                    ? createBind(options.path) 
                                    : (options.defaultValue || ""),
                                realtime: typeof options.realtime !== "undefined" ? options.realtime : 1
                            })
                        ];
                    break;
                    case "password":
                        childNodes = [
                            new ui.label({ width : width, maxwidth: maxwidth, caption: name + ":" }),
                            new ui.password({
                                skin: skins.textbox || "searchbox",
                                width: options.width || widths.password,
                                value: options.path 
                                    ? createBind(options.path) 
                                    : (options.defaultValue || ""),
                                realtime: typeof options.realtime !== "undefined" ? options.realtime : 1
                            })
                        ];
                    break;
                    case "colorbox":
                        childNodes = [
                            new ui.label({ width : width, maxwidth: maxwidth, caption: name + ":" }),
                            new ui.colorbox({
                                width: options.width || widths.colorbox,
                                value: options.path 
                                    ? createBind(options.path) 
                                    : (options.defaultValue || ""),
                                realtime: typeof options.realtime !== "undefined" ? options.realtime : 1
                            })
                        ];
                    break;
                    case "button":
                        childNodes = [
                            new ui.label({ width : width, maxwidth: maxwidth, caption: name + ":" }),
                            new ui.button({
                                skin: "blackbutton",
                                height: 24,
                                margin: "-2 0 -2 0",
                                style: "line-height:22px",
                                caption: options.caption,
                                width: options.width || widths.button,
                                onclick: options.onclick
                            })
                        ];
                    break;
                    case "submit":
                        node = new ui.button({
                            skin: "btn-default-css3",
                            margin: options.margin,
                            caption: options.caption || "",
                            submenu: options.submenu && options.submenu.aml 
                                || options.submenu || "",
                            width: options.width || "",
                            onclick: options.onclick,
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
                    case "textarea":
                        childNodes = [
                            new ui.label({ width : width, maxwidth: maxwidth, caption: name + ":" }),
                            new ui.textarea({
                                width: options.width || widths.textarea,
                                height: options.height || 200,
                                value: options.path 
                                    ? createBind(options.path) 
                                    : (options.defaultValue || ""),
                                realtime: typeof options.realtime !== "undefined" ? options.realtime : 1
                            })
                        ];
                    break;
                    case "textarea-row":
                        // TODO this should be ace
                        node = new ui.vsplitbox({
                            options: options,
                            height: options.rowheight || rowheight,
                            edge: options.edge || edge,
                            type: options.type,
                            childNodes: [
                                new ui.label({ height: 40, caption: name + ":" }),
                                new ui.textarea({
                                    width: options.width || widths.textarea,
                                    height: options.height || 200,
                                    style: options.fixedFont
                                        ? "font-family: Monaco, Menlo, 'Ubuntu Mono', Consolas, source-code-pro, monospace; font-size: 10px"
                                        : "",
                                    value: options.path 
                                        ? createBind(options.path) 
                                        : (options.defaultValue || ""),
                                    realtime: typeof options.realtime !== "undefined" ? options.realtime : 1
                                })
                            ]
                        });
                    break;
                    case "custom":
                        node = options.node;
                    break;
                    default:
                        throw new Error("Unknown form element type: " 
                            + options.type);
                }
                
                if (!node) {
                    node = new ui.hsplitbox({
                        options: options,
                        height: options.rowheight || rowheight,
                        edge: options.edge || edge,
                        type: options.type,
                        childNodes: childNodes
                    });
                }
                
                if (options.id || options.name) {
                    node.setAttribute("id", options.id || options.name);
                    elements[node.name] = node;
                }
                
                ui.insertByIndex(heading.container, node, position, foreign);

                foreign.addElement(node);
                
                return node;
            }
            
            function update(items) {
                items.forEach(function(item) {
                    var el = elements[item.id];
                    switch (el.type) {
                        case "dropdown":
                            var dropdown = el.lastChild;
                            
                            var data = item.items.map(function(item) {
                                return "<item value='" + item.value 
                                  + "'><![CDATA[" + item.caption + "]]></item>";
                            }).join("");
                            if (data) {
                                setTimeout(function(){
                                    dropdown.$model.load("<items>" + data + "</items>");
                                    
                                    setTimeout(function(){
                                        var value = item.value || dropdown.value;
                                        dropdown.value = -999;
                                        dropdown.setAttribute("value", value);
                                    });
                                });
                            }
                        break;
                        default:
                            if ("value" in item)
                                el.lastChild.setAttribute('value', item.value);
                            if ("onclick" in item)
                                el.lastChild.onclick = item.onclick;
                            if ("visible" in item)
                                el.lastChild.setAttribute("visible", item.visible)
                            if ("zindex" in item)
                                el.lastChild.setAttribute("zindex", item.zindex)
                        break;
                    }
                })
            }

            function attachTo(htmlNode, beforeNode) {
                draw();
                
                if (htmlNode.$amlLoaded) {
                    container.parentNode = htmlNode;
                    htmlNode = htmlNode.$int;
                }
                // if we have apf node, make sure apf child-parent links do not get broken
                if (htmlNode.host && container.host) {
                    htmlNode.host.insertBefore(container.host, beforeNode && beforeNode.host);
                } else {
                    htmlNode.insertBefore(container.$ext, beforeNode || null);
                }
                show();
            }
            
            function detach(){
                container.$ext.parentNode.removeChild(container.$ext);
                emit("hide");
            }

            function toJson(amlNode, json) {
                if (!json)
                    json = {};
                
                if (!drawn) {
                    draw();
                    hide();
                }
                
                (amlNode || container).childNodes.forEach(function(row) {
                    if (row.localName == 'bar')
                        return toJson(row, json);

                    var name = row.name;
                    if (!name) return;
                    
                    var value = row.childNodes.filter(function(node) {
                        return node.localName != "label";
                    }).map(function(node) {
                        return node.value;
                    });
                    
                    if (value.length == 1) value = value[0];
                    json[name] = value;
                });
                
                var result = emit("serialize", { json: json });
                return result || json;
            }

            function reset(){
                container.childNodes.forEach(function(row) {
                    var options = row.options;
                    if (!row.childNodes.length) return;

                    if (row.firstChild.localName == "checkbox")
                        row.firstChild.setValue(options.defaultCheckboxValue || "");
                    row.lastChild.setValue(options.defaultValue || "");
                });
            }
            
            function validate(){
                return true;
            }
            
            function getRect(){
                return container.$ext.getBoundingClientRect();
            }
            
            function show(){ container.show(); emit("show"); }
            function hide(){ container.hide(); emit("hide"); }
            
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
                drawn = false;
            });
            
            /***** Register and define API *****/
            
            /**
             * Form Builder for Cloud9. Use this class to create forms
             * that requests user input.
             * 
             * This is what the {@link preferences.Preferences Preferences} plugin uses to draw the
             * settings and what the deploy plugins use to create forms that
             * allow the user to choose the deploy instances.
             * 
             * Example:
             * 
             *     var authform = new Form({
             *         rowheight : 27,
             *         colwidth  : 70,
             *         form      : [
             *             {
             *                 type   : "image",
             *                 src    : "/logo.png",
             *                 width  : 180,
             *                 height : 58
             *             },
             *             {
             *                 title  : "Username",
             *                 name   : "username",
             *                 type   : "textbox",
             *             },
             *             {
             *                 title  : "Password",
             *                 name   : "password",
             *                 type   : "password",
             *             },
             *             {
             *                 name    : "loginfail",
             *                 type    : "label",
             *                 caption : "Could not login. Please try again.",
             *                 style   : "color:rgb(255, 143, 0);margin-left:5px;"
             *             },
             *             {
             *                 type      : "submit",
             *                 caption   : "Login",
             *                 "default" : true,
             *                 margin    : "10 20 5 20",
             *                 onclick   : function(){
             *                     if (authform.validate())
             *                         login(authform.toJson(), function(){});
             *                 }
             *             }
             *         ]
             *     });
             */
            /**
             * @constructor
             * Creates a new Form instance based on an abstract definition of
             * the form elements.
             * 
             * The form elements are described by simple objects that determine
             * the properties of each element. The following properties are the 
             * same for all form element definitions:
             * 
             * <table>
             * <tr><td>Property</td><td>          Possible Values</td></tr>
             * <tr><td>title</td><td>             The text of the label in the first column</td></tr>
             * <tr><td>name</td><td>              This value is used when creating a json object using {@link #toJson}</td></tr>
             * <tr><td>width</td><td>             A different width for the element in the 2nd column</td></tr>
             * <tr><td>rowheight</td><td>         A different height for this row</td></tr>
             * <tr><td>edge</td><td>              The edges on the top, right, bottom, left side of the form element in pixels, space separated (e.g. "5 5 10 5").</td></tr>
             * <tr><td>position</td><td>          Integer specifying the position in the form.</td></tr>
             * <tr><td valign="top">type</td><td> The type of form element to create. The following values are supported:
             * 
             *   <table>
             *   <tr><td>Type</td><td>                Description</td></tr>
             *   <tr><td>checkbox</td><td>            A simple two-state checkbox</td></tr>
             *   <tr><td>dropdown</td><td>            A dropdown containing items that a user can select</td></tr>
             *   <tr><td>spinner</td><td>             A widget that lets a users select integers</td></tr>
             *   <tr><td>checked-spinner</td><td>     A combination of a checkbox and a spinner</td></tr>
             *   <tr><td>textbox</td><td>             A simple textbox</td></tr>
             *   <tr><td>password</td><td>            A textbox that doesn't show the content while the user types into it</td></tr>
             *   <tr><td>colorbox</td><td>            A widget that allows a user to select a color</td></tr>
             *   <tr><td>button</td><td>              A simple button</td></tr>
             *   <tr><td>submit</td><td>              A button without a label</td></tr>
             *   <tr><td>label</td><td>               A label that spans both columns</td></tr>
             *   <tr><td>image</td><td>               An image that spans both columns</td></tr>
             *   <tr><td>divider</td><td>             A divider that spans both columns</td></tr>
             *   <tr><td>textarea</td><td>            A multi line input widget</td></tr>
             *   <tr><td>custom</td><td>              A custom APF element. This can be anything</td></tr>
             *   </table>
             * </td></tr>
             * </table>
             * 
             * Each element type also has properties that are unique for it's 
             * type.
             * 
             * ## checkbox ##
             * <table>
             * <tr><td>Property</td><td>        Possible Value</td></tr>
             * <tr><td>defaultValue</td><td>    The default value of the checkbox. This is the value that is set initially and after calling {@link #reset}</td></tr>
             * <tr><td>values</td><td>          Array defining the values that correspond with the checked and unchecked state. (i.e. ["on", "off"])</td></tr>
             * </table>
             * ## dropdown ##
             * <table>
             * <tr><td>Property</td><td>        Possible Value</td></tr>
             * <tr><td>items</td><td>           Array of objects with a value and caption property.</td></tr>
             * <tr><td>defaultValue</td><td>    The value of the default selected item</td></tr>
             * <tr><td>empty-message</td><td>   The message displayed when no items have been selected</td></tr>
             * </table>
             * ## spinner ##
             * <table>
             * <tr><td>Property</td><td>        Possible Value</td></tr>
             * <tr><td>defaultValue</td><td>    The default value of the spinner. This is the value that is set initially and after calling {@link #reset}</td></tr>
             * <tr><td>min</td><td>             The smallest value that a number can have in the spinner</td></tr>
             * <tr><td>max</td><td>             The largest value that a number can have in the spinner</td></tr>
             * <tr><td>realtime</td><td>        Whether the values are updated while typing, or only when the form element has lost focus</td></tr>
             * </table>
             * ## checked-spinner ##
             * <table>
             * <tr><td>Property</td><td>                Possible Value</td></tr>
             * <tr><td>defaultCheckboxValue</td><td>    The default value of the checkbox. This is the value that is set initially and after calling {@link #reset}</td></tr>
             * <tr><td>defaultValue</td><td>            The default value of the spinner. This is the value that is set initially and after calling {@link #reset}</td></tr>
             * <tr><td>min</td><td>                     The smallest value that a number can have in the spinner</td></tr>
             * <tr><td>max</td><td>                     The largest value that a number can have in the spinner</td></tr>
             * <tr><td>realtime</td><td>                Whether the values are updated while typing, or only when the form element has lost focus</td></tr>
             * </table>
             * ## textbox ##
             * <table>
             * <tr><td>Property</td><td>        Possible Value</td></tr>
             * <tr><td>message</td><td>        The message displayed while the textbox has no value</td></tr>
             * <tr><td>defaultValue</td><td>   The default value of the textbox. This is the value that is set initially and after calling {@link #reset}</td></tr>
             * <tr><td>realtime</td><td>       Whether the values are updated while typing, or only when the form element has lost focus</td></tr>
             * </table>
             * ## password ##
             * <table>
             * <tr><td>Property</td><td>        Possible Value</td></tr>
             * <tr><td>defaultValue</td><td>    The default value of the password element. This is the value that is set initially and after calling {@link #reset}</td></tr>
             * <tr><td>realtime</td><td>        Whether the values are updated while typing, or only when the form element has lost focus</td></tr>
             * </table>
             * ## textarea ##
             * <table>
             * <tr><td>Property</td><td>        Possible Value</td></tr>
             * <tr><td>height</td><td>          The height of the textarea in pixels.</td></tr>
             * <tr><td>defaultValue</td><td>    The default value of the password element. This is the value that is set initially and after calling {@link #reset}</td></tr>
             * <tr><td>realtime</td><td>        Whether the values are updated while typing, or only when the form element has lost focus</td></tr>
             * </table>
             * ## colorbox ##
             * <table>
             * <tr><td>Property</td><td>        Possible Value</td></tr>
             * <tr><td>defaultValue</td><td>    The default value of the colorbox. This is the value that is set initially and after calling {@link #reset}</td></tr>
             * <tr><td>realtime</td><td>        Whether the values are updated while typing, or only when the form element has lost focus</td></tr>
             * </table>
             * ## button ##
             * <table>
             * <tr><td>Property</td><td>        Possible Value</td></tr>
             * <tr><td>caption</td><td>         The text displayed on the button</td></tr>
             * <tr><td>onclick</td><td>         The function that is executed when a user clicks on the button</td></tr>
             * </table>
             * ## submit ##
             * <table>
             * <tr><td>Property</td><td>        Possible Value</td></tr>
             * <tr><td>margin</td><td>          The edges on the top, right, bottom, left side of the submit element in pixels, space separated (e.g. "5 5 10 5").</td></tr>
             * <tr><td>caption</td><td>         The text displayed on the button</td></tr>
             * <tr><td>submenu</td><td>         A reference to a menu that is shown when the button is clicked</td></tr>
             * <tr><td>onclick</td><td>         The function that is executed when a user clicks on the button</td></tr>
             * <tr><td>default</td><td>         Whether this is the action that is executed when the user presses Enter in one of the form elements</td></tr>
             * </table>
             * ## label ##
             * <table>
             * <tr><td>Property</td><td>        Possible Value</td></tr>
             * <tr><td>caption</td><td>         The text displayed on the button</td></tr>
             * <tr><td>style</td><td>           A css string that is applied to the label</td></tr>
             * </table>
             * ## image ##
             * <table>
             * <tr><td>Property</td><td>        Possible Value</td></tr>
             * <tr><td>src</td><td>             The URL to load the image from</td></tr>
             * <tr><td>margin</td><td>          The edges on the top, right, bottom, left side of the submit element in pixels, space separated (e.g. "5 5 10 5").</td></tr>
             * <tr><td>height</td><td>          The height of the image in pixels</td></tr>
             * </table>
             * ## divider ##
             * *None*
             * 
             * @param {Object}      [options]            The definition of the form.
             * @param {String}      [options.edge]       The edges on the top, right, bottom, left side of the form in pixels, space separated (e.g. "5 5 10 5").
             * @param {Number}      [options.rowheight]  The default height of each row in pixels.
             * @param {Number}      [options.colwidth]   The width of the left column in pixels.
             * @param {String}      [options.className]  This className is applied to the form container.
             * @param {Object}      [options.widths]     A hash of the default widths of the form elements. The key of the hash is the type name of the form element.
             * @param {HTMLElement} [options.html]       The html element to attacht the form to. You can also attach the form later using {@link #attachTo}.
             * @param {Object[]}    [options.form]       A list of form element definitions as described above.
             */
            plugin.freezePublicAPI({
                /**
                 * The HTML Element that contains the form.
                 * @property {HTMLElement} container
                 * @readonly
                 */
                get container(){ return container.$ext; },
                /**
                 * The APF element that is the parent to all form elements.
                 * @property {AMLElement} aml
                 * @private
                 * @readonly
                 */
                get aml(){ return container; },
                /**
                 * A hash of all the headings in this form, indexed by name.
                 * @property {Object} headings
                 * @private
                 * @readonly
                 */
                get headings(){ return headings; },
                /**
                 * A meta data object that allows you to store whatever you want
                 * in relation to this form.
                 * @property {Object} meta
                 */
                get meta(){ return meta; },
                set meta(v){ meta = v; },
                
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
                    "hide",
                    /**
                     * Fires when toJson is called. The event object contains 
                     * a JSON object containing key value pairs. Each
                     * key is the value of the name property of each form
                     * element and the value is the current value of the form
                     * element at the time of calling serialize()
                     * 
                     * This event allows plugins to alter the data, prior to
                     * it being returned to the caller of the {@link #toJson} 
                     * method.
                     * 
                     * @event serialize
                     * @param {Object} e
                     * @param {Object} e.json  The JSON object representing the 
                     * serialized state of the form.
                     */
                    "serialize"
                ],
                
                /**
                 * Retrieves the geometrical properties of the form
                 * @return {Object}
                 * @return {Number} return.left    The left position of the form, relative to the browser window.
                 * @return {Number} return.top     The top position of the form, relative to the browser window.
                 * @return {Number} return.width   The width of the form.
                 * @return {Number} return.height  The height of the form.
                 */
                getRect: getRect,
                
                /**
                 * Returns a JSON object containing key value pairs. Each
                 * key is the value of the name property of each form
                 * element and the value is the current value of the form
                 * element at the time of calling serialize()
                 * @return {Object}
                 * @fires serialize
                 */
                toJson: toJson,

                /**
                 * Attaches this form to an HTML element.
                 * @param {HTMLElement} htmlNode    The HTML element to attach the form to.
                 * @param {HTMLElement} beforeNode  The HTML element before 
                 *   which the form will be insert. This element should 
                 *   always be a child of the `htmlNode`.
                 * @fires show
                 */
                attachTo: attachTo,

                /**
                 * Detaches this form from the HTML element it is attached to.
                 * @fires hide
                 */
                detach: detach,

                /**
                 * Renders all the form elements, defined during the creation of
                 * the form instance.
                 * @fires draw
                 */
                draw: draw,

                /**
                 * Clear all values from the form elements or return values to
                 * their default values, if defined.
                 */
                reset: reset,

                /**
                 * Add additional form elements to the form.
                 * @param {Object} state    The form definition. See {@link Form}.
                 * @param {Plugin} foreign  The plugin responsible for adding these elements (needed for cleanup).
                 */
                add: add,

                /**
                 * Updates form elements with new values. This method currently
                 * only supports updating the items of a dropdown element.
                 * @param {Array} items
                 */
                update: update,

                /**
                 * Show the form. This requires the form to be 
                 * {@link #attachTo attached} to an HTML element.
                 * @fires show
                 */
                show: show,

                /**
                 * Hide the form.
                 * @fires hide
                 */
                hide: hide,

                /**
                 * Not implemented yet. Validate the form elements.
                 */
                validate: validate
            });
            
            plugin.load(null, "form");

            return plugin;
        }
            
        register(null, {
            Form: Form
        });
    }
});