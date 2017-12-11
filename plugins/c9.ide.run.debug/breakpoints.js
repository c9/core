define(function(require, exports, module) {
    main.consumes = [
        "DebugPanel", "settings", "ui", "tabManager", "debugger", "ace",
        "MenuItem", "Divider", "save", "layout", "fs", "c9.analytics"
    ];
    main.provides = ["breakpoints"];
    return main;

    function main(options, imports, register) {
        var DebugPanel = imports.DebugPanel;
        var settings = imports.settings;
        var save = imports.save;
        var ui = imports.ui;
        var tabs = imports.tabManager;
        var debug = imports.debugger;
        var layout = imports.layout;
        var aceHandle = imports.ace;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        var fs = imports.fs;
        var analytics = imports["c9.analytics"];

        var Breakpoint = require("./data/breakpoint");
        var basename = require("path").basename;
        var Tree = require("ace_tree/tree");
        var TreeData = require("ace_tree/data_provider");
        var escapeHTML = require("ace/lib/lang").escapeHTML;

        /***** Initialization *****/

        var plugin = new DebugPanel("Ajax.org", main.consumes, {
            caption: "Breakpoints",
            index: 400
        });
        // var emit = plugin.getEmitter();

        var changed = false;
        var breakpoints = [];
        var enableBreakpoints = true;

        var dbg;
        var list, listEl, menu, model, hCondition, hInput; // UI Elements
        var btnBreakpoints, btnBpRemove, codebox;
        var conditionBreakpoint;

        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;

            model = new TreeData();
            model.$sortNodes = false;
            model.renderRow = function(row, html, config) {
                var bp = this.visibleItems[row];
                html.push('<div class="', this.getClassName(bp), '">',
                    '<span class="checkbox">&nbsp;</span>',
                    '<div class="content">',
                        escapeHTML(bp.text || "") + ":", bp.line + 1,
                    '<div>',
                        escapeHTML(bp.content || "") + "&nbsp;",
                    '</div></div>',
                    '<strong class="btnclose"> </strong>',
                '</div>');
            };
            model.getEmptyMessage = function() {
                return "No breakpoints";
            };

            model.getClassName = function(node) {
                return "bpItem " + (node.enabled ? "checked " : " ") + node.className;
            };

            fs.on("afterRename", function(e) {
                var oldPath = e.args[0];
                var newPath = e.args[1];
                
                var changed = false;
                breakpoints.forEach(function(bp) {
                    if (bp.path && bp.path.indexOf(oldPath) === 0) {
                        var char = bp.path.charAt(oldPath.length);
                        // Make sure that a path like /Untitled1 is not matched
                        // by a path like /Untitled, which are clearly different
                        // files with no relation to each other
                        if (!char || char == "/") {
                            bp.path = bp.path.replace(oldPath, newPath);
                            bp.text = basename(bp.path);
                            changed = true;
                            updateBreakpointAtDebugger(bp, "add");
                        }
                    }
                });
                if (changed)
                    settings.save();
            });

            tabs.on("tabAfterActivate", function(e) {
                var tab = e.tab;
                if (!tab || !tab.editor || tab.editor.type != "ace")
                    return;

                var ace = tab.editor.ace;

                decorateAce(ace);
                updateDocument(tab.document);
                decorateDocument(tab.document);
            });

            aceHandle.on("create", function(e) {
                e.editor.on("createAce", decorateAce, plugin);
            }, plugin);

            save.on("afterSave", function(e) {
                var doc = e.document;
                if (dbg && dbg.features.liveUpdate) {
                    dbg.on("setScriptSource", function() {
                        updateMovedBreakpoints(doc);
                    });
                }
                else {
                    updateMovedBreakpoints(doc);
                }
            });

            debug.on("attach", function(e) {
                dbg = e.implementation;

                // Add breakpoints that we potentially got from the server
                e.breakpoints.forEach(function(bp) {
                    if (bp.serverOnly)
                        setBreakpoint(bp, true);
                });

                // Deactivate breakpoints if user wants to
                if (!enableBreakpoints)
                    deactivateAll(true);
            });
            debug.on("detach", function(e) {
                dbg = null;
            });
            debug.on("stateChange", function(e) {
                plugin[e.action]();
            });

            debug.on("getBreakpoints", function() {
                return breakpoints;
            });

            debug.on("breakpointUpdate", function(e) {
                var bp = e.breakpoint;

                if (bp.hidden)
                    return;

                if (bp.actual) {
                    // Delete breakpoints that are outside of the doc length
                    var tab = tabs.findTab(bp.path);
                    if (tab) {
                        var session = tab.document.getSession();
                        if (session && session.session) {
                            var len = session.session.getLength();

                            if (bp.actual.line == len) {
                                bp.actual.line = len - 1;
                            }
                            else if (bp.actual.line > len) {
                                clearBreakpoint(bp);
                                return;
                            }
                        }
                    }
                }

                var loc = bp.actual || bp;
                var bps = findBreakpoints(bp.path, loc.line);

                if (bps.length > 1) {
                    for (var bpi, i = 0, l = bps.length; i < l; i++) {
                        bpi = bps[i];
                        if (bpi == bp) continue;

                        if (bpi.actual && bpi.actual.line != bpi.line) {
                            bpi.invalid = true;
                        }
                        else {
                            bp.invalid = true;
                        }
                    }
                }
                else {
                    bp.invalid = false;
                }

                redrawBreakpoint(bp);
            }, plugin);

            // Breakpoints may have already been set
            breakpoints.forEach(function(bp) {
                updateBreakpointAtDebugger(bp, "add");
            });

            // restore the breakpoints from the IDE settings
            settings.on("read", function (e) {
                settings.setDefaults("user/breakpoints", [
                    ["active", true]
                ]);

                var bps = settings.getJson("state/breakpoints");

                // bind it to the Breakpoint model
                breakpoints = (bps || []).map(function(bp) {
                    return new Breakpoint(bp);
                });
                model.setRoot(breakpoints);
                model.visibleItems = breakpoints;

                // update the currently active document
                if (tabs.focussedTab && tabs.focussedTab.editor.type == "ace") {
                    updateDocument(tabs.focussedTab.document);
                }

                enableBreakpoints = settings.getBool("user/breakpoints/@active");
                toggleBreakpoints(enableBreakpoints);

                if (!enableBreakpoints && drawn)
                    list.renderer.setStyle("listBPDisabled");
            });

            settings.on("write", function (e) {
                if (changed) {
                    var list = breakpoints.map(function(bp) {
                        return bp.json;
                    });
                    settings.setJson("state/breakpoints", list);
                }

                changed = false;
            });

            // Wait for the gutter menu
            aceHandle.on("draw", function() {

                // We need the gutter context menu
                var menu = aceHandle.gutterContextMenu;
                var meta = menu.meta;

                menu.append(new MenuItem({
                    caption: "Continue to Here",
                    position: 100,
                    isAvailable: function() {
                        return dbg && dbg.state == "stopped"
                          && meta.className.indexOf("breakpoint") === -1;
                    },
                    onclick: function() {
                        var path = meta.ace.session.c9doc.tab.path;
                        if (!path)
                            return;
                        // Add hidden breakpoint
                        var breakpoint = new Breakpoint({
                           path: path,
                           line: meta.line,
                           column: 0,
                           hidden: true,
                           enabled: true
                        });

                        // Set breakpoint
                        dbg.setBreakpoint(breakpoint, function(err, bp) {
                            if (err || bp.actual && bp.actual.line != bp.line) {
                                updateBreakpointAtDebugger(breakpoint, "remove");
                                return; // Won't do this if bp can't be set
                            }

                            debug.on("break", done);
                            debug.on("detach", done);

                            // Deactivate all breakpoints
                            deactivateAll(true);

                            // Continue
                            debug.resume();
                        });

                        // Wait until break
                        function done() {
                            // Remove breakpoint
                            updateBreakpointAtDebugger(breakpoint, "remove");

                            // Re-activate all breakpoints
                            activateAll(true);

                            debug.off("break", done);
                            debug.off("detach", done);
                        }
                    }
                }, plugin));

                menu.append(new Divider({ position: 150 }, plugin));

                var itemAdd = menu.append(new MenuItem({
                    position: 200,
                    isAvailable: function() {
                        itemAdd.caption = meta.className.indexOf("breakpoint") > -1
                            ? "Remove Breakpoint"
                            : "Add Breakpoint";
                        return true;
                    },
                    onclick: function() {
                        editBreakpoint(meta.className.indexOf("breakpoint") > -1
                            ? "remove" : "add", meta.ace, meta.line);
                    }
                }, plugin));

                var itemCondition = menu.append(new MenuItem({
                    position: 300,
                    isAvailable: function() {
                        var name = meta.className;
                        itemCondition.caption = name.indexOf("condition") > -1
                            ? "Edit Condition"
                            : (name.indexOf("breakpoint") > -1
                                ? "Set Condition"
                                : "Add Conditional Breakpoint");
                        return !dbg || dbg.features.conditionalBreakpoints;
                    },
                    onclick: function() {
                        editBreakpoint("edit", meta.ace, meta.line);
                    }
                }, plugin));
            });
        }

        var drawn;
        function draw(options) {
            if (drawn) return false;
            drawn = true;

            // Create UI elements
            var markup = require("text!./breakpoints.xml");
            ui.insertMarkup(options.aml, markup, plugin);

            listEl = plugin.getElement("list");
            list = new Tree(listEl.$ext);
            list.setTheme({ cssClass: "blackdg" });
            list.setOption("maxLines", 200);
            
            layout.on("eachTheme", function(e) {
                var height = parseInt(ui.getStyleRule(".listBP .bpItem", "height"), 10) || 52;
                // model.rowHeightInner = height - 1;
                model.rowHeight = height;
                
                if (e.changed) (list).resize(true);
            });
            
            list.setDataProvider(model);

            list.on("click", function(e) {
                var bp = e.getNode();
                if (!bp || e.getButton())
                    return;

                var className = e.domEvent.target.className || "";
                if (className.indexOf("btnclose") != -1)
                    clearBreakpoint(bp);
                else if (className.indexOf("checkbox") != -1)
                    list._signal("afterCheck", { node: bp });
                else
                    gotoBreakpoint(bp);
            });

            // Breakpoint is removed
            list.on("delete", function(e) {
                var bp = findBreakpoint(e.node);
                clearBreakpoint(bp);
            });

            // Breakpoint is enabled / disabled
            list.on("afterCheck", function(e) {
                var bp = findBreakpoint(e.node);

                if (!bp.enabled)
                    enableBreakpoint(bp);
                else
                    disableBreakpoint(bp);
            });

            menu = plugin.getElement("menu");

            listEl.setAttribute("contextmenu", menu);

            if (!enableBreakpoints)
                list.renderer.setStyle("listBPDisabled");

            menu.on("prop.visible", function() {
                var length = model.visibleItems.length;

                menu.childNodes.forEach(function(item) {
                    if (item.localName == "divider") return;
                    if (item.value == "deactivate") {
                        item.setAttribute("caption", enableBreakpoints
                            ? "Deactivate Breakpoints"
                            : "Activate Breakpoints");
                        return;
                    }

                    item.setAttribute("disabled", length ? false : true);
                });
            });

            menu.on("itemclick", function(e) {
                var bp = list.selection.getCursor();
                if (!bp)
                    return;

                if (e.value == "remove") {
                    clearBreakpoint(findBreakpoint(bp));
                }
                else if (e.value == "remove-all") {
                    for (var i = breakpoints.length - 1; i >= 0; i--) {
                        clearBreakpoint(breakpoints[i]);
                    }
                }
                else if (e.value == "deactivate") {
                    if (enableBreakpoints)
                        deactivateAll();
                    else
                        activateAll();
                }
                else if (e.value == "enable-all") {
                    breakpoints.forEach(function(bp) {
                        enableBreakpoint(bp);
                    });
                }
                else if (e.value == "disable-all") {
                    breakpoints.forEach(function(bp) {
                        disableBreakpoint(bp);
                    });
                }
            });

            var hbox1 = debug.getElement("hbox");
            var hbox2 = debug.getElement("hbox2");
            btnBreakpoints = hbox1.insertBefore(new ui.button({
                id: "btnBreakpoints",
                tooltip: "Deactivate All Breakpoints",
                icon: true,
                skinset: "default",
                skin: "c9-menu-btn",
                class: "nosize toggle_breakpoints2"
            }), hbox1.selectSingleNode("a:divider").nextSibling);
            btnBpRemove = hbox2.insertBefore(new ui.button({
                id: "btnBpRemove",
                tooltip: "Clear All Breakpoints",
                icon: true,
                skinset: "default",
                skin: "c9-menu-btn",
                class: "nosize remove_breakpoints"
            }), hbox2.selectSingleNode("a:divider"));
            plugin.addElement(btnBreakpoints, btnBpRemove);

            if (!enableBreakpoints)
                toggleBreakpoints(enableBreakpoints);

            btnBreakpoints.on("click", function() {
                toggleBreakpoints();
            });

            btnBpRemove.on("click", function() {
                for (var i = breakpoints.length - 1; i >= 0; i--) {
                    clearBreakpoint(breakpoints[i]);
                }
            });
        }

        var drawnCondition;
        function drawCondition() {
            if (drawnCondition) return;
            drawnCondition = true;

            // Create HTML elements
            var html = require("text!./breakpoints.html");
            hCondition = ui.insertHtml(null, html, plugin)[0];

            hInput = hCondition.querySelector(".input");
            codebox = new apf.codebox({
                skin: "simplebox",
                "class": "dark",
                focusselect: true,
                htmlNode: hInput,
                "initial-message": "Your Expression"
            });

            codebox.ace.commands.addCommands([
                {
                    bindKey: "ESC",
                    exec: function() { hCondition.style.display = "none"; }
                }, {
                    name: "confirmCondition",
                    bindKey: "Enter",
                    exec: function() {
                        setCondition(conditionBreakpoint, codebox.getValue());
                        hCondition.style.display = "none";
                    }
                },
            ]);

            apf.addEventListener("movefocus", function(e) {
                if (e.toElement != codebox)
                    codebox.execCommand("confirmCondition");
            });
        }

        /***** Helper Functions *****/

        function toggleBreakpoints(force) {
            var enable = force !== undefined
                ? force
                : !enableBreakpoints;

            if (btnBreakpoints) {
                btnBreakpoints.setAttribute("class", "nosize " + (enableBreakpoints
                    ? "toggle_breakpoints2"
                    : "toggle_breakpoints1"));
                btnBreakpoints.setAttribute("tooltip",
                    enableBreakpoints
                        ? "Deactivate All Breakpoints"
                        : "Activate All Breakpoints"
                );
            }

            if (enable)
                activateAll();
            else
                deactivateAll();

            tabs.getPanes().forEach(function(pane) {
                var tab = pane.getTab();
                if (tab && tab.editorType == "ace")
                    updateDocument(tab.document);
            });
        }

        // Breakpoints
        function updateBreakpointAtDebugger(bp, action) {
            // Give plugins the ability to update a breakpoint before
            // setting it in the debugger
            // emit("breakpointsUpdate", e);

            if (!debug.state || debug.state == "disconnected")
                return;

            // There used to be a timeout here.
            if (!dbg)
                return setTimeout(function() {
                    updateBreakpointAtDebugger(bp, action);
                }, 500);

            if (action == "enable" || action == "disable") {
                if (enableBreakpoints)
                    dbg.changeBreakpoint(bp);
            }
            else if (action == "condition" || action == "ignoreCount") {
                dbg.changeBreakpoint(bp);
            }
            else if (action == "add") {
                dbg.setBreakpoint(bp);
            }
            else if (action == "remove") {
                dbg.clearBreakpoint(bp);
            }
        }

        /**
         * Adds and event listener to this ace instance that draws breakpoints
         */
        function decorateAce(editor) {
            if (editor.$breakpointListener)
                return;

            var el = document.createElement("div");
            editor.renderer.$gutter.appendChild(el);
            el.style.cssText = "position:absolute;top:0;bottom:0;left:0;width:18px;cursor:pointer";

            editor.on("guttermousedown", editor.$breakpointListener = function(e) {
                if (e.getButton()) // !editor.isFocused()
                    return;

                var gutterRegion = editor.renderer.$gutterLayer.getRegion(e);
                if (gutterRegion != "markers")
                    return;

                e.stop();

                var line = e.getDocumentPosition().row;
                // var className = editor.session.getBreakpoints()[line];
                var action;

                var bp = findBreakpoint(e.editor.session.c9doc.tab.path, line);

                // Show condition dialog
                if (e.getAccelKey()) {
                    action = "edit";
                }
                // Toggle disabled/enabled
                else if (e.getShiftKey()) {
                    action = !bp || !bp.enabled//className && className.indexOf("disabled") > -1
                        ? "enable" : "disable";
                }
                // Toggle add/remove
                else {
                    action = !bp ? "create" :
                        (!bp.enabled ? "enable" : "remove");
                }

                editBreakpoint(action, editor, line);
            });
        }

        function editBreakpoint(action, editor, line) {
            var session = editor.session;
            var path = session.c9doc.tab.path;
            var removed = false;
            var enabled = true;

            var obp = findBreakpoint(path, line, true).filter(function(b) {
                return b.invalid && b.line != line ? false : true;
            })[0];

            function createBreakpoint(condition) {
                var caption = basename(path);
                var lineContents = session.getLine(line);

                return setBreakpoint({
                    path: path,
                    line: line,
                    column: (lineContents.match(/^(\s+)/) || [0, ""])[1].length,
                    text: caption,
                    content: lineContents.slice(0, 200),
                    time: Date.now(),
                    enabled: enabled,
                    condition: condition
                });
            }

            // Show condition dialog
            if (action == "edit") {
                if (!enableBreakpoints)
                    activateAll();
                showConditionDialog(editor, createBreakpoint, path, line, obp);
                return;
            }
            // Toggle disabled/enabled
            else if (action == "enable" || action == "disable") {
                enabled = action == "enable";
                removed = false;
            }
            // Create
            else if (action == "create") {
                var mode = session.syntax;
                if (mode === "php")
                    analytics.track("Breakpoint Created: " + mode);
                if (!enableBreakpoints)
                    activateAll();
            }
            // Toggle add/remove
            else {
                removed = action == "remove";
                enabled = true;
            }

            // Remove old breakpoint
            if (obp) {
                if (removed)
                    clearBreakpoint(obp);
                else if (enabled)
                    enableBreakpoint(obp);
                else
                    disableBreakpoint(obp);
                return;
            }

            createBreakpoint();
        }

        function showConditionDialog(ace, createBreakpoint, path, line, breakpoint) {
            if (!breakpoint)
                breakpoint = createBreakpoint();

            drawCondition();

            // Attach dialog to ace
            ace.container.parentNode.appendChild(hCondition);
            hCondition.style.display = "block";

            // Set left
            // var gutterWidth = ace.renderer.$gutterLayer.gutterWidth;
            hCondition.style.left = "2px"; //(gutterWidth + 5) + "px"; //gutter width

            // Set top
            var pos = ace.renderer.$cursorLayer.getPixelPosition({
                row: line + 1,
                column: 0
            }, true);
            hCondition.style.top = (pos.top + 3) + "px"; // line position

            // Set current value
            codebox.setValue(breakpoint.condition || "");

            var node = hCondition.getElementsByTagName("div")[0].firstChild;
            node.nodeValue = node.nodeValue.replace(/\d+/, line + 1);

            conditionBreakpoint = breakpoint;

            setTimeout(function() { codebox.focus(); });
        }

        /**
         * Adds and event listener to an ace session that updates breakpoints
         */
        function decorateDocument(doc) {
            var session = doc.getSession();
            if (session.hasBreakpoints)
                return;

            var aceSession = session.session;
            // A file was loaded that doesn't exists and is already destroyed
            if (!aceSession)
                return;

            aceSession.on("change", function(delta) {
                var breakpoints = aceSession.$breakpoints;
                var doc = aceSession.c9doc;

                if (!breakpoints.length || !doc.tab.loaded || !doc.hasValue())
                    return;

                var bpsInDoc = findBreakpoints(doc.tab.path);
                if (!bpsInDoc.length)
                    return;
                
                if (delta.end.row == delta.start.row)
                    return;

                var len, firstRow;
                len = delta.end.row - delta.start.row;
                if (delta.action == "insert") {
                    firstRow = delta.start.column
                        ? delta.start.row + 1
                        : delta.start.row;
                }
                else {
                    firstRow = delta.start.row;
                }

                var i;
                var lines = [];

                bpsInDoc.forEach(function(bp) {
                    if (bp.moved == -1)
                        return clearBreakpoint(bp);

                    var line;
                    !isNaN(line = bp.moved)
                        || !isNaN(line = (bp.actual || 0).line)
                        || !isNaN(line = (bp.sourcemap || 0).line)
                        || (line = bp.line);

                    if (typeof line !== "number" && isNaN(line))
                        return console.warn("Could not find breakpoint, file likely has unsaved changes");

                    lines[line] = bp;
                });

                if (delta.action[0] == "i") {
                    var args = Array(len);
                    args.unshift(firstRow, 0);
                    breakpoints.splice.apply(breakpoints, args);

                    // Insert should move breakpoints out of the way
                    for (i = firstRow; i < lines.length; i++) {
                        if (lines[i]) {
                            changed = true;
                            lines[i].moved = i + len;
                        }
                    }
                }
                else {
                    var rem = breakpoints.splice(firstRow + 1, len);

                    // Remove deletes breakpoints
                    var max = firstRow + len + 1;
                    for (i = firstRow; i < max; i++) {
                        if (lines[i]) {
                            changed = true;
                            lines[i].moved = -1;
                        }
                    }

                    if (!breakpoints[firstRow]) {
                        for (i = rem.length; i--;) {
                            if (rem[i]) {
                                changed = true;
                                if (!lines[firstRow + i + 1]) {
                                    console.warn("Could not find the breakpoint");
                                    continue;
                                }
                                breakpoints[firstRow] = rem[i];
                                lines[firstRow + i + 1].moved = firstRow;
                                break;
                            }
                        }
                    }
                    else if (lines[firstRow]) {
                        lines[firstRow].moved = firstRow;
                    }

                    // Move other breakpoints
                    for (i = max; i < lines.length; i++) {
                        if (lines[i]) {
                            changed = true;
                            lines[i].moved = i - len;
                        }
                    }
                }

                if (changed)
                    settings.save();
            });

            session.hasBreakpoints = true;
        }

        function updateDocument(doc) {
            if (!doc.editor || doc.editor.type != "ace")
                return;

            var session = doc.getSession();
            var rows = [];
            var path = doc.tab.path;

            if (!session.session)
                return;

            breakpoints.forEach(function(bp) {
                if (bp.path != path || bp.sourcemap && bp.sourcemap.path != path || bp.moved == -1)
                    return;

                var loc = bp.invalid ? bp : (bp.actual || bp.sourcemap || bp);
                var line; !isNaN(line = bp.moved) || (line = loc.line);
                rows[line]
                    = " ace_breakpoint"
                        + (bp.condition ? " condition" : "")
                        + (bp.enabled && enableBreakpoints ? "" : " disabled ")
                        + (bp.invalid ? " invalid" : "");
            });

            session.session.$breakpoints = rows;
            session.session._emit("changeBreakpoint", {});
        }

        function updateMovedBreakpoints(doc) {
            var bpsInDoc = findBreakpoints(doc.tab.path);
            bpsInDoc.forEach(function(bp) {
                if (typeof bp.moved == "number" && !isNaN(bp.moved)) {
                    if (bp.moved == -1)
                        clearBreakpoint(bp);
                    else if (bp.moved != bp.line) {
                        clearBreakpoint(bp);
                        bp.line = bp.moved;
                        bp.actual = undefined;
                        setBreakpoint(bp);
                    }
                    bp.moved = undefined;
                }
            });
        }

        function updateBreakpoint(breakpoint, action, force) {
            //This can be optimized, currently rereading everything
            var tab = tabs.findTab(breakpoint.path);
            if (tab) {
                // @todo there used to be a timeout here
                updateDocument(tab.document);
            }

            // Don't call update to enable/disable breakpoints when they are
            // all deactivated
            if (force || enableBreakpoints || (action != "enable" && action != "disable"))
                updateBreakpointAtDebugger(breakpoint, action);

            changed = true;
            settings.save();
        }

        /***** Methods *****/

        function setCondition(breakpoint, condition, ignoreXml) {
            breakpoint.data.condition = condition;
            updateBreakpoint(breakpoint, "condition");

            ignoreXml || model._signal("change");

            return true;
        }

        function enableBreakpoint(breakpoint, ignoreXml) {
            breakpoint.data.enabled = true;
            updateBreakpoint(breakpoint, "enable");

            ignoreXml || model._signal("change");

            return true;
        }

        function disableBreakpoint(breakpoint, ignoreXml) {
            breakpoint.data.enabled = false;
            updateBreakpoint(breakpoint, "disable");

            ignoreXml || model._signal("change");

            return true;
        }

        function setBreakpoint(breakpoint, noEvent) {
            // Ignore if the breakpoint already exists
            for (var i = 0, l = breakpoints.length, bp; i < l; i++) {
                if ((bp = breakpoints[i]).equals(breakpoint, true)) {
                    return;
                }
            }

            if (breakpoint.hidden)
                return;

            // Make sure we have a breakpoint object
            if (!(breakpoint instanceof Breakpoint))
                breakpoint = new Breakpoint(breakpoint);

            breakpoints.push(breakpoint);
            model._signal("change");

            if (!noEvent) // Prevent recursion during init
                updateBreakpoint(breakpoint, "add");

            return breakpoint;
        }

        function clearBreakpoint(breakpoint, ignoreXml, silent) {
            breakpoints.remove(breakpoint);
            if (!silent)
                updateBreakpoint(breakpoint, "remove");

            ignoreXml || model._signal("change");
        }

        function redrawBreakpoint(bp) {
            var tab = tabs.findTab(bp.path);
            if (!tab) return;

            updateDocument(tab.document);

            model._signal("change", bp);
        }

        function findBreakpoint(path, line, multi) {
            if (typeof path == "object") {
                line = path.line;
                path = path.path;
            }

            var match = { path: path };
            if (line || line === 0) match.line = line;

            var bp, list = [];
            for (var i = 0, l = breakpoints.length; i < l; i++) {
                bp = breakpoints[i];
                // loc = bp.actual || bp;

                // if (bp.path == path && (!line || loc.line == line)) {
                if (bp.equals(match)) {
                    if (!multi) return bp;
                    else list.push(bp);
                }
            }

            return multi ? list : false;
        }

        function findBreakpoints(path, line) {
            return findBreakpoint(path, line, true);
        }

        function gotoBreakpoint(bp, line, column) {
            var path;

            if (bp instanceof Breakpoint) {
                var loc = bp.actual || bp;
                path = bp.path;
                line = loc.line - 1;
                column = loc.column;
            }
            else if (typeof bp == "object") {
                return gotoBreakpoint(findBreakpoint(bp));
            }
            else {
                path = bp;
            }

            if (isNaN(line)) line = undefined;
            if (isNaN(column)) column = undefined;

            debug.openFile({
                path: path,
                line: line,
                column: column
            });
        }

        function activateAll(force) {
            if (enableBreakpoints && !force) return;

            enableBreakpoints = true;
            settings.set("user/breakpoints/@active", true);

            breakpoints.forEach(function(bp) {
                if (bp.enabled)
                    updateBreakpoint({ id: bp.id, enabled: true }, "enable", force);
            });

            if (drawn)
                list.renderer.unsetStyle("listBPDisabled");

            toggleBreakpoints(true);
        }

        function deactivateAll(force) {
            if (!enableBreakpoints && !force) return;

            settings.set("user/breakpoints/@active", false);

            breakpoints.forEach(function(bp) {
                updateBreakpoint({ id: bp.id, enabled: false }, "disable", force);
            });

            if (drawn)
                list.renderer.setStyle("listBPDisabled");

            enableBreakpoints = false;
            toggleBreakpoints(false);
        }

        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
            plugin.once("draw", draw);
        });
        plugin.on("enable", function() {
            if (!enableBreakpoints && drawn)
                list.renderer.setStyle("listBPDisabled");
        });
        plugin.on("disable", function() {

        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
            drawnCondition = false;
        });

        /***** Register and define API *****/

        /**
         * The breakpoints panel for the {@link debugger Cloud9 debugger}.
         *
         * This panel shows a list of all the breakpoints and allows the user
         * to remove, disable and enable the breakpoints.
         *
         * @singleton
         * @extends DebugPanel
         **/
        plugin.freezePublicAPI({
            /**
             * A list of breakpoints that are set.
             * @property {debugger.Breakpoint[]} breakpoints
             * @readonly
             */
            get breakpoints() { return breakpoints.slice(0); },

            /**
             * Sets or retrieves whether the debugger should break when it hits
             * a breakpoint.
             * @property {Boolean} enableBreakpoints
             * @readonly
             */
            get enableBreakpoints() { return enableBreakpoints; },
            set enableBreakpoints(v) {
                enableBreakpoints = v;
                toggleBreakpoints(v);
            },

            /**
             * Sets the condition expression of a breakpoint.
             * @param {debugger.Breakpoint} breakpoint The breakpoint to set the condition on.
             * @param {String}              condition  An expression that needs to be true for the debugger to break on the breakpoint.
             */
            setCondition: setCondition,

            /**
             * Flags a breakpoint to not be ignored when the debugger hits it.
             * @param {debugger.Breakpoint} breakpoint The breakpoint to enable.
             */
            enableBreakpoint: enableBreakpoint,

            /**
             * Flags a breakpoint to be ignored when the debugger hits it.
             * @param {debugger.Breakpoint} breakpoint The breakpoint to disable.
             */
            disableBreakpoint: disableBreakpoint,

            /**
             * Displays a breakpoint in the ace editor.
             * @param {debugger.Breakpoint} breakpoint The breakpoint to display.
             */
            gotoBreakpoint: gotoBreakpoint,

            /**
             * Adds a breakpoint to the list of breakpoints.
             * @param {debugger.Breakpoint} breakpoint The breakpoint to add.
             */
            setBreakpoint: setBreakpoint,

            /**
             * Removes a breakpoint from the list of breakpoints.
             * @param {debugger.Breakpoint} breakpoint The breakpoint to remove.
             */
            clearBreakpoint: clearBreakpoint,
        });

        register(null, {
            breakpoints: plugin
        });
    }
});
