define(function(require, exports, module) {
    main.consumes = ["Plugin", "util", "layout"];
    main.provides = ["DockableLayout", "DockableWidget", "DockableAbsoluteRenderer"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var util = imports.util;
        var layout = imports.layout;
        var event = require("ace/lib/event");
        
        /***** Initialization *****/
        
        var counter = 0;
        
        /* 
            @todo mix flex/percentage/fixed
                - resizeTo - use split
                - hsplit/vsplit - always leave existing flex col 
                    (where widget is) and create new fixed col.
                - [DONE] clean - use merge
        
            @todo [Harutyun] Support fixed width widgets - preserving their width/height when dragging/dropping
            @todo Add constraints such as min-width/max-width min-height/max-height, container size
            @todo Move to cell should give an as big an area as possible (multiple cells)
            
            BUGS:
            @todo What does this mean? http://screencast.com/t/vi8WMm6nc20z
            @todo Moving filters to split values in the bottom doesnt resize values
            @todo Off by padding when resizing
            @todo Steps:
                - Resize grid
                - Move values to below grid
                - Move Columns to right side of values
        */
        
        function DockableLayout(developer, deps, options) {
            var plugin = new Plugin(developer, deps);
            var emit = plugin.getEmitter();
            
            var parent = options.parent;
            var renderer = options.renderer;
            
            var model = [];
            var renderId = 0;
            var widgets = [];
            var edge = [0, 0, 0, 0];
            var paused = false;
            
            var container, columns, rows, changes, pending, padding;
            var parentLayout;
            
            var CHANGE_INIT = 1;
            var CHANGE_COLUMNS = 2;
            var CHANGE_ROWS = 4;
            var CHANGE_REDRAW = 7;
            var CHANGE_RESIZE = 6;
            
            var loaded = false;
            function load() {
                if (loaded) return false;
                loaded = true;
                
                if (parent)
                    attachToParent(parent);
            }
            
            function attachToParent(parent) {
                container = document.createElement("div");
                parent.appendChild(container);
                
                container.style.position = "absolute";
                container.style.left = "0";
                container.style.top = "0";
                container.style.right = "0";
                container.style.bottom = "0";
                
                // Start Render Loop
                schedule(CHANGE_REDRAW);
                
                // Hook resize
                layout.on("resize", resize, plugin);
            }
            
            function applyChanges(){
                if (changes && !paused) {
                    var changeset = calculate(changes);
                    render(changeset);
                    changes = 0;
                }
            }
            
            var inited = false;
            function schedule(change) {
                changes = changes | change;
                
                if (paused || pending) return;
                
                pending = true;
                util.nextFrame(function(){
                    if (inited)
                        emit("change");
                    
                    inited = true;
                    pending = false;
                    applyChanges();
                });
            }
            
            /***** Methods *****/
            
            function initModel(){
                model = [];
                if (rows && rows.length && columns && columns.length) {
                    for (var i = 0; i < columns.length; i++) {
                        model[i] = [];
                        for (var j = 0; j < rows.length; j++) {
                            model[i][j] = null;
                        }
                    }
                }
            }
            
            function getWidgetAtPoint(x, y) {
                for (var i = 0; i < widgets.length; i++) {
                    var widget = widgets[i];
                    var computed = widget.computed;
                    if (computed.top < y && computed.top + computed.height > y
                      && computed.left < x && computed.left + computed.width > x) {
                        return widget;
                    }
                }
                
                var rect = container.getBoundingClientRect();
                // Make sure x/y are in the layout
                if (x < rect.width && y < rect.height) {
                    var total = edge[3];
                    var pos = { 
                        widget: { empty: true, rowspan: 1, colspan: 1 },
                        layout: plugin,
                        insertionPoint: "full"
                    };
                    
                    // Find row/col
                    columns.every(function(c, i) {
                        if (total + c.computed > x) {
                            pos.left = total;
                            pos.width = c.computed;
                            pos.widget.col = i;
                            return false;
                        }
                        else {
                            total += c.computed + padding;
                            return true;
                        }
                    });
                    total = edge[0];
                    rows.every(function(c, i) {
                        if (total + c.computed > y) {
                            pos.top = total;
                            pos.height = c.computed;
                            pos.widget.row = i;
                            return false;
                        }
                        else {
                            total += c.computed + padding;
                            return true;
                        }
                    });
                    
                    if (model[pos.widget.col] && model[pos.widget.col][pos.widget.row])
                        return model[pos.widget.col][pos.widget.row];
                    
                    return fill(pos);
                }
            }
            
            function fill(pos) {
                // Expand to empty space
                var start, passed, end;
                var col = pos.widget.col;
                var row = pos.widget.row;
                for (var i = 0; i < model.length; i++) {
                    if (!model[i][row]) {
                        if (start === undefined)
                            start = i;
                        if (i == col)
                            passed = true;
                    }
                    else {
                        if (!passed)
                            start = undefined;
                        else {
                            end = i - 1;
                            break;
                        }
                    }
                }
                if (!end) end = i - 1;
                
                function searchRows(i) {
                    var rstart, rend;
                    // Before Row
                    for (var j = row; j >= 0; j--) {
                        if (!model[i][j])
                            rstart = j;
                        else
                            break;
                    }
                    // After Row
                    for (var j = row; j < rows.length; j++) {
                        if (!model[i][j])
                            rend = j;
                        else
                            break;
                    }
                    
                    return { start: rstart, end: rend };
                }
                
                var info, rstart = 0, rend = 900;
                for (var i = start; i <= end; i++) {
                    info = searchRows(i);
                    rstart = Math.max(info.start, rstart);
                    rend = Math.min(info.end, rend);
                }
                
                pos.widget.col = start;
                pos.widget.colspan = end - start + 1;
                pos.widget.row = rstart;
                pos.widget.rowspan = rend - rstart + 1;
                
                var left = edge[3], width = 0;
                for (var i = 0; i <= end; i++) {
                    if (i < start)
                        left += columns[i].computed + padding;
                    else
                        width += columns[i].computed + padding;
                }
                width -= padding;
                
                var top = edge[0], height = 0;
                for (var i = 0; i <= rend; i++) {
                    if (i < rstart)
                        top += rows[i].computed + padding;
                    else
                        height += rows[i].computed + padding;
                }
                height -= padding;
                
                pos.left = left;
                pos.top = top;
                pos.width = width;
                pos.height = height;
                
                return pos;
            }
            
            /**
             * This is now a simple algorithm that simply allows a widget to be
             * inserted at a side of the widget that it is hovering above.
             * In the future this should be expanded to a more complex algo 
             * where the full spectrum of insertion points is addressed.
             * @todo make this pluggable
             */
            function getInsertionPoint(widget, x, y) {
                // Expand into parent layout
                if (x < 0 || y < 0) { // @todo beyond max size
                    if (parentLayout) {
                        var r1 = plugin.container.getBoundingClientRect();
                        var r2 = parentLayout.container.getBoundingClientRect();
                        
                        return parentLayout.getInsertionPoint(widget, 
                            x + (r1.left - r2.left), y + (r1.top - r2.top));
                    }
                    return false;
                }
                
                // Find widget in this layout
                var targetWidget = getWidgetAtPoint(x, y);
                if (!targetWidget)
                    return false;
                if (targetWidget.widget)
                    return targetWidget; // Which is actually pos
                    
                var target = targetWidget.computed;
                var pos, widgetSize;
                
                // Dive into child layout
                if (targetWidget.innerLayout && targetWidget != widget) {
                    pos = targetWidget.innerLayout.getInsertionPoint(widget, 
                        x - target.left, y - target.top);
                    if (pos)
                        return pos;
                }
                
                pos = { widget: targetWidget, layout: plugin };
                
                var xdiff = x - target.left;
                var ydiff = y - target.top;
                var xfar = target.width / 2 < xdiff ? target.width - xdiff : false;
                var yfar = target.height / 2 < ydiff ? target.height - ydiff : false;
                var xshort = (xfar !== false ? xfar : xdiff) / target.width;
                var yshort = (yfar !== false ? yfar : ydiff) / target.height;
                
                if (xshort < yshort) {
                    pos.width = (target.width - padding) / 2; //widget.computed.width; //
                    pos.height = target.height;
                    pos.width = clip(pos.width, widget.minWidth, widget.maxWidth);
                    pos.height = clip(pos.height, widget.minHeight, widget.maxHeight);
                    pos.isVertical = true;
                    widgetSize = widget.getPreferedSize(pos);
                    if (widgetSize) {
                        pos.width = widgetSize.width || pos.width;
                        pos.height = widgetSize.height || pos.height;
                    }
                    
                    pos.left = xfar === false ? target.left : 
                        target.left + (target.width - pos.width);
                    pos.top = target.top;
                    pos.insertionPoint = xfar === false ? "x0" : "x1";
                }
                else {
                    pos.width = target.width;
                    pos.height = (target.height - padding) / 2; //widget.computed.height; //
                    pos.width = clip(pos.width, widget.minWidth, widget.maxWidth);
                    pos.height = clip(pos.height, widget.minHeight, widget.maxHeight);
                    pos.isVertical = false;
                    widgetSize = widget.getPreferedSize(pos);
                    if (widgetSize) {
                        pos.width = widgetSize.width || pos.width;
                        pos.height = widgetSize.height || pos.height;
                    }
                    
                    pos.left = target.left;
                    pos.top = yfar === false ? target.top : 
                        target.top + (target.height - pos.height);
                    pos.insertionPoint = yfar === false ? "y0" : "y1";
                }
                
                widget.computed.lastDragPosition = pos;
                
                return pos;
            }
            
            function insertWidget(widget, pos) {
                // Remove widget from layout
                if (widget.layout) {
                    var other = widget.layout != plugin && widget.layout;
                    widget.layout.remove(widget);
                    if (other)
                        other.clean();
                }
                
                var args, info;
                var point = pos.insertionPoint;
                
                if (point == "x0") {
                    // Add widget to this column
                    args = [widget, pos.widget.col, 
                        pos.widget.row, 1, pos.widget.rowspan];
                    
                    info = hsplit(pos.widget, pos.width);
                    args[1] = info.col;
                    args[3] = info.colspan;
                }
                else if (point == "x1") {
                    // Add widget to this column
                    args = [widget, pos.widget.col + pos.widget.colspan, 
                        pos.widget.row, 1, pos.widget.rowspan];
                    
                    info = hsplit(pos.widget, pos.width, true);
                    args[1] = info.col;
                    args[3] = info.colspan;
                }
                else if (point == "y0") {
                    // Add widget to this row
                    args = [widget, pos.widget.col, 
                        pos.widget.row, pos.widget.colspan, 1];
                    
                    info = vsplit(pos.widget, pos.height);
                    args[2] = info.row;
                    args[4] = info.rowspan;
                }
                else if (point == "y1") {
                    // Add widget to this row
                    args = [widget, pos.widget.col, pos.widget.row 
                        + pos.widget.rowspan, pos.widget.colspan, 1];
                    
                    info = vsplit(pos.widget, pos.height, true);
                    args[2] = info.row;
                    args[4] = info.rowspan;
                }
                else if (point == "full") {
                    // Add widget to this row
                    args = [widget, pos.widget.col, pos.widget.row, 
                        pos.widget.colspan, pos.widget.rowspan];
                }
                
                // Move dragged widget to it's new location
                moveTo.apply(this, args);
                
                // Remove Unused Columns & Rows
                clean();
                
                schedule(CHANGE_REDRAW);
            }
            
            function vsplit(widget, height, far) {
                var result, start, i;
                
                function innerloop(){
                    if (rows[i].pixels < height) {
                        height -= rows[i].pixels;
                    }
                    else if (rows[i].pixels == height) {
                        if (widget.rowspan == 1) throw new Error();
                        
                        // Move split widget
                        moveTo(widget, widget.col, widget.row + (far ? 0 : 1), 
                            widget.colspan, i - widget.row + (far ? -1 : 1));
                            
                        return { row: i, rowspan: start - i + 1 };
                    }
                    else {
                        // Create a row
                        insertRow(height, i + (far ? 1 : 0), far);
                        
                        // Move split widget
                        moveTo(widget, widget.col, widget.row + (far ? 0 : 1), 
                            widget.colspan, i - widget.row + 1);
                        
                        return { row: i + (far ? 1 : 0), rowspan: start - i + 1 };
                    }
                }
                
                if (far) {
                    // Find Row number and height
                    start = widget.row + widget.rowspan - 1;
                    for (i = start; i >= widget.row; i--) {
                        result = innerloop();
                        if (result) return result;
                    }
                }
                else {
                    // Find Row number and height
                    start = widget.row;
                    for (i = start; i < widget.row + widget.rowspan; i++) {
                        result = innerloop();
                        if (result) return result;
                    }
                }
            }
            
            function hsplit(widget, width, far) {
                var result, start, i;
                
                function innerloop(){
                    if (columns[i].pixels < width) {
                        width -= columns[i].pixels;
                    }
                    else if (columns[i].pixels == width) {
                        if (widget.colspan == 1) throw new Error();
                        
                        // Move split widget
                        moveTo(widget, widget.col + (far ? 0 : 1), widget.row, 
                            i - widget.col + (far ? -1 : 1), widget.rowspan);
                            
                        return { col: i, colspan: start - i + 1 };
                    }
                    else {
                        // Create a col
                        insertColumn(width, i + (far ? 1 : 0), far);
                        
                        // Move split widget
                        moveTo(widget, widget.col + (far ? 0 : 1), widget.row, 
                            i - widget.col + 1, widget.rowspan);
                        
                        return { col: i + (far ? 1 : 0), colspan: start - i + 1 };
                    }
                }
                
                if (far) {
                    // Find Column number and height
                    start = widget.col + widget.colspan - 1;
                    for (i = start; i >= widget.col; i--) {
                        result = innerloop();
                        if (result) return result;
                    }
                }
                else {
                    // Find Column number and height
                    start = widget.col;
                    for (i = start; i < widget.col + widget.colspan; i++) {
                        result = innerloop();
                        if (result) return result;
                    }
                }
            }
            
            function insertColumn(width, index, copyFromLeft) {
                // Add to columns
                columns.splice(index, 0, getRowColEntry(width));
                
                // Move & Resize items
                if (model[index]) {
                    var newcol = [], done = {};
                    model[index - (copyFromLeft ? 1 : 0)].forEach(function(widget) {
                        newcol.push(widget);
                        if (widget && !done[widget.name]) {
                            done[widget.name] = true;
                            widget.colspan++;
                        }
                    });
                    model.splice(index, 0, newcol);
                    
                    // Move all subsequent widgets to column + 1
                    for (var i = index + (copyFromLeft ? 1 : 2); i < model.length; i++) {
                        model[i].forEach(function(widget) {
                            if (widget && !done["s" + widget.name] && widget.col == i - 1) {
                                widget.col++;
                                done["s" + widget.name] = true;
                            }
                        });
                    }
                }
                else {
                    model[index] = [];
                    rows.forEach(function(n, i) {
                        model[index][i] = null;
                    });
                    // @todo expand fill?
                }
                
                schedule(CHANGE_COLUMNS);
            }
            
            function removeColumn(index) {
                var col = model[index];
                
                // Move & Resize items
                if (col.length) {
                    var done = {};
                    col.forEach(function(widget) {
                        if (!widget || done[widget.name]) return;
                        if (widget.colspan == 1)
                            remove(widget);
                        else
                            widget.colspan--;
                        done[widget.name] = true;
                    });
                    
                    // Move all subsequent widgets to column - 1
                    for (var i = index + 1; i < model.length; i++) {
                        model[i].forEach(function(widget) {
                            if (widget && !done["s" + widget.name] && widget.col == i) {
                                widget.col--;
                                done["s" + widget.name] = true;
                            }
                        });
                    }
                }
                
                // Remove from model
                model.splice(index, 1);
                
                // Remove from columns
                columns.splice(index, 1);
                
                schedule(CHANGE_COLUMNS);
            }
            
            function insertRow(height, index, copyFromTop) {
                // Add to rows
                rows.splice(index, 0, getRowColEntry(height));
                
                // Move & Resize items
                var done = {};
                model.forEach(function(col) {
                    var widget = col[index - (copyFromTop ? 1 : 0)];
                    col.splice(index, 0, widget || null);
                    if (widget) {
                        if (!done[widget.name]) {
                            done[widget.name] = true;
                            widget.rowspan++;
                        }
                    }
                    
                    // Move all subsequent widgets to row + 1
                    for (var i = index + (copyFromTop ? 1 : 2); i < col.length; i++) {
                        widget = col[i];
                        if (widget && !done["s" + widget.name] && widget.row == i - 1) {
                            widget.row++;
                            done["s" + widget.name] = true;
                        }
                    }
                });
                
                schedule(CHANGE_ROWS);
            }
            
            function removeRow(index) {
                // Move & Resize items
                var done = {};
                model.forEach(function(col) {
                    var widget = col[index];
                    if (widget) {
                        if (!done[widget.name]){
                            if (widget.rowspan == 1)
                                remove(widget);
                            else
                                widget.rowspan--;
                            done[widget.name] = true;
                        }
                    }
                    
                    // Move all subsequent widgets to row + 1
                    for (var i = index + 1; i < col.length; i++) {
                        widget = col[i];
                        if (widget && !done["s" + widget.name] && widget.row == i) {
                            widget.row--;
                            done["s" + widget.name] = true;
                        }
                    }
                        
                    // Remove from model
                    col.splice(index, 1);
                });
                
                // Remove from rows
                rows.splice(index, 1);
                
                schedule(CHANGE_ROWS);
            }
            
            function merge(name, indexFrom, indexTo) {
                var defSet = name == "columns" ? columns : rows;
                
                var from = defSet[indexFrom];
                var to = defSet[indexTo];
                
                // Keep pixels
                if (to.pixels && from.pixels) {
                    to.pixels += from.pixels + padding;
                }
                // Keep flex
                else if (to.flex || from.flex) {
                    // Simple case, both have flex
                    if (to.flex && from.flex)
                        to.flex += from.flex;
                    else {
                        var flex = defSet.filter(function(n){ return n.flex });
                        
                        if (!to.flex) {
                            delete to.pixels;
                            delete to.percentage;
                        }
                        
                        // There is only 1 flex item (so missing px/% 
                        // will be moved to this one automatically)
                        if (flex.length === 1) {
                            if (!to.flex)
                                to.flex = from.flex;
                        }
                        // Lets convert the px/% into flex units
                        else {
                            var flextotal = 0;
                            flex.forEach(function(n) { 
                                if (n != to && n != from)
                                    flextotal += n.flex;
                            });
                            // 200,200,200,200: 1,1,1,1
                            // 300,166,166,166: 1.5,0.83,0.83,0.83
                            
                            var f, p, a;
                            if (to.flex)
                                f = to.flex, p = to.computed, a = from.computed;
                            else
                                f = from.flex, p = from.computed, a = to.computed;
                            
                            var newflex = (f / p) * (p + a);
                            var delta = (newflex - f) / flextotal;
                            
                            flex.forEach(function(n) { 
                                if (n != to && n != from)
                                    n.flex -= delta;
                            });
                            
                            to.flex = f + delta;
                        }
                    }
                }
                // Keep percentage
                else if (to.percentage || from.percentage) {
                    if (to.percentage && from.percentage) {
                        to.percentage += from.percentage;
                    }
                    else {
                        // @todo unused right now
                    }
                }
                
                if (name == "columns")
                    removeColumn(indexFrom);
                else
                    removeRow(indexFrom);
            }
            
            function clean(){
                var empty = rows.map(function(){ return true; });
                
                for (var i = model.length - 1; i >= 0; i--) {
                    var col = model[i];
                    var prev = model[i - 1];
                    
                    // Unused columns
                    var unused = prev && col.every(function(n, j) { 
                        // return !n && !prev[j] || n && n.colspan > 1 && n.col != i;
                        return n == prev[j];
                    });
                    if (unused)
                        merge("columns", i, i - 1);
                    
                    // Unused rows
                    col.forEach(function(n, j) {
                        if (!empty[j]) return;
                        
                        // if (n && (n.rowspan == 1 || n.row == j))
                        if (empty[j] && col[j - 1] != n)
                            empty[j] = false;
                        // if (!n && !col[j - 1])
                        //     empty[j] = false;
                    });
                }
                
                // Unused rows
                for (var i = empty.length; i > 0; i--) {
                    if (empty[i])
                        merge("rows", i, i - 1);
                }
            }
            
            function serializeRowCol(m) {
                if (m.pixels)
                    return m.pixels + "px";
                if (m.flex)
                    return m.flex;
                if (m.percentage)
                    return m.percentage + "%";
            }
            
            function getRowColEntry(m) {
                if (typeof m == "number") {
                    // if (m < 0) throw new Error("Invalid column size");
                    return { pixels: m };
                }
                else if (parseFloat(m) == m) // Flex
                    return { flex: parseFloat(m) };
                else if (m.indexOf("%") > -1) // Percentage
                    return { percentage: parseFloat(m) / 100 };
                else if (m.indexOf("px") > -1) // Pixels
                    return { pixels: parseInt(m, 10) };
                else throw new Error("Invalid Row/Column Configuration");
            }
            
            function calculate(changes) {
                renderId++;
                if (renderId > 30000)
                    renderId = 0;
                
                // Get width/height of container
                var width = container.offsetWidth 
                    - edge[1] - edge[3] - ((columns.length - 1) * padding);
                var height = container.offsetHeight 
                    - edge[2] - edge[0] - ((rows.length - 1) * padding);
                
                if (!width || !height) {
                    console.warn("Invalid size of dockable layout");
                    return [];
                }
                
                var flexCols = [], totalCols = 0, totalColFlex = 0;
                var flexRows = [], totalRows = 0, totalRowFlex = 0;
                
                // Calc width of each col
                var col;
                for (var i = 0; i < columns.length; i++) {
                    col = columns[i];
                    if (col.flex) {
                        flexCols.push(col);
                        totalColFlex += col.flex;
                    }
                    else {
                        col.computed = col.pixels || col.percentage * width;
                        totalCols += col.computed;
                    }
                }
                flexCols.forEach(function(col) {
                    col.computed = (width - totalCols) / totalColFlex * col.flex;
                });
                
                // Calc height of each row
                var row;
                for (var i = 0; i < rows.length; i++) {
                    row = rows[i];
                    if (row.flex) {
                        flexRows.push(row);
                        totalRowFlex += row.flex;
                    }
                    else {
                        row.computed = row.pixels || row.percentage * height;
                        totalRows += row.computed;
                    }
                }
                flexRows.forEach(function(row) {
                    row.computed = (height - totalRows) / totalRowFlex * row.flex;
                });
                
                var changed = [];
                
                // Loop over elements and calc new width/height, left/top
                var curwidth = edge[3];
                var widget, computed, curheight, wchanged, hasChanges;
                for (var i = 0, li = model.length; i < li; i++) {
                    col = model[i];
                    curheight = edge[0];
                    if (i > 0)
                        curwidth += padding;
                    
                    for (var k, j = 0, lj = col.length; j < lj; j++) {
                        widget = col[j];
                        computed = widget && widget.computed;
                        
                        if (!computed || computed.renderId == renderId) {
                            curheight += (computed 
                                ? computed.height 
                                : rows[j].computed) + padding;
                            continue;
                        }
                        computed.renderId = renderId;

                        if (changes & CHANGE_INIT) {
                            computed.left = 
                            computed.top = 
                            computed.width = 
                            computed.height = null;
                        }
                        
                        wchanged = { widget: widget };
                        hasChanges = false;
                        
                        if (computed.left != curwidth) {
                            wchanged.left = computed.left = curwidth;
                            hasChanges = true;
                        }

                        if (computed.top != curheight) {
                            wchanged.top = computed.top = curheight;
                            hasChanges = true;
                        }
                        
                        if (changes & CHANGE_COLUMNS) {
                            width = 0;
                            for (k = 0; k < widget.colspan; k++) {
                                width += columns[i + k].computed 
                                    + (k > 0 ? padding : 0);
                            }
                            
                            if (computed.width != width) {
                                wchanged.width = computed.width = width;
                                hasChanges = true;
                            }
                        }
                        
                        height = 0;
                        for (k = 0; k < widget.rowspan; k++) {
                            height += rows[j + k].computed
                                + (k > 0 ? padding : 0);
                        }
                        j += k - 1; //Lets skip the next row items
                            
                        if (changes & CHANGE_ROWS) {
                            if (computed.height != height) {
                                wchanged.height = computed.height = height;
                                hasChanges = true;
                            }
                        }
                        
                        if (hasChanges)
                            changed.push(wchanged);
                        
                        curheight += height + padding;
                    }
                    
                    curwidth += columns[i].computed;
                }
                
                return changed;
            }
            
            function render(changeset) {
                renderer.render(changeset, plugin);
            }
            
            function add(widget, col, row, colspan, rowspan) {
                widget.row = row;
                widget.col = col;
                widget.rowspan = rowspan || (rowspan = 1);
                widget.colspan = colspan || (colspan = 1);
                widget.layout = plugin;
                
                if (widgets.indexOf(widget) == -1)
                    widgets.push(widget);
                
                var rowindex, colindex;
                
                for (var i = 0; i < colspan; i++) {
                    colindex = col + i;
                    
                    var colset = model[colindex];
                    if (!colset)
                        colset = model[colindex] = [];
                    
                    for (var j = 0; j < rowspan; j++) {
                        rowindex = row + j;
                        
                        if (colset[rowindex]) {
                            var w = colset[rowindex];
                            throw new Error("Conflict occurred adding widget to col: "
                                + colindex + " and row: " + rowindex 
                                + ". The following widget is already there, col: " + w.col
                                + " row: " + w.row);
                        }
                        
                        colset[rowindex] = widget;
                    }
                }
                
                schedule(CHANGE_REDRAW);
            }
            
            function moveTo(widget, col, row, colspan, rowspan) {
                if (widget.layout) {
                    if (widget.layout != plugin)
                        throw new Error("Moving a widget that is not first added to this layout.");
                    remove(widget);
                }
                
                add(widget, col, row, colspan, rowspan);
            }
            
            function isEmptyCol(col, widget) {
                var c = model[col];
                for (var i = widget.row; i < widget.row + widget.rowspan; i++) {
                    if (c[i] && c[i] != widget) return false;
                }
                return true;
            }
            
            function isEmptyRow(row, widget) {
                for (var i = widget.col; i < widget.col + widget.colspan; i++) {
                    if (model[i][row] && model[i][row] != widget) return false;
                }
                return true;
            }
            
            function resizeTo(widget, width, fromLeft, height, fromTop) {
                var delta, shrink, shrinkOther, insertIndex,copyFromTop;
                var copyFromLeft, snap;
                
                width = getRowColEntry(width);
                height = getRowColEntry(height);
                
                width.pixels = clip(width.pixels, widget.minWidth, widget.maxWidth);
                height.pixels = clip(height.pixels, widget.minHeight, widget.maxHeight);
                
                // Find the right column / size
                var i, l, size, total = 0, collission = false;
                if (fromLeft) {
                    for (i = widget.col + widget.colspan - 1; i >= 0; i--) {
                        size = columns[i].computed;
                        
                        if (total + size > width.pixels
                          || (collission = !isEmptyCol(i, widget)))
                            break;
                        
                        total += size + padding;
                    }
                }
                else {
                    for (i = widget.col, l = columns.length; i < l; i++) {
                        size = columns[i].computed;
                        
                        if (total + size > width.pixels 
                          || (collission = !isEmptyCol(i, widget)))
                            break;
                        
                        total += size + padding;
                    }
                }
                
                // Move to column
                delta = width.pixels - total + padding;
                snap = !delta;
                shrinkOther = fromLeft && widget.computed.width > width.pixels;
                
                var col, colspan;
                if (collission) {
                    // Resize current row
                    curcol = columns[i - (fromTop ? -1 : 1)];
                    if (curcol && curcol.pixels)
                        curcol.pixels += delta;
                    else {
                        // @todo
                    }
                }
                else if (!snap) {
                    var curcol = columns[i];
                    if (curcol && curcol.pixels)
                        curcol.pixels -= delta;
                    
                    insertIndex = i + (fromLeft || i > 0 && shrink ? 1 : 0);
                    copyFromLeft = fromLeft && width.pixels < widget.computed.width 
                        || !fromLeft && width.pixels > widget.computed.width;
                    insertColumn(width.pixels - total, insertIndex, copyFromLeft);
                    
                    col = fromLeft ? i + 1 : widget.col;
                    colspan = fromLeft 
                        ? widget.col + widget.colspan - i - 1 
                        : i - widget.col + 1;
                    moveTo(widget, col, widget.row, colspan, widget.rowspan);
                }
                // Snap
                else {
                    col = fromLeft ? i + 1 : widget.col;
                    colspan = fromLeft 
                        ? widget.col + widget.colspan - i - 1
                        : i - col;
                    moveTo(widget, col, widget.row, colspan, widget.rowspan);
                }
                
                // Find the right row / size
                total = 0;
                collission = false;
                if (fromTop) {
                    for (i = widget.row + widget.rowspan - 1; i >= 0; i--) {
                        size = rows[i].computed;
                        
                        if (total + size > height.pixels
                          || (collission = !isEmptyRow(i, widget)))
                            break;
                        
                        total += size + padding;
                    }
                }
                else {
                    for (i = widget.row, l = rows.length; i < l; i++) {
                        size = rows[i].computed;
                        
                        if (total + size > height.pixels
                          || (collission = !isEmptyRow(i, widget)))
                            break;
                        
                        total += size + padding;
                    }
                }
                
                // Move to row
                delta = height.pixels - total + padding;
                shrinkOther = fromTop && widget.computed.height > height.pixels;
                
                var row, rowspan;
                if (collission) {
                    // Resize current row
                    currow = rows[i - (fromTop ? -1 : 1)];
                    if (currow && currow.pixels)
                        currow.pixels += delta;
                    else {
                        // @todo
                    }
                }
                else if (delta) {
                    var currow = rows[i];
                    if (currow && currow.pixels)
                        currow.pixels -= delta;
                    
                    insertIndex = i + (fromTop || i > 0 && shrink ? 1 : 0);
                    copyFromTop = fromTop && height.pixels < widget.computed.height 
                        || !fromTop && height.pixels > widget.computed.height;
                    insertRow(height.pixels - total, insertIndex, copyFromTop);
                    
                    row = fromTop ? i + 1 : widget.row;
                    rowspan = fromTop 
                        ? widget.row + widget.rowspan - i - 1
                        : i - widget.row + 1;
                    moveTo(widget, widget.col, row, widget.colspan, rowspan);
                }
                // Snap
                else {
                    row = fromTop ? i + 1 : widget.row;
                    rowspan = fromTop 
                        ? widget.row + widget.rowspan - i - 1 
                        : i - row;
                    moveTo(widget, widget.col, row, widget.colspan, rowspan);
                }
                
                clean();
            }
            
            function remove(widget, deep) {
                var index = widgets.indexOf(widget);
                if (index === -1)
                    return;
                widgets.splice(index, 1);
                
                var col = widget.col;
                var row = widget.row;
                var colspan = widget.colspan;
                var rowspan = widget.rowspan;
                
                for (var i = 0; i < colspan; i++) {
                    var colset = model[col + i];
                    for (var j = rowspan - 1; j >= 0; j--) {
                        colset[row + j] = null;
                    }
                    // if (deep && colset.length === 0)
                    //     removeColumn(col + i);
                }
                
                widget.computed = { 
                    width: widget.computed.width, 
                    height: widget.computed.height 
                };
                widget.layout = null;
                
                schedule(CHANGE_REDRAW);
            }
            
            function getState(){
                var state = {};
                widgets.forEach(function(w) {
                    state[w.name] = w.getState();
                });
                
                state.columns = columns.map(serializeRowCol).join(",");
                state.rows = rows.map(serializeRowCol).join(",");
                
                return state;
            }
            
            function setState(state) {
                plugin.columns = state.columns;
                plugin.rows = state.rows;
                
                widgets.forEach(function(w) {
                    if (state[w.name]) {
                        w.setState(state[w.name]);
                        add(w, w.col, w.row, w.colspan, w.rowspan);
                    }
                });
                
                schedule(CHANGE_REDRAW);
            }
            
            function getCoords(col, row) {
                if (col > columns.length)
                    col = columns.length - 1;
                if (row > rows.length)
                    row = rows.length - 1;
                
                var y = edge[3];
                for (var i = 0; i < row; i++) y += rows[i].computed;
                y += row * padding;
                y += 1;
                
                var x = edge[0];
                for (var i = 0; i < col; i++) x += columns[i].computed;
                x += row * padding;
                x += 1;
                
                return { x: x, y: y };
            }
            
            function resize(){
                changes = CHANGE_RESIZE;
                applyChanges();
            }
            
            function clip(w, min, max) {
                if (w < min) return min;
                if (w > max) return max;
                return w;
            }
            
            function pause(){
                paused = true;
            }
            
            function resume(){
                paused = false;
                resize();
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
            });
            
            /***** Register and define API *****/
            
            // This is a baseclass
            plugin.freezePublicAPI.baseclass();
            
            /**
             * 
             **/
            plugin.freezePublicAPI({
                get container(){ return container;},
                get paused(){ return paused;},
                
                get children(){ return widgets;},
                
                get columns(){ return columns/* && columns.join(", ")*/; },
                set columns(v) { 
                    columns = String(v).split(/\s*,\s*/).map(function(m) {
                        return getRowColEntry(m);
                    });
                    initModel();
                },
                
                get rows(){ return rows /*&& rows.join(", ")*/; },
                set rows(v) { 
                    rows = String(v).split(/\s*,\s*/).map(function(m) {
                        return getRowColEntry(m);
                    });
                    initModel();
                },
                
                get padding(){ return padding; },
                set padding(v){ padding = parseInt(v, 10); },
                
                get edge(){ return edge; },
                set edge(v){ edge = util.getBox(v); },
                
                get parentLayout(){ return parentLayout; },
                set parentLayout(el){ parentLayout = el; },
                
                /**
                 * 
                 */
                getWidgetAtPoint: getWidgetAtPoint,
                
                /**
                 * 
                 */
                resize: resize,
                
                /**
                 * 
                 */
                attachToParent: attachToParent,
                
                /**
                 * 
                 */
                clean: clean,
                
                /**
                 * 
                 */
                fill: fill,
                
                /**
                 * 
                 */
                getCoords: getCoords,
                
                /**
                 * 
                 */
                getState: getState,
                
                /**
                 * 
                 */
                setState: setState,
                
                /**
                 * 
                 */
                add: add,
                
                /**
                 * 
                 */
                moveTo: moveTo,
                
                /**
                 * 
                 */
                resizeTo: resizeTo,
                
                /**
                 * 
                 */
                remove: remove,
                
                /**
                 * 
                 */
                insertWidget: insertWidget,
                
                /**
                 * 
                 */
                getInsertionPoint: getInsertionPoint,
                
                pause: pause,
                
                resume: resume
            });
            
            return plugin;
        }
        
        function DockableAbsoluteRenderer(){
            var plugin = new Plugin("Ajax.org", main.consumes);
            // var emit = plugin.getEmitter();
            
            var inited = {};
            
            function init(widget, dockLayout) {
                widget.load("plugin" + counter++); // @todo remove after testing
                widget.container.style.position = "absolute";
                dockLayout.container.appendChild(widget.container);
                inited[widget.name] = dockLayout;
            }
            
            function render(changeset, dockLayout) {
                var change, widget, html;
                for (var i = 0; i < changeset.length; i++) {
                    change = changeset[i];
                    widget = change.widget;
                    html = widget.container;
                    
                    if (!inited[widget.name] 
                      || dockLayout.container != widget.container.parentNode) // Detect layout moving
                        init(widget, dockLayout);
                    
                    if (change.left !== undefined)
                        html.style.left = change.left + "px";
                    if (change.top !== undefined)
                        html.style.top = change.top + "px";
                    if (change.width !== undefined)
                        html.style.width = change.width + "px";
                    if (change.height !== undefined)
                        html.style.height = change.height + "px";
                    
                    widget.resize(change);
                }
            }
            
            /**
             * 
             **/
            plugin.freezePublicAPI({
                /**
                 * 
                 */
                render: render
            });
            
            plugin.load("DockRenderer" + counter++);
            
            return plugin;
        }
        
        var CURSOR = {
            "s"  : "ns-resize",
            "n"  : "ns-resize",
            "w"  : "ew-resize",
            "e"  : "ew-resize",
            "ne" : "nesw-resize",
            "nw" : "nwse-resize",
            "se" : "nwse-resize",
            "sw" : "nesw-resize"
        }
        
        function DockableWidget(developer, deps) {
            var plugin = new Plugin(developer, deps);
            var emit = plugin.getEmitter();
            
            var computed = {};
            var row, col, rowspan, colspan, container, handle, layout;
            var innerLayout;
            
            var draggable = true;
            var resizable = true;
            
            var EDGE_SIZE = 10;
            
            var loaded = false;
            function load() {
                if (loaded) return false;
                loaded = true;
            }
            
            function setDragHandle(c, h) {
                if (c)
                    container = c;
                else {
                    container = document.createElement("div");
                    container.style.boxSizing = "border-box";
                }
                
                if (typeof h == "string")
                    h = c.querySelector(h);
                
                handle = h || container;
                handle.decorated = plugin;
                
                event.addListener(container, "mousedown", function(e) {
                    if (layout.paused) return;
                    
                    var edge = detectEdge(e);
                    if (edge && resizable)
                        startResize(e, edge);
                    event.stopEvent(e);
                });
                    
                event.addListener(handle, "mousedown", function(e) {
                    if (layout.paused) return;
                    
                    var edge = detectEdge(e);
                    if ((!edge || !resizable) && draggable)
                        startDragWatch(e);
                    event.stopEvent(e);
                });
                
                event.addListener(container, "mousemove", function(e) {
                    if (layout.paused) return;
                    
                    if (!plugin.innerLayout) {
                        var edge = detectEdge(e);
                        var cursor = edge ? CURSOR[edge] : "default";
                        container.style.cursor = cursor;
                        
                        setGlobalCursor(edge ? cursor : false);
                    }
                });
                event.addListener(container, "mouseout", function(e) {
                    if (layout.paused) return;
                    
                    if (e.currentTarget == container && !plugin.innerLayout) {
                        setGlobalCursor(false);
                        container.style.cursor = "";
                    }
                });
            }
            
            /***** Methods *****/
            
            function resize(e) {
                emit("resize", e);
            }
            
            function getPosition() {
                return {row: row, col: col, rowspan: rowspan, colspan: colspan};
            }
            
            function getPreferedSize(availablePos) {
                if (this.computePreferredSize)
                    return this.computePreferredSize(availablePos);
            }
            
            function isEdge(value){ return value >= 0 && value < EDGE_SIZE; }
            function detectEdge(e) {
                var rect = container.getBoundingClientRect();
                var hor = "", ver = "";
                
                if (isEdge(e.clientX - rect.left))
                    hor = "w";
                else if (isEdge(rect.left + rect.width - e.clientX))
                    hor = "e";
                if (isEdge(e.clientY - rect.top))
                    ver = "n";
                else if (isEdge(rect.top + rect.height - e.clientY))
                    ver = "s";
                
                return hor || ver ? ver + hor : false;
            }
            
            function startResize(e, edge) {
                var el = container;
                var drag = getDragOverlay();
                
                // Set Top
                drag.style.zIndex = 1000000;
                drag.className = "drag resize";
                
                var offsetX = e.clientX - (parseInt(container.style.left, 10) || 0);
                var offsetY = e.clientY - (parseInt(container.style.top, 10) || 0);
                var moved = false;
                var startX = e.clientX - offsetX;
                var startY = e.clientY - offsetY;
                
                var rect = layout.container.getBoundingClientRect();
                var parentLeft = rect.left;
                var parentTop = rect.top;
                var startWidth = container.offsetWidth;
                var startHeight = container.offsetHeight;
                
                drag.style.left = (startX + parentLeft) + "px";
                drag.style.top = (startY + parentTop) + "px";
                drag.style.width = startWidth + "px";
                drag.style.height = startHeight + "px";
                
                var sizes = { v: layout.rows, h: layout.columns };
                var margin = layout.edge;
                var padding = layout.padding;
                var SNAP_DIST = 20;
                
                function findSnapPos(pos, dir, side) {
                    var snapPos = margin[dir === "v" ? 0 : 3];
                    var rows = sizes[dir];
                    for (var i = 0; i <= rows.length; i++) {
                        if (side > 0 && i > 1)
                            snapPos += padding;
                        if (Math.abs(pos - snapPos) < SNAP_DIST)
                            return snapPos;
                        snapPos += rows[i] && rows[i].computed;
                        if (side < 0)
                            snapPos += padding;
                    }
                    return pos;
                }
                
                event.capture(el, function(e) {
                    var snapToGrid = !e.ctrlKey && !e.altKey && !e.metaKey;
                    var x = e.clientX - offsetX;
                    var y = e.clientY - offsetY;
                    
                    if (!moved && Math.abs(x - startX) + Math.abs(y - startY) > 5)
                        moved = true;
                    
                    if (edge.indexOf("w") > -1) {
                        if (snapToGrid)
                            x = findSnapPos(x, "h", -1);
                        drag.style.left = (x + parentLeft) + "px";
                        drag.style.width = (startWidth + (startX - x)) + "px";
                    }
                    else if (edge.indexOf("e") > -1) {
                        var left = startX + parentLeft;
                        var w = startWidth + (x - startX);
                        if (snapToGrid)
                            w = findSnapPos(w + startX, "h", 1) - startX;
                        drag.style.left = left + "px";
                        drag.style.width = w + "px";
                    }
                    
                    if (edge.indexOf("n") > -1) {
                        if (snapToGrid)
                            y = findSnapPos(y, "v", -1);
                        drag.style.top = (y + parentTop) + "px";
                        drag.style.height = (startHeight + (startY - y)) + "px";
                    }
                    else if (edge.indexOf("s") > -1) {
                        var top = startY + parentTop;
                        var h = startHeight + (y - startY);
                        if (snapToGrid)
                            h = findSnapPos(h + startY, "v", 1) - startY;
                        drag.style.top = top + "px";
                        drag.style.height = h + "px";
                    }
                    
                    drag.style.display = "block";
                }, function() {
                    if (moved)
                        layout.resizeTo(plugin, 
                            drag.offsetWidth, edge.indexOf("w") > -1, 
                            drag.offsetHeight, edge.indexOf("n") > -1);
                    
                    
                    drag.style.zIndex = "";
                    drag.style.display = "none";
                });
                
                event.stopEvent(e);
            }
            
            function startDragWatch(e) {
                var el = handle || container;
                var drag = getDragOverlay();
                
                // Set Top
                drag.style.zIndex = 1000000;
                
                var lastLayout = layout;
                var rect = lastLayout.container.getBoundingClientRect();
                var baseX = rect.left;
                var baseY = rect.top;
                
                var parentLeft = rect.left;
                var parentTop = rect.top;
                
                var offsetX = e.clientX - (parseInt(container.style.left, 10) || 0);
                var offsetY = e.clientY - (parseInt(container.style.top, 10) || 0);
                var moved = false;
                var startX = e.clientX - offsetX;
                var startY = e.clientY - offsetY;
                
                var startWidth = container.offsetWidth;
                var startHeight = container.offsetHeight;
                
                var lastPos;
                event.capture(el, function(e) {
                    var x = e.clientX - offsetX;
                    var y = e.clientY - offsetY;
                    
                    if (!moved && Math.abs(x - startX) + Math.abs(y - startY) > 5)
                        moved = true;
                    
                    var pos = lastLayout.getInsertionPoint(plugin, 
                        e.clientX - baseX, e.clientY - baseY) || lastPos;
                    lastPos = pos;
                    
                    if (!pos) return;
                    
                    if (pos.widget == plugin) {
                        drag.className = "drag";
                        drag.style.left = (x + parentLeft) + "px";
                        drag.style.top = (y + parentTop) + "px";
                        drag.style.width = startWidth + "px";
                        drag.style.height = startHeight + "px";
                    }
                    else {
                        if (lastLayout != pos.layout) {
                            lastLayout = pos.layout;
                            var rect = lastLayout.container.getBoundingClientRect();
                            baseX = rect.left;
                            baseY = rect.top;
                        }
                        
                        drag.className = "drag " + pos.insertionPoint;
                        drag.style.left = (baseX + pos.left) + "px";
                        drag.style.top = (baseY + pos.top) + "px";
                        drag.style.width = pos.width + "px";
                        drag.style.height = pos.height + "px";
                    }
                    
                    drag.style.display = "block";
                }, function() {
                    if (moved && lastPos.widget != plugin)
                        lastPos.layout.insertWidget(plugin, lastPos);
                    
                    drag.style.zIndex = "";
                    drag.style.display = "none";
                });
                
                event.stopEvent(e);
            }
            
            var dragOverlay;
            function getDragOverlay(){
                if (!dragOverlay) {
                    var el = document.createElement("div");
                    el.className = "drag";
                    document.body.appendChild(el);
                    
                    dragOverlay = el;
                }
                
                dragOverlay.style.width = container.offsetWidth + "px";
                dragOverlay.style.height = container.offsetHeight + "px";
                dragOverlay.style.display = "none";
                
                return dragOverlay;
            }
            
            function getState(){
                return {
                    col: col,
                    row: row,
                    colspan: colspan,
                    rowspan: rowspan
                }
            }
            
            function setState(state) {
                col = state.col;
                row = state.row;
                colspan = state.colspan;
                rowspan = state.rowspan;
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
            });
            
            /***** Register and define API *****/
            
            // This is a baseclass
            plugin.freezePublicAPI.baseclass();
            
            /**
             * 
             **/
            plugin.freezePublicAPI({
                get layout(){ return layout; },
                set layout(el) { 
                    layout = el; 
                    if (innerLayout)
                        innerLayout.parentLayout = layout;
                },
                
                get innerLayout(){ return innerLayout; },
                set innerLayout(el) { 
                    innerLayout = el;
                    innerLayout.parentLayout = layout;
                },
                
                get container(){ return container; },
                get handle(){ return handle || container; },
                
                get row(){ return row; },
                set row(v){ row = v; },
                
                get col(){ return col; },
                set col(v){ col = v; },
                
                get rowspan(){ return rowspan; },
                set rowspan(v){ rowspan = v; },
                
                get colspan(){ return colspan; },
                set colspan(v){ colspan = v; },
                
                get computed(){ return computed; },
                set computed(v){ computed = v; },
                
                get draggable(){ return draggable; },
                set draggable(v){ draggable = v; },
                
                get resizable(){ return resizable; },
                set resizable(v){ resizable = v; },
                
                _events: [
                    /**
                     * @event draw
                     */
                    "draw",
                    
                    /**
                     * 
                     */
                    "resize"
                ],
                
                /**
                 * 
                 */
                getState: getState,
                
                /**
                 * 
                 */
                setState: setState,
                
                /**
                 * 
                 */
                startDragWatch: startDragWatch,
                
                /**
                 * 
                 */
                setDragHandle: setDragHandle,
                
                /**
                 * 
                 */
                getPosition: getPosition,
                
                /**
                 * 
                 */
                getPreferedSize: getPreferedSize,
                
                /**
                 * 
                 */
                resize: resize
            });
            
            return plugin;
        }
        
        var setGlobalCursor = (function(){
            var done = {};
            var sheet;
            
            return function(cursor) {
                if (!sheet) {
                    var style = document.createElement("style");
                    style.appendChild(document.createTextNode(""));
                    document.head.appendChild(style);
                    sheet = style.sheet;
                }
                
                if (cursor) {
                    if (!done[cursor]) {
                        sheet.addRule("." + cursor + " *", "cursor:" + cursor + " !important;", 0);
                        done[cursor] = true;
                    }
                    
                    document.body.className = cursor;
                }
                else {
                    document.body.className = "";
                }
            }
        })();
        
        register(null, {
            DockableLayout: DockableLayout,
            DockableWidget: DockableWidget,
            DockableAbsoluteRenderer: DockableAbsoluteRenderer
        });
    }
});