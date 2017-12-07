define(function(require, exports, module) {
"use strict";
var event = require("ace/lib/event");

function HeadingHandler(mouseHandler) {
    var editor       = mouseHandler.editor;
    var headingLayer = editor.renderer.$headingLayer;
    

    event.addListener(headingLayer.element, 
        "mousedown", 
        mouseHandler.onMouseEvent.bind(mouseHandler, "headerMouseDown"));
        
    event.addListener(headingLayer.element, 
        "mousemove",
        mouseHandler.onMouseEvent.bind(mouseHandler, "headerMouseMove"));
        
    var overResizer, dragStartPos, columnData;
    editor.setDefaultHandler("headerMouseMove", function(e) {
        if (dragStartPos || !editor.provider || !editor.provider.columns)
            return;
        var pos = e.getDocumentPosition();
        var width = editor.renderer.$size.scrollerWidth;
        if (width != editor.provider.columns.width)
            headingLayer.updateWidth(width);
        columnData = headingLayer.findColumn(pos.x);
        
        overResizer = columnData && columnData.overResizer;
        headingLayer.element.style.cursor = overResizer
            ? "ew-resize"
            : "default";
    });
    
    
    editor.setDefaultHandler("headerMouseDown", function(e) {
        if (overResizer) {
            var pos = e.getDocumentPosition();
            dragStartPos = {x: pos.x};
            mouseHandler.setState("headerResize");
            mouseHandler.captureMouse(e);
            mouseHandler.mouseEvent = e;
        }
        e.stop();
    });
    
    mouseHandler.headerResize = function() {
        if (this.mouseEvent && dragStartPos) {
            var pos = this.mouseEvent.getDocumentPosition();
            var dx = pos.x // - dragStartPos.x;
            var columns = editor.renderer.provider.columns;
            for (var i = 0; i < columns.length; i++) {
                var col = columns[i];
                dx -= col.pixelWidth;
                if (col === columnData.column)
                    break;
            }
            var total = editor.renderer.$size.scrollerWidth;
            headingLayer.changeColumnWidth(columnData.column, dx, total);
            
            var renderer = editor.renderer;
            renderer.updateFull();
        }
    };
    mouseHandler.headerResizeEnd = function() {
        dragStartPos = null;
        headingLayer.element.style.cursor = "";
        overResizer = false;
    };

}

exports.HeadingHandler = HeadingHandler;

});
