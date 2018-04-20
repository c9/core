define(function(require, exports, module) {

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
    /**
     * The entry point for parsing the output from git blame -p
     * 
     * @param {string} blame The output as a string
     */
    this.parse = function(blame) {
        var lines = blame.split("\n");
        
        for (var i = 0; i < lines.length; i++) {
            // If we detect a tab character we know it's a line of code
            // So we can reset stateful variables
            if (lines[i][0] == "\t") {
                // The first tab is an addition made by git, so get rid of it
                this.lines[this.currentLineNumber].code = lines[i].substr(1);
                this.settingCommitData = false;
                this.currentCommitHash = "";
            }
            else {
                var arrLine = lines[i].split(" ");
        
                // If we are in the process of collecting data about a commit summary
                if (this.settingCommitData) {
                    this.parseCommitLine(arrLine);
                }
                else if (arrLine[0].length == 40) {
                    // 40 == the length of an Sha1
                    // This is really only an added check, we should be guaranteed
                    // that an Sha1 is expected here
                   
                    this.currentCommitHash = arrLine[0];
                    this.currentLineNumber = arrLine[2];
    
                    // Setup the new lines hash
                    this.lines[arrLine[2]] = {
                        code: "",
                        hash: this.currentCommitHash,
                        originalLine: arrLine[1],
                        finalLine: arrLine[2],
                        numLines: arrLine[3] || -1
                    };
    
                    // Since the commit data (author, committer, summary, etc) only
                    // appear once in a porcelain output for every commit, we set
                    // it up once here and then expect that the next 8-11 lines of
                    // the file are dedicated to that data
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

    /**
     * Parses and sets data from a line following a commit header
     * 
     * @param {array} lineArr The current line split by a space
     */
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
    this.onChangeSelection = this.onChangeSelection.bind(this);
    this.onMousemove = this.onMousemove.bind(this);
    this.onMouseout = this.onMouseout.bind(this);
    
    this.blameData = [];
    this.$cache = [];
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
    
        this.element = dom.buildDom(["div", {
            class: "ace_layer ace_blame-gutter-layer ace_gutter"
        }], editor.container);
        this.resizer = dom.buildDom(["div", { class: "ace_resizer_v" }, 
            ["div", { class: "ace_closeButton" }]
        ], editor.container);
        this.closeButton = this.resizer.firstChild;

        gutter.on("afterRender", this.drawGutter);
        editor.on("changeSelection", this.onChangeSelection);
        this.element.addEventListener("mousedown", this.onMousedown);
        this.resizer.addEventListener("mousedown", this.onMousedown);

        event.addListener(this.element, "mousemove", this.onMousemove);
        event.addListener(this.element, "mouseout", this.onMouseout);

        this.resizer.style.left =
        this.element.style.width = "220px";
        editor.renderer.setMargin(0, 0, 220, 0);
    };
    
    this.detachFromEditor = function() {
        if (!this.editor) return;
        
        var editor = this.editor;
        var gutter = editor.renderer.$gutterLayer;
        gutter.off("afterRender", this.drawGutter);
        editor.off("changeSelection", this.onChangeSelection);

        editor.blameGutter = gutter.blameColumn = this.editor = null;

        editor.renderer.setMargin(0);
        
        this.element.remove();
        this.resizer.remove();
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
    
    this.onChangeSelection = function() {
        var renderer = this.editor.renderer;
        var row = this.session.selection.cursor.row;
        
        var blameData = this.blameData || [];

        while (!blameData[row] && row > 0) row--;
        var blameCell = blameData[row];
        if (blameCell) {
            this.selectedHash = blameCell.data.hash;
            renderer.$loop.schedule(renderer.CHANGE_GUTTER | renderer.CHANGE_MARKER);
        }
    };
    
    this.drawGutter = function(e, gutter) {
        var container = gutter.blameColumn.element;
        var blameData = gutter.blameColumn.blameData;
        var selectedHash = gutter.blameColumn.selectedHash;

        var cells = gutter.$lines.cells;
        var cache = gutter.blameColumn.$cache;
        var cacheIndex = 0;
        var offset = -getTop(gutter.element);
        
        var commit;
        for (var i = 0; i < cells.length; i++) {
            var cell = cells[i];
            var row = cell.row;
            var data = blameData[row];
            
            if (!data && i == 0) {
                // find first row
                while (!blameData[row] && row > 0) row--;
                data = blameData[row]
            }
            
            if (!data)
                continue;
            
            if (commit)
                add(commit.data, commit.row, commit.cell, cell);
            
            commit = {
                row: row,
                cell: cell,
                data: data,
            };
        }
        if (commit)
            add(commit.data, commit.row, commit.cell);
        
        function add(data, row, firstCell, nextCell) {
            var el = cache[cacheIndex++];
            if (!el)
                cache.push(el = dom.createElement("div"));
            el.className = "ace_blame-cell " + (data.data.hash == selectedHash ? "selected" : "");
            el.index = row;
            el.textContent = data.text + " " + data.title;
            
            var top = Math.max(getTop(firstCell.element) - offset, 0);
            var next = nextCell ? getTop(nextCell.element) - offset : gutter.config.height;
            el.style.top = top + "px";
            el.style.height = next - top + "px";
            
            container.appendChild(el);
        }
        
        while (cacheIndex < cache.length) {
            cache.pop().remove();
        }   
        
        function getTop(element) {
            return parseInt(element.style.top);
        }
    };

    this.onMousedown = function(e) {
        var target = e.target;

        if (target == this.closeButton) {
            this.removeData();
            return event.stopEvent(e);
        }

        if (target == this.resizer) {
            var rect = this.editor.blameGutter.element.getBoundingClientRect();
            var mouseHandler = this.editor.$mouseHandler;
            apf.plane.setCursor("ew-resize");
            this.editor.blameGutter.resizer.classList.add("hover");
            mouseHandler.resizeBlameGutter = function() {
                var gutterWidth = this.x - rect.left;
                this.editor.blameGutter.resizer.style.left = 
                this.editor.blameGutter.element.style.width = gutterWidth + "px";
                this.editor.renderer.setMargin(0, 0, gutterWidth, 0);
            };
            mouseHandler.resizeBlameGutterEnd = function() {
                apf.plane.unsetCursor();
                this.editor.blameGutter.resizer.classList.remove("hover");
            };
            mouseHandler.setState("resizeBlameGutter");
            mouseHandler.captureMouse(e, mouseHandler.resizeBlameGutter.bind(mouseHandler));
            return event.stopEvent(e);
        }

        if (dom.hasCssClass(target, "ace_blame-cell")) {
            var gutter = this.editor.renderer.$gutterLayer;
            var blameData = gutter.blameColumn.blameData;

            var blameCell = blameData[target.index];
            if (!blameCell)
                return event.stopEvent(e);
            var pos = this.editor.renderer.screenToTextCoordinates(e.clientX, e.clientY);
            this.editor.selection.moveToPosition(pos);
            gutter.blameColumn.selectedHash = blameCell.data.hash;
            this.editor.renderer.$loop.schedule(this.editor.renderer.CHANGE_GUTTER);
            return event.stopEvent(e);
        }
    };

    this.onMousemove = function(e) {
        var target = e.target;
        var container = e.currentTarget;
        var tooltip = this.editor.tooltip;
        if (this.$highlightedCell != target) {
            if (dom.hasCssClass(target, "ace_blame-cell")) {
                tooltip.style.display = "block";
                this.$highlightedCell = target;
                tooltip.textContent = target.textContent;
            }
        }

        if (this.$highlightedCell) {
            tooltip.style.top = e.clientY + 10 + "px";
            tooltip.style.left = e.clientX + 10 + "px";
        } else {
            this.onMouseout();
            return;
        }
    };
    this.onMouseout = function(e) {
        // this.editor.tooltip.style.display = "none";
        this.$highlightedCell = null;
    };
}).call(BlameGutter.prototype);


exports.annotate = function annotate(editor, blameStr) {
    return new BlameGutter(editor, blameStr);
};



});