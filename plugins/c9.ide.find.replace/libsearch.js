/*global apf*/

define(function(require, exports, module) {

var prefix = "state/search-history/";
var TextMode = require("ace/mode/text").Mode;
var HashHandler = require("ace/keyboard/hash_handler").HashHandler;

module.exports = function(settings, execFind, toggleDialog, restore, toggleOption, resizeBox) {
    return {
        keyStroke: "",
        addSearchKeyboardHandler: function(txtFind, type) {
            var _self = this;
            txtFind.ace.saveHistory = function() {
                _self.saveHistory(this.getValue(), this.session.listName);
            };
    
            txtFind.ace.session.listName = type;
            var iSearchHandler = new HashHandler();
            iSearchHandler.bindKeys({
                "Up": function(codebox) {
                    if (codebox.getCursorPosition().row > 0)
                        return false;
    
                    _self.navigateList("next", codebox);
                    codebox.selection.moveCursorFileStart();
                    codebox.selection.clearSelection();
                },
                "Down": function(codebox) {
                    if (codebox.getCursorPosition().row < codebox.session.getLength() - 1)
                        return false;
    
                    _self.navigateList("prev", codebox);
                    codebox.selection.lead.row = codebox.session.getLength() - 1;
                },
                "Ctrl-Home": function(codebox) { _self.navigateList("first", codebox); },
                "Ctrl-End": function(codebox) { _self.navigateList("last", codebox); },
                "Esc": function() { toggleDialog(-1); },
                "Shift-Esc": function() { restore(); },
                "Ctrl-Return|Alt-Return": function(codebox) { codebox.insert("\n"); },
                "Return": function(codebox) {
                    execFind(false, true);
                },
                "Shift-Return": function(codebox) {
                    execFind(true, true);
                }
            });
            
            function optionCommand(name, key) {
                return {
                    bindKey: {
                        mac: key.replace(/^|\|/g, "$&Ctrl-Option-"),
                        win: key.replace(/^|\|/g, "$&Alt-")
                    },
                    name: name,
                    exec: toggleOption
                };
            }
            
            toggleOption && iSearchHandler.addCommands([
                optionCommand("regex", "r"),
                optionCommand("matchCase", "i|c"),
                optionCommand("wholeWords", "w|b"),
                optionCommand("preserveCase", "a")
            ]);
            
            iSearchHandler.handleKeyboard = function(data, hashId, keyString, keyCode) {
                if (keyString == "\x00")
                    return;
                var command = this.findKeyCommand(hashId, keyString);
                var editor = data.editor;
                if (!command)
                    return;
    
                var success = editor.execCommand(command);
                if (success !== false)
                    return { command: "null" };
            };
            txtFind.ace.setKeyboardHandler(iSearchHandler);
            return iSearchHandler;
        },
    
        navigateList: function(type, codebox) {
            var listName = codebox.session.listName;
            var lines = settings.getJson(prefix + listName) || [];
    
            var value = codebox.getValue();
            if (value && (this.position == -1 || lines[this.position] != value)) {
                lines = this.saveHistory(value, listName);
                this.position = 0;
            }
            
            if (this.position === undefined)
                this.position = -1;
    
            var next;
            if (type == "prev") {
                next = Math.max(0, this.position - 1);
                if (this.position <= 0)
                    next = -1;

            }
            else if (type == "next")
                next = Math.min(lines.length - 1, this.position + 1);
            else if (type == "last")
                next = Math.max(lines.length - 1, 0);
            else if (type == "first")
                next = 0;
    
            if (next in lines && next != this.position || next == -1) {
                this.keyStroke = type;
                codebox.setValue(lines[next] || "", true);
                this.keyStroke = "";
                this.position = next;
            }
        },
    
        saveHistory: function(searchTxt, listName) {
            var json = settings.getJson(prefix + listName) || [];
    
            if (searchTxt && json[0] != searchTxt) {
                json.unshift(searchTxt);
                if (json.length > 200)
                    json.splice(200, json.length);
                settings.setJson(prefix + listName, json);
            }
    
            return json;
        },
    
        checkRegExp: function(txtFind, tooltip, win) {
            var searchTxt = txtFind.getValue();
            try {
                new RegExp(searchTxt);
            }
            catch (e) {
                tooltip.$ext.textContent = e.message.replace(": /" + searchTxt + "/", "");
                tooltip.$ext.style.opacity = 1;
    
                var pos = apf.getAbsolutePosition(win.$ext);
                tooltip.$ext.style.left = pos[0] + txtFind.getLeft() + "px";
                tooltip.$ext.style.top = (pos[1] - 16) + "px";
    
                this.tooltipTimer = setTimeout(function() {
                    tooltip.$ext.style.display = "block";
                }, 200);
    
                return false;
            }
            clearTimeout(this.tooltipTimer);
            tooltip.$ext.style.display = "none";
    
            return true;
        },
        
        setReplaceFieldMode: function(txtFind, mode) {
            var session = txtFind.ace.session;
            if (session.$modeId == mode)
                return;
            var textMode = new TextMode();
            textMode.$highlightRules = new textMode.HighlightRules();
            var rules = {
                "literal": [
                    { defaultToken: "text" }
                ],
                "jsOnly": [
                    { token: "constant.language.escape", regex: /\$[\d&\$]|\\[\\nrt]/ },
                ],
                "extended": [
                    { token: "constant.language.escape", regex: /\$\$|\\[\\nrt]/ },
                    { token: "string", regex: /\\\d|\$[\d&]/ },
                    { token: "keyword", regex: /\\U/, next: "uppercase" },
                    { token: "keyword", regex: /\\L/, next: "lowercase" },
                    { token: "keyword", regex: /\\E/, next: "start" },
                    { token: "keyword", regex: /\\[ul]/, next: "uppercase" },
                ],
                "uppercase": [
                    { include: "extended" },
                    { defaultToken: "uppercase" }
                ],
                "lowercase": [
                    { include: "extended" },
                    { defaultToken: "lowercase" }
                ]
            };
            
            rules.start = rules[mode] || rules.literal;
            textMode.$highlightRules.$rules = rules;
            textMode.$highlightRules.normalizeRules();
            
            session.setMode(textMode);
            session.$modeId = mode;
        },
        
        setRegexpMode: function(txtFind, isRegexp) {
            var tokenizer = {}, _self = this;
            tokenizer.getLineTokens = isRegexp
                ? function(val) { return { tokens: _self.parseRegExp(val), state: "" }; }
                : function(val) { return { tokens: [{ value: val, type: "text" }], state: "" }; };
    
            txtFind.ace.session.bgTokenizer.tokenizer = tokenizer;
            txtFind.ace.session.bgTokenizer.lines = [];
            txtFind.ace.renderer.updateFull();
    
            if (this.colorsAdded)
                return;
            this.colorsAdded = true;
            require("ace/lib/dom").importCssString("\
                .ace_r_collection {background:#ffc080;color:black}\
                .ace_r_escaped{color:#cb7824}\
                .ace_r_subescaped{background:#dbef5c;color:orange}\
                .ace_r_sub{background:#dbef5c;color:black;}\
                .ace_r_replace{background:#80c0ff;color:black}\
                .ace_r_range{background:#80c0ff;color:black}\
                .ace_r_modifier{background:#80c0ff;color:black}\
                .ace_r_error{background:red;color:white;",
                "ace_regexps"
            );
        },
    
        regexp: {
            alone: { "^": 1, "$": 1, ".": 1 },
            rangeStart: { "+": 1, "*": 1, "?": 1, "{": 1 },
            replace: /^\\[sSwWbBnrd]/,
            searches: /^\((?:\?\:|\?\!|\?|\?\=|\?\<\=)/,
            range: /^([+*?]|\{(\d+,\d+|\d+,?|,?\d+)\})\??|^[$\^]/
        },
    
        // Calculate RegExp Colors
        parseRegExp: function(value) {
            var re = this.regexp;
            var l, t, c, sub = 0, collection = 0;
            var out = [];
            var push = function(text, type) {
                if (typeof text == "number")
                    text = value.substr(0, text);
                out.push(text, type);
                value = value.substr(text.length);
            };
    
            // This could be optimized if needed
            while (value.length) {
                if ((c = value.charAt(0)) == "\\") {
                    // \\ detection
                    if (t = value.match(/^\\\\+/g)) {
                        var odd = ((l = t[0].length) % 2);
                        push(l - odd, sub > 0 ? "subescaped" : "escaped");
                        continue;
                    }
    
                    // Replacement symbols
                    if (t = value.match(re.replace)) {
                        push(t[0], "replace");
                        continue;
                    }
    
                    // \uXXXX
                    if (t = value.match(/^\\(?:(u)\d{0,4}|(x)\d{0,2})/)) {
                        var isError = (t[1] == "u" && t[0].length != 6)
                            || (t[1] == "x" && t[0].length != 4);
                        push(t[0], isError ? "error" : "escaped");
                        continue;
                    }
    
                    // Escaped symbols
                    push(2, "escaped");
                    continue;
                }
    
                if (c == "|") {
                    push(c, "collection");
                    continue;
                }
    
                // Start Sub Matches
                if (c == "(") {
                    sub++;
                    t = value.match(re.searches);
                    if (t) {
                        push(t[0], "sub");
                        continue;
                    }
    
                    push("(", "sub");
                    continue;
                }
    
                // End Sub Matches
                if (c == ")") {
                    if (sub === 0) {
                        push(")", "error");
                    }
                    else {
                        sub--;
                        push(")", "sub");
                    }
                    continue;
                }
    
                // Collections
                if (c == "[") {
                    collection = 1;
    
                    var ct, temp = ["["];
                    for (var i = 1, l = value.length; i < l; i++) {
                        ct = value.charAt(i);
                        temp.push(ct);
                        if (ct == "[")
                            collection++;
                        else if (ct == "]")
                            collection--;
    
                        if (!collection)
                            break;
                    }
    
                    push(temp.join(""), "collection");
                    continue;
                }
    
                if (c == "]" || c == "}") {
                    push(c, sub > 0 ? "sub" : "text");
                    continue;
                }
    
                // Ranges
                if (re.rangeStart[c]) {
                    var m = value.match(re.range);
                    if (!m) {
                        push(c, "text");
                        continue;
                    }
                    push(m[0], "range");
                    // double quantifier is an error
                    m = value.match(re.range);
                    if (m) {
                        push(m[0], "error");
                        continue;
                    }
                    continue;
                }
    
                if (re.alone[c]) {
                    push(c, "replace");
                    if (c == ".")
                        continue;
                    var m = value.match(re.range);
                    if (m)
                        push(m[0], "error");
                    continue;
                }
    
                // Just Text
                push(c, sub > 0 ? "sub" : "text");
            }
    
            // Process out ace token list
            var last = "text", res = [], token = { type: last, value: "" };
            for (var i = 0; i < out.length; i += 2) {
                if (out[i + 1] != last) {
                    token.value && res.push(token);
                    last = out[i + 1];
                    token = { type: "r_" + last, value: "" };
                }
               token.value += out[i];
            }
            token.value && res.push(token);
            return res;
        }
    };
};

});