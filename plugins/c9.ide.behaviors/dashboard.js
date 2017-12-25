define(function(require, exports, module) {
    main.consumes = ["Plugin", "ui", "dashboard"];
    main.provides = ["dashboardbehavior"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var dashboard = imports.dashboard;
        
        /***** Initialization *****/
        
        var handle = new Plugin("Ajax.org", main.consumes);
        // var emit = handle.getEmitter();
        
        var divSplit;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            // @todo how to make sure this happens only once?
            var css = require("text!./style.css");
            ui.insertCss(css, null, handle);

            dashboard.on("widgetCreate", function(e) {
                if (e.widget.dashboard.configurable)
                    addInteraction(e.widget);
            }, handle);
            
            dashboard.on("widgetAfterClose", function(e) {
                //@todo keep total tree small
            }, handle);
        }
        
        function addInteraction(plugin) {
            var widget = plugin.aml;
            var titlebar = widget.oCaption && widget.oCaption.parentNode;
            if (!titlebar) return;
            var container = widget.$ext;

            var offsetX, offsetY, startX, startY, dragWidth, dragHeight;
            var originalBox, box, started, start;
            var originalPosition, splitDirection, splitBox, originalSize;
            
            function finish() {
                divSplit.style.display = "none";
                
                apf.removeListener(document, "mousemove", mouseMoveSplit);
                apf.removeListener(document, "mouseup", mouseUpSplit);
                
                container.style.zIndex = 
                container.style.opacity = 
                container.style.pointerEvents = "";
                
                plugin.dashboard.widgets.forEach(function(widget) {
                    widget.aml.$int.style.pointerEvents = "";
                });
                
                widget.$dragging = false;
            }
            
            titlebar.addEventListener("mousedown", function(e) {
                // APF stuff
                widget.$dragging = true;
                
                // Calculate where on the titlebar was clicked
                var rect = container.getBoundingClientRect();
                startX = e.clientX; 
                startY = e.clientY; 
                offsetX = startX - rect.left;
                offsetY = startY - rect.top;
                
                // Use mine
                started = false;

                // Set current box
                box = widget.parentNode;
                
                // Store original info
                originalBox = box;
                originalPosition = container.nextSibling;
                originalSize = [container.style.left, container.style.top, 
                                    container.style.width, container.style.height, 
                                    ui.getStyle(container, "margin")];
                dragWidth = container.offsetWidth;
                dragHeight = container.offsetHeight;
                
                // Div that shows where to insert split
                if (!divSplit) {
                    divSplit = document.createElement("div");
                    divSplit.className = "split-area dark";
                    document.body.appendChild(divSplit);
                }
                
                // Fixate current position and width
                start = function() {
                    rect = container.getBoundingClientRect();
                    container.style.width = (dragWidth - ui.getWidthDiff(container)) + "px";
                    container.style.height = (dragHeight - ui.getHeightDiff(container)) + "px";
                    
                    // Prepare titlebar for dragging
                    container.style.zIndex = 100000;
                    container.style.opacity = 0.7;
                    container.style.margin = 0;
                    container.style.pointerEvents = "none";
                    
                    plugin.dashboard.widgets.forEach(function(widget) {
                        widget.aml.$int.style.pointerEvents = "none";
                    });
                    
                    document.body.appendChild(container);
                };
                
                apf.addListener(document, "mousemove", mouseMoveSplit);
                apf.addListener(document, "mouseup", mouseUpSplit);
            });
            
            function showSplitPosition(e) {
                var el = document.elementFromPoint(e.clientX, e.clientY);
                var aml = apf.findHost(el);
                
                while (aml && aml.localName != "frame")
                    aml = aml.parentNode;
                
                // If aml is not the box we seek, lets abort
                if (!aml) {
                    divSplit.style.display = "none";
                    splitBox = null;
                    splitDirection = null;
                    return;
                }
                
                // Find the rotated quarter that we're in
                var rect = aml.$ext.getBoundingClientRect();
                var left = (e.clientX - rect.left) / rect.width;
                var right = 1 - left;
                var top = (e.clientY - rect.top) / rect.height;
                var bottom = 1 - top;
                
                // Cannot split box that would be removed later
                //@todo this needs to be a check against self
                // if (aml.getWidgets().length === 0) { // && aml == originalBox
                //     divSplit.style.display = "none";
                //     splitBox = null;
                //     splitDirection = null;
                //     return;
                // }
                splitBox = aml;
                
                // Anchor to closes side
                var min = Math.min(left, top, right, bottom);
                
                // Get titlebars height
                var bHeight = aml.oCaption.parentNode.offsetHeight;
                
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
                    start();
                }
                
                container.style.left = (e.clientX - offsetX) + "px";
                container.style.top = (e.clientY - offsetY) + "px";
                
                return showSplitPosition(e);
            }
            
            function mouseUpSplit(e) {
                apf.removeListener(document, "mousemove", mouseMoveSplit);
                apf.removeListener(document, "mouseup", mouseUpSplit);
                
                if (!started) return finish();
                
                container.style.left = (e.clientX - offsetX) + "px";
                container.style.top = (e.clientY - offsetY) + "px";
                
                showSplitPosition(e);
                
                if (splitBox) {
                    if (splitDirection == "n")
                        plugin.vsplit(splitBox, widget, false);
                    else if (splitDirection == "s")
                        plugin.vsplit(splitBox, widget, true);
                    else if (splitDirection == "w")
                        plugin.hsplit(splitBox, widget, false);
                    else if (splitDirection == "e")
                        plugin.hsplit(splitBox, widget, true);
                    
                    var child = box.childNodes[0];
                    if (child.localName == "splitter")
                        child = box.childNodes[1];
                    var pNode = box.parentNode;
                    var next = box.nextSibling;
                    pNode.removeChild(box);
                    pNode.insertBefore(child, next);
                    if (box.edge) {
                        child.setAttribute("edge", box.edge);
                        child.$ext.style.margin = "";
                    }
                    child.setAttribute("width", box.width || "");
                    child.setAttribute("height", box.height || "");
                    box.destroy(true, true);
                }
                else {
                    originalBox.insertBefore(widget, originalPosition);
                    
                    container.style.left = originalSize[0];
                    container.style.top = originalSize[1];
                    container.style.width = originalSize[2];
                    container.style.height = originalSize[3];
                    container.style.margin = originalSize[4];
                }
                
                // Remove box if empty
                // if (originalBox && originalBox.getWidgets().length === 0)
                //     originalBox.cloud9box.unload();
                
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
        handle.freezePublicAPI({});
        
        register(null, {
            dashboardbehavior: handle
        });
    }
});