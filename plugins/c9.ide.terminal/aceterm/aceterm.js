
define(function(require, exports, module) {
    var InputHandler = require("./input");
    var MouseHandler = require("./mouse");
    var Terminal = require("./libterm");
    var ScrollBuffer = require("./scroll_buffer");
    
    
    // Ace
    var dom = require("ace/lib/dom");
    var Range = require("ace/range").Range;
    var AceEditor = require("ace/editor").Editor;
    var EditSession = require("ace/edit_session").EditSession;
    var VirtualRenderer = require("ace/virtual_renderer").VirtualRenderer;
    
    
    // TODO
    var Aceterm = function(w, h, writeCb) {
        var terminal = new Terminal(w, h, writeCb);
        terminal.aceSession = Aceterm.createSession(terminal);
        terminal.monitor = Aceterm.createMonitor(terminal.aceSession);
        return terminal;
    };
    
    Aceterm.createEditor = function(container, theme) {
        // Create Ace editor instance
        var ace = new AceEditor(new VirtualRenderer(container, theme));
        
        ace.setStyle("terminal");
        
        // todo move ace colors to container
        var scroller = ace.renderer.scroller;
        scroller.style.color = "inherit";
        scroller.style.background = "inherit";
        
        ace.setOptions({
            showPrintMargin: false,
            showGutter: false,
            // readOnly: true,
            scrollPastEnd: 0
        });
        
        ace.renderer.setScrollMargin(1, 0);
       
        ace.renderer.on("resize", function(oldSize, renderer) {
            var session = renderer.session;
            if (!session || !session.term)
                return;
            var size = renderer.$size;
            var dh = size.scrollerHeight - oldSize.scrollerHeight;
            if (dh < 0) {
                var oldMaxScrollTop = renderer.layerConfig.maxHeight
                    - oldSize.scrollerHeight + renderer.scrollMargin.v;
                var scrollTop = session.getScrollTop();
                if (scrollTop > oldMaxScrollTop - renderer.layerConfig.lineHeight) {
                    session.setScrollTop(scrollTop - dh);
                }
            }
            var h = ace.renderer.layerConfig.lineHeight;
            if (!h)
                return;
            if (session.resize)
                session.resize();
            
            updateScrollMargin(session.term, ace.renderer, dh);
            
            if (session.getScrollTop() === 0) {
                session.setScrollTop(-1);
            }
            
        });
        
        ace.renderer.on("beforeRender", function() {
            if (ace.session && ace.session.term && ace.session.term.refreshTimer)
                ace.session.term.refreshSync();
        });
        
        // disable spurious copy event from ace
        ace.onCopy = function() {};
        
        // permanently hide hor scrollbar
        ace.renderer.scrollBarH.setVisible(false);
        ace.renderer.scrollBarH.setVisible=function(){};
        
        ace.renderer.setOption("vScrollBarAlwaysVisible", true);
        ace.renderer.scrollBarV.element.style.overflowY = "auto";
        
        initView(ace);
        ace.termInputHandler = new InputHandler(ace);
        ace.termMouseHandler = new MouseHandler(ace);
        
        return ace;
    };
    
    Aceterm.createSession = function(term) {
        var session = new EditSession("");
        session.setScrollTop(-1);
        session.term = term;
        
        term.copyMode = true;
        
        session.doc.getLength = function() {
            if (term.noScrollBack())
                return term.rows;
            return term.rows + term.ybase;
        };
        session.doc.getLine = function(row, newLineChar) {
            if (term.noScrollBack()) {
                row += term.ybase;
            }
            var line = term.lines[row] || [];
            var str = "";
            for (var l = Math.min(line.length, term.cols); l--;)
                if (line[l][1])
                    break;
            for (var i = 0; i <= l; i++) {
                var ch = line[i][1];
                if (ch != "\x00")
                    str += line[i][1] || " ";
            }

            if (newLineChar && !line.wrapped)
                str += newLineChar;

            return str;
        };
        
        session.getLineData = function(row) {
            if (term.noScrollBack()) {
                row += term.ybase;
            }
            return term.lines[row] || [];
        };
        
        session.doc.getLines = function(start, end) {
            var lines = [];
            for (var i = start; i < end; i++) {
                lines.push(this.getLine(i));
            }
            return lines;
        };
        session.doc.$lines = null;
        
        session.doc.getTextRange = function(range) {
            var start = range.start.row;
            var end = range.end.row;
            if (start === end) {
                return this.getLine(start).substring(range.start.column, range.end.column);
            }
            var newLineChar = this.getNewLineCharacter();
            var str = this.getLine(start++, newLineChar).substring(range.start.column);
            while (start < end) {
                str += this.getLine(start++, newLineChar);
            }
            str += this.getLine(end, newLineChar).substring(0, range.end.column);
            return str;
        };
        
        session.doc.getValue = function() {
            return this.getTextRange(new Range(0, 0, this.getLength(), Number.MAX_VALUE));
        };
        
        session.$computeWidth =
        session.getScreenWidth = function () {
            return this.term.cols;
        };
        
        session.doc.insert = function(pos, str) {
            session.send(str);
            return pos;
        };
        session.doc.remove = function(pos) {
            // can be called from ace, ignore
            return pos;
        };
        
        var range = session.selection.getRange();
        range.cursor = range.start = range.end;
        
        var dummyDelta = {action:"insertText", start: range.clone().start, end: range.clone().end, lines:[""]};

        session.on("changeEditor", function(e, session) {
            if (e.oldEditor) {
                if (session.ace == e.oldEditor)
                    session.ace = null;
            }
            if (e.editor) {
                if (session.ace) {
                    console.warn("aceterm session isn't detached");
                }
                session.ace = e.editor;
            }
            if (!session.selectionRange) {
                session.selectionRange = range;
                session.ace.addSelectionMarker(range);
            } else if (session.term) {
                // update scroll position if there was more output while session was detached
                session.term.refreshView(0, 0);
            }
        });
        
        session.term.refreshView = function(start, end) {
            var ace = session.ace;
            if (!ace)
                return;

            var term = session.term;
            var renderer = ace.renderer;

            var cursorRow = Math.max(term.y, 0);
            range.cursor.row = cursorRow;
            var scrollTop = 0;
            var h = ace.renderer.layerConfig.lineHeight;
            if (!term.noScrollBack()) {
                range.cursor.row += term.ybase;
                start += term.ybase;
                end += term.ybase;
                
                scrollTop = term.ybase * h + renderer.scrollMargin.bottom;
                var maxScrollTop = Math.min(session.maxScrollTop, scrollTop);
                if (session.getScrollTop() < (maxScrollTop || 0) - 2 * h)
                    scrollTop = null;
            }
            
            if (ace.$mouseHandler.isMousePressed)
                scrollTop = null;

            if (scrollTop !== null) {
                updateScrollMargin(term, renderer, 0);
                
                session.setScrollTop(scrollTop || -1);
                session.maxScrollTop = scrollTop;
            } else
                renderer.$loop.schedule(renderer.CHANGE_SCROLL);
            
            renderer.updateLines(start, end);
            range.cursor.column = term.x;
            if (scrollTop !== null)
                session.selection.setSelectionRange(range);

            // needed for things like search to work correctly
            session.doc._signal("change", dummyDelta);
        };
        session.term.isRenderPending = function() {
            var ace = session.ace;
            if (!ace)
                return;
            return ace.renderer.$loop.pending;
        };
        session.bgTokenizer.$worker=function(){};
        session.term.on("input", function() {
            if (session.maxScrollTop) {
                session.maxScrollTop = 0;
                session.setScrollTop(Number.MAX_VALUE);
            }
        });
        session.setScrollLeft = function (scrollLeft) {
            if (scrollLeft) {
                this.$scrollLeft = 0;
                this._signal("changeScrollLeft", 0);
            }
        };
    
        session.send = function(str) {
            this.term.send(str);
        };
        
        return session;
    };
    
    Aceterm.createMonitor = function(session) {
        session.term.on("input", function(str) {
            monitor.$lastInput = str;
            var term = session.term;
            if (str === "\r") {
                var row = term.y + term.ybase;
                var command = monitor.getCommand(row);
                if (command) {
                    // wait for \n to know what command was typed
                    term.on("afterWrite", waitForNewLine);
                    term.lines[row].isUserInput = true;
                    monitor.lastCommandRow = row;
                    monitor.$command = monitor.getCommand(monitor.lastCommandRow).trim();
                }
            }
            
            if (str === "\r" && monitor.$command === "clear" || str === "\x0c") //"ctrl-l"
            if (!term.noScrollBack()) {
                term.once("beforeWrite", function fixClear(data) {
                    if (data == "\r\n") {
                        term.once("beforeWrite", fixClear);
                        return "";
                    }
                    var m = /^\u001b\[H\u001b\[K\r\n((?:\u001b\[K\u001b\[1B)+)\u001b\[K\u001b\[H(.*)$/.exec(data);
                    if (!m) return;
                    data = Array(term.rows + 1).join("\r\n") + "\u001b[H" + m[2];
                    return data;
                });
            }
        });
        function waitForNewLine(data) {
             if (data.indexOf("\n") >= 0) {
                session.term.off("afterWrite", waitForNewLine);
                monitor.$command = monitor.getCommand(monitor.lastCommandRow).trim();
             }
        }

        var monitor = {
            lastCommandRow: -1,
            getLastCommand: function() {
                return this.$command;
            },
            getCommand: function(row) {
                
                var line = session.getLine(row);
                var i = line.indexOf("$");
                var command = i == -1 ? "" : line.substr(i + 1);
                return command;
            },
            getLastKey: function() {
                return monitor.$lastInput;
            },
            wasQuitSent: function() {
                return this.$command === "exit"
                    || this.$command === "logout"
                    || this.$lastInput === "\u0004"; // Ctrl-D
            }
        };
        return monitor;
    };
    
    module.exports = Aceterm;
    
    function updateScrollMargin(terminal, renderer, heightDiff) {
        // if (window.updateScrollMargin)
        //     return window.updateScrollMargin.apply(this, arguments);
        var sm = renderer.scrollMargin;
        var cursorRow = Math.max(terminal.y, 0);
        var l = terminal.ybase + terminal.rows - 1;
        var lastEmpty = l;
        while (lastEmpty > cursorRow && terminal.isLineEmpty(terminal.lines[lastEmpty])) {
            lastEmpty--;
        }
        var noScrollbar = terminal.noScrollBack();
        
        var margin = 0;
        var marginTop = 0;
        var marginBottom = 0;
        var oldMargin = sm.bottom || 0;
        var lineHeight = renderer.layerConfig.lineHeight;
        var height = renderer.$size.height - 1;
        margin = height % lineHeight;
        sm.preffered = margin;
        
        var preferTop = lastEmpty < l;
        var prevState = sm.snapToTop || [0, 0, 0, 0];
        var snapToTop = [lastEmpty, terminal.ybase, l, sm.preffered, terminal.y, preferTop];
        sm.snapToTop = snapToTop;
        
        var allowSnap = snapToTop[1] > prevState[1] && (
                snapToTop[4] === 0 || !preferTop && !prevState[5]
            );
        // var scrollTop = terminal.aceSession.maxScrollTop;
        
        if (noScrollbar) {
            marginTop = Math.ceil(sm.preffered / 2);
            marginBottom = sm.preffered - marginTop;
        }
        else if (heightDiff) {
            // TODO this causes cursor to be half visible sometimes
            // if (heightDiff > 0 || !preferTop) {
            //     if (oldMargin < 0) {
            //         oldMargin += heightDiff;
            //         oldMargin = oldMargin % lineHeight;
            //     }
            //     marginBottom = Math.min(margin, oldMargin);
            // } else {
            //     if (oldMargin >= margin - lineHeight) {
            //         oldMargin += heightDiff;
            //         oldMargin = oldMargin % lineHeight;
            //         marginBottom = Math.max(margin - lineHeight, oldMargin);
            //     } else {
            //         marginBottom = Math.min(margin - lineHeight, oldMargin);
            //     }                    
            // }
            marginBottom = Math.min(margin, oldMargin);
        }
        else if (allowSnap) {
            if (preferTop) {
                marginBottom = sm.preffered;
                marginTop = 0;
            } else {
                marginBottom = marginTop = 0;
            }
        }
        else {
            return;
        }
        renderer.setScrollMargin(1 + marginTop, marginBottom);
    }
    
    function initCursor() {
        this.cursorClass = "reverse-video";
        this.getCursorNode = function() {
            if (!this.textLayer.$cur) {
                this.textLayer.$cur =
                    this.textLayer.element.querySelector(".reverse-video");
            }
            
            return this.textLayer.$cur || {};
        };
        this.hideCursor = function() {
            this.isVisible = false;
            dom.addCssClass(this.element, "ace_hidden-cursors");
            this.restartTimer();
        };
    
        this.showCursor = function() {
            this.isVisible = true;
            dom.removeCssClass(this.element, "ace_hidden-cursors");
            this.restartTimer();
        };
    
        this.restartTimer = function() {
            clearInterval(this.intervalId);
            clearTimeout(this.timeoutId);
            
            this.getCursorNode().className = this.cursorClass;
    
            if (!this.blinkInterval || !this.isVisible || !Terminal.cursorBlink)
                return;
    
            this.intervalId = setInterval(function() {
                if (this.renderer.$loop.changes) return;
                var node = this.getCursorNode();
                node.className = node.className ? "" : this.cursorClass;
            }.bind(this), 500);
        };
    
        this.update = function(config) {
            this.config = config;
    
            var pixelPos = this.getPixelPosition(null, true);

            this.restartTimer();

            // cache for textarea and gutter highlight
            this.$pixelPos = pixelPos;
            this.restartTimer();
        };
    }
    
    function initView(ace) {
        initCursor.call(ace.renderer.$cursorLayer);
        ace.renderer.$cursorLayer.renderer = ace.renderer;
        ace.renderer.$cursorLayer.textLayer = ace.renderer.$textLayer;
        
        // allow for 1px of cursor outline
        ace.renderer.content.style.overflow = "visible";
        ace.renderer.$textLayer.element.style.overflow = "visible";
        
        ace.renderer.$textLayer.$renderLine = Aceterm.renderLine;
            
        ace.renderer.$textLayer.$renderLineInner = Aceterm.renderLineInner;
        
        ace.setOption("showPrintMargin", false);
        ace.setOption("highlightActiveLine", false);
    }
    
    Aceterm.renderLine = function(stringBuilder, row, onlyContents, foldLine) {
        if (!onlyContents) {
            stringBuilder.push(
                "<div class='ace_line' style='height:", this.config.lineHeight, "px'>"
            );
        }
        this.$renderLineInner(stringBuilder, row);
    
        if (!onlyContents)
            stringBuilder.push("</div>");
    };
    
    Aceterm.renderLineInner = function(stringBuilder, row) {
        var term = this.session.term;
        if (!term)
            return;
        var fgColor, bgColor, flags;
        var width = term.cols;
        var cursorY = term.y;
        
        if (term.noScrollBack()) {
            row += term.ybase;
        }
        
        cursorY += term.ybase;
        
        
        var line = term.lines[row] || [];
        var out = '';
    
        var x = row === cursorY && term.cursorState && !term.cursorHidden
            ? term.x
            : -1;

        var defAttr = term.defAttr;
        var attr = defAttr;
        for (var i = 0; i < width; i++) {
            var token = line[i] || term.ch;
            var data = token[0];
            var ch = token[1];
    
            if (i === x) data = -1;
    
            if (data !== attr) {
                if (attr !== defAttr)
                    out += '</span>';
                if (data === defAttr) {
                    // do nothing
                } else if (data === -1) {
                    out += '<span class="reverse-video">';
                    this.$cur = null;
                } else {
                    out += '<span style="';

                    bgColor = data & 0x1ff;
                    fgColor = (data >> 9) & 0x1ff;
                    flags = data >> 18;

                    if (flags & 1) {
                        if (this.$fontMetrics.allowBoldFonts)
                            out += 'font-weight:bold;';
                        // see: XTerm*boldColors
                        if (fgColor < 8)
                            fgColor += 8;
                    }

                    if (flags & 2)
                        out += 'text-decoration:underline;';

                    if (bgColor === 256) {
                        if (fgColor !== 257)
                            out += 'color:' + (
                                Terminal.overridenColors[fgColor] ||
                                Terminal.colors[fgColor]
                            ) + ';';
                    } else {
                        out += 'background-color:' + Terminal.colors[bgColor] + ';';
                        if (fgColor !== 257)
                            out += 'color:' + Terminal.colors[fgColor] + ';';
                        out += 'display:inline-block" class="aceterm-line-bg" l="' + i;
                    }
                    out += '">';
                }
            }
    
            
            if (ch <= ' ')
                out += ch == "\x00" ? "" : "\xa0";
            else if (ch == '&')
                out += '&#38;';
            else if (ch == '<')
                out += '&#60;';
            else
                out += ch;
    
            attr = data;
        }
    
        if (attr !== defAttr)
            out += '</span>';
        stringBuilder.push(out);
    };

});