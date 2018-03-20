define("plugins/c9.ide.scm/blame",[], function(require, exports, module) {

var dom = require("ace/lib/dom");
var event = require("ace/lib/event");
var css = require("text!./blame.css");

function BlameParser(str) {
    this.commits = {};
    this.lines = {};

    this.settingCommitData = false;
    this.currentCommitHash = "";
    this.currentLineNumber = 1;
    if (str) this.parse(str);
}

(function() {
    this.parse = function(blame) {
        var lines = blame.split("\n");
        
        for (var i = 0; i < lines.length; i++) {
            if (lines[i][0] == "\t") {
                this.lines[this.currentLineNumber].code = lines[i].substr(1);
                this.settingCommitData = false;
                this.currentCommitHash = "";
            }
            else {
                var arrLine = lines[i].split(" ");
                if (this.settingCommitData) {
                    this.parseCommitLine(arrLine);
                }
                else if (arrLine[0].length == 40) {
                    this.currentCommitHash = arrLine[0];
                    this.currentLineNumber = arrLine[2];
                    this.lines[arrLine[2]] = {
                        code: "",
                        hash: this.currentCommitHash,
                        originalLine: arrLine[1],
                        finalLine: arrLine[2],
                        numLines: arrLine[3] || -1
                    };
                    if (!this.commits[arrLine[0]]) {
                        this.settingCommitData = true;
                        this.commits[arrLine[0]] = {
                            author: "",
                            authorMail: "",
                            authorTime: "",
                            authorTz: "",
                            committer: "",
                            committerMail: "",
                            committerTime: "",
                            committerTz: "",
                            summary: "",
                            previousHash: "",
                            filename: ""
                        };
                    }
                }
            }
        }
        
        return this;
    },
    this.parseCommitLine = function(lineArr) {
        switch (lineArr[0]) {
            case "author":
                this.commits[this.currentCommitHash].author = lineArr.slice(1).join(" ");
                break;

            case "author-mail":
                this.commits[this.currentCommitHash].authorMail = lineArr[1];
                break;

            case "author-time":
                this.commits[this.currentCommitHash].authorTime = lineArr[1];
                break;

            case "author-tz":
                this.commits[this.currentCommitHash].authorTz = lineArr[1];
                break;

            case "committer":
                this.commits[this.currentCommitHash].committer = lineArr.slice(1).join(" ");
                break;

            case "committer-mail":
                this.commits[this.currentCommitHash].committerMail = lineArr[1];
                break;

            case "committer-time":
                this.commits[this.currentCommitHash].committerTime = lineArr[1];
                break;

            case "committer-tz":
                this.commits[this.currentCommitHash].committerTz = lineArr[1];
                break;

            case "summary":
                this.commits[this.currentCommitHash].summary = lineArr.slice(1).join(" ");
                break;

            case "filename":
                this.commits[this.currentCommitHash].filename = lineArr[1];
                break;

            case "previous":
                this.commits[this.currentCommitHash].previous = lineArr.slice(1).join(" ");
                break;

            default:
                break;
        }
    };
    
    this.getDisplayData = function() {
        var commitData = this.commits;
        var lineData = this.lines;
        var textHash = {}, lastHash = "";
        for (var i in lineData) {
            if (lineData[i].numLines != -1 && lineData[i].hash != lastHash) {
                lastHash = lineData[i].hash;
                var time = new Date(parseInt(commitData[lineData[i].hash].authorTime, 10) * 1000);
                var commit = commitData[lineData[i].hash];
                textHash[i - 1] = {
                    text: commit.author +
                        " \xBB "/* +
                        lineData[i].hash.substr(0, 8),*/,
                    title: commitData[lineData[i].hash].summary,
                    data: lineData[i],
                    commit: commit,
                    time: time
                };
            }
        }
        return textHash;
    };
}).call(BlameParser.prototype);



var BlameGutter = function(editor, blameStr) {
    if (editor.blameGutter)
        return editor.blameGutter;
    
    if (css) {
        dom.importCssString(css, "blameGutter");
        css = "";
    }
    
    this.onMousedown = this.onMousedown.bind(this);
    this.onChangeEditor = this.onChangeEditor.bind(this);
    this.onMousemove = this.onMousemove.bind(this);
    this.onMouseout = this.onMouseout.bind(this);
    
    this.blameData = [];
    if (blameStr)
        this.setData(blameStr);
    
    this.attachToEditor(editor);
};

(function() {
    this.attachToEditor = function(editor) {
        if (this.editor) this.detachFromEditor();
        
        if (!this.session) {
            this.session = editor.session;
            this.session.blameMarker = this;
            this.session.on("changeEditor", this.onChangeEditor);
            
        }
        
        var gutter = editor.renderer.$gutterLayer;
        this.editor = editor;
        editor.blameGutter = this;
        gutter.blameColumn = this;
    
        this.element = dom.createElement("div");
        this.element.className = "ace_layer ace_blame-gutter-layer";
        var parentEl = editor.renderer.$gutter;
        parentEl.appendChild(this.element);
    
        this.resizer = dom.createElement("div");
        this.resizer.className = "ace_resizer_v";
        parentEl.appendChild(this.resizer);
    
        this.closeButton = dom.createElement("div");
        this.closeButton.className = "ace_closeButton";
        this.resizer.appendChild(this.closeButton);
    
        gutter.update = this.drawGutter;
        this.editor.on("guttermousedown", this.onMousedown);

        var gutterEl = this.editor.renderer.$gutter;
        event.addListener(gutterEl, "mousemove", this.onMousemove);
        event.addListener(gutterEl, "mouseout", this.onMouseout);

        gutter.element.style.width = "";
        this.resizer.style.right = "40px";
        this.element.style.width = "260px";
        parentEl.style.width = "300px";

        gutter.update(this.editor.renderer.layerConfig);
    };
    
    this.detachFromEditor = function() {
        if (!this.editor) return;
        
        var editor = this.editor;
        var gutter = editor.renderer.$gutterLayer;
        gutter.$cells.length = 0;
        gutter.element.innerHTML = "";
        delete gutter.update;

        editor.blameGutter = gutter.blameColumn = this.editor = null;

        editor.off("guttermousedown", this.onMousedown);
        var gutterEl = editor.renderer.$gutter;
        event.removeListener(gutterEl, "mousemove", this.onMousemove);
        event.removeListener(gutterEl, "mouseout", this.onMouseout);

        gutterEl.style.width = "";
        
        if (this.element.parentNode)
            this.element.parentNode.removeChild(this.element);
        
        if (this.resizer.parentNode)
            this.resizer.parentNode.removeChild(this.resizer);
        
        gutter.update(editor.renderer.layerConfig);
    };
    
    this.setData = function(blameStr) {
        var parser = new BlameParser(blameStr);
        var blameData = parser.getDisplayData(blameStr);
        
        this.blameData = blameData;
        if (this.editor)
            this.editor.renderer.$loop.schedule(this.editor.renderer.CHANGE_GUTTER);
    };

    this.removeData = function() {
        if (this.session)
            this.session.off("changeEditor", this.onChangeEditor);
        this.detachFromEditor();
    };

    this.onChangeEditor = function(e) {
        if (e.oldEditor == this.editor)
            this.detachFromEditor();
        if (e.editor)
            this.attachToEditor(e.editor);
    };
    
    this.drawGutter = function(config) {
        this.$config = config;

        var blameEl = this.blameColumn.element;
        blameEl.style.marginTop = -config.offset + "px";

        var html = [];
        var i = config.firstRow;
        var lastRow = config.lastRow;
        var fold = this.session.getNextFoldLine(i);
        var foldStart = fold ? fold.start.row : Infinity;
        var foldWidgets = this.$showFoldWidgets && this.session.foldWidgets;
        var lineHeight = config.lineHeight;

        var blameData = this.blameColumn.blameData;
        var selectedText = this.selectedText;
        var blameHtml = [];
        var $blameIndex, lastBlameCellIndex = 0;
        var blameCell;

        findBlameCell(i);
        if (blameCell)
            addBlameCell(blameCell.text, blameCell.title);
        else
            addBlameCell("", "");
        if (!blameData[i + 1]) {
            blameHtml[$blameIndex] -= config.offset - 1;
            blameHtml.splice($blameIndex + 1, 0, "px;margin-top:", config.offset - 1);
        }


        while (true) {
            if (i > foldStart) {
                i = fold.end.row + 1;
                fold = this.session.getNextFoldLine(i, fold);
                if (fold) {
                    foldStart = fold.start.row;
                    lastBlameCellIndex = fold.end.row;
                } else {
                    foldStart = Infinity;
                }
            }
            if (i > lastRow)
                break;

            html.push("<div class='ace_gutter-cell",
                "' style='height:", lineHeight, "px;'>", (i + 1));

            if (foldWidgets) {
                var c = foldWidgets[i];
                if (c == null)
                    c = foldWidgets[i] = this.session.getFoldWidget(i);
                if (c)
                    html.push(
                        "<span class='ace_fold-widget ace_", c,
                        c == "start" && i == foldStart && i < fold.end.row ? " ace_closed" : " ace_open",
                        "' style='height:", lineHeight, "px",
                        "'></span>"
                    );
            }

            var wrappedRowLength = this.session.getRowLength(i) - 1;
            while (wrappedRowLength--) {
                html.push("</div><div class='ace_gutter-cell' style='height:", lineHeight, "px'>\xA6");
            }
            html.push("</div>");

            i++;
            findBlameCell(i);
            if (blameCell)
                addBlameCell(blameCell.text, blameCell.title);
            else
                blameHtml[$blameIndex] += this.session.getRowLength(i - 1) * lineHeight;
        }

        this.element.innerHTML = html.join("");
        blameEl.innerHTML = blameHtml.join("");
        this.element.style.height = config.minHeight + "px";

        var gutterWidth = this.element.parentNode.offsetWidth;
        if (gutterWidth !== this.gutterWidth) {
            this.gutterWidth = gutterWidth;
            this._emit("changeGutterWidth", gutterWidth);
        }

        function addBlameCell(text, title) {
            blameHtml.push(
                "<div class='ace_blame-cell ", text == selectedText ? "selected" : "",
                "' index='", lastBlameCellIndex - 1, "'",
                "style='height:", lineHeight, "px'>",
                text, "  ", title,
                "</div>"
            );
            $blameIndex = blameHtml.length - 6;
        }
        function findBlameCell(i) {
            do {
                blameCell = blameData[i];
            } while (!blameCell && i-- > lastBlameCellIndex);
            lastBlameCellIndex = i + 1;
        }
    };

    this.onMousedown = function(e) {
        var target = e.domEvent.target;

        if (target == this.closeButton) {
            this.removeData();
            return e.stop();
        }

        if (target == this.resizer) {
            var rect = this.editor.blameGutter.element.getBoundingClientRect();
            var mouseHandler = this.editor.$mouseHandler;
            mouseHandler.resizeBlameGutter = function() {
                var gutterWidth = this.x + 40 - rect.left;
                this.editor.renderer.$gutter.style.width = gutterWidth + "px";
                this.editor.blameGutter.element.style.width = gutterWidth - 40 + "px";
                this.editor.renderer.$gutterLayer._emit("changeGutterWidth", gutterWidth);
            };
            mouseHandler.captureMouse(e, mouseHandler.resizeBlameGutter.bind(mouseHandler));
            return e.stop();
        }

        if (dom.hasCssClass(target, "ace_blame-cell")) {
            var gutter = this.editor.renderer.$gutterLayer;
            var index = parseInt(target.getAttribute("index"), 10);

            var blameCell = gutter.blameColumn.blameData[index];
            if (!blameCell)
                return e.stop();
            gutter.selectedText = blameCell.text;
            var ch = target.parentNode.children;
            for (var i = ch.length; i--;) {
                var isSelected = ch[i].innerHTML.indexOf(gutter.selectedText) == 0;
                ch[i].className = "ace_blame-cell" + (isSelected ? " selected" : "");
            }
            return e.stop();
        }
    };

    this.onMousemove = function(e) {
        var target = e.target;
        var container = e.currentTarget;
        return;
        var tooltip = this.editor.tooltip;
        if (this.$highlightedCell != target) {
            if (dom.hasCssClass(target, "ace_blame-cell")) {
                tooltip.style.display = "block";
                this.$highlightedCell = target;
                tooltip.textContent = target.textContent;
            }
        }

        if (this.$highlightedCell) {
        } else {
            this.onMouseout();
            return;
        }
    };
    this.onMouseout = function(e) {
        this.$highlightedCell = null;
    };
}).call(BlameGutter.prototype);
exports.annotate = function annotate(editor, blameStr) {
    return new BlameGutter(editor, blameStr);
};



});
