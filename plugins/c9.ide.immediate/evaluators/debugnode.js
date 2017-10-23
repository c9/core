define(function(require, exports, module) {
    main.consumes = [
        "immediate", "debugger", "Evaluator", "callstack", "ui"
    ];
    main.provides = ["immediate.debugnode"];
    return main;

    function main(options, imports, register) {
        var Evaluator = imports.Evaluator;
        var debug = imports.debugger;
        var immediate = imports.immediate;
        var callstack = imports.callstack;
        var ui = imports.ui;
        
        var escapeHTML = require("ace/lib/lang").escapeHTML;
        
        /***** Initialization *****/
        
        var plugin = new Evaluator("Ajax.org", main.consumes, {
            caption: "Debugger",
            id: "debugger",
            mode: "ace/mode/javascript", // @todo make this variable: repl.session.setMode
            message: "Welcome to the debugger inspector. You can inspect "
                + "any process that the debugger is attached to. Code \nwill be "
                + "executed in the global context unless on "
                + "a breakpoint, then code is executed in the current frame."
        });
        // var emit = plugin.getEmitter();
        
        var dbg, log, lastCell;
        
        var loaded;
        function load() {
            if (loaded) return;
            loaded = true;
            
            // Set and clear the dbg variable
            debug.on("attach", function(e) {
                dbg = e.implementation;
                if (dbg.attachLog)
                    initLog(dbg.attachLog());
                    
                immediate.defaultEvaluator = "debugger";
            });
            debug.on("detach", function(e) {
                dbg = null;
                immediate.defaultEvaluator = null;
            });
            debug.on("stateChange", function(e) {
                plugin[e.action]();
            });
        }
        
        /***** Log *****/
        
        function writeLog() {
            var cell;
            var dist = 1;
            var type = arguments[arguments.length - dist];
            if (type && type.addWidget) {
                dist++;
                cell = type;
                type = arguments[arguments.length - dist];
            }
            if (!cell)
                cell = lastCell;
            if (!cell.html)
                createWidget(cell);
            
            var html = cell.html.appendChild(document.createElement("div"));
            html.className = type;
            
            for (var i = 0; i < arguments.length - dist; i++) {
                renderType(arguments[i], html, type != "return");
            }
            insert(html, "<br />");
            
            html.updateWidget = updateWidget.bind(cell);
            html.updateWidget();
            scrollIntoView(cell);
        }
        
        function updateWidget() {
            this.session.repl.onWidgetChanged(this);
        }
        
        function scrollIntoView(cell) {
            if (!cell.session.repl.editor)
                return;

            // TODO add a better way to scroll ace cursor into view when rendered
            var renderer = cell.session.repl.editor.renderer;
            setTimeout(function() {
                renderer.scrollCursorIntoView();
            });
        }
        
        function initLog(proxy) {
            log = proxy;
            log.on("log", function(e) {
                var args = Array.prototype.slice.apply(arguments);
                args.push(e.type);
                writeLog.apply(log, args); 
            }, plugin);
        }
        
        function createWidget(cell) {
            cell.html = document.createElement("div");
            cell.addWidget({ el: cell.html, coverLine: true, fixedWidth: true });
        }
        
        /***** Analyzer *****/
        
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
                    drawChildren(object, container, function() {
                        findWidgetAndUpdate(target);
                    });
                }
                
                var collapsed = container.style.display == "none";
                arrow.className = "arrow " + (collapsed ? "expanded" : "");
                container.style.display = collapsed ? "block" : "none";
                
                // hack!
                var target = e.currentTarget;
                findWidgetAndUpdate(target);
            });
        }
        
        function findWidgetAndUpdate(target) {
            while (target) {
                if (target.updateWidget) {
                    target.updateWidget();
                    break;
                }
                target = target.parentNode;
            }
        }
        
        function parseChildren(object, html, callback) {
            if (object.value == "[Array]") {
                if (object.length < 101) {
                    object.forEach(function(item, i) {
                        renderType(item, html, 2, false, i);
                        insert(html, "<br />");
                    });
                }
                else {
                    
                }
            }
            else if (object.$arrayWalker) {
                
            }
            else if (object instanceof Error) {
                var stack = (object.stack || "").split("\n");
                stack.shift();
                stack = stack.join("<br />");
                insert(html, "<div class='stack'>" + stack + "</div>");
            }
            // else if (object instanceof win.Element) {
            //     if (!html.parentNode.textContent.match(/HTML\w*Element/)) {
            //         var children = object.childNodes;
            //         for (var i = 0; i < children.length; i++) {
            //             renderType(children[i], html, false, 2);
            //             insert(html, "<br />");
            //         }
            //         insert(html, "&lt;/" + object.tagName.toLowerCase() + "&gt;");
            //         return;
            //     }
            // }
            
            if (!object.properties && dbg) {
                dbg.getProperties(object, function(err, properties) {
                    // if (properties && properties.length)
                    parseChildren(object, html, callback);
                });
                return;
            }
            
            (object.properties || []).forEach(function(prop) {
                renderType(prop, html, 2, 2, prop.name);
                insert(html, "<br />");
            });
            
            callback();
        }
        
        function getOwnProperties(object) {
            var result = [];
            (object.properties || []).forEach(function(o) {
                if (typeof o.name != "number")
                    result.push(o);
            });
        }
        
        function renderType(object, html, log, short, name) {
            var type = object.type;
            var value = object.value;
            var caption;
            
            if (object.name && typeof object.name == "string" 
              && object.name.indexOf("function") === 0)
                type = "function";
            
            if (type == "undefined" || type == "null") {
                insert(html, "<span class='null'>" + type + "</span>", name);
            }
            else if (type == "string") {
                if (!log || log == 2) {
                    value = JSON.parse(value)
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
            else if (type == "number" || type == "int" || type == "float") {
                insert(html, "<span class='number'>" + value + "</span>", name);
            }
            else if (type == "function") {
                insert(html, "<span class='function'>" 
                    + (object.name + "")
                        .replace(/ /g, "&nbsp;") 
                        .replace(/\n/g, "<br />") 
                    + "</span>", name);
            }
            else if (type == "boolean" || type == "bool") {
                insert(html, "<span class='boolean'>" + value + "</span>", name);
            }
            else if (!log && type == "regexp") {
                insert(html, "<span class='regexp'>" 
                    + object.value + "</span>", name);
            }
            else if (value == "[Array]") {
                if (short) {
                    insert(html, "Array [" + object.name + "]", name);
                    return;
                }
                else {
                    // Detect Sparse Array via every
                    if (false) {
                        
                    }
                    
                    var j = 0;
                    if (log) {
                        caption = document.createElement("span");
                        insert(caption, "", name);
                        var preview = caption.appendChild(document.createElement("span"));
                        preview.className = "preview";
                        
                        insert(preview, "[", name);
                        
                        (object.properties || []).every(function(item, i) {
                            if (typeof item.name != "number") {
                                j++;
                                return true;
                            }
                            
                            renderType(item, preview, false, true);
                            if (i < object.properties.length - 2 - j)
                                insert(preview, ", ");
                            
                            return (i - j) < 100;
                        });
                        
                        var props = getOwnProperties(object);
                        var count = Math.min(Math.min(props.length, 5), 
                            Math.max(0, 100 - object.length));
                        for (var i = 0; i < count; i++) {
                            insert(preview, (i !== 0 ? ", " : "") + escapeHTML(props[i]) + ": ");
                            renderType(props[i], preview, false, 2);
                        }
                        if (props.length > count)
                            insert(preview, "…");
                            
                        insert(preview, "]");
                    }
                    else if ((object.properties || "").length > 100) {
                        caption = document.createElement("span");
                        insert(caption, "Array [" + object.properties.length + "]", name);
                    }
                    else {
                        insert(html, "[", name);
                        (object.properties || []).every(function(item, i) {
                            if (typeof item.name != "number") {
                                j++;
                                return true;
                            }
                            
                            renderType(item, html, false, 2);
                            if (i < object.properties.length - 1)
                                insert(html, ", ");
                            
                            return true;
                        });
                        insert(html, "]");
                        return;
                    }
                }
                
                insertTree(html, caption, object, parseChildren);
            }
            // // HTML/XML Element
            // else if (object instanceof win.Node && log === false) {
            //     // Text Node
            //     if (object.nodeType == 3) {
            //         insert(html, "<span class='textnode'>" 
            //             + object.nodeValue.replace(/</g, "&lt;") + "</span>");
            //     }
            //     // CDATA Section
            //     else if (object.nodeType == 4) {
            //         insert(html, "<span class='cdata'>&lt;![CDATA[" 
            //             + object.nodeValue.replace(/</g, "&lt;") 
            //             + "]]&gt;</span>");
            //     }
            //     // Comment
            //     else if (object.nodeType == 11) {
            //         insert(html, "<span class='comment'>&lt;!--" 
            //             + object.nodeValue.replace(/</g, "&lt;") 
            //             + "--&gt;</span>");
            //     }
            //     // Element Node
            //     else if (object.nodeType == 1) {
            //         var node = ["&lt;" + object.tagName.toLowerCase()];
            //         for (var attr, i = 0, l = object.attributes.length; i < l; i++) {
            //             attr = object.attributes.item(i);
            //             node.push(attr.nodeName + "=\"" + attr.nodeValue.replace(/"/g, "&quot;") + "\"");
            //         }
            //         node = node.join(" ");
            //         node += object.childNodes.length ? "&gt;" : "&gt;&lt;/" 
            //             + object.tagName.toLowerCase() + "&gt;";
                    
            //         caption = document.createElement("span");
            //         insert(caption, node, name);
                    
            //         if (object.childNodes.length)
            //             insertTree(html, caption, object, parseChildren);
            //         else {
            //             caption.className = "emptynode";
            //             html.appendChild(caption);
            //         }
            //     }
            // }
            // Object
            else {
                var heading;
                if (object["$$error"]) {
                    object = object["$$error"];
                    heading = (object.stack || "").split(":")[0];
                    heading = "<span class='err'>"
                        + object.message
                        + "</span>";
                    
                    caption = document.createElement("span");
                    insert(caption, heading, name);
                    insertTree(html, caption, object, parseChildren);
                }
                else {
                    if (type === "object" || object.children || (object.properties && object.properties.length > 0)) {
                        // An object, or a value of unknown type which has properties, so should be displayed as an object.

                        heading = (object.value || "[(anonymous function)]")
                            .replace(/^\[(.*)\]$/, "$1");
                        if (short === true)
                            return insert(html, heading, name);

                        caption = document.createElement("span");
                        insert(caption, heading, name);
                        preview = caption.appendChild(document.createElement("span"));
                        preview.className = "preview";

                        if (short !== 2) {
                            insert(preview, " {");

                            props = object.properties || [];
                            count = 0;
                            for (var i = 0; count < 5 && i < props.length; i++) {
                                var propName = props[i].name;
                                // for buffers propName is a number
                                if (typeof propName == "string" && propName.indexOf("function") === 0)
                                    continue;

                                insert(preview, (i !== 0 ? ", " : ""));
                                insert(preview, "", propName);
                                renderType(props[i], preview, 2, true);
                                count++;
                            }
                            if (props.length > count)
                                insert(preview, "…");

                            insert(preview, "}");
                        }
                        else {
                            insert(preview, "");
                        }

                        insertTree(html, caption, object, parseChildren);
                    }
                    else {
                        // A value of unknown type which does not have any properties - assume it is a language-specific
                        // primitive type.
                        insert(html, escapeHTML(value), name);
                    }
                }
            }
        }
        
        function canEvaluate(str) { 
            return str.trim() ? true : false; 
        }
        
        function evaluate(expression, cell, cb) {
            lastCell = cell;
            
            if (cell.html)
                cell.html.textContent = "";
            
            evaluateHeadless(expression, function(result) {
                if (cell.setError && result["$$error"])
                    return cell.setError(result["$$error"]);
                
                writeLog(result, "return", cell);
                cell.setWaiting(false);
            });

            //cb("Done");
        }
        
        function evaluateHeadless(expression, callback) {
            if (!callback) return;
            
            if (!dbg || !dbg.features.executeCode) {
                var err = new Error(
                    dbg && !dbg.features.executeCode
                        ? "Code execution is not supported by this debugger"
                        : "Debug Session is not running");
                return callback({ "$$error": err, type: err });
            }
            
            dbg.evaluate(expression, callstack.activeFrame, 
              !callstack.activeFrame, false, function(err, variable) {
                if (err)
                    return callback({ "$$error": err, type: err });
                
                if (variable.type == "function") {
                    dbg.serializeVariable(variable, function(value) {
                        variable.name = value;
                        callback(variable);
                    });
                    return;
                }
                
                callback(variable);
            });
        }
        
        function addVariables(list, node) {
            node.variables.forEach(function(n) {
                list.push(n.name);
            });
        }
        
        function getAllProperties(context, callback) {
            // Return all properties of the current context
            if (context == -1) {
                var frame = callstack.activeFrame;
                var vars = [];
                var count = 0;
                if (frame) {
                    addVariables(vars, frame);
                    
                    frame.scopes.forEach(function(scope) {
                        if (scope.status == "loaded")
                            addVariables(vars, scope);
                        else {
                            count++;
                            dbg.getScope(frame, scope, function(err) {
                                if (!err)
                                    addVariables(vars, scope);
                                
                                if (--count === 0)
                                    callback(null, vars);
                            });
                        }
                    });
                    
                    return;
                }
                else {
                    context = "global";
                }
            }
            
            console.warn("DEBUG: (properties)", context);
            evaluateHeadless(context, function(variable) {
                console.warn("DEBUG: (properties-received)", variable);
                
                if (variable["$$error"])
                    return callback(variable["$$error"]);
                if (!variable.properties)
                    return callback(null, []);
                    
                var results = variable.properties.map(function(m) {
                    return m.name;
                });
                
                function check(variable) {
                    if (variable.prototype) {
                        if (!dbg) return callback(new Error("disconnected"));
                        
                        console.warn("DEBUG: (properties-properties)", variable);
                        dbg.getProperties(variable.prototype, function(err, props) {
                        console.warn("DEBUG: (properties-properties-received)", variable, err);
                            if (err) return callback(err);
                            
                            props.forEach(function(prop) {
                                if (results.indexOf(prop.name) === -1)
                                    results.push(prop.name);
                            });
                            
                            check(variable.prototype);
                        });
                    }
                    else {
                        callback(null, results);
                    }
                }
                check(variable);
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
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
            loaded = false;
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
            "immediate.debugnode": plugin
        });
    }
});
