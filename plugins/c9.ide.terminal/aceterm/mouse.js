define(function(require, exports, module) {
    var lang = require("ace/lib/lang");
    module.exports = function bindMouse(ace) {
        var pressed = 32;
        var wheelEvent = "mousewheel";
        // mouseup, mousedown, mousewheel
        // left click: ^[[M 3<^[[M#3<
        // mousewheel up: ^[[M`3>
        function sendButton(ev) {
            var term = ace.session.term;
            // get the xterm-style button
            var button = getButton(ev);

            // get mouse coordinates
            var pos = getCoords(ev);
            if (!pos) return;

            sendEvent(button, pos);

            switch (ev.type) {
            case 'mousedown':
                pressed = button;
                break;
            case 'mouseup':
                // keep it at the left
                // button, just in case.
                pressed = 32;
                break;
            case wheelEvent:
                // nothing. don't
                // interfere with
                // `pressed`.
                break;
            }
        }

        // motion example of a left click:
        // ^[[M 3<^[[M@4<^[[M@5<^[[M@6<^[[M@7<^[[M#7<
        function sendMove(ev) {
            var term = ace.session.term;
            var button = pressed;
            var pos = getCoords(ev);
            if (!pos) return;

            // buttons marked as motions
            // are incremented by 32
            button += 32;

            sendEvent(button, pos);
        }

        // encode button and
        // position to characters
        function encode(data, ch) {
            var term = ace.session.term;
            if (!term.utfMouse) {
                if (ch === 255) return data.push(0);
                if (ch > 127) ch = 127;
                data.push(ch);
            }
            else {
                if (ch === 2047) return data.push(0);
                if (ch < 127) {
                    data.push(ch);
                }
                else {
                    if (ch > 2047) ch = 2047;
                    data.push(0xC0 | (ch >> 6));
                    data.push(0x80 | (ch & 0x3F));
                }
            }
        }

        // send a mouse event:
        // regular/utf8: ^[[M Cb Cx Cy
        // urxvt: ^[[ Cb ; Cx ; Cy M
        // sgr: ^[[ Cb ; Cx ; Cy M/m
        // vt300: ^[[ 24(1/3/5)~ [ Cx , Cy ] \r
        // locator: CSI P e ; P b ; P r ; P c ; P p & w
        function sendEvent(button, pos) {
            var term = ace.session.term;
            // term.emit('mouse', {
            //   x: pos.x - 32,
            //   y: pos.x - 32,
            //   button: button
            // });

            if (term.vt300Mouse) {
                // NOTE: Unstable.
                // http://www.vt100.net/docs/vt3xx-gp/chapter15.html
                button &= 3;
                pos.x -= 32;
                pos.y -= 32;
                var data = '\x1b[24';
                if (button === 0) data += '1';
                else if (button === 1) data += '3';
                else if (button === 2) data += '5';
                else if (button === 3) return;
                else data += '0';
                data += '~[' + pos.x + ',' + pos.y + ']\r';
                term.send(data);
                return;
            }

            if (term.decLocator) {
                // NOTE: Unstable.
                button &= 3;
                pos.x -= 32;
                pos.y -= 32;
                if (button === 0) button = 2;
                else if (button === 1) button = 4;
                else if (button === 2) button = 6;
                else if (button === 3) button = 3;
                term.send('\x1b[' + button + ';' + (button === 3 ? 4 : 0) + ';' + pos.y + ';' + pos.x + ';' + (pos.tab || 0) + '&w');
                return;
            }

            if (term.urxvtMouse) {
                pos.x -= 32;
                pos.y -= 32;
                pos.x++;
                pos.y++;
                term.send('\x1b[' + button + ';' + pos.x + ';' + pos.y + 'M');
                return;
            }

            if (term.sgrMouse) {
                pos.x -= 32;
                pos.y -= 32;
                term.send('\x1b[<' + ((button & 3) === 3 ? button & ~3 : button) + ';' + pos.x + ';' + pos.y + ((button & 3) === 3 ? 'm' : 'M'));
                return;
            }

            var data = [];

            encode(data, button);
            encode(data, pos.x);
            encode(data, pos.y);

            term.send('\x1b[M' + String.fromCharCode.apply(String, data));
        }

        function getButton(ev) {
            var term = ace.session.term;
            var button, shift, meta, ctrl, mod;

            // two low bits:
            // 0 = left
            // 1 = middle
            // 2 = right
            // 3 = release
            // wheel up/down:
            // 1, and 2 - with 64 added
            switch (ev.type) {
            case 'mousedown':
                button = ev.button || 0;
                break;
            case 'mouseup':
                button = 3;
                break;
            case 'mousewheel':
                button = ev.wheelY < 0 ? 64 : 65;
                break;
            }

            // next three bits are the modifiers:
            // 4 = shift, 8 = meta, 16 = control
            shift = ev.shiftKey ? 4 : 0;
            meta = ev.metaKey ? 8 : 0;
            ctrl = ev.ctrlKey ? 16 : 0;
            mod = shift | meta | ctrl;

            // no mods
            if (term.vt200Mouse) {
                // ctrl only
                mod &= ctrl;
            }
            else if (!term.normalMouse) {
                mod = 0;
            }

            // increment to SP
            button = (32 + (mod << 2)) + button;

            return button;
        }

        // mouse coordinates measured in cols/rows
        function getCoords(ev) {
            var term = ace.session.term;
            var pos = ace.renderer.pixelToScreenCoordinates(ev.clientX, ev.clientY);

            var x = pos.column, y = pos.row;

            // be sure to avoid sending
            // bad positions to the program
            if (x < 0) x = 0;
            if (x > term.cols) x = term.cols;
            if (y < 0) y = 0;
            if (y > term.rows) y = term.rows;

            // xterm sends raw bytes and
            // starts at 32 (SP) for each.
            x += 32;
            y += 32;

            return {
                x: x,
                y: y,
                down: ev.type === 'mousedown',
                up: ev.type === 'mouseup',
                wheel: ev.type === wheelEvent,
                move: ev.type === 'mousemove'
            };
        }

        function altOnly(e) {
            return e.altKey && !e.shiftKey && !e.metaKey && !e.ctrlKey;
        }
        ace.on('mousedown', function(ev) {
            var term = ace.session.term;
            if (!term || !term.mouseEvents
                || term.copyMode && !altOnly(ev.domEvent)) {
                return;
            }
            ace.focus();
            // send the button
            sendButton(ev);
            // fix for odd bug
            if (term.vt200Mouse) {
                sendButton({ __proto__: ev, type: 'mouseup' });
                return ev.stop();
            }

            // bind events
            if (term.normalMouse) ace.on('mousemove', sendMove);

            // x10 compatibility mode can't send button releases
            if (!term.x10Mouse) {
                ace.on('mouseup', function up(ev) {
                    sendButton(ev);
                    if (term.normalMouse) ace.off('mousemove', sendMove);
                    ace.off('mouseup', up);
                    return ev.stop(ev);
                });
            }

            return ev.stop(ev);
        }, true);

        ace.on("mousewheel", function(ev) {
            var term = ace.session.term;
            if (!term.mouseEvents) return;
            if (term.x10Mouse || term.vt300Mouse || term.decLocator) return;
            ev.type = "mousewheel";
            ev.shiftKey = ev.domEvent.shiftKey;
            ev.metaKey = ev.domEvent.metaKey;
            ev.ctrlKey = ev.domEvent.ctrlKey;
            sendButton(ev);
            return ev.stop();
        }, true);

        // allow mousewheel scrolling in
        // the shell for example
        ace.on("mousewheel", function(ev) {
            var term = ace.session.term;
            if (term.mouseEvents) return;
            if (term.applicationKeypad) {
                term.send(ev.wheelY < 0
                    ? '\x1bOA\x1bOA\x1bOA'
                    : '\x1bOB\x1bOB\x1bOB'
                );
                return ev.stop(ev);
            }
        });

        ace.on("click", function(e) {
            var term = ace.session.term;
            if (term.mouseEvents) return;
            var pos = e.getDocumentPosition();
            if (e.domEvent.altKey && ace.session.selection.isEmpty()) {
                var row = pos.row;
                var wrappedLen = 0;
                var cursorRow = term.ybase + term.y;
                while (row < cursorRow) {
                    var lineData = ace.session.getLineData(row);
                    if (!lineData || !lineData.wrapped)
                        break;
                    wrappedLen -= ace.session.getLine(row).length;
                    row ++;
                }
                while (row > cursorRow) {
                    var lineData = ace.session.getLineData(row - 1);
                    if (!lineData || !lineData.wrapped)
                        break;
                    wrappedLen += ace.session.getLine(row - 1).length;
                    row --;
                }
                
                if (row == cursorRow) {
                    var dx = pos.column + wrappedLen - term.x;
                    if (dx < 0)
                       var str = lang.stringRepeat("\x1b[D", -dx);
                    else
                       var str = lang.stringRepeat("\x1b[C", dx);
                   term.send(str);
                }
            }
        });
    };
});