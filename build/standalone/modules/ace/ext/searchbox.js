define("ace/requirejs/text!ace/ext/searchbox.css",[],".ace_search {\n    background-color: #ddd;\n    border: 1px solid #cbcbcb;\n    border-top: 0 none;\n    max-width: 325px;\n    overflow: hidden;\n    margin: 0;\n    padding: 4px;\n    padding-right: 6px;\n    padding-bottom: 0;\n    position: absolute;\n    top: 0px;\n    z-index: 99;\n    white-space: normal;\n}\n.ace_search.left {\n    border-left: 0 none;\n    border-radius: 0px 0px 5px 0px;\n    left: 0;\n}\n.ace_search.right {\n    border-radius: 0px 0px 0px 5px;\n    border-right: 0 none;\n    right: 0;\n}\n\n.ace_search_form, .ace_replace_form {\n    border-radius: 3px;\n    border: 1px solid #cbcbcb;\n    float: left;\n    margin-bottom: 4px;\n    overflow: hidden;\n}\n.ace_search_form.ace_nomatch {\n    outline: 1px solid red;\n}\n\n.ace_search_field {\n    background-color: white;\n    color: black;\n    border-right: 1px solid #cbcbcb;\n    border: 0 none;\n    -webkit-box-sizing: border-box;\n       -moz-box-sizing: border-box;\n            box-sizing: border-box;\n    float: left;\n    height: 22px;\n    outline: 0;\n    padding: 0 7px;\n    width: 214px;\n    margin: 0;\n}\n.ace_searchbtn,\n.ace_replacebtn {\n    background: #fff;\n    border: 0 none;\n    border-left: 1px solid #dcdcdc;\n    cursor: pointer;\n    float: left;\n    height: 22px;\n    margin: 0;\n    position: relative;\n}\n.ace_searchbtn:last-child,\n.ace_replacebtn:last-child {\n    border-top-right-radius: 3px;\n    border-bottom-right-radius: 3px;\n}\n.ace_searchbtn:disabled {\n    background: none;\n    cursor: default;\n}\n.ace_searchbtn {\n    background-position: 50% 50%;\n    background-repeat: no-repeat;\n    width: 27px;\n}\n.ace_searchbtn.prev {\n    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAFCAYAAAB4ka1VAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAADFJREFUeNpiSU1NZUAC/6E0I0yACYskCpsJiySKIiY0SUZk40FyTEgCjGgKwTRAgAEAQJUIPCE+qfkAAAAASUVORK5CYII=);    \n}\n.ace_searchbtn.next {\n    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAFCAYAAAB4ka1VAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAADRJREFUeNpiTE1NZQCC/0DMyIAKwGJMUAYDEo3M/s+EpvM/mkKwCQxYjIeLMaELoLMBAgwAU7UJObTKsvAAAAAASUVORK5CYII=);    \n}\n.ace_searchbtn_close {\n    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAcCAYAAABRVo5BAAAAZ0lEQVR42u2SUQrAMAhDvazn8OjZBilCkYVVxiis8H4CT0VrAJb4WHT3C5xU2a2IQZXJjiQIRMdkEoJ5Q2yMqpfDIo+XY4k6h+YXOyKqTIj5REaxloNAd0xiKmAtsTHqW8sR2W5f7gCu5nWFUpVjZwAAAABJRU5ErkJggg==) no-repeat 50% 0;\n    border-radius: 50%;\n    border: 0 none;\n    color: #656565;\n    cursor: pointer;\n    float: right;\n    font: 16px/16px Arial;\n    height: 14px;\n    margin: 5px 1px 9px 5px;\n    padding: 0;\n    text-align: center;\n    width: 14px;\n}\n.ace_searchbtn_close:hover {\n    background-color: #656565;\n    background-position: 50% 100%;\n    color: white;\n}\n.ace_replacebtn.prev {\n    width: 54px\n}\n.ace_replacebtn.next {\n    width: 27px\n}\n\n.ace_button {\n    margin-left: 2px;\n    cursor: pointer;\n    -webkit-user-select: none;\n    -moz-user-select: none;\n    -o-user-select: none;\n    -ms-user-select: none;\n    user-select: none;\n    overflow: hidden;\n    opacity: 0.7;\n    border: 1px solid rgba(100,100,100,0.23);\n    padding: 1px;\n    -moz-box-sizing: border-box;\n    box-sizing:    border-box;\n    color: black;\n}\n\n.ace_button:hover {\n    background-color: #eee;\n    opacity:1;\n}\n.ace_button:active {\n    background-color: #ddd;\n}\n\n.ace_button.checked {\n    border-color: #3399ff;\n    opacity:1;\n}\n\n.ace_search_options{\n    margin-bottom: 3px;\n    text-align: right;\n    -webkit-user-select: none;\n    -moz-user-select: none;\n    -o-user-select: none;\n    -ms-user-select: none;\n    user-select: none;\n}");

define("ace/ext/searchbox",[], function(require, exports, module) {
"use strict";

var dom = require("../lib/dom");
var lang = require("../lib/lang");
var event = require("../lib/event");
var searchboxCss = require("../requirejs/text!./searchbox.css");
var HashHandler = require("../keyboard/hash_handler").HashHandler;
var keyUtil = require("../lib/keys");

dom.importCssString(searchboxCss, "ace_searchbox");

var html = '<div class="ace_search right">\
    <button type="button" action="hide" class="ace_searchbtn_close"></button>\
    <div class="ace_search_form">\
        <input class="ace_search_field" placeholder="Search for" spellcheck="false"></input>\
        <button type="button" action="findNext" class="ace_searchbtn next"></button>\
        <button type="button" action="findPrev" class="ace_searchbtn prev"></button>\
        <button type="button" action="findAll" class="ace_searchbtn" title="Alt-Enter">All</button>\
    </div>\
    <div class="ace_replace_form">\
        <input class="ace_search_field" placeholder="Replace with" spellcheck="false"></input>\
        <button type="button" action="replaceAndFindNext" class="ace_replacebtn">Replace</button>\
        <button type="button" action="replaceAll" class="ace_replacebtn">All</button>\
    </div>\
    <div class="ace_search_options">\
        <span action="toggleRegexpMode" class="ace_button" title="RegExp Search">.*</span>\
        <span action="toggleCaseSensitive" class="ace_button" title="CaseSensitive Search">Aa</span>\
        <span action="toggleWholeWords" class="ace_button" title="Whole Word Search">\\b</span>\
    </div>\
</div>'.replace(/>\s+/g, ">");

var SearchBox = function(editor, range, showReplaceForm) {
    var div = dom.createElement("div");
    div.innerHTML = html;
    this.element = div.firstChild;

    this.$init();
    this.setEditor(editor);
};

(function() {
    this.setEditor = function(editor) {
        editor.searchBox = this;
        editor.container.appendChild(this.element);
        this.editor = editor;
    };

    this.$initElements = function(sb) {
        this.searchBox = sb.querySelector(".ace_search_form");
        this.replaceBox = sb.querySelector(".ace_replace_form");
        this.searchOptions = sb.querySelector(".ace_search_options");
        this.regExpOption = sb.querySelector("[action=toggleRegexpMode]");
        this.caseSensitiveOption = sb.querySelector("[action=toggleCaseSensitive]");
        this.wholeWordOption = sb.querySelector("[action=toggleWholeWords]");
        this.searchInput = this.searchBox.querySelector(".ace_search_field");
        this.replaceInput = this.replaceBox.querySelector(".ace_search_field");
    };
    
    this.$init = function() {
        var sb = this.element;
        
        this.$initElements(sb);
        
        var _this = this;
        event.addListener(sb, "mousedown", function(e) {
            setTimeout(function(){
                _this.activeInput.focus();
            }, 0);
            event.stopPropagation(e);
        });
        event.addListener(sb, "click", function(e) {
            var t = e.target || e.srcElement;
            var action = t.getAttribute("action");
            if (action && _this[action])
                _this[action]();
            else if (_this.$searchBarKb.commands[action])
                _this.$searchBarKb.commands[action].exec(_this);
            event.stopPropagation(e);
        });

        event.addCommandKeyListener(sb, function(e, hashId, keyCode) {
            var keyString = keyUtil.keyCodeToString(keyCode);
            var command = _this.$searchBarKb.findKeyCommand(hashId, keyString);
            if (command && command.exec) {
                command.exec(_this);
                event.stopEvent(e);
            }
        });

        this.$onChange = lang.delayedCall(function() {
            _this.find(false, false);
        });

        event.addListener(this.searchInput, "input", function() {
            _this.$onChange.schedule(20);
        });
        event.addListener(this.searchInput, "focus", function() {
            _this.activeInput = _this.searchInput;
            _this.searchInput.value && _this.highlight();
        });
        event.addListener(this.replaceInput, "focus", function() {
            _this.activeInput = _this.replaceInput;
            _this.searchInput.value && _this.highlight();
        });
    };
    this.$closeSearchBarKb = new HashHandler([{
        bindKey: "Esc",
        name: "closeSearchBar",
        exec: function(editor) {
            editor.searchBox.hide();
        }
    }]);
    this.$searchBarKb = new HashHandler();
    this.$searchBarKb.bindKeys({
        "Ctrl-f|Command-f": function(sb) {
            var isReplace = sb.isReplace = !sb.isReplace;
            sb.replaceBox.style.display = isReplace ? "" : "none";
            sb.searchInput.focus();
        },
        "Ctrl-H|Command-Option-F": function(sb) {
            sb.replaceBox.style.display = "";
            sb.replaceInput.focus();
        },
        "Ctrl-G|Command-G": function(sb) {
            sb.findNext();
        },
        "Ctrl-Shift-G|Command-Shift-G": function(sb) {
            sb.findPrev();
        },
        "esc": function(sb) {
            setTimeout(function() { sb.hide();});
        },
        "Return": function(sb) {
            if (sb.activeInput == sb.replaceInput)
                sb.replace();
            sb.findNext();
        },
        "Shift-Return": function(sb) {
            if (sb.activeInput == sb.replaceInput)
                sb.replace();
            sb.findPrev();
        },
        "Alt-Return": function(sb) {
            if (sb.activeInput == sb.replaceInput)
                sb.replaceAll();
            sb.findAll();
        },
        "Tab": function(sb) {
            (sb.activeInput == sb.replaceInput ? sb.searchInput : sb.replaceInput).focus();
        }
    });

    this.$searchBarKb.addCommands([{
        name: "toggleRegexpMode",
        bindKey: {win: "Alt-R|Alt-/", mac: "Ctrl-Alt-R|Ctrl-Alt-/"},
        exec: function(sb) {
            sb.regExpOption.checked = !sb.regExpOption.checked;
            sb.$syncOptions();
        }
    }, {
        name: "toggleCaseSensitive",
        bindKey: {win: "Alt-C|Alt-I", mac: "Ctrl-Alt-R|Ctrl-Alt-I"},
        exec: function(sb) {
            sb.caseSensitiveOption.checked = !sb.caseSensitiveOption.checked;
            sb.$syncOptions();
        }
    }, {
        name: "toggleWholeWords",
        bindKey: {win: "Alt-B|Alt-W", mac: "Ctrl-Alt-B|Ctrl-Alt-W"},
        exec: function(sb) {
            sb.wholeWordOption.checked = !sb.wholeWordOption.checked;
            sb.$syncOptions();
        }
    }]);

    this.$syncOptions = function() {
        dom.setCssClass(this.regExpOption, "checked", this.regExpOption.checked);
        dom.setCssClass(this.wholeWordOption, "checked", this.wholeWordOption.checked);
        dom.setCssClass(this.caseSensitiveOption, "checked", this.caseSensitiveOption.checked);
        this.find(false, false);
    };

    this.highlight = function(re) {
        this.editor.session.highlight(re || this.editor.$search.$options.re);
        this.editor.renderer.updateBackMarkers()
    };
    this.find = function(skipCurrent, backwards, preventScroll) {
        var range = this.editor.find(this.searchInput.value, {
            skipCurrent: skipCurrent,
            backwards: backwards,
            wrap: true,
            regExp: this.regExpOption.checked,
            caseSensitive: this.caseSensitiveOption.checked,
            wholeWord: this.wholeWordOption.checked,
            preventScroll: preventScroll
        });
        var noMatch = !range && this.searchInput.value;
        dom.setCssClass(this.searchBox, "ace_nomatch", noMatch);
        this.editor._emit("findSearchBox", { match: !noMatch });
        this.highlight();
    };
    this.findNext = function() {
        this.find(true, false);
    };
    this.findPrev = function() {
        this.find(true, true);
    };
    this.findAll = function(){
        var range = this.editor.findAll(this.searchInput.value, {            
            regExp: this.regExpOption.checked,
            caseSensitive: this.caseSensitiveOption.checked,
            wholeWord: this.wholeWordOption.checked
        });
        var noMatch = !range && this.searchInput.value;
        dom.setCssClass(this.searchBox, "ace_nomatch", noMatch);
        this.editor._emit("findSearchBox", { match: !noMatch });
        this.highlight();
        this.hide();
    };
    this.replace = function() {
        if (!this.editor.getReadOnly())
            this.editor.replace(this.replaceInput.value);
    };    
    this.replaceAndFindNext = function() {
        if (!this.editor.getReadOnly()) {
            this.editor.replace(this.replaceInput.value);
            this.findNext()
        }
    };
    this.replaceAll = function() {
        if (!this.editor.getReadOnly())
            this.editor.replaceAll(this.replaceInput.value);
    };

    this.hide = function() {
        this.element.style.display = "none";
        this.editor.keyBinding.removeKeyboardHandler(this.$closeSearchBarKb);
        this.editor.focus();
    };
    this.show = function(value, isReplace) {
        this.element.style.display = "";
        this.replaceBox.style.display = isReplace ? "" : "none";

        this.isReplace = isReplace;

        if (value)
            this.searchInput.value = value;
        
        this.find(false, false, true);
        
        this.searchInput.focus();
        this.searchInput.select();

        this.editor.keyBinding.addKeyboardHandler(this.$closeSearchBarKb);
    };

    this.isFocused = function() {
        var el = document.activeElement;
        return el == this.searchInput || el == this.replaceInput;
    }
}).call(SearchBox.prototype);

exports.SearchBox = SearchBox;

exports.Search = function(editor, isReplace) {
    var sb = editor.searchBox || new SearchBox(editor);
    sb.show(editor.session.getTextRange(), isReplace);
};

});
