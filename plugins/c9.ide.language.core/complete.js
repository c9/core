/**
 * Cloud9 Language Foundation
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "tabManager", "ace", "language",
        "menus", "commands", "c9", "tabManager",
        "language.tooltip", "settings"
    ];
    main.provides = ["language.complete"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var c9 = imports.c9;
        var aceHandle = imports.ace;
        var menus = imports.menus;
        var tabs = imports.tabManager;
        var commands = imports.commands;
        var language = imports.language;
        var tooltip = imports["language.tooltip"];
        var settings = imports.settings;
        var escapeHTML = require("ace/lib/lang").escapeHTML;
        var lang = require("ace/lib/lang");
        var SyntaxDetector = require("./syntax_detector");
        var completeUtil = require("plugins/c9.ide.language/complete_util");
        var Popup = require("ace/autocomplete/popup").AcePopup;
        var completedp = require("./completedp");
        var assert = require("c9/assert");
        
        var snippetManager = require("ace/snippets").snippetManager;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var theme;
        
        var isInvokeScheduled = false;
        var ignoreMouseOnce = false;
        var enterCompletion = true;
        var tooltipHeightAdjust = 0;
        
        var commandKeyBeforePatch, textInputBeforePatch, aceBeforePatch;
        var isDocShown;
        var txtCompleterDoc; // ui elements
        var docElement, lastAce, worker; 
        var matches, eventMatches, popup;
        var lastUpDownEvent, forceOpen, $closeTrigger;
        
        var idRegexes = {};
        var completionRegexes = {}; 
      
        var DEFAULT_ID_REGEX = completeUtil.DEFAULT_ID_REGEX;
        
        var FETCH_DOC_DELAY = 1200;
        var SHOW_DOC_DELAY = 1500;
        var SHOW_DOC_DELAY_MOUSE_OVER = 100;
        var HIDE_DOC_DELAY = 1000;
        var AUTO_UPDATE_DELAY = 200;
        var CRASHED_COMPLETION_TIMEOUT = 6000;
        var MENU_WIDTH = 330;
        var MENU_SHOWN_ITEMS = 8;
        var EXTRA_LINE_HEIGHT = 4;
        var REPEAT_IGNORE_RATE = 200;
        
        var deferredInvoker = lang.deferredCall(function() {
            isInvokeScheduled = false;
            var ace = deferredInvoker.ace;
            var pos = ace.getCursorPosition();
            var line = ace.getSession().getDocument().getLine(pos.row);
            var identifierRegex = getIdentifierRegex(null, ace);
            var completionRegex = getCompletionRegex(null, ace);
            if (completeUtil.precededByIdentifier(line, pos.column, null, ace)
               || (line[pos.column - 1] && line[pos.column - 1].match(identifierRegex))
               || (matchCompletionRegex(completionRegex, line, pos) && (line[pos.column - 1].match(identifierRegex) || !(line[pos.column] || "").match(identifierRegex)))
               || (language.isInferAvailable() && completeUtil.isRequireJSCall(line, pos.column, "", ace))) {
                invoke({ autoInvoke: true });
            }
            else {
                closeCompletionBox();
            }
        });
        var drawDocInvoke = lang.deferredCall(function() {
            if (!isPopupVisible()) return;
            var match = matches[popup.getHoveredRow()] || matches[popup.getRow()];
            if (match && (match.doc || match.$doc)) {
                isDocShown = true;
                showDocPopup();
            }
            isDrawDocInvokeScheduled = false;
        });
        var isDrawDocInvokeScheduled = false;
        
        var requestDocInvoke = lang.deferredCall(function() {
            if (!isPopupVisible()) return;
            isDocsRequested = true;
            if (!eventMatches.some(function(m) {
                return m.noDoc;
            }))
                return;
            invoke({ requestDocs: true });
        });
        var isDocsRequested;
        
        var undrawDocInvoke = lang.deferredCall(function() {
            if (!isPopupVisible()) {
                isDocShown = false;
                hideDocPopup();
            }
        });
        
        var killCrashedCompletionInvoke = lang.deferredCall(function() {
            closeCompletionBox();
        });
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            language.once("initWorker", function(e) {
                worker = e.worker;
                
                worker.on("setIdentifierRegex", function(event) {
                    idRegexes[event.data.language] = event.data.identifierRegex;
                });
                worker.on("setCompletionRegex", function(event) {
                    completionRegexes[event.data.language] = event.data.completionRegex;
                }); 
                
                e.worker.on("complete", function(event) {
                    var tab = tabs.focussedTab;
                    if (!tab || (tab.path || tab.name) !== event.data.path)
                        return;
                    
                    // TODO for background tabs editor.ace.session is wrong
                    if (tab.document !== tab.editor.ace.session.c9doc)
                        return;
                    
                    assert(tab.editor, "Could find a tab but no editor for " + event.data.path);
                    onComplete(event, tab.editor);
                });
            });
            
            menus.addItemByPath("Tools/~", new ui.divider(), 2000, plugin);
            menus.addItemByPath("Tools/Show Autocomplete", new ui.item({
                command: "complete"
            }), 2100, plugin);
            
            commands.addCommand({
                name: "complete",
                hint: "code complete",
                bindKey: {
                    mac: "Ctrl-Space|Alt-Space", 
                    win: "Ctrl-Space|Alt-Space"
                },
                isAvailable: function(editor) {
                    return editor && language.isEditorSupported({ editor: editor });
                },
                exec: function() {
                    invoke();
                }
            }, plugin);
            
            commands.addCommand({
                name: "completeoverwrite",
                hint: "code complete & overwrite",
                bindKey: {
                    mac: "Ctrl-Shift-Space|Alt-Shift-Space", 
                    win: "Ctrl-Shift-Space|Alt-Shift-Space"
                },
                isAvailable: function(editor) {
                    return editor && language.isEditorSupported({ editor: editor });
                },
                exec: invoke.bind(null, false, true)
            }, plugin);
            
            aceHandle.on("themeChange", function(e) {
                theme = e.theme;
                if (!theme || !drawn) return;
                
                txtCompleterDoc.className = "code_complete_doc_text" 
                    + (theme.isDark ? " dark" : "");

                popup.setTheme({
                    cssClass: "code_complete_text",
                    isDark: theme.isDark,
                    padding: 0
                });
                popup.renderer.setStyle("dark", theme.isDark);
            }, plugin);
            
            settings.on("read", updateSettings);
            settings.on("user/language", updateSettings);
            settings.on("project/language", updateSettings);
        }
        
        var drawn;
        function draw() {
            if (drawn) return;
            drawn = true;
        
            // Import the CSS for the completion box
            ui.insertCss(require("text!./complete.css"), plugin);
            
            txtCompleterDoc = document.createElement("div");
            txtCompleterDoc.className = "code_complete_doc_text" 
                + (!theme || theme.isDark ? " dark" : "");
            
            popup = new Popup(document.body);
            popup.setTheme({
                cssClass: "code_complete_text",
                isDark: !theme || theme.isDark,
                padding: 0
            });
            popup.$imageSize = 8 + 5 + 7 + 1;
            // popup.renderer.scroller.style.padding = "1px 2px 1px 1px";
            popup.renderer.$extraHeight = 4;
            popup.renderer.setStyle("dark", !theme || theme.isDark);
            
            completedp.initPopup(popup, c9.staticUrl);
            //@TODO DEPRECATE: onKeyPress
            function clearLastLine() { popup.onLastLine = false; }
            popup.on("select", clearLastLine);
            popup.on("change", clearLastLine);
            
            // Ace Tree Interaction
            popup.on("mouseover", function() {
                if (ignoreMouseOnce) {
                    ignoreMouseOnce = false;
                    return;
                }
                
                if (!isDocsRequested)
                    requestDocInvoke.call();
                if (!isDrawDocInvokeScheduled)
                    drawDocInvoke.schedule(SHOW_DOC_DELAY_MOUSE_OVER);
            }, false);
            
            popup.on("select", function() { updateDoc(true); });
            popup.on("changeHoverMarker", function() { updateDoc(true); });
            
            popup.on("click", function(e) {
                onKeyPress(e, 0, 13);
                e.stop();
            });
            
            emit("draw");
        }
        
        function updateSettings() {
            setEnterCompletion(settings.get("user/language/@enterCompletion"));
        }
        
        /***** Helper Functions *****/
        
        function isPopupVisible() {
            return popup && popup.isOpen;
        }
        
        function getSyntax(ace) {
            return SyntaxDetector.getContextSyntax(
                ace.getSession().getDocument(),
                ace.getCursorPosition(),
                ace.getSession().syntax);
        }
        
        function isJavaScript(ace) {
            return ["javascript", "jsx"].indexOf(getSyntax(ace)) > -1;
        }
        
        function isHtml(ace) {
            return getSyntax(ace) === "html";
        }
        
        /**
         * Replaces the preceeding identifier (`prefix`) with `newText`, where ^^
         * indicate the cursor positions after the replacement.
         * If the prefix is already followed by an identifier substring, that string
         * is deleted.
         */
        function replaceText(ace, match, deleteSuffix) {
            if (!ace.inVirtualSelectionMode && ace.inMultiSelectMode) {
                ace.forEachSelection(function() {
                    replaceText(ace, match, deleteSuffix);
                }, null, { keepOrder: true });
                if (ace.tabstopManager)
                    ace.tabstopManager.tabNext();
                return;
            }

            var newText = match.replaceText;
            var pos = ace.getCursorPosition();
            var session = ace.getSession();
            var line = session.getLine(pos.row);
            var doc = session.getDocument();
            var idRegex = match.identifierRegex || getIdentifierRegex(null, ace);
            var prefix = completeUtil.retrievePrecedingIdentifier(line, pos.column, idRegex);
            var postfix = completeUtil.retrieveFollowingIdentifier(line, pos.column, idRegex) || "";
            
            var snippet = match.snippet;
            if (!snippet) {
                if (match.replaceText === "require(^^)" && isJavaScript(ace)) {
                    newText = "require(\"^^\")";
                    if (!isInvokeScheduled)
                        setTimeout(deferredInvoke.bind(null, false, ace), 0);
                }
                
                // Don't insert extra () in front of (
                var endingParens = newText.substr(newText.length - 4) === "(^^)"
                    ? 4
                    : newText.substr(newText.length - 2) === "()" ? 2 : 0;
                if (endingParens) {
                    if (line.substr(pos.column + (deleteSuffix ? postfix.length : 0), 1) === "(")
                        newText = newText.substr(0, newText.length - endingParens);
                    if (postfix && line.substr(pos.column, postfix.length + 1) === postfix + "(") {
                        newText = newText.substr(0, newText.length - endingParens);
                        deleteSuffix = true;
                    }
                }

                // Ensure cursor marker
                if (newText.indexOf("^^") === -1)
                    newText += "^^";
                    
                // Remove HTML duplicate '<' completions
                var preId = completeUtil.retrievePrecedingIdentifier(line, pos.column, idRegex);
                if (isHtml(ace) && line[pos.column - preId.length - 1] === '<' && newText[0] === '<')
                    newText = newText.substring(1);
                
                snippet = newText.replace(/[$]/g, "\\$").replace(/\^\^(.*)\^\^|\^\^/g, "${0:$1}");
                // Remove cursor marker
                newText = newText.replace(/\^\^/g, "");
            }
            
            tooltip.setLastCompletion(match, pos);

            if (deleteSuffix || newText.slice(-postfix.length) === postfix || match.deleteSuffix)
                doc.removeInLine(pos.row, pos.column - prefix.length, pos.column + postfix.length);
            else
                doc.removeInLine(pos.row, pos.column - prefix.length, pos.column);
            
            snippetManager.insertSnippet(ace, snippet);
            
            language.onCursorChange(null, null, true);
            emit("replaceText", {
                pos: pos,
                prefix: prefix,
                newText: newText,
                match: match
            });
            
            if (matchCompletionRegex(getCompletionRegex(), doc.getLine(pos.row), ace.getCursorPosition()))
                deferredInvoke(true);
        }
        
        function showCompletionBox(editor, m, prefix, line) {
            var ace = editor.ace;
            draw();

            matches = m;
            docElement = txtCompleterDoc;
           
            // Monkey patch
            if (!commandKeyBeforePatch) {
                aceBeforePatch = ace;
                commandKeyBeforePatch = ace.keyBinding.onCommandKey;
                ace.keyBinding.onCommandKey = onKeyPress.bind(this);
                textInputBeforePatch = ace.keyBinding.onTextInput;
                ace.keyBinding.onTextInput = onTextInput.bind(this);
            }
            
            lastAce = ace;
            
            populateCompletionBox(ace, matches);
            window.document.addEventListener("mousedown", closeCompletionBox);
            ace.on("mousewheel", closeCompletionBox);

            var renderer = ace.renderer;
            popup.setFontSize(ace.getFontSize());
            var lineHeight = renderer.layerConfig.lineHeight;
            
            var base = ace.getCursorPosition();
            base.column -= prefix.length;
            
            // Offset to the left for completion in string, e.g. 'require("a")'
            if (base.column > 0 && line.substr(base.column - 1, 1).match(/["'"]/))
                base.column--;
            
            var loc = ace.renderer.textToScreenCoordinates(base.row, base.column);
            var pos = { left: loc.pageX, top: loc.pageY };
            pos.left -= popup.getTextLeftOffset();
            tooltipHeightAdjust = 0;

            popup.show(pos, lineHeight);
            adjustToToolTipHeight(tooltip.getHeight());
            updateDoc(true);
            
            ignoreMouseOnce = !isPopupVisible();
            emit("showPopup", { popup: popup });
        }
        
        function adjustToToolTipHeight(height) {
            // Give function to tooltip to adjust completer
            tooltip.adjustCompleterTop = adjustToToolTipHeight;
            
            if (!isPopupVisible())
                return;
            
            var left = parseInt(popup.container.style.left, 10);
            if (popup.isTopdown !== tooltip.isTopdown() || left > tooltip.getRight())
                height = 0;
            
            if (popup.isTopdown) {
                var top = parseInt(popup.container.style.top, 10) - tooltipHeightAdjust;
                height -= height ? 3 : 0;
                top += height;
                popup.container.style.top = top + "px";
            }
            else {
                var bottom = parseInt(popup.container.style.bottom, 10) - tooltipHeightAdjust;
                bottom += height;
                popup.container.style.bottom = bottom + "px";
            }
            tooltipHeightAdjust = height;
            if (isDocShown)
                showDocPopup();
        }
    
        function closeCompletionBox(event) {
            if (!popup)
                return;
            
            if (event && event.target) {
                if (popup.container.contains(event.target)
                  || docElement.contains(event.target))
                    return;
            }
            
            emit("hidePopup");
            
            popup.hide();
            hideDocPopup();
            
            if (!lastAce) // no editor, try again later
                return;
                
            var ace = lastAce;
            window.document.removeEventListener("mousedown", closeCompletionBox);
            ace.off("mousewheel", closeCompletionBox);
            
            if (commandKeyBeforePatch) {
                aceBeforePatch.keyBinding.onCommandKey = commandKeyBeforePatch;
                aceBeforePatch.keyBinding.onTextInput = textInputBeforePatch;
            }
            commandKeyBeforePatch = textInputBeforePatch = null;
            
            undrawDocInvoke.schedule(HIDE_DOC_DELAY);
            requestDocInvoke.cancel();
            forceOpen = false;
        }
            
        function populateCompletionBox(ace, matches) {
            // Get context info
            var pos = ace.getCursorPosition();
            var line = ace.getSession().getLine(pos.row);
            var idRegex = getIdentifierRegex(null, ace);
            var prefix = completeUtil.retrievePrecedingIdentifier(line, pos.column, idRegex);
            
            // Set the highlight metadata
            popup.ace = ace;
            popup.matches = matches;
            popup.prefix = prefix;
            
            popup.ignoreGenericMatches = isIgnoreGenericEnabled(matches);
            popup.matches = matches;
            
            popup.calcPrefix = function(regex) {
                return completeUtil.retrievePrecedingIdentifier(line, pos.column, regex);
            };
            
            setPopupDataKeepRow(matches);
        }
        
        function setPopupDataKeepRow(matches) {
            var row = popup.getRow();
            popup.setData(matches);
            popup.setRow(row);

            if (!popup.isOpen || row >= matches.length || row > 0 && !popup.data.every(function(m, i) {
                return i > row || matches[i] && matches[i].name === m.name;
            }))
                popup.setRow(0);
        }
        
        function cleanupMatches(matches, ace, pos, line) {
            if (isIgnoreGenericEnabled(matches)) {
                // Disable generic matches when possible
                matches = matches.filter(function(m) { return !m.isGeneric; });
            }
            
            if (ace.inMultiSelectMode) {
                var prefix = completeUtil.retrievePrecedingIdentifier(line, pos.column);
                for (var i = 0; i < matches.length; i++) {
                    var m = matches[i];
                    if (m.replaceText === prefix)
                        matches.splice(i--, 1);
                }
            }
            
            // Simpler look & feel in strings
            if (inCommentOrString(ace, pos)) {
                for (var i = 0; i < matches.length; i++) {
                    var m = matches[i];
                    if (m.meta === "snippet") {
                        matches.splice(i--, 1);
                        continue;
                    }
                    if (m.icon !== "package" && m.icon !== "event" && !m.isContextual)
                        m.icon = null;
                    var simpleName = m.replaceText.replace("^^", "").replace(/\(\)$/, "");
                    if (m.name.indexOf(simpleName) === 0)
                        m.name = m.replaceText = simpleName;
                    delete m.isContextual;
                    delete m.meta;
                }
            }
            
            return matches;
        }
        
        function isIgnoreGenericEnabled(matches) {
            var isNonGenericAvailable = false;
            var isContextualAvailable = false;
            for (var i = 0; i < matches.length; i++) {
                if (!matches[i].isGeneric)
                    isNonGenericAvailable = true;
                if (matches[i].isContextual)
                    isContextualAvailable = true;
            }
            return isNonGenericAvailable && isContextualAvailable;
        }
        
        function updateDoc(delayPopup) {
            docElement.innerHTML = '<span class="code_complete_doc_body">';
            var matches = popup.matches;
            var selected = matches && (
                matches[popup.getHoveredRow()] || matches[popup.getRow()]);

            if (!selected)
                return;
            var docHead = selected.docHeadHtml || selected.docHead && escapeHTML(selected.docHead);
            if (selected.type) {
                var shortType = completedp.guidToShortString(selected.type);
                if (shortType) {
                    docHead = docHead || selected.name + " : " 
                        + completedp.guidToLongString(selected.type) + "</div>";
                }
            }
            
            selected.$doc = "";
            
            // TODO: apply escapeHTML to selected.doc
            if (selected.doc || selected.docHtml)
                selected.$doc = '<p>' + (selected.doc || selected.docHtml) + '</p>';
                
            if (selected.icon || selected.type)
                selected.$doc = '<div class="code_complete_doc_head">' 
                    + (docHead || selected.name && escapeHTML(selected.name)) + '</div>' 
                    + (selected.$doc || "");
            
            if (selected && selected.$doc) {
                if (isDocShown) {
                    showDocPopup();
                }
                else {
                    hideDocPopup();
                    if (!isDrawDocInvokeScheduled || delayPopup) {
                        if (!isDocsRequested)
                            requestDocInvoke.schedule(FETCH_DOC_DELAY);
                        drawDocInvoke.schedule(SHOW_DOC_DELAY);
                    }
                }
                docElement.innerHTML += selected.$doc + '</span>';
            }
            else {
                hideDocPopup();
            }
            if (selected && selected.docUrl)
                docElement.innerHTML += '<p><a' +
                    ' onclick="require(\'ext/preview/preview\').preview(\'' + selected.docUrl + '\'); return false;"' +
                    ' href="' + selected.docUrl + '" target="c9doc">(more)</a></p>';
            docElement.innerHTML += '</span>';
        }
        
        function showDocPopup() {
            if (!isDocsRequested)
                requestDocInvoke.call();
            if (matches[0] && matches[0].nodoc === "always")
                return;
            
            var rect = popup.container.getBoundingClientRect();
            if (!txtCompleterDoc.parentNode) {
                document.body.appendChild(txtCompleterDoc);                
            }
            txtCompleterDoc.style.top = popup.container.style.top;
            txtCompleterDoc.style.bottom = popup.container.style.bottom;
            
            if (window.innerWidth - rect.right < 320) {
                txtCompleterDoc.style.right = window.innerWidth - rect.left + "px";
                txtCompleterDoc.style.left = "";
            } else {
                txtCompleterDoc.style.left = (rect.right + 1) + "px";
                txtCompleterDoc.style.right = "";
            }
            txtCompleterDoc.style.height = rect.height + "px";
            txtCompleterDoc.style.display = "block";
        }
        
        function hideDocPopup() {
            if (txtCompleterDoc)
                txtCompleterDoc.style.display = "none";
        }
        
        /**
         * Set a tooltip to show when a generic completion was just
         * typed in by the user.
         */
        function setTextInputToolTip(text) {
            if (text !== "(")
                return;
            
            var foundOne = false;
            var pos = lastAce.getCursorPosition();
            var line = lastAce.getSession().getLine(pos.row);
            for (var i = 0; i < matches.length; i++) {
                // Find matches that give us a viable tooltip
                if (!matches[i].isGeneric
                    || (!matches[i].doc && matches[i].name === matches[i].replaceText)
                    || !matches[i].replaceText.match(/\)$/))
                    continue;
                var replaceText = matches[i].replaceText.replace("^^", "").replace(/\(\)$/, "");
                var prefix = completeUtil.retrievePrecedingIdentifier(line, pos.column - 1, matches[i].identifierRegex || getIdentifierRegex());
                if (replaceText !== prefix)
                    continue;
                if (foundOne)
                    tooltip.setLastCompletion(null, pos);
                tooltip.setLastCompletion(matches[i], pos);
                foundOne = true;
            }
        }
    
        function onTextInput(text, pasted) {
            var keyBinding = lastAce.keyBinding;
            textInputBeforePatch.apply(keyBinding, arguments);
            if (!pasted) {
                setTextInputToolTip(text);
                var matched = false;
                for (var i = 0; i < matches.length && !matched; i++) {
                    var idRegex = matches[i].identifierRegex || getIdentifierRegex();
                    matched = idRegex.test(text);
                }
                var completionMatch = matchCompletionRegex(getCompletionRegex(), text, { column: text.length });
                if (matched || completionMatch)
                    deferredInvoke(completionMatch);
                else
                    closeCompletionBox();
            }
        }
    
        function onKeyPress(e, hashKey, keyCode) {
            if (keyCode && (e.metaKey || e.ctrlKey || e.altKey)) {
                if (!e.altKey || keyCode != 32)
                    closeCompletionBox();
                return;
            }
            
            var keyBinding = lastAce.keyBinding;
    
            switch (keyCode) {
                case 0: break;
                case 32: // Space
                case 35: // End
                case 36: // Home
                    closeCompletionBox();
                    break;
                case 27: // Esc
                    // special case for vim mode, needed because complete hijacks ace keybinding
                    if (lastAce.$vimModeHandler)
                        commandKeyBeforePatch.apply(keyBinding, arguments);
                    closeCompletionBox();
                    e.preventDefault();
                    e.stopPropagation();
                    break;
                case 8: // Backspace
                    commandKeyBeforePatch.apply(keyBinding, arguments);
                    deferredInvoke();
                    e.preventDefault();
                    break;
                case 37:
                case 39:
                    commandKeyBeforePatch.apply(keyBinding, arguments);
                    closeCompletionBox();
                    e.preventDefault();
                    break;
                case 13: // Enter
                case 9: // Tab
                    var ace = lastAce;
                    if (!enterCompletion && keyCode === 13) {
                        commandKeyBeforePatch(e, hashKey, keyCode);
                        closeCompletionBox();
                        break;
                    }
                    closeCompletionBox();
                    replaceText(ace, matches[popup.getRow()], e.shiftKey);
                    e.preventDefault();
                    e.stopImmediatePropagation && e.stopImmediatePropagation();
                    break;
                case 40: // Down
                    isDocShown = true;
                    var time = Date.now();
                    if (popup.getRow() == popup.matches.length - 1) {
                        if (!(lastUpDownEvent + REPEAT_IGNORE_RATE > time)
                            || popup.matches.length === 1)
                            return closeCompletionBox();
                    }
                    else {
                        popup.setRow(popup.getRow() + 1);
                    }
                    lastUpDownEvent = time;
                    e.stopPropagation();
                    e.preventDefault();
                    break;
                case 38: // Up
                    isDocShown = true;
                    var time = new Date().getTime();
                    if ((!popup.getRow() && !(lastUpDownEvent + REPEAT_IGNORE_RATE > time))
                        || popup.matches.length === 1)
                        return closeCompletionBox();
                    lastUpDownEvent = time;
                    if (popup.getRow())
                        popup.setRow(popup.getRow() - 1);
                    e.stopPropagation();
                    e.preventDefault();
                    break;
                case 33: // PageUp
                    popup.gotoPageUp();
                    e.stopPropagation();
                    e.preventDefault();
                    break;
                case 34: // PageDown
                    popup.gotoPageDown();
                    e.stopPropagation();
                    e.preventDefault();
                    break;
            }
        }
        
        /**
         * Trigger code completion by firing an event to the worker.
         * 
         * @param {Object} options
         * @param {Boolean} [options.autoInvoke]    completion was triggered automatically
         * @param {Boolean} [options.deleteSuffix]  the suffix of the current identifier
         *                                          may be overwritten
         * @param {Boolean} [options.predictOnly]   only prediction is requested
         */
        function invoke(options) {
            var tab = tabs.focussedTab;
            if (!tab || !language.isEditorSupported(tab))
                return;
            
            var ace = lastAce = tab.editor.ace;
            options = options || {};
            if (!options.predictOnly)
                isDocsRequested = options.requestDocs;
            
            if (ace.inMultiSelectMode) {
                var row = ace.selection.lead.row;
                // allow completion if all selections are empty and on the same line
                var shouldClose = options.autoInvoke && !ace.selection.ranges.every(function(r) {
                    return r.cursor.row == row && r.isEmpty();
                });
                if (shouldClose && !forceOpen || !sameMultiselectPrefix(ace))
                    return closeCompletionBox();
                else
                    forceOpen = true;
            }
            ace.addEventListener("change", deferredInvoke);
            var pos = ace.getCursorPosition();
            var line = ace.getSession().getLine(pos.row);
            worker.emit("complete", { data: {
                pos: pos,
                line: line,
                forceBox: true,
                deleteSuffix: true,
                noDoc: !options.requestDocs && !isDocShown,
                predictOnly: options.predictOnly,
            }});
            if (options.autoInvoke)
                killCrashedCompletionInvoke(CRASHED_COMPLETION_TIMEOUT);
        }
        
        function onComplete(event, editor) {
            if (!lastAce || lastAce != editor.ace) {
                console.error("[complete] received completion for wrong ace");
                return;
            }
            
            var pos = editor.ace.getCursorPosition();
            var line = editor.ace.getSession().getLine(pos.row);
            isDocsRequested = !event.data.noDoc;
            
            editor.ace.removeEventListener("change", deferredInvoke);
            killCrashedCompletionInvoke.cancel();
    
            if (!completeUtil.canCompleteForChangedLine(event.data.line, line, event.data.pos, pos, getIdentifierRegex(null, editor.ace)))
                 return;
            if (event.data.isUpdate && !isPopupVisible() && eventMatches && eventMatches.length)
                return;
    
            var matches = eventMatches = event.data.matches;
            matches = filterMatches(matches, line, pos);
            matches = cleanupMatches(matches, editor.ace, pos, line);
            
            if (matches.length === 1 && !event.data.forceBox) {
                replaceText(editor.ace, matches[0], event.data.deleteSuffix);
            }
            else if (matches.length > 0) {
                var idRegex = matches[0].identifierRegex || getIdentifierRegex();
                var identifier = completeUtil.retrievePrecedingIdentifier(line, pos.column, idRegex);
                if (matches.length === 1 && (identifier === matches[0].replaceText || identifier + " " === matches[0].replaceText) && matches[0].replaceText)
                    closeCompletionBox();
                else
                    showCompletionBox(editor, matches, identifier, line);
            }
            else {
                closeCompletionBox();
            }
        }
        
        function setEnterCompletion(enabled) {
            enterCompletion = enabled;
        }
            
        function sameMultiselectPrefix(ace) {
            var commonPrefix;
            var idRegex = getIdentifierRegex();
            return ace.selection.ranges.every(function(range) {
                var pos = range.cursor;
                var line = ace.session.getLine(pos.row);
                var prefix = completeUtil.retrievePrecedingIdentifier(line, pos.column, idRegex);
                if (commonPrefix === undefined)
                    commonPrefix = prefix;
                return commonPrefix == prefix;
            });
        }
            
        /**
         * Incrementally update completion results while waiting for the worker.
         */
        function onCompleteUpdate() {
            var ace = lastAce;
            if (!isPopupVisible() || !eventMatches)
                return;
            var pos = ace.getCursorPosition();
            var line = ace.getSession().getLine(pos.row);
            var idRegex = getIdentifierRegex();
            var prefix = completeUtil.retrievePrecedingIdentifier(line, pos.column, idRegex);
            matches = filterMatches(eventMatches, line, pos);
            matches = cleanupMatches(matches, ace, pos, line);
            if (matches.length) {
                showCompletionBox({ ace: ace }, matches, prefix, line);
            } else {
                closeCompletionBox();
                $closeTrigger = ace.prevOp;
            }
        }
        
        function filterMatches(matches, line, pos) {
            var identifierRegex = getIdentifierRegex();
            var defaultPrefix = completeUtil.retrievePrecedingIdentifier(line, pos.column, identifierRegex);
            var results = matches.filter(function(match) {
                var prefix = match.identifierRegex ? completeUtil.retrievePrecedingIdentifier(line, pos.column, match.identifierRegex) : defaultPrefix;
                return match.name.indexOf(prefix) === 0;
            });
            
            // Always prefer current identifier (similar to worker.js)
            var prefixLine = line.substr(0, pos.column);
            for (var i = 0; i < results.length; i++) {
                var m = results[i];		
                m.replaceText = m.replaceText || m.name;
                if (results[i].isGeneric && results[i].$source !== "local")
                    continue;
                var match = prefixLine.lastIndexOf(m.replaceText);
                if (match > -1
                    && match === pos.column - m.replaceText.length
                    && completeUtil.retrievePrecedingIdentifier(line, pos.column, m.identifierRegex || identifierRegex)) {
                    results.splice(i, 1);
                    results.splice(0, 0, m);
                }
            }
            
            return results;
        }
        
        function deferredInvoke(now, ace, fromBackspace) {
            if (fromBackspace && (!$closeTrigger || ace.prevOp != $closeTrigger))
                return;
            ace = ace || lastAce;
            now = now || !isPopupVisible();
            var delay = now ? 0 : AUTO_UPDATE_DELAY;
            if (!now) {
                // Fire incremental update after document changes are known
                setTimeout(onCompleteUpdate.bind(this), 0);
            }
            if (isInvokeScheduled)
                return;
            isInvokeScheduled = true;
            deferredInvoker.ace = ace;
            deferredInvoker.schedule(delay);
        }
        
        function getCompletionRegex(language, ace) {
            // Try getting a regex, or return null, with matches nothing (undefined matches anything)
            return completionRegexes[language || getSyntax(ace || lastAce)] || null;
        }
        
        function matchCompletionRegex(completionRegex, line, pos) {
            if (!completionRegex)
                return false;
            var ch = line[pos.column - 1];
            if (ch && completionRegex.test(ch))
                return true;
            if (completionRegex.source.match(/[^\\]\$\)*$/))
                return completionRegex.test(line.substr(0, pos.column));
        }
        
        function getIdentifierRegex(language, ace) {
            return idRegexes[language || getSyntax(ace || lastAce)] || DEFAULT_ID_REGEX;
        }
        
        function inCommentOrString(ace, pos) {
            var token = ace.getSession().getTokenAt(pos.row, pos.column - 1);
            return token && token.type && token.type.match(/^comment|^string/);
        }
        
        function addSnippet(data, plugin) {
            if (typeof data == "string") {
                data = { text: data };
                var text = data.text;
                var firstLine = text.split("\n", 1)[0].replace(/\#/g, "").trim();
                firstLine.split(";").forEach(function(n) {
                    if (!n) return;
                    var info = n.split(":");
                    if (info.length != 2) return;
                    data[info[0].trim()] = info[1].trim();
                });
            }
            if (data.include)
                data.include = data.include.split(",").map(function(n) {
                    return n.trim();
                });
            if (!data.scope) throw new Error("Missing Snippet Scope");
            
            data.scope = data.scope.split(",");
            if (!data.snippets && data.text)
                data.snippets = snippetManager.parseSnippetFile(data.text);
            
            data.scope.forEach(function(scope) {
                snippetManager.register(data.snippets, scope);
            });
            
            // if (snippet.include) {
            //     snippetManager.snippetMap[snippet.scope].includeScopes = snippet.include;
            //     snippet.include.forEach(function(x) {
            //         // loadSnippetFile("ace/mode/" + x);
            //         // @nightwing help!
            //     });
            // }
            
            plugin.addOther(function() {
                snippetManager.unregister(data.snippets);
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
            theme = null;
            isInvokeScheduled = null;
            ignoreMouseOnce = null;
            enterCompletion = null;
            tooltipHeightAdjust = null;
            commandKeyBeforePatch = null;
            textInputBeforePatch = null;
            aceBeforePatch = null;
            isDocShown = null;
            txtCompleterDoc = null;
            docElement = null;
            lastAce = null;
            worker = null;
            matches = null;
            eventMatches = null;
            popup = null;
            lastUpDownEvent = null;
            forceOpen = null;
            $closeTrigger = null;
            isDocShown = false;
            isDocsRequested = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Manages the code completer popup.
         **/
        plugin.freezePublicAPI({
            /**
             * Invoke the completer after a small delay,
             * if there is a matching language handler that
             * agrees to complete at the current cursor position.
             *
             * @param {Boolean} now   Show without delay
             * @param {ace}     ace   The current tab's editor.ace object
             */
            deferredInvoke: deferredInvoke,
            
            /**
             * Force-invoke the completer immediately.
             * @ignore
             * @internal See {@link #deferredInvoke()}.
             */
            invoke: invoke,
            
            /**
             * @ignore
             */
            getCompletionRegex: getCompletionRegex,
            
            /**
             * @ignore
             */
            matchCompletionRegex: matchCompletionRegex,
            
            /**
             * @ignore
             */
            getIdentifierRegex: getIdentifierRegex,
            
            /**
             * Close the completion popup.
             */
            closeCompletionBox: closeCompletionBox,
            
            /**
             * Determines whether a completion popup is currently visible.
             */
            isPopupVisible: isPopupVisible,
            
            /**
             * @internal
             */
            setEnterCompletion: setEnterCompletion,
            
            /**
             * @internal
             */
            $setShowDocDelay: function(value) {
                SHOW_DOC_DELAY = value;
            },
            
            events: [
                /**
                 * Fires when a code completion option is picked.
                 *
                 * @param {Object} pos
                 * @param {String} newText
                 * @param {Object} match
                 * @event replaceText
                 */
                "replaceText",
                /**
                 * Fires when a completion popup is shown.
                 * @event showPopup
                 */
                "showPopup",
                /**
                 * Fires when a completion popup is hidden.
                 * @event hidePopup
                 */
                "hidePopup"
            ],
            
            /**
             * 
             */
            addSnippet: addSnippet
        });
        
        register(null, {
            "language.complete": plugin
        });
    }
});
