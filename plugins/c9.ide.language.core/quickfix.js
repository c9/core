define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "tabManager", "ace", "language",
        "menus", "commands", "c9", "tabManager",
        "settings", "language.jumptodef"
    ];
    main.provides = ["language.quickfix"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var tabs = imports.tabManager;
        var language = imports.language;
        var commands = imports.commands;
        var jumptodef = imports["language.jumptodef"];
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        var CRASHED_JOB_TIMEOUT = 30000;
        
        var worker;
        
        var loaded;
        function load() {
            if (loaded) return;
            loaded = true;
            
            commands.on("update", function() {
                var key = commands.getPrettyHotkey("quickfix");
                
                language.getWorker(function(err, result) {
                    if (err) return console.error(err);
                    worker = result;
                    
                    worker.emit("quickfix_key", { data: key });
                });
            });
            
            commands.addCommand({
                name: "quickfix",
                hint: "quickfix",
                bindKey: { mac: "Command-F3", win: "Ctrl-F3" },
                exec: function(editor) {
                    invoke();
                }
            }, plugin);
            
            language.getWorker(function(err, result) {
                if (err) console.error(err);
                worker = result;
                
                worker.on("quickfixes_result", onResult);
            });
            
            /*
            menus.addItemByPath("Tools/Quickfix", new apf.item({
                caption: "Quickfix",
                command: "quickfix"
            }), 20001, plugin)
            */
        }
    
        function invoke() {
            if (!tabs.focussedTab || !tabs.focussedTab.editor || !tabs.focussedTab.editor.ace)
                return;
            
            var tab = tabs.focussedTab;
            var ace = tab.editor.ace;
            var sel = ace.getSelection();
            var pos = sel.getCursor();
    
            activateSpinner(tabs.focussedTab);
    
            worker.emit("quickfixes", {
                data: pos
            });
        }
        
        function onResult(e) {
            var tab = tabs.findTab(e.data.path);
            if (!tab || tabs.focussedTab !== tab)
                return;
            
            clearSpinners(tab);
            var results = e.data.results;
            
            if (!results.length)
                return;
            
            // HACK: don't show UI for now, assume there's only 1 result
            if (results[0].deltas.length > 1 && results[0].delta.some(function(d) { return d.path; }))
                throw new Error("Multiple deltas with paths not allowed");
                
            applyQuickfix(e.data.path, results[0]);
        }
    
        function activateSpinner(tab) {
            tab.classList.add("loading");
            clearTimeout(tab.$quickfixReset);
            tab.$quickfixReset = setTimeout(function() {
                clearSpinners(tab);
            }, CRASHED_JOB_TIMEOUT);
        }
    
        function clearSpinners(tab) {
            clearTimeout(tab.$quickfixReset);
            tab.classList.remove("loading");
        }
        
        function applyQuickfix(sourcePath, fix) {
            var tab = fix.deltas[0].path
                ? tabs.findTab(fix.deltas[0].path)
                : tabs.focussedTab;
            if (tab !== tabs.focussedTab) {
                var sourcePos = tabs.focussedTab.editor.ace.getCursorPosition();
                return jumptodef.jumpToPos(fix.deltas[0].path, fix.pos, sourcePath, sourcePos, function(err) {
                    if (err) return console.error(err);
                    applyQuickfix(sourcePath, fix);
                });
            }
            
            var ace = tab.editor.ace;
            var doc = ace.getSession().getDocument();
    
            doc.applyDeltas(fix.deltas);
        
            if (fix.pos) {
                var pos = fix.pos;
                var selection = ace.getSelection();
                selection.clearSelection();
                selection.moveCursorTo(pos.row, pos.column, false);
            }
        }
        
        /*
        var CLASS_SELECTED = "cc_complete_option selected";
        var CLASS_UNSELECTED = "cc_complete_option";
        var SHOW_DOC_DELAY = 1500;
        var SHOW_DOC_DELAY_MOUSE_OVER = 100;
        var HIDE_DOC_DELAY = 1000;
        var MENU_WIDTH = 400;
        var MENU_SHOWN_ITEMS = 9;
        var EXTRA_LINE_HEIGHT = 3;
        var QFBOX_MINTIME = 500;
        
        var ignoreMouseOnce = false;
        var isDocShown;
        var isDrawDocInvokeScheduled = false;
        var quickfixElement;
        var editor;
        var selectedIdx;
        var scrollIdx;
        var quickfixEls;
        var docElement;
        var cursorConfig;
        var lineHeight;
        var quickFixes;
        var popupTime;
        var oldCommandKey;
        var oldOnTextInput;
        
        function isPopupVisible() {
            return barQuickfixCont.$ext.style.display !== "none";
        }
        
        var drawDocInvoke = lang.deferredCall(function() {
            if (isPopupVisible() && (quickFixes[selectedIdx].preview
                || quickFixes[selectedIdx].previewHtml)) {
                isDocShown = true;
                txtQuickfixDoc.parentNode.show();
            }
            isDrawDocInvokeScheduled = false;
        });
        
        var undrawDocInvoke = lang.deferredCall(function() {
            if (!isPopupVisible()) {
                isDocShown = false;
                txtQuickfixDoc.parentNode.hide();
            }
        });
        
        function initEditor(editor) {
                   
            editor.on("guttermousedown", editor.$markerListener = function(e) {
                 editor = editor;
                if (!e.getButton())
                    return;
                apf.addListener(mnuCtxEditor, "prop.visible", hideContext);
                function hideContext(ev) {
                    // only fire when visibility is set to true
                    if (ev.value) {
                        apf.removeListener(mnuCtxEditor, "prop.visible", hideContext);
                        mnuCtxEditor.hide();
                    }
                }
                var gutterRegion = editor.renderer.$gutterLayer.getRegion(e);
                if (gutterRegion != "markers")
                    return;
                
                var row = e.getDocumentPosition().row;
                showQuickfixBox(row, 0);
                
            });
        }
            
        function getAnnos(row) {
            var editor = editors.currentEditor.amlEditor.$editor;
            var res = [];
            
            editor.getSession().languageAnnos.forEach(function(anno, idx) {
                if (anno.row == row) {
                    res.push(anno);
                    
                    // Select the annotation in the editor
                    anno.select = function() {
                        if (!(anno.pos.sl && anno.pos.sc && anno.pos.el && anno.pos.ec)) {
                            return;
                        }
                        var startPos = { row: anno.pos.sl, column: anno.pos.sc };
                        var endPos = { row: anno.pos.el, column: anno.pos.ec };
                        if (startPos.row < endPos.row || startPos.column < endPos.column) {
                            editor.getSelection().setSelectionRange(
                                {start: startPos, end: endPos});
                        }
                    };
                    
                    // Returns the screen coordinates of the start of the annotation
                    anno.getScreenCoordinates = function() {
                        return editor.renderer.textToScreenCoordinates(anno.pos.sl,
                                                                       anno.pos.sc);  
                    };
                }
            });
            
            res.sort(function(a,b) { return a.pos.sc - b.pos.sc; });
            
            return res;
        }
        
        function showQuickfixBox(row, column) {
            // Get the annotation on this line that is containing or left of the 
            // position (row,column)
            var annos = getAnnos(row);
            if (!annos.length) {
                return;
            }
            for (var i = 0; i < annos.length - 1; i++) {
                if (annos[i+1].pos.sc > column) { break; }
            }
            var anno = annos[i];
            if (!anno.resolutions.length) {
                // TODO If some other annotation on this line has resolutions, 
                // quickfix that one instead
                return;
            }
    
            editor = editors.currentEditor;
            var ace = editor.amlEditor.$editor;
            selectedIdx = 0;
            scrollIdx = 0;
            quickfixEls = [];
            // annos = annos;
            quickFixes = [];
            quickfixElement = txtQuickfix.$ext;
            docElement = txtQuickfixDoc.$ext;
            cursorConfig = ace.renderer.$cursorLayer.config;
            lineHeight = cursorConfig.lineHeight + EXTRA_LINE_HEIGHT;
            var style = dom.computedStyle(editor.amlEditor.$ext);
            quickfixElement.style.fontSize = style.fontSize;
            
            barQuickfixCont.setAttribute('visible', true);
    
    
            // Monkey patch
            if (!oldCommandKey) {
                oldCommandKey = ace.keyBinding.onCommandKey;
                ace.keyBinding.onCommandKey = onKeyPress.bind(this);
                oldOnTextInput = ace.keyBinding.onTextInput;
                ace.keyBinding.onTextInput = onTextInput.bind(this);
            }
            
            // Collect all quickfixes for the given annotation
            quickFixes = anno.resolutions;
            
            // Select it in the editor
            anno.select();
            
            populateQuickfixBox(quickFixes);
    
            apf.popup.setContent("quickfixBox", barQuickfixCont.$ext);
            var boxLength = quickFixes.length || 1;
            var quickfixBoxHeight = 11 + Math.min(10 * lineHeight, boxLength * (lineHeight));
            
            var innerBoxLength = quickFixes.length || 1;
            var innerQuickfixBoxHeight = Math.min(10 * lineHeight, innerBoxLength * (lineHeight));
            txtQuickfixHolder.$ext.style.height = innerQuickfixBoxHeight + "px";
            
            ignoreMouseOnce = !isPopupVisible();
            
            var pos = anno.getScreenCoordinates();
            apf.popup.show("quickfixBox", {
                x: pos.pageX, 
                y: pos.pageY + cursorConfig.lineHeight, 
                height: quickfixBoxHeight,
                width: MENU_WIDTH,
                animate: false,
                callback: function() {
                    barQuickfixCont.setHeight(quickfixBoxHeight);
                    barQuickfixCont.$ext.style.height = quickfixBoxHeight + "px";
                    sbQuickfix.$resize();
                    // HACK: Need to set with non-falsy value first
                    quickfixElement.scrollTop = 1;
                    quickfixElement.scrollTop = 0;
                }
            });
            
            popupTime = new Date().getTime();
            document.addEventListener("click", closeQuickfixBox, false);
            ace.container.addEventListener("DOMMouseScroll", closeQuickfixBox, false);
            ace.container.addEventListener("mousewheel", closeQuickfixBox, false);
        }
    
        function closeQuickfixBox(event) {
            var qfBoxTime = new Date().getTime() - popupTime;
            if (!forceClose && qfBoxTime < QFBOX_MINTIME) {
                return;
            }
            
            forceClose = false;
        
            barQuickfixCont.$ext.style.display = "none";
            if (!editors.currentEditor.amlEditor) // no editor, try again later
                return;
            var ace = editors.currentEditor.amlEditor.$editor;
            
            // TODO these calls don't work.
            document.removeEventListener("click", closeQuickfixBox, false);
            ace.container.removeEventListener("DOMMouseScroll", closeQuickfixBox, false);
            ace.container.removeEventListener("mousewheel", closeQuickfixBox, false);
            
            if (oldCommandKey) {
                ace.keyBinding.onCommandKey = oldCommandKey;
                ace.keyBinding.onTextInput = oldOnTextInput;
            }
            oldCommandKey = oldOnTextInput = null;
            undrawDocInvoke.schedule(HIDE_DOC_DELAY);
        }
        
        function populateQuickfixBox(quickFixes) {
            
            quickfixElement.innerHTML = "";
            var cursorConfig = code.amlEditor.$editor.renderer.$cursorLayer.config;
    
            // For each quickfix, create a list entry
            quickFixes.forEach(function(qfix, qfidx) {
    
                var annoEl = dom.createElement("div");
                annoEl.className = qfidx === selectedIdx ? CLASS_SELECTED : CLASS_UNSELECTED;
                var html = "";
    
                if (qfix.image)
                    html = "<img src='" + ide.staticPrefix + qfix.image + "'/>";
    
                html += '<span class="main">' + (qfix.messageHtml || escapeHtml(qfix.message)) + '</span>';
    
                annoEl.innerHTML = html;     
                
                annoEl.addEventListener("mouseover", function() {
                    if (ignoreMouseOnce) {
                        ignoreMouseOnce = false;
                        return;
                    }
                    quickfixEls[selectedIdx].className = CLASS_UNSELECTED;
                    selectedIdx = qfidx;
                    quickfixEls[selectedIdx].className = CLASS_SELECTED;
                    updateDoc();
                    if (!isDrawDocInvokeScheduled)
                        drawDocInvoke.schedule(SHOW_DOC_DELAY_MOUSE_OVER);
                });
                
                
                annoEl.addEventListener("click", function() {
                    forceClose = true;
                    applyQuickfix(qfix);
                });
                
                
                annoEl.style.height = cursorConfig.lineHeight + EXTRA_LINE_HEIGHT +  "px";
                annoEl.style.width = (MENU_WIDTH - 10) + "px";
                quickfixElement.appendChild(annoEl);
                quickfixEls.push(annoEl);
            });
    
            updateDoc(true);
            
        }
        
        function updateDoc(delayPopup) {
            docElement.innerHTML = '<span class="code_complete_doc_body">';
            var selected = quickFixes[selectedIdx];
    
            if (selected && (selected.preview || selected.previewHtml)) {
                if (isDocShown) {
                    txtQuickfixDoc.parentNode.show();
                }
                else {
                    txtQuickfixDoc.parentNode.hide();
                    if (!isDrawDocInvokeScheduled || delayPopup)
                        drawDocInvoke.schedule(SHOW_DOC_DELAY);
                }
                docElement.innerHTML += 
                    selected.previewHtml
                    || escapeHtml(selected.preview).replace(/\n/g, '<br/>');
                docElement.innerHTML += '</span>';
            }
            else {
                txtQuickfixDoc.parentNode.hide();
            }
    
            docElement.innerHTML += '</span>';
        }
        
        function onTextInput(text, pasted) {
            closeQuickfixBox();
        }
    
        function onKeyPress(e, hashKey, keyCode) {
            
            if (e.metaKey || e.ctrlKey || e.altKey) {
                closeQuickfixBox();
                return;
            }
            
            var keyBinding = editors.currentEditor.amlEditor.$editor.keyBinding;
    
            switch (keyCode) {
                case 0: break;
                case 32: // Space
                    closeQuickfixBox();
                    break;
                case 27: // Esc
                    closeQuickfixBox();
                    e.preventDefault();
                    break;
                case 8: // Backspace
                    closeQuickfixBox();
                    e.preventDefault();
                    break;
                case 37:
                case 39:
                    oldCommandKey.apply(keyBinding, arguments);
                    closeQuickfixBox();
                    e.preventDefault();
                    break;
                case 13: // Enter
                case 9: // Tab
                    applyQuickfix(quickFixes[selectedIdx]);
                    forceClose = true;
                    closeQuickfixBox();
                    e.stopPropagation();
                    e.preventDefault();
                    break;
                case 40: // Down
                    if (quickfixEls.length === 1) {
                        closeQuickfixBox();
                        break;
                    }
                    e.stopPropagation();
                    e.preventDefault();
                    quickfixEls[selectedIdx].className = CLASS_UNSELECTED;
                    if (selectedIdx < quickFixes.length-1)
                        selectedIdx++;
                    quickfixEls[selectedIdx].className = CLASS_SELECTED;
                    if (selectedIdx - scrollIdx > MENU_SHOWN_ITEMS) {
                        scrollIdx++;
                        quickfixEls[scrollIdx].scrollIntoView(true);
                    }
                    updateDoc();
                    break;
                case 38: // Up
                    if (quickfixEls.length === 1) {
                    closeQuickfixBox();
                        break;
                    }
                    e.stopPropagation();
                    e.preventDefault();
                    if (selectedIdx <= 0)
                        return;
                    quickfixEls[selectedIdx].className = CLASS_UNSELECTED;
                    selectedIdx--;
                    quickfixEls[selectedIdx].className = CLASS_SELECTED;
                    if (selectedIdx < scrollIdx) {
                        scrollIdx--;
                        quickfixEls[scrollIdx].scrollIntoView(true);
                    }
                    updateDoc();
                    break;
            }
        }
        
        function invoke(forceBox) {
            var editor = editors.currentEditor.amlEditor.$editor;
            if (editor.inMultiSelectMode) {
                closeQuickfixBox();
                return;
            }
            forceBox = forceBox;
            
            var pos = editor.getCursorPosition();
            
            showQuickfixBox(pos.row, pos.column);
        }
        */
        
        plugin.on("load", load);
        
        register(null, {
            "language.quickfix": plugin.freezePublicAPI({
                
            })
        });
    }

});