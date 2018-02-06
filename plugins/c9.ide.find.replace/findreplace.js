define(function(require, exports, module) {
    "use strict";
    
    main.consumes = [
        "Plugin", "settings", "ui", "layout",
        "menus", "tabManager", "commands", "tooltip", "apf"
    ];
    main.provides = ["findreplace"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var ui = imports.ui;
        var menus = imports.menus;
        var layout = imports.layout;
        var commands = imports.commands;
        var tooltip = imports.tooltip;
        var tabs = imports.tabManager;
        var apf = imports.apf;

        var css = require("text!./findreplace.css");
        var skin = require("text!./skin.xml");
        var markup = require("text!./findreplace.xml");
        
        var lib = require("plugins/c9.ide.find.replace/libsearch");
        
        var asyncSearch = require("./async_search");
        var Range = require("ace/range").Range;

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        var libsearch = lib(settings, execFind, toggleDialog, restore, toggleOption);

        var searchRow, txtFind, winSearchReplace, txtReplace;
        var tooltipSearchReplace, divSearchCount; 
        var btnPrev, btnNext, btnReplace, btnReplaceAll, hbox, btnCollapse;
        var chk = {};

        var currentRange, lastSearchOptions;
        var timer, startPos = {};

        function toggleOption() {
            var ch;
            switch (this.name) {
                case "regex": ch = chk.regEx; break;
                case "wholeWords": ch = chk.wholeWords; break;
                case "matchCase": ch = chk.matchCase; break;
            }
            ch.change(!ch.checked, true);

            execFind();
        }
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;

            function isSupported(editor) {
                if (apf.activeElement === txtFind || apf.activeElement === txtReplace)
                    return true;
                return editor && editor.ace;
            }
            
            function isSupportedRW(editor) {
                var ace = isSupported(editor);
                return ace === true || !ace ? ace : !ace.getOption("readOnly");
            }

            commands.addCommands({
                replace: {
                    bindKey: { mac: "Option-Command-F", win: "Alt-Shift-F|Ctrl-H" },
                    hint: "search for a string inside the active document and replace it",
                    isAvailable: isSupportedRW,
                    exec: function(env, args, request) {
                        toggleDialog(1, true);
                    }
                }, 
                replaceall: {
                    bindKey: { mac: "", win: "" },
                    hint: "search for a string inside the active document and replace all",
                    isAvailable: isSupportedRW,
                    exec: function(env, args, request) {
                        replaceAll();
                    }
                },
                replacenext: {
                    isAvailable: isSupportedRW,
                    exec: function(env, args, request) {
                        replace();
                    }
                },
                replaceprevious: {
                    isAvailable: isSupportedRW,
                    exec: function(env, args, request) {
                        replace(true);
                    }
                },
                findAll: {
                    isAvailable: isSupported,
                    bindKey: { mac: "Ctrl-Alt-G", win: "Ctrl-Alt-K" },
                    exec: function(editor) { 
                        findAgain(editor.ace, 0);
                    },
                },
                findnext: {
                    isAvailable: isSupported,
                    bindKey: { mac: "Command-G", win: "Ctrl-K" },
                    exec: function(editor) {
                        findAgain(editor.ace, 1);
                    },
                },
                findprevious: {
                    isAvailable: isSupported,
                    bindKey: { mac: "Command-Shift-G", win: "Ctrl-Shift-K" },
                    exec: function(editor) {
                        findAgain(editor.ace, -1);
                    },
                },
                find: {
                    hint: "open the quicksearch dialog to quickly search for a phrase",
                    bindKey: { mac: "Command-F", win: "Ctrl-F" },
                    isAvailable: isSupported,
                    exec: function(env, args, request) {
                        toggleDialog(1, false);
                    }
                },
                hidesearchreplace: {
                    bindKey: { mac: "ESC", win: "ESC" },
                    isAvailable: function(editor) {
                        return winSearchReplace && winSearchReplace.visible;
                    },
                    exec: function(env, args, request) {
                        toggleDialog(-1);
                    }
                }
            }, plugin);

            menus.addItemByPath("Find/Find...", new ui.item({
                command: "find"
            }), 100, plugin);
            menus.addItemByPath("Find/Find Next", new ui.item({
                command: "findnext"
            }), 200, plugin);
            menus.addItemByPath("Find/Find Previous", new ui.item({
                command: "findprevious"
            }), 300, plugin);
            menus.addItemByPath("Find/~", new ui.divider(), 400, plugin);
            menus.addItemByPath("Find/Replace...", new ui.item({
                command: "replace"
            }), 500, plugin);
            menus.addItemByPath("Find/Replace Next", new ui.item({
                command: "replacenext",
            }), 600, plugin);
            menus.addItemByPath("Find/Replace Previous", new ui.item({
                command: "replaceprevious",
            }), 700, plugin);
            menus.addItemByPath("Find/Replace All", new ui.item({
                command: "replaceall"
            }), 800, plugin);
            
            tabs.on("focus", function(e) {
                if (winSearchReplace && winSearchReplace.visible) {
                    if (e.tab && e.tab.editor.ace) {
                        winSearchReplace.enable();
                        execFind(false, "highlight");
                    }
                    else {
                        winSearchReplace.disable();
                        btnCollapse.enable();
                        updateCounter();
                    }
                }
            });
        }

        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;

            // Import CSS
            ui.insertCss(css, null, plugin);

            // Import Skin
            ui.insertSkin({
                name: "searchreplace",
                data: skin,
            }, plugin);

            // Create UI elements
            searchRow = layout.findParent(plugin);
            ui.insertMarkup(null, markup, plugin);

            txtFind = plugin.getElement("txtFind");
            winSearchReplace = plugin.getElement("winSearchReplace");
            txtReplace = plugin.getElement("txtReplace");
            tooltipSearchReplace = plugin.getElement("tooltipSearchReplace");
            chk.searchSelection = plugin.getElement("chkSearchSelection");
            divSearchCount = plugin.getElement("divSearchCount");
            hbox = plugin.getElement("hbox");
            chk.regEx = plugin.getElement("chkRegEx");
            chk.wrapAround = plugin.getElement("chkWrapAround");
            chk.matchCase = plugin.getElement("chkMatchCase");
            chk.wholeWords = plugin.getElement("chkWholeWords");
            chk.preserveCase = plugin.getElement("chkPreserveCase");
            btnPrev = plugin.getElement("btnPrev");
            btnNext = plugin.getElement("btnNext");
            btnReplace = plugin.getElement("btnReplace");
            btnReplaceAll = plugin.getElement("btnReplaceAll");
            btnCollapse = plugin.getElement("btnCollapse");

            btnNext.on("click", function() { findNext(false); });
            btnPrev.on("click", function() { findNext(true); });
            btnReplace.on("click", function() { replace(); });
            btnReplaceAll.on("click", function() { replaceAll(); });
            btnCollapse.on("click", function() { toggleDialog(-1); });

            txtFind.$ext.appendChild(divSearchCount.$ext);
            txtFind.$ext.appendChild(btnPrev.$ext);
            txtFind.$ext.appendChild(btnNext.$ext);
            
            var first = 0;
            function resize() {
                if (first++ < 2) { return; } // Skip first 2 calls
                
                var h = winSearchReplace.$ext.scrollHeight;
                if (Math.abs(winSearchReplace.height - h) < 1) { return; }
                winSearchReplace.setHeight(h);
                winSearchReplace.$ext.style.height = "";
                ui.layout.forceResize(null, true);
            }
            
            txtFind.ace.renderer.on("autosize", resize);
            txtReplace.ace.renderer.on("autosize", resize);

            var timer, control;
            txtReplace.on("focus", function() {
                if (control) control.stop();
                control = {};

                // I'd rather use css anims, but they didn't seem to work
                apf.tween.single(txtReplace.$ext.parentNode, {
                    type: "boxFlex",
                    from: txtReplace.$ext.parentNode.style[apf.CSS_FLEX_PROP] || 1,
                    to: 3,
                    anim: apf.tween.easeOutCubic,
                    control: control,
                    steps: 15,
                    interval: 1,
                    onfinish: function() {
                        ui.layout.forceResize(null, true);
                    }
                });
            });
            txtReplace.on("blur", function() {
                if (txtReplace.getValue())
                    return;
                    
                if (control) control.stop();
                control = {};

                // I'd rather use css anims, but they didn't seem to work
                apf.tween.single(txtReplace.$ext.parentNode, {
                    type: "boxFlex",
                    from: txtReplace.$ext.parentNode.style[apf.CSSPREFIX + "BoxFlex"] || 3,
                    to: 1,
                    anim: apf.tween.easeOutCubic,
                    control: control,
                    steps: 15,
                    interval: 1,
                    onfinish: function() {
                        ui.layout.forceResize(null, true);
                    }
                });
            });

            settings.on("read", function(e) {
                settings.setDefaults("state/ace/search", [
                    ["regex", "false"],
                    ["matchcase", "false"],
                    ["wholeword", "false"],
                    ["backwards", "false"],
                    ["wraparound", "true"],
                    ["highlightmatches", "true"],
                    ["preservecase", "false"]
                ]);
            }, plugin);

            var kb = libsearch.addSearchKeyboardHandler(txtReplace, "replace");
            kb.bindKeys({
                "Return": function(codebox) { replace(); },
                "Shift-Return": function(codebox) { replace(true); }
            });

            document.body.appendChild(tooltipSearchReplace.$ext);

            chk.regEx.on("prop.value", function(e) {
                libsearch.setRegexpMode(txtFind, ui.isTrue(e.value));
            });
            libsearch.setRegexpMode(txtFind, chk.regEx.checked);
            
            libsearch.setReplaceFieldMode(txtReplace, "extended");

            decorateCheckboxes(hbox);
            
            [txtReplace].forEach(function(node) {
                tooltip.add(node.$ext, {
                    message: node.label,
                    width: "auto",
                    timeout: 0,
                    tooltip: tooltipSearchReplace.$ext,
                    animate: false,
                    getPosition: function() {
                        var pos = ui.getAbsolutePosition(winSearchReplace.$ext);
                        var pos2 = ui.getAbsolutePosition(node.$ext, winSearchReplace.$ext);
                        var left = pos[0] + pos2[0];
                        var top = pos[1];
                        return [left, top - 16];
                    }
                }, plugin);
            });

            libsearch.addSearchKeyboardHandler(txtFind, "search");
            txtFind.ace.session.on("change", function(e) {
                clearTimeout(timer);
                var find = !libsearch.keyStroke;
                timer = setTimeout(function() {
                    execFind(false, find ? false : "highlight");
                }, 20);
            });
            
            txtFind.ace.commands.on("exec", function(e) {
                if (/centerselection|fold|comment/i.test(e.command.name)) {
                    getAce().execCommand(e.command.name);
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
            
            initFindInRange();

            emit("draw");
        }

        /***** Methods *****/

        function decorateCheckboxes(parent) {
            var cbs = parent.selectNodes("//a:checkbox");

            cbs.forEach(function(cb) {
                cb.on("click", function(e) {
                    if (this.name == "chkSearchSelection") {
                        if (chk.searchSelection.checked && !txtReplace.ace.isFocused())
                            txtFind.focus();
                        updateFindInRangeMarker(e);
                    }
                    execFind(undefined, "highlight");
                });

                tooltip.add(cb.$ext, {
                    message: cb.label,
                    width: "auto",
                    timeout: 0,
                    tooltip: tooltipSearchReplace.$ext,
                    animate: false,
                    getPosition: function() {
                        var pos = ui.getAbsolutePosition(winSearchReplace.$ext);
                        var left = cb.$ext.getBoundingClientRect().left;
                        var top = pos[1];
                        return [left, top - 16];
                    }
                }, plugin);
            });
        }

        function updateCounter(total, current, msg, wrapped) {
            var oIter = divSearchCount.$ext;            
            if (!oIter) return;
            
            msg = msg || "";
            
            var color = wrapped ? "blue" : "";
            
            if (typeof total == "number" && typeof current == "number") {
                if (!total) {
                    current = 0;
                    color = "red";
                } else {
                    current = getOptions().backwards ? total - current : current + 1;
                }
                msg = current + " of " + total + msg;
            }
            oIter.style.color = color;
            oIter.textContent = msg;
        }

        function setStartPos(ace, force) {
            if (!startPos.range || force) {
                startPos.range = ace.getSelectionRange();
            }
            if (chk.searchSelection.checked) {
                var range = ace.getSelectionRange();
                var isValid = ace.session.getTextRange(range).length > 100;
                if (!isValid || currentRange && range.isEqual(currentRange))
                    range = null;
                    
                if (marker || !range && startPos.id == getSessionId(ace.session))
                    range = startPos.searchRange;
                
                if (range && !range.isEmpty())
                    startPos.searchRange = range;
                else
                    startPos.searchRange = null;
            }
            startPos.scrollTop = ace.session.getScrollTop();
            startPos.scrollLeft = ace.session.getScrollLeft();
            startPos.id = getSessionId(ace.session);
        }

        function initFromEditor(ace) {
            if (!ace.selection.isEmpty() && !ace.selection.isMultiLine())
                txtFind.setValue(ace.getCopyText());
        }

        function toggleDialog(force, isReplace, noselect, callback) {
            var tab = tabs.focussedTab;
            var editor = tab && tab.editor;

            draw();

            tooltipSearchReplace.$ext.style.display = "none";

            if (!force && !winSearchReplace.visible || force > 0) {
                if (!editor || !editor.ace)
                    return;
                
                winSearchReplace.enable();
                
                var ace = getAce();
                var fromEditor = ace && editor && editor.ace == ace;
                if (fromEditor) {
                    if (!isReplace)
                        initFromEditor(ace);

                    setStartPos(ace, ace.selection.isEmpty());
                }

                if (!winSearchReplace.visible)
                    showUi(callback);

                // chk.searchSelection.uncheck();
                var input = isReplace ? txtReplace : txtFind;
                input.focus();
                input.select();
            }
            else if (winSearchReplace.visible) {
                txtFind.ace.saveHistory();
                if (!noselect)
                    tabs.focusTab(tab);
                hideUi(null, callback);
            }
            else if (callback)
                callback();

            return false;
        }

        function showUi(callback) {
            btnReplaceAll.setCaption(searchRow.getWidth() < 800 ? "All" : "Replace All");

            layout.setFindArea(winSearchReplace, {}, callback);

            btnCollapse.setValue(1);
        }

        function hideUi(animate, callback) {
            layout.setFindArea(null, {}, callback);
            btnCollapse.setValue(0);
        }

        function restore() {
            if (!startPos)
                return false;

            var editor = getAce();
            editor.selection.setSelectionRange(startPos.range || startPos.searchRange);
            editor.session.setScrollTop(startPos.scrollTop);
            editor.session.setScrollLeft(startPos.scrollLeft);
        }

        function getOptions() {
            var options = {
                backwards: false,
                wrap: chk.wrapAround.checked,
                caseSensitive: chk.matchCase.checked,
                wholeWord: chk.wholeWords.checked,
                regExp: chk.regEx.checked
            };
            var ace = getAce();
            if (chk.searchSelection.checked) {
                options.range = startPos.searchRange;
            }
            else {
                options.range = null;
            }
            var newLineMode = ace.session.getNewLineMode();
            txtFind.ace.session.setNewLineMode(newLineMode);
            txtReplace.ace.session.setNewLineMode(newLineMode);

            return options;
        }

        function findNext(backwards) {
            execFind(backwards, true);
        }

        /*
         * type can be highlight-> only update highlighting, 
         *      next|true -> skip current selection
         *      falsy -> do not skip current
         */
        function execFind(reverseBackwards, type, options, callback) {
            var ace = getAce();
            if (!ace || !txtFind)
                return;

            if (timer)
                timer = clearTimeout(timer);

            var searchTxt = txtFind.getValue();

            if (!options)
                options = getOptions();

            if (reverseBackwards)
                options.backwards = !options.backwards;

            if (options.regExp) {
                libsearch.checkRegExp(txtFind,
                    tooltipSearchReplace, winSearchReplace);
            }

            var range = ace.selection.getRange();
            
            if (type === true)
                type = "next";
            
            if (type == "next")
                txtFind.ace.saveHistory();
            
            if (type == "next" || !currentRange)
                currentRange = range;

            options.skipCurrent = type == "next";
            options.start = currentRange;

            options.needle = searchTxt;
            
            if (options.range && type != "highlight")
                addFindInRangeMarker(options.range, ace.session);
            else if (!options.range)
                removeFindInRangeMarker();
            
            var re = ace.$search.$assembleRegExp(options, true);
            if (!re) {
                updateCounter();
                if (type != "highlight") {
                    var pos = options.start[options.backwards ? "end" : "start"];
                    var newRange = options.range || Range.fromPoints(pos, pos);
                    ace.revealRange(newRange);
                }
                return callback && callback();
            }
            
            if (type != "highlight") {
                lastSearchOptions = options;
            }

            options.re = re;
            options.source = re.source;
            options.flags = re.ignoreCase ? "igm" : "gm";
            asyncSearch.execFind(ace.session, options, function(result) {
                if (result == "waiting")
                    return updateCounter("...");

                result = result || { total: 0, current: 0 };
                updateCounter(result.total, result.current, null, result.wrapped);
                
                if (!result.start || !result.end) {
                    result.start = 
                    result.end = range[!options.backwards ? "start" : "end"];
                }
                var newRange = Range.fromPoints(result.start, result.end);
                
                if (options.range && newRange.isEmpty())
                    newRange = options.range;
                
                if (type == "next")
                    currentRange = newRange;

                if (type != "highlight")
                    ace.revealRange(newRange);
                
                if (options.findAll) {
                    selectAll(result);
                } else {
                    // highlight
                    ace.session.highlight(re);
                    ace.session._signal("changeBackMarker");
                }
                
                callback && callback(result);
            });
            
            function selectAll(result) {
                var indexArray = result.matches;
                var value = result.value;
                var startIndex = result.offset;
                var re = options.re;
                if (!indexArray.length)
                    return;
        
                var doc = ace.session.doc;
                var ranges = [];
                var startPos = { row: 0, column: 0 };
                var endPos = { row: 0, column: 0 };
                var start = 0, end = 0, offset = 0;
                for (var i = 0; i < indexArray.length; i++) {
                    var index = indexArray[i] + startIndex;
                    re.lastIndex = index;
                    var match = re.exec(value);
                    var txt = match[0];
                    var len = txt.length;
                    startPos = doc.indexToPosition(index + offset - start + startPos.column, startPos.row);
                    start = index + offset;
                    end = index + len + offset;
                    endPos = doc.indexToPosition(end - start + startPos.column, startPos.row);
                    ranges.push(Range.fromPoints(startPos, endPos));
                }
                ace.selection.fromJSON(ranges);
            }
        }
        
        function findAgain(ace, direction) {
            if (!ace.selection.isEmpty() && lastSearchOptions) {
                var text = ace.session.getTextRange();
                var match = lastSearchOptions.re && lastSearchOptions.re.exec(text);
                if (!match || match[0] != text)
                    lastSearchOptions = null;
            }

            if (lastSearchOptions) {
                if (chk.searchSelection.checked) {
                    chk.searchSelection.uncheck();
                    removeFindInRangeMarker(true);
                    delete lastSearchOptions.range;
                    delete lastSearchOptions.indexRange;
                    marker = null;
                }
                
                lastSearchOptions.backwards = direction == -1;
                lastSearchOptions.findAll = direction == 0;
                execFind(null, true, lastSearchOptions);
            } else if (direction == -1) {
                ace.findPrevious();
            } else if (direction == 1) {
                ace.findNext();
            } else if (direction == 0) {
                ace.findAll();
            }
        }
        
        function replace(backwards) {
            var ace = getAce();
            if (!ace)
                return;

            var options = getOptions();
            options.needle = txtFind.getValue();
            var re = ace.$search.$assembleRegExp(options, true);
            var replaceFn = getReplaceFunction(options);
            var range = ace.selection.getRange();
            execFind(backwards, false, options, function(result) {
                if (!ace.selection.getRange().isEqual(range))
                    return; // found new one
                if (result && result.total) {
                    re.lastIndex = result.startIndex;
                    var match = re.exec(result.value);
                    var replacement = match && replaceFn(match);
                    if (match[0] != replacement) {
                        range.end = ace.session.replace(range, replacement);
                    }
                    if (options.backwards) {
                        range.end = range.start;
                    } else {
                        range.start = range.end;
                    }
                    ace.selection.setRange(range);
                }
                findNext(backwards);
            });
            txtReplace.ace.saveHistory();
        }

        function replaceAll(cb) {
            var ace = getAce();
            if (!ace)
                return;

            var options = getOptions();
            options.needle = txtFind.getValue();
            var re = ace.$search.$assembleRegExp(options, true);
            if (!re) {
                return updateCounter();
            }
            options.re = re;
            options.source = re.source;
            options.flags = re.ignoreCase ? "igm" : "gm";
            options.findAll = true;
            
            var replaceFn = getReplaceFunction(options);
            ace.$search.set({ preserveCase: chk.preserveCase.checked });
            
            asyncSearch.execFind(ace.session, options, function(result) {
                var replaced = 0;
                var indexArray = result.matches;
                var value = result.value;
                var startIndex = result.offset;
                var re = options.re;
                if (!indexArray.length)
                    return replaced;
        
                var doc = ace.session.doc;

                var startPos = { row: 0, column: 0 };
                var endPos = { row: 0, column: 0 };
                var start = 0, end = 0, offset = 0;
                var range = new Range();
                for (var i = 0; i < indexArray.length; i++) {
                    var index = indexArray[i] + startIndex;
                    re.lastIndex = index;
                    var match = re.exec(value);
                    var txt = match[0];
                    var len = txt.length;
                    startPos = doc.indexToPosition(index + offset - start + startPos.column, startPos.row);
                    start = index + offset;
                    end = index + len + offset;
                    endPos = doc.indexToPosition(end - start + startPos.column, startPos.row);
                    range.start = startPos;
                    range.end = endPos;
                    var replacement = replaceFn(match);
                    if (txt != replacement) {
                        doc.replace(range, replacement);
                        offset += replacement.length - txt.length;
                    }
                }
        
                updateCounter();
                cb && cb();
            });
            
            txtReplace.ace.saveHistory();
        }
        
        function getReplaceFunction(options) {
            var val = txtReplace.getValue();
            options.preserveCase = chk.preserveCase.checked;
            
            if (options.replaceMode == "literal")
                return function() { return val; };
            
            var fmtParts = [];
            function add(p) {
                var last = fmtParts.length - 1;
                if (p && typeof p == "string" && typeof fmtParts[last] == "string")
                    fmtParts[last] += p;
                else if (typeof p == "number" || p)
                    fmtParts.push(p);
            }
            var lut = { n: "\n", t: "\t", r: "\r", "&": 0, U: -1, L: -2, E: -3, u: -4, l: -5 };
            var re = /\$([\$&\d])|\\([\\ULulEntr\d])/g;
            var index = 0, m;
            while ((m = re.exec(val))) {
                add(val.substring(index, m.index));
                index = re.lastIndex;
                var part = m[1] || m[2];
                if (/\d/.test(part))
                    part = options.regExp ? parseInt(part, 10) : part;
                else if (part in lut)
                    part = lut[part];
                add(part);
            }
            add(val.substr(index));
            
            if (fmtParts.length == 1 && typeof fmtParts[0] == "string" && !options.preserveCase)
                return function() { return fmtParts[0]; };

            return function(match) {
                var gChangeCase = 0;
                var changeCase = 0;
                var result = "";
                for (var i = 0; i < fmtParts.length; i++) {
                    var ch = fmtParts[i];
                    if (typeof ch === "number") {
                        if (ch < 0) {
                            switch (ch) {
                                case -1: gChangeCase = 1; break;
                                case -2: gChangeCase = 2; break;
                                case -3: gChangeCase = 0; break;
                                case -4: changeCase = 1; break;
                                case -5: changeCase = 2; break;
                            }
                            continue;
                        }
                        ch = match[ch] || "";
                    }
                    if (gChangeCase)
                        ch = gChangeCase === 1 ? ch.toUpperCase() : ch.toLowerCase();
                    if (changeCase && ch) {
                        result += changeCase === 1 ? ch[0].toUpperCase() : ch[0].toLowerCase();
                        ch = ch.substr(1);
                        changeCase = 0;
                    }
                    
                    result += ch;
                }
                
                if (options.preserveCase) {
                    var input = match[0];
                    var replacement = result.split("");
                    for (var i = Math.min(input.length, replacement.length); i--;) {
                        var ch = input[i];
                        if (ch && ch.toLowerCase() != ch)
                            replacement[i] = replacement[i].toUpperCase();
                        else
                            replacement[i] = replacement[i].toLowerCase();
                    }
                    result = replacement.join("");
                }
                
                return result;
            };
        }

        function getAce() {
            var tab = tabs.focussedTab;
            var editor = tab && tab.editor;
            return editor && editor.ace;
        }
        
        function getSessionId(session) {
            return (session.c9doc || session.c9session).name;
        }
        
        var marker;
        function addFindInRangeMarker(range, session) {
            removeFindInRangeMarker();

            if (!range || !session || range.isEmpty())
                return;

            var start = new Range(0, 0, range.start.row, range.start.column);
            var end = new Range(range.end.row, range.end.column, Number.MAX_VALUE, Number.MAX_VALUE);
            start.id = session.addMarker(start, "findInRangeMarker", true, "line", true);
            end.id = session.addMarker(end, "findInRangeMarker", true, "line", true);
            
            range.start = start.end = session.doc.createAnchor(start.end.row, start.end.column);
            range.end = end.start = session.doc.createAnchor(end.start.row, end.start.column);
            
            return marker = { start: start, end: end, session: session };
        }
        
        function removeFindInRangeMarker(reset) {
            if (!marker) return;
            
            var session = marker.session;
            session.removeMarker(marker.start.id);
            session.removeMarker(marker.end.id);
            
            marker.start.end.detach();
            marker.end.start.detach();
            marker = null;
        }
        
        function updateFindInRangeMarker(e) {
            var changeFocusInside = false;
            var isBlur = e.name == "blur";
            var target = isBlur ? e.toElement : e.fromElement;
            if (target && target.$ext) {
                changeFocusInside = winSearchReplace.$ext.contains(target.$ext);
            }
            
            if (changeFocusInside)
                return;

            var ace = getAce();
            if (isBlur || !ace)
                return removeFindInRangeMarker();

            if (e.fromElement && e.fromElement.editor) {
                if (e.fromElement.editor.ace == ace)
                    setStartPos(ace);
                
                execFind(false, "highlight");
            }
            
            if (!startPos.searchRange || startPos.id !== getSessionId(ace.session) || e.name == "click")
                setStartPos(ace);
            
            if (chk.searchSelection.checked)
                addFindInRangeMarker(getOptions().range, ace.session);
            else
                removeFindInRangeMarker();
            if (e.name)
                currentRange = null;
        }
        
        function initFindInRange() {
            winSearchReplace.addEventListener("focus", updateFindInRangeMarker);
            winSearchReplace.addEventListener("blur", updateFindInRangeMarker);
        }

        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {

        });
        plugin.on("disable", function() {

        });
        plugin.on("unload", function() {
            loaded = false;
            asyncSearch.terminateWorker();
            searchRow = txtFind = winSearchReplace = txtReplace = null;
            tooltipSearchReplace = divSearchCount = null;
            btnPrev = btnNext = btnReplace = btnReplaceAll = hbox = btnCollapse = null;
            currentRange = lastSearchOptions = timer = null;
            startPos = {};
        });

        /***** Register and define API *****/

        /**
         * Implements the search and replace UI for Cloud9.
         * @singleton
         */
        /**
         * Fetches a ui element. You can use this method both sync and async.
         * 
         * The search in files plugin has the following elements:
         * 
         * * txtFind - `{ui.textbox}`
         * * winSearchReplace - `{ui.window}`
         * * txtReplace - `{ui.textbox}`
         * * tooltipSearchReplace - `{ui.label}`
         * * chkSearchSelection - `{ui.checkbox}`
         * * chkRegEx - `{ui.checkbox}`
         * * chkWrapAround - `{ui.checkbox}`
         * * chkMatchCase - `{ui.checkbox}`
         * * chkWholeWords - `{ui.checkbox}`
         * * chkPreserveCase - `{ui.checkbox}`
         * * btnPrev - `{ui.button}`
         * * btnNext - `{ui.button}`
         * * btnReplace - `{ui.button}`
         * * btnReplaceAll - `{ui.button}`
         * * btnCollapse - `{ui.button}`
         * 
         * @method getElement
         * @param {String}   name       the id of the element to fetch.
         * @param {Function} [callback] the function to call when the 
         *     element is available (could be immediately)
         */
        plugin.freezePublicAPI({
            /**
             * 
             */
            get aml() { return winSearchReplace; },
            
            /**
             * Toggles the visibility of the search and replace panel.
             * @param {Number} force  Set to -1 to force hide the panel, 
             *   or set to 1 to force show the panel.
             */
            toggle: toggleDialog,

            /**
             * Return the cursor and selection to where it was, prior to 
             * starting searching.
             */
            restore: restore,

            /**
             * Find the next occurance of the search query. If wrap around is
             * turned on, the search will continue from the beginning when it
             * reaches the end of the file.
             * @param {Boolean} backwards  When set to true the search direction is reversed.
             */
            findNext: findNext,

            /**
             * Replace the next occurance of the query with whatever the user
             * entered in the replace textbox.
             * @param {Boolean} backwards  When set to true the search direction is reversed.
             */
            replace: replace,

            /**
             * Replace all occurences of the query with whatever the user
             * entered in the replace textbox.
             */
            replaceAll: replaceAll
        });

        register(null, {
            findreplace: plugin
        });
    }
});