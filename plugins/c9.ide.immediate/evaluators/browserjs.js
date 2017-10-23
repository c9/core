define(function(require, exports, module) {
    main.consumes = ["Evaluator", "ui"];
    main.provides = ["immediate.browserjs"];
    return main;
    
    /*
        Test Cases:
        1
        "1"
        new Error()
        window
        console.log("1");
        throw new Error("1");
        
        Missing:
        get/set in object
        __proto__
    */

    function main(options, imports, register) {
        var Evaluator = imports.Evaluator;
        var ui = imports.ui;
        
        var escapeHTML = require("ace/lib/lang").escapeHTML;
        
        /***** Initialization *****/
        
        var plugin = new Evaluator("Ajax.org", main.consumes, {
            caption: "Javascript (browser)",
            id: "jsbrowser",
            mode: "ace/mode/javascript",
            message: "Welcome to the Javascript REPL. This REPL allows you to "
                + "test any single or multi line code in\na browser based "
                + "javascript environment (iframe). It operates similar to "
                + "your browser console."
        });
        // var emit = plugin.getEmitter();
        
        var iframe;
        var win;
        
        function createIframe() {
            if (iframe) return;
            iframe = document.body.appendChild(document.createElement("iframe"));
            iframe.setAttribute("nwdisable", "nwdisable");

            iframe.style.width = "1px";
            iframe.style.height = "1px";
            iframe.style.position = "absolute";
            iframe.style.left = "-100px";
            iframe.style.top = "-100px";
            
            win = iframe.contentWindow;
        }
        
        /***** Evaluator *****/
        
        var counter = 0;
        function Console(cell) {
            this.name = "output_section" + (++counter);
            this.cell = cell;
            
            this.html = document.createElement("div");
            this.cell.addWidget({ el: this.html, coverLine: true, fixedWidth: true });
        }
        Console.prototype = {
            write: function () {
                var html = this.html.appendChild(document.createElement("div"));
                var type = arguments[arguments.length - 1];
                html.className = type;
                
                for (var i = 0; i < arguments.length - 1; i++) {
                    renderType(arguments[i], html, type != "return");
                }
                insert(html, "<br />");
                
                html.updateWidget = this.$update.bind(this);
                html.updateWidget();
                this.$scrollIntoView();  
            },
            log: function(output) { 
                var args = Array.prototype.slice.apply(arguments);
                args.push("log");
                return this.write.apply(this, args); 
            },
            error: function(output) { 
                var args = Array.prototype.slice.apply(arguments);
                args.push("error");
                return this.write.apply(this, args); 
            },
            warn: function(output) { 
                var args = Array.prototype.slice.apply(arguments);
                args.push("warning");
                return this.write.apply(this, args); 
            },
            $update: function() {
                this.cell.session.repl.onWidgetChanged(this.cell);
            },
            $scrollIntoView: function() {
                var editor = this.cell.session.repl.editor;
                if (!editor) // tab isn't active
                    return;
                var renderer = editor.renderer;
                // TODO add a better way to scroll ace cursor into view when rendered
                setTimeout(function() {
                    renderer.scrollCursorIntoView();
                });
            }
        };
        
        function insert(div, markup, name) {
            if (name !== undefined) 
                insert(div, "<span class='property'>" + escapeHTML(name) + ": </span>");
            
            markup = markup.replace(/([a-z]\w{1,4}:\/\/[\w:_\-\?&\/\.\#]*)/gi, "<a>$1</a>");
            div.insertAdjacentHTML("beforeend", markup);
            
            if (div.lastChild && div.lastChild.nodeType == 1) {
                var nodes = div.lastChild.querySelectorAll("a");
                for (var i = 0; i < nodes.length; i++) {
                    nodes[i].addEventListener("click", function(e) {
                        //@todo
                        alert(this.firstChild.nodeValue);
                        e.stopPropagation();
                    });
                }
            }
        }
        
        function insertTree(div, caption, object, drawChildren) {
            // caption can be a string or an html element
            var treeitem = div.appendChild(document.createElement("span"));
            var arrow = treeitem.appendChild(document.createElement("span"));
            treeitem.className = "treeitem";
            arrow.className = "arrow";
            treeitem.appendChild(caption);
            
            var container;
            treeitem.addEventListener("click", function(e) {
                if (container && ui.isChildOf(container, e.target, true))
                    return;
                
                e.stopPropagation();
                
                if (!container) {
                    container = treeitem.appendChild(document.createElement("div"));
                    container.className = "treecontainer";
                    container.style.display = "none";
                    drawChildren(object, container);
                }
                
                var collapsed = container.style.display == "none";
                arrow.className = "arrow " + (collapsed ? "expanded" : "");
                container.style.display = collapsed ? "block" : "none";
                
                // hack!
                var target = e.currentTarget;
                while (target) {
                    if (target.updateWidget) {
                        target.updateWidget();
                        break;
                    }
                    target = target.parentNode;
                }
            });
        }
        
        function parseChildren(object, html) {
            if (object instanceof win.Array) {
                if (object.length < 101) {
                    // object.forEach(function(item, i) {
                    //     renderType(item, html, 2, false, i);
                    //     insert(html, "<br />");
                    // });
                }
                else {
                    
                }
            }
            else if (object.$arrayWalker) {
                
            }
            else if (object instanceof win.Error) {
                var stack = object.stack.split("\n");
                stack.shift();
                stack = stack.join("<br />");
                insert(html, "<div class='stack'>" + stack + "</div>");
            }
            else if (object instanceof win.Element) {
                if (!html.parentNode.textContent.match(/HTML\w*Element/)) {
                    var children = object.childNodes;
                    for (var i = 0; i < children.length; i++) {
                        renderType(children[i], html, false, 2);
                        insert(html, "<br />");
                    }
                    insert(html, "&lt;/" + object.tagName.toLowerCase() + "&gt;");
                    return;
                }
            }
            
            var keys = Object.getOwnPropertyNames(object);
            keys.forEach(function(name) {
                renderType(object[name], html, 2, 2, name);
                insert(html, "<br />");
            });
        }
        
        function renderType(object, html, log, short, name) {
            var type = typeof object;
            var caption;
            
            if (object === undefined || object === null) {
                insert(html, "<span class='null'>" + object + "</span>", name);
            }
            else if (type == "string") {
                if (!log || log == 2) {
                    var value = String(object)
                        .replace(/</g, "&lt;")
                        .replace(/\t/g, "    ")
                        .replace(/ /g, "&nbsp;")
                        .replace(/\n/g, "<br />");
                    var str = "\"<span class='string'>" + value + "</span>\"";
                    if (name && object.length > 100) {
                        var event = "this.style.display = \"none\";\
                            this.nextSibling.style.display = \"inline\";\
                            event.stopPropagation()";
                        str = "<span class='stringcollapse'><span onclick='" + event 
                            + "'>(...)</span><span>" + str
                            + "</span></span>";
                    }
                    insert(html, str, name);
                }
                else {
                    insert(html, object, name);
                }
            }
            else if (type == "number") {
                insert(html, "<span class='number'>" + object + "</span>", name);
            }
            else if (type == "function") {
                insert(html, "<span class='function'>" 
                    + object.toString() + "</span>", name);
            }
            else if (type == "boolean") {
                insert(html, "<span class='boolean'>" + object + "</span>", name);
            }
            else if (!log && object instanceof win.RegExp) {
                insert(html, "<span class='regexp'>" 
                    + object.toString() + "</span>", name);
            }
            else if (object instanceof win.Array) {
                if (short) {
                    insert(html, "Array [" + object.length + "]", name);
                    return;
                }
                else {
                    // Detect Sparse Array via every
                    if (false) {
                        
                    }
                    
                    if (log) {
                        caption = document.createElement("span");
                        insert(caption, "", name);
                        var preview = caption.appendChild(document.createElement("span"));
                        preview.className = "preview";
                        
                        var found = false;
                        insert(preview, "[", name);
                        object.every(function(item, i) {
                            renderType(item, preview, false, true);
                            if (i < object.length - 1)
                                insert(preview, ", ");
                            found = true;
                            return i < 100;
                        });
                        
                        var props = Object.getOwnPropertyNames(object).filter(function(n) {
                            return parseInt(n) != n;
                        });
                        var count = Math.min(Math.min(props.length, 5), 
                            Math.max(0, 100 - object.length));
                        for (var i = 0; i < count; i++) {
                            insert(preview, (found || i !== 0 ? ", " : "") + escapeHTML(props[i]) + ": ");
                            renderType(object[props[i]], preview, false, 2);
                        }
                        if (props.length > count)
                            insert(preview, "…");
                            
                        insert(preview, "]");
                    }
                    else if (object.length > 100) {
                        caption = document.createElement("span");
                        insert(caption, "Array [" + object.length + "]", name);
                    }
                    else {
                        insert(html, "[", name);
                        object.forEach(function(item, i) {
                            renderType(item, html, false, 2);
                            if (i < object.length - 1)
                                insert(html, ", ");
                            return true;
                        });
                        insert(html, "]");
                        return;
                    }
                }
                
                insertTree(html, caption, object, parseChildren);
            }
            // HTML/XML Element
            else if (object instanceof win.Node && log === false && object.nodeType != 9) {
                // Text Node
                if (object.nodeType == 3) {
                    insert(html, "<span class='textnode'>" 
                        + object.nodeValue.replace(/</g, "&lt;") + "</span>");
                }
                // CDATA Section
                else if (object.nodeType == 4) {
                    insert(html, "<span class='cdata'>&lt;![CDATA[" 
                        + object.nodeValue.replace(/</g, "&lt;") 
                        + "]]&gt;</span>");
                }
                // Comment
                else if (object.nodeType == 11) {
                    insert(html, "<span class='comment'>&lt;!--" 
                        + object.nodeValue.replace(/</g, "&lt;") 
                        + "--&gt;</span>");
                }
                // Element Node
                else if (object.nodeType == 1) {
                    var node = ["&lt;" + object.tagName.toLowerCase()];
                    for (var attr, i = 0, l = object.attributes.length; i < l; i++) {
                        attr = object.attributes.item(i);
                        node.push(attr.nodeName + "=\"" + attr.nodeValue.replace(/"/g, "&quot;") + "\"");
                    }
                    node = node.join(" ");
                    node += object.childNodes.length ? "&gt;" : "&gt;&lt;/" 
                        + object.tagName.toLowerCase() + "&gt;";
                    
                    caption = document.createElement("span");
                    insert(caption, node, name);
                    
                    if (object.childNodes.length)
                        insertTree(html, caption, object, parseChildren);
                    else {
                        caption.className = "emptynode";
                        html.appendChild(caption);
                    }
                }
            }
            // Object
            else {
                var heading;
                if (object["$$error"]) {
                    object = object["$$error"];
                    heading = object.stack.split(":")[0];
                    heading = "<span class='err'>"
                        + heading + ": "
                        + (object.message || (!object ? object : object.toString()))
                        + "</span>";
                    
                    caption = document.createElement("span");
                    insert(caption, heading, name);
                }
                else {
                    heading = (object.constructor.toString().match(/^function\s+(\w+)/) 
                        || [0, "(anonymous function)"])[1];
                    if (short === true) 
                        return insert(html, heading, name);
                
                    caption = document.createElement("span");
                    insert(caption, heading, name);
                    var preview = caption.appendChild(document.createElement("span"));
                    preview.className = "preview";
                    
                    if (short !== 2) {
                        insert(preview, " {");
                        
                        // @TODO https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptor
                        
                        var props = Object.getOwnPropertyNames(object);
                        var count = 0;
                        for (var i = 0; count < 5 && i < props.length; i++) {
                            if (typeof object[props[i]] == "function")
                                continue;

                            insert(preview, (i !== 0 ? ", " : ""));
                            insert(preview, "", props[i]);
                            renderType(object[props[i]], preview, 2, true);
                            count++;
                        }
                        if (props.length > count)
                            insert(preview, "…");
                            
                        insert(preview, "}");
                    }
                    else {
                        insert(preview, "");
                    }
                }
                
                insertTree(html, caption, object, parseChildren);
            }
        }
        
        function canEvaluate(str) { 
            return str.trim() ? true : false; 
        }
        
        function evaluate(expression, cell, cb) {
            if (!iframe) createIframe();
            // Ignore heroku command if typed
            // str = str.replace(/^heroku\s+/, "");
            
            // cell.addWidget({rowCount: 6, html:"<img src='http://martin.bravenboer.name/logo-trans-85.png'>"})
            // cell.addWidget({rowCount: 8, el:editor.container, editor: editor})
            
            // var session = cell.session;
            // var args = str.trim().split(" ");
            // if (evaluator.name && str.indexOf("-a") == -1)
            //     args.push("-a", evaluator.name);
            
            // cb("Authorization Required");
            // cell.insert(data);
            
            // //cell.addWidget({rowCount: 6, html:"<span class='error'>" + data + "</span>"});
            // cell.insert(pos, "Error: " + data);
            
            // cb(buffer);
             
            var output = new Console(cell);
             
            win.console = output;
            
            var result = evaluateHeadless(expression);

            output.write(result, "return");
             
            cell.setWaiting(false);
            //cb("Done");
            
            delete win.result;
        }
        
        function evaluateHeadless(expression) {
            if (!iframe) createIframe();
            try {
                win.thrown = false;
                win.result = win.eval(expression);
            } catch (e) {
                win.result = e;
                win.thrown = true;
            }
            var result = win.result;
            if (win.thrown)
                result = { "$$error": result, type: win.thrown };
            return result;
        }
        
        function getAllProperties(context, callback) {
            var results = evaluateHeadless(
                "(" + function getAllProperties(obj) {
                    if (obj == null)
                        return [];
                    var results = [];
                    do {
                        var props = Object.getOwnPropertyNames(obj);
                        props.forEach(function(prop) {
                            if (results.indexOf(prop) === -1)
                                results.push(prop);
                        });
                        props = Object.keys(obj);
                        props.forEach(function(prop) {
                            if (results.indexOf(prop) === -1)
                                results.push(prop);
                        });
                    } while ((obj = Object.getPrototypeOf(obj)));
                    return results;
                }.toString() + ")(" + context + ")");
            
            callback(null, results);
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
        });
        plugin.on("canEvaluate", function(e) {
            return canEvaluate(e.expression);
        });
        plugin.on("evaluate", function(e) {
            return evaluate(e.expression, e.cell, e.callback);
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
            iframe && iframe.remove();
            win = iframe = null;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            /** @ignore */
            evaluateHeadless: evaluateHeadless,
            
            /** @ignore */
            getAllProperties: getAllProperties
        });
        
        register(null, {
            "immediate.browserjs": plugin
        });
    }
});