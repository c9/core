define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "tabManager", "ace", "anims", "settings", "preferences"
    ];
    main.provides = ["tabinteraction"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var anims = imports.anims;
        var settings = imports.settings;
        var prefs = imports.preferences;
        var tabs = imports.tabManager;
        var aceHandle = imports.ace;
        
        var css = require("text!./style.css");
        
        /***** Initialization *****/
        
        var handle = new Plugin("Ajax.org", main.consumes);
        // var emit = handle.getEmitter();
        
        var divSplit, divButton, plusMargin = 11;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            // Insert CSS
            ui.insertCss(css, null, handle);
            
            settings.on("read", function() {
                settings.setDefaults("user/tabs", [["autoclosepanes", true]]);
            }, handle);

            tabs.on("tabCreate", function(e) {
                var tab = e.tab;
                
                addInteraction(tab);
                
                // Make sure that events are put on the button when the skin changes
                tab.aml.on("$skinchange", function() {
                    addInteraction(tab);
                });
            }, handle);
            
            tabs.on("tabDestroy", function(e) {
                if (e.tab.meta.$skipAnimation)
                    setTimeout(function() { e.tab.pane.unload(); }, 0);
            }, handle);
            
            tabs.on("tabAfterClose", function(e) {
                if (e.last && canTabBeRemoved(e.tab.pane, 1)
                  && settings.getBool("user/tabs/@autoclosepanes")) {
                    e.tab.meta.$skipAnimation = true;
                }
            }, handle);
            
            prefs.add({
               "General": {
                    "User Interface": {
                        position: 20,
                        "Automatically Close Empty Panes": {
                            type: "checkbox",
                            path: "user/tabs/@autoclosepanes",
                            position: 1150
                        }
                    }
                }
            }, handle);
            
            ui.insertCss("* { }", false, handle);
        }
        
        function canTabBeRemoved(pane, min) {
            if (!pane || pane.getTabs().length > (min || 0)) 
                return false;
            
            var containers = tabs.containers;
            for (var i = 0; i < containers.length; i++) {
                if (ui.isChildOf(containers[i], pane.aml)) {
                    return containers[i]
                        .getElementsByTagNameNS(apf.ns.aml, "tab").length > 1;
                }
            }
            return false;
        }
        
        function addInteraction(plugin) {
            var tab = plugin.aml;
            var button = tab.$button;
            if (!button) return;

            var offsetX, offsetY, startX, startY, dragWidth;
            var mode, rightPadding, originalTab, btnPlus, pane;
            var started, tabWidth, leftPadding, leftPos, start, initMouse;
            var pages, clean, originalPosition, splitDirection, splitTab;
            
            function setOrderMode(toTab, e) {
                if (toTab.isOrderCleaned === false) {
                    return setTimeout(function() {
                        setOrderMode(toTab, e);
                    }, 10);
                }
                
                mode = "order";
                clean && clean();
                
                var lastPane = pane;
                
                // Set new pane
                pane = toTab;
                
                // Plus Button
                btnPlus = pane.$ext.querySelector(".plus_tab_button");
                
                // Attach tab to pane
                if (e) {
                    var curpage = pane.getPage();
                    if (curpage) {
                        var curbtn = curpage.$button;
                        ui.setStyleClass(curbtn, "", ["curbtn"]);
                    }
                    
                    ui.setStyleClass(tab.$button, "curbtn");
                }
                
                var container = pane.$buttons;
                var nodes = container.childNodes;
                var rect = container.getBoundingClientRect();
                var btn = (pane.getPage() || { $button: button }).$button;
                var diff = ui.getWidthDiff(btn);
                
                var leftMargin = parseInt(ui.getStyle(btn, "marginLeft"), 10) || 0;
                var rightMargin = parseInt(ui.getStyle(btn, "marginRight"), 10) || 0;
                var maxWidth = parseInt(ui.getStyle(btn, "maxWidth"), 10) || 150;
                if (maxWidth > 500) maxWidth = 150;
                
                leftPos = rect.left;
                pages = pane.getPages();
                leftPadding = parseInt(ui.getStyle(container, "paddingLeft"), 10) || 0;
                rightPadding = (parseInt(ui.getStyle(container, "paddingRight"), 10) || 0) + 24;

                var addOne = pages.indexOf(tab) == -1;
                var maxTabWidth = Math.min(maxWidth + diff, 
                  ((rect.width - leftPadding - rightPadding + rightMargin) 
                    / (pages.length + (addOne ? 1 : 0))) - rightMargin);
                var newTabWidth = maxTabWidth - diff;
                
                tabWidth = maxTabWidth + leftMargin + rightMargin;
                
                // Get the positions info of the tab buttons
                var info = [];
                for (var i = nodes.length - 1; i >= 0; i--) {
                    if ((btn = nodes[i]).nodeType != 1) continue;
                    info.push([btn, btn.offsetLeft, btn.offsetTop, btn.offsetWidth]);
                }
                
                // Append the button to the button container
                if (e || addOne) {
                    pane.$buttons.appendChild(button);
                    info.push([button, 0, button.offsetTop, dragWidth]);
                }
                
                // Set the info
                var iter;
                while ((iter = info.pop())) {
                    btn = iter[0];
                    btn.style.left = (iter[1]) + "px";
                    btn.style.top = (iter[2]) + "px";
                    btn.style.width = (iter[3] - ui.getWidthDiff(btn)) + "px";
                    btn.style.margin = 0;
                    btn.style.position = "absolute";
                }
                
                start = function() {
                    // Remove from childNodes of old pane
                    var lastIndex = pane.childNodes.indexOf(tab);
                    pane.childNodes.remove(tab);
                };
                
                if (started)
                    start();
                
                // Set initial position
                if (e || addOne)
                    mouseMoveOrder(e, newTabWidth); //, lastPane == pane);
                
                apf.addListener(document, "mousemove", mouseMoveOrder);
                apf.addListener(document, "mouseup", mouseUpOrder);
                
                clean = function(change, toTab) {
                    if (!toTab)
                        toTab = pane;
                    toTab.isOrderCleaned = false;
                        
                    if (change !== false) {
                        apf.removeListener(document, "mousemove", mouseMoveOrder);
                        apf.removeListener(document, "mouseup", mouseUpOrder);
                    }
                    
                    if (change === true) {
                        var maxTabWidth = Math.min(maxWidth + diff, 
                          ((rect.width - leftPadding - rightPadding + rightMargin + 3) 
                            / pane.getPages().length) - rightMargin);
                        tabWidth = maxTabWidth + leftMargin + rightMargin;
                        
                        var cb = clean.bind(this, false, toTab);
                        return animateTabs(cb, null, maxTabWidth - diff);
                    }
                    
                    if (curbtn && curpage.parentNode && curpage == curpage.parentNode.getPage()) {
                        ui.setStyleClass(curbtn, "curbtn");
                        curbtn = null;
                    }
                    
                    for (var i = nodes.length - 1; i >= 0; i--) {
                        if ((btn = nodes[i]).nodeType != 1) continue;
                        btn.style.left = 
                        btn.style.top = 
                        btn.style.width = 
                        btn.style.margin = 
                        btn.style.position = "";
                    }
                    
                    toTab.isOrderCleaned = true;
                };
            }
            
            function setSplitMode(e) {
                mode = "split";
                
                // Div that shows where to insert split
                if (!divSplit) {
                    divSplit = document.createElement("div");
                    divSplit.className = "split-area";
                    document.body.appendChild(divSplit);
                }
                
                // Remove all pointer events from iframes
                var frames = document.getElementsByTagName("iframe");
                for (var i = 0; i < frames.length; i++)
                    frames[i].style.pointerEvents = "none";
                
                start = function() {
                    // Fixate current position and width
                    var rect = button.getBoundingClientRect();
                    button.style.left = (rect.left) + "px";
                    button.style.top = (rect.top) + "px";
                    button.style.width = (dragWidth - ui.getWidthDiff(button)) + "px";
                    button.style.position = "absolute";
                    
                    // Attach tab to body
                    if (!divButton) {
                        divButton = document.createElement("div");
                        document.body.appendChild(divButton);
                    }
                    
                    var theme = aceHandle.theme || {};
                    divButton.className = 
                        (theme.isDark ? "dark " : "") + (theme.cssClass || "");
                    divButton.appendChild(button);
                    
                    // Remove from parent childNodes
                    pane.childNodes.remove(tab);
                    
                    ui.setStyleRule("*", "cursor", "default!important");
                };
                
                apf.addListener(document, "mousemove", mouseMoveSplit);
                apf.addListener(document, "mouseup", mouseUpSplit);
                
                if (started)
                    start();
                    
                clean && clean(true);
                    
                clean = function() {
                    button.style.left = 
                    button.style.top = 
                    button.style.width = 
                    button.style.margin = 
                    button.style.position = "";
                    
                    divSplit.style.display = "none";
                    
                    ui.setStyleRule("*", "cursor", "");
                    
                    apf.removeListener(document, "mousemove", mouseMoveSplit);
                    apf.removeListener(document, "mouseup", mouseUpSplit);
                };
                
                if (started) {
                    // Set initial position and detect immediate snap
                    if (mouseMoveSplit(e) === false)
                        return;
                }
            }
            
            function finish() {
                if (!initMouse) {
                    clean(null, null, true);
                    
                    button.style.zIndex = 
                    button.style.pointerEvents = "";
                    
                    // Return all pointer events to iframes
                    var frames = document.getElementsByTagName("iframe");
                    for (var i = 0; i < frames.length; i++)
                        frames[i].style.pointerEvents = "";
                }
                
                tab.$dragging = false;
            }
            
            button.addEventListener("mousedown", function(e) {
                // Tab needs to support ordering
                if (!tab.parentNode.$order || tab.$dragging || e.button)
                    return;
                
                // APF stuff
                tab.$dragging = true;
                
                startX = e.clientX; 
                startY = e.clientY; 
                
                initMouse = function() {
                    // Calculate where on the button was clicked
                    var rect = button.getBoundingClientRect();
                    offsetX = startX - rect.left;
                    offsetY = startY - rect.top;
                    
                    // Prepare button for dragging
                    button.style.zIndex = 100000;
                    button.style.pointerEvents = "none";
                    
                    // Initialize with order mode
                    setOrderMode(tab.parentNode, e);
                    
                    initMouse = null;
                };
                
                // Use mine
                started = false;

                // Set current pane
                pane = plugin.pane.aml;
                
                // Store original info
                originalTab = pane;
                originalPosition = button.nextSibling;
                dragWidth = button.offsetWidth;
                
                apf.addListener(document, "mousemove", mouseMoveOrder);
                apf.addListener(document, "mouseup", mouseUpOrder);
            }, true);
            
            function isNotSnapped(e, container) {
                if (!container)
                    container = pane.$buttons;
                var rect = container.getBoundingClientRect();
                
                var x = e.clientX;
                var y = e.clientY;
                var diff = 10;
                
                return (
                    x < rect.left - diff || 
                    x > rect.left + rect.width + diff ||
                    y < rect.top - 5 || 
                    y > rect.top + rect.height + diff
                );
            }
            
            function showOrderPosition(idx, toWidth, finalize, finish) {
                if (idx < 0) idx = 0;
                
                var orderTab = (pages[idx - 1] == tab
                    ? pages[idx + 1]
                    : pages[idx]) || null;
                
                // Remove tab from childNodes
                pane.childNodes.remove(tab);
                
                if (finalize) {
                    // Get new pages with new order
                    pages = pane.getPages();
                    
                    // Reparent for real
                    var insert = pages[idx] && pages[idx].cloud9tab;
                    plugin.attachTo(pane.cloud9pane, insert, true);
                }
                else {
                    // If we're already at this position do nothing
                    if (orderTab == tab)
                        return;
                    
                    // Move tab to new position
                    idx = pane.childNodes.indexOf(orderTab);
                    if (idx > -1) pane.childNodes.splice(idx, 0, tab);
                    else pane.childNodes.push(tab);
                    
                    pane.$buttons.insertBefore(tab.$button, 
                        orderTab && orderTab.$button || btnPlus);
                }
                
                // Patch + button which is changed to "" again
                // btnPlus.style.position = "absolute";
                // btnPlus.style.top = "6px";
                
                animateTabs(finish, finalize, toWidth);
            }
            
            function animateTabs(finish, includeTab, toWidth) {
                // Get new pages array (with new order)
                pages = pane.getPages();
                pages.push({ $button: btnPlus });
                
                // Animate all pages to their right position
                var p, tweens = [], offset = 0;
                for (var i = 0, l = pages.length; i < l; i++) {
                    p = pages[i];
                    
                    // Ignore the tab we are dragging
                    if (!includeTab && tab === p) {
                        if (p.$button.parentNode == document.body)
                            offset = 1;
                        if (toWidth) 
                            p.$button.style.width = toWidth + "px";
                        continue;
                    }

                    var curLeft = p.$button.offsetLeft;
                    var toLeft = leftPadding + ((i - offset) * tabWidth) 
                        + (!p.localName ? plusMargin : 0);
                        
                    if (toWidth || toLeft != curLeft) {
                        var tween = {
                            node: p.$button,
                            duration: tab === p ? 0.20 : 0.15,
                            timingFunction: tab === p
                                ? "cubic-bezier(.30, .08, 0, 1)"
                                : "linear"
                        };
                        if (includeTab || tab !== p)
                            tween.left = toLeft + "px";
                        if (toWidth && p.localName)
                            tween.width = toWidth + "px";
                        
                        tweens.push(tween);
                    }
                }
                
                anims.animateMultiple(tweens, function() {
                    finish && finish();
                });
            }
            
            function mouseMoveOrder(e, toWidth, finalize) {
                if (!e) e = event;
                
                if (!started) {
                    if (Math.abs(startX - e.clientX) < 4
                      && Math.abs(startY - e.clientY) < 4)
                        return;
                    started = true;
                    initMouse();
                    start();
                }
                
                if (isNotSnapped(e))
                    return setSplitMode(e);
                
                button.style.left = (e.clientX - leftPos - offsetX) + "px";
                
                var x = button.offsetLeft - leftPadding + (tabWidth / 2);
                var idx = Math.floor(x / tabWidth);
                
                showOrderPosition(idx, toWidth, finalize);
            }
            
            function mouseUpOrder(e) {
                apf.removeListener(document, "mousemove", mouseMoveOrder);
                apf.removeListener(document, "mouseup", mouseUpOrder);
                
                if (!started)
                    return finish();
                
                button.style.left = (e.clientX - leftPos - offsetX) + "px";
                
                var x = button.offsetLeft - leftPadding + (tabWidth / 2);
                var idx = Math.floor(x / tabWidth);
                
                // Show final order
                var orderTab = showOrderPosition(idx, null, true, finish);
                
                // Activate tab
                plugin.activate();
                
                // Remove pane if empty
                if (originalTab && canTabBeRemoved(originalTab.cloud9pane) 
                  && settings.getBool("user/tabs/@autoclosepanes"))
                    originalTab.cloud9pane.unload();
            }
            
            function showSplitPosition(e) {
                var el = document.elementFromPoint(e.clientX, e.clientY);
                var aml = apf.findHost(el);
                
                while (aml && aml.localName != "tab")
                    aml = aml.parentNode;
                
                // If aml is not the pane we seek, lets abort
                if (!aml) {
                    divSplit.style.display = "none";
                    splitTab = null;
                    splitDirection = null;
                    return;
                }
                
                var tab = (aml.getPage() || {}).cloud9tab;
                var dark = !tab || tab.classList.names.indexOf("dark") > -1;
                divSplit.className = "split-area" + (dark ? " dark" : "");
                
                // Find the rotated quarter that we're in
                var rect = aml.$ext.getBoundingClientRect();
                var left = (e.clientX - rect.left) / rect.width;
                var right = 1 - left;
                var top = (e.clientY - rect.top) / rect.height;
                var bottom = 1 - top;
                
                // Check whether we're going to dock
                if (!isNotSnapped(e, aml.$buttons)) {
                    setOrderMode(aml, e);
                    return false;
                }
                
                // Cannot split pane that would be removed later
                if (aml.getPages().length === 0) { // && aml == originalTab
                    divSplit.style.display = "none";
                    splitTab = null;
                    splitDirection = null;
                    return;
                }
                splitTab = aml;
                
                // Anchor to closes side
                var min = Math.min(left, top, right, bottom);
                
                // Get buttons height
                var bHeight = pane.$buttons.offsetHeight - 1;
                
                // Left
                if (min == left) {
                    divSplit.style.left = rect.left + "px";
                    divSplit.style.top = (bHeight + rect.top) + "px";
                    divSplit.style.width = (rect.width / 2) + "px";
                    divSplit.style.height = (rect.height - bHeight) + "px";
                    splitDirection = "w";
                }
                // Right
                else if (min == right) {
                    divSplit.style.left = rect.left + (rect.width / 2) + "px";
                    divSplit.style.top = (bHeight + rect.top) + "px";
                    divSplit.style.width = (rect.width / 2) + "px";
                    divSplit.style.height = (rect.height - bHeight) + "px";
                    splitDirection = "e";
                }
                // Top
                else if (min == top) {
                    divSplit.style.left = rect.left + "px";
                    divSplit.style.top = (bHeight + rect.top) + "px";
                    divSplit.style.width = rect.width + "px";
                    divSplit.style.height = ((rect.height / 2) - bHeight) + "px";
                    splitDirection = "n";
                }
                // Bottom
                else if (min == bottom) {
                    divSplit.style.left = rect.left + "px";
                    divSplit.style.top = (rect.top + (rect.height / 2)) + "px";
                    divSplit.style.width = rect.width + "px";
                    divSplit.style.height = (rect.height / 2) + "px";
                    splitDirection = "s";
                }
                
                divSplit.style.cursor = splitDirection + "-resize";
                divSplit.style.display = "block";
            }
            
            function mouseMoveSplit(e) {
                if (!started) {
                    if (Math.abs(startX - e.clientX) < 4
                      && Math.abs(startY - e.clientY) < 4)
                        return;
                    started = true;
                    initMouse();
                    start();
                }
                
                button.style.left = (e.clientX - offsetX) + "px";
                button.style.top = (e.clientY - offsetY) + "px";
                
                return showSplitPosition(e);
            }
            
            // var waiting;
            // function schedule(e){
            //     if (waiting) {
            //         waiting = e;
            //         return;
            //     }
                
            //     waiting = e;
            //     setTimeout(function(){
            //         showSplitPosition(waiting);
            //         waiting = false;
            //     }, 1000);
            // }
            
            function mouseUpSplit(e) {
                button.style.left = (e.clientX - offsetX) + "px";
                button.style.top = (e.clientY - offsetY) + "px";
                
                apf.removeListener(document, "mousemove", mouseMoveSplit);
                apf.removeListener(document, "mouseup", mouseUpSplit);
                
                showSplitPosition(e);
                
                if (splitTab) {
                    splitTab = splitTab.cloud9pane;
                    var newTab;
                    if (splitDirection == "n")
                        newTab = splitTab.vsplit();
                    else if (splitDirection == "s")
                        newTab = splitTab.vsplit(true);
                    else if (splitDirection == "w")
                        newTab = splitTab.hsplit();
                    else if (splitDirection == "e")
                        newTab = splitTab.hsplit(true);
                    
                    var oldTab = pane;
                    plugin.attachTo(newTab, null, true);
                    pane = newTab.aml;
                    
                    if (oldTab && canTabBeRemoved(oldTab.cloud9pane)) {
                        oldTab.cloud9pane.unload();
                        originalTab = null;
                    }
                }
                else {
                    tab.parentNode.$buttons.insertBefore(button,
                        originalPosition);
                    
                    if (originalTab == tab.parentNode) {
                        var idx = tab.parentNode.childNodes.indexOf(tab.nextSibling);
                        if (idx == -1)
                            tab.parentNode.childNodes.push(tab);
                        else
                            tab.parentNode.childNodes.splice(idx, 0, tab);
                    }
                }
                
                // Remove pane if empty
                if (originalTab && originalTab != tab.parentNode
                  && canTabBeRemoved(originalTab.cloud9pane))
                    originalTab.cloud9pane.unload();
                
                finish();
            }
        }
        
        /***** Methods *****/
        
        /***** Lifecycle *****/
        
        handle.on("load", function() {
            load();
        });
        handle.on("enable", function() {
            
        });
        handle.on("disable", function() {
            
        });
        handle.on("unload", function() {
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        /**
         **/
        handle.freezePublicAPI({
            get plusMargin() { return plusMargin; },
            set plusMargin(v) { plusMargin = v; }
        });
        
        register(null, {
            tabinteraction: handle
        });
    }
});