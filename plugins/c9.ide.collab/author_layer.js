define(function(require, module, exports) {
    main.consumes = ["Plugin", "ace", "settings", "collab.workspace", "collab.util", "ui", "menus"];
    main.provides = ["AuthorLayer"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var ui = imports.ui;
        var ace = imports.ace;
        var util = imports["collab.util"];
        var menus = imports.menus;
        var workspace = imports["collab.workspace"];

        var dom = require("ace/lib/dom");
        var event = require("ace/lib/event");
        var Range = require("ace/range").Range;

        var AuthorAttributes = require("./ot/author_attributes")();

        var showAuthorInfo = true;
        var showAuthorInfoKey = "user/collab/@show-author-info";

        settings.on("user/collab", function () {
            showAuthorInfo = settings.getBool(showAuthorInfoKey);
        }, workspace);

        ace.on("create", function(e) {
            showAuthorInfo = settings.getBool(showAuthorInfoKey);
            initGutterLayer(e.editor.ace);
        }, workspace);

        menus.addItemByPath("context/ace-gutter/Gutter Options/Show Authorship Info", new ui.item({
            type: "check",
            checked: showAuthorInfoKey
        }), 1000, workspace);

        function AuthorLayer(session) {
            var plugin = new Plugin("Ajax.org", main.consumes);
            // var emit = plugin.getEmitter();
            var marker;

            function refresh() {
                if (showAuthorInfo) {
                    session.on("changeEditor", onChangeEditor);
                    marker = session.addDynamicMarker({ update: drawAuthInfos }, false);
                }
                else {
                    dispose();
                }
                
                var doc = session.collabDoc.original;
                var ace = doc.editor && doc.editor.ace;
                var aceSession = ace && ace.session;
                if (aceSession !== session)
                    return;

                session._emit("changeBackMarker");
                onChangeEditor({ editor: ace });
            }

            function dispose() {
                marker && session.removeMarker(marker.id);
                session.off("changeEditor", onChangeEditor);
            }

            plugin.freezePublicAPI({
                get colorPool() { return workspace.colorPool; },
                refresh: refresh,
                dispose: dispose
            });

            return plugin;
        }
        
        function onChangeEditor(e) {
            var renderer = (e.editor || e.oldEditor).renderer;
            renderer.$gutterLayer.$padding = null;
            renderer.$loop.schedule(renderer.CHANGE_GUTTER);
            if (showAuthorInfo && e.editor) {
                renderer.$gutterLayer.on("afterRender", decorateGutter);
            }
            else {
                renderer.$gutterLayer.off("afterRender", decorateGutter);
                clearGutterDecorations(renderer.$gutterLayer);
            }
        }

        function drawAuthInfos(html, markerLayer, session, config) {
            if (!showAuthorInfo || !util.isRealCollab(workspace))
                return;

            var doc = session.collabDoc;
            var editorDoc = session.doc;
            var colorPool = workspace.colorPool;
            var reversedAuthorPool = workspace.reversedAuthorPool;

            var firstRow = config.firstRow;
            var lastRow = config.lastRow;

            var range = new Range(firstRow, 0, lastRow, editorDoc.getLine(lastRow).length);

            var cache = createAuthorKeyCache(editorDoc, doc.authAttribs, range);
            var authKeyCache = cache.authorKeys;
            var rowScores = cache.rowScores;

            var fold = session.getNextFoldLine(firstRow);
            var foldStart = fold ? fold.start.row : Infinity;

            for (var i = firstRow; i < lastRow; i++) {
                if (i > foldStart) {
                    i = fold.end.row + 1;
                    fold = session.getNextFoldLine(i, fold);
                    foldStart = fold ? fold.start.row : Infinity;
                }
                if (i > lastRow)
                    break;

                if (!authKeyCache[i] || !rowScores[i])
                    continue;

                var rowScore = rowScores[i];
                for (var authVal in rowScore) {
                    if (authVal == authKeyCache[i])
                        continue;
                    var edits = rowScore[authVal].edits;
                    for (var j = 0; j < edits.length; j++) {
                        var edit = edits[j];
                        var uid = reversedAuthorPool[authVal];
                        var bgColor = colorPool[uid];
                        var extraStyle = "position:absolute;border-bottom:solid 2px " + util.formatColor(bgColor) + ";z-index: 2000";
                        var startPos = session.documentToScreenPosition(edit.pos);
                        markerLayer.drawSingleLineMarker(html,
                            new Range(startPos.row, startPos.column, startPos.row, startPos.column + edit.length),
                            "", config, 0, extraStyle);
                    }
                }
            }
        }

        function decorateGutter(e, gutter) {
            var session = gutter.session;
            
            var editorDoc = session.doc;
            var doc = session.collabDoc;
            var isCollabGutter = doc && showAuthorInfo && util.isRealCollab(workspace);

            if (!isCollabGutter)
                return;
            
            var config = gutter.config;
            var range = new Range(config.firstRow, 0, config.lastRow, Number.MAX_VALUE);
            var authorKeysCache = isCollabGutter && createAuthorKeyCache(editorDoc, doc.authAttribs, range).authorKeys;
            var colorPool = workspace.colorPool;
            var reversedAuthorPool = workspace.reversedAuthorPool;
            
            var cells = gutter.$lines.cells;
            for (var i = 0; i < cells.length; i++) {
                var cell = cells[i];
                var authorKey = authorKeysCache[cell.row];
                var authorColor = "transparent";
                var fullname = null;
                if (authorKey) {
                    var uid = reversedAuthorPool[authorKey];
                    authorColor = util.formatColor(colorPool[uid]);
                    var user = workspace.users[uid];
                    fullname = user && user.fullname;
                }
                cell.element.style.borderLeft = "solid 5px " + authorColor;
                cell.element.setAttribute("uid", fullname ? uid : "");
            }
        }
        
        function clearGutterDecorations(gutter) {
            gutter.$lines.cellCache.length = 0;
            var cells = gutter.$lines.cells;
            for (var i = 0; i < cells.length; i++) {
                var cell = cells[i];
                cell.element.style.borderLeft = "";
                cell.element.setAttribute("uid", "");
            }
        }

        function createAuthorKeyCache(editorDoc, authAttribs, range) {
            var startI = editorDoc.positionToIndex(range.start);
            var endI = editorDoc.positionToIndex(range.end);

            var authKeyCache = {};
            var rowScores = {};
            var lastPos = range.start;

            function processScore(index, length, value) {
                var line = editorDoc.getLine(lastPos.row);
                var rowScore = rowScores[lastPos.row] = rowScores[lastPos.row] || {};
                var score = Math.min(line.length - lastPos.column, length);
                var scoreObj = rowScore[value] = rowScore[value] || { edits: [], score: 0 };
                scoreObj.edits.push({ pos: lastPos, length: score });
                scoreObj.score += score;
                 var pos = editorDoc.indexToPosition(index + length);
                if (lastPos.row !== pos.row) {
                    if (value) {
                        for (var i = lastPos.row + 1; i < pos.row; i++)
                            authKeyCache[i] = value;
                    }
                    line = editorDoc.getLine(pos.row);
                    rowScore = rowScores[pos.row] = rowScores[pos.row] || {};
                    score = pos.column;
                    scoreObj = rowScore[value] = rowScore[value] || { edits: [], score: 0 };
                    scoreObj.edits.push({ pos: pos, length: score });
                    scoreObj.score += score;
                }
                lastPos = pos;
            }
            AuthorAttributes.traverse(authAttribs, startI, endI, processScore);

            for (var rowNum in rowScores) {
                var rowScore = rowScores[rowNum];
                delete rowScore[null];
                delete rowScore[undefined];
                delete rowScore[0];
                var authorKeys = Object.keys(rowScore);

                if (authorKeys.length === 0) {
                    delete rowScores[rowNum];
                    // authKeyCache[rowNum] = null;
                }
                else if (authorKeys.length === 1) {
                    authKeyCache[rowNum] = parseInt(authorKeys[0], 10);
                }
                else {
                    var biggestScore = 0;
                    var authKey;
                    for (var key in rowScore) {
                        if (rowScore[key].score > biggestScore) {
                            biggestScore = rowScore[key].score;
                            authKey = key;
                        }
                    }
                    authKeyCache[rowNum] = parseInt(authKey, 10);
                }
            }

            return {
                authorKeys: authKeyCache,
                rowScores: rowScores
            };
        }

        function getLineAuthorKey(session, authAttribs, row) {
            var editorDoc = session.doc;

            var line = editorDoc.getLine(row);
            var lineStart = editorDoc.positionToIndex({ row: row, column: 0 }) - 1;
            var lineEnd = lineStart + line.length + 1;
            var scores = {};
            AuthorAttributes.traverse(authAttribs, lineStart, lineEnd, function (index, length, value) {
                if (value)
                    scores[value] = (scores[value] || 0) + length;
            });

            var authorKeys = Object.keys(scores);

            if (authorKeys.length === 0)
                return null;

            if (authorKeys.length === 1)
                return parseInt(authorKeys[0], 10);

            var biggestScore = 0;
            var authorKey;
            for (var key in scores) {
                if (scores[key] > biggestScore) {
                    biggestScore = scores[key];
                    authorKey = key;
                }
            }

            return parseInt(authorKey, 10);
        }

        function initGutterLayer(editor) {
            if (!editor || editor.$authorGutterInited) return;
            editor.$authorGutterInited = true;

            var highlightedCell;

            var tooltip = editor.tooltip = dom.createElement("div");
            tooltip.className = "ace_gutter-tooltip";
            tooltip.style.display = "none";
            editor.container.appendChild(tooltip);

            function onGutterMouseout(e) {
                tooltip.style.display = "none";
                highlightedCell = null;
            }

            var gutterEl = editor.renderer.$gutter;
            // var gutterEl = editor.renderer.$gutterLayer.element;
            // event.addListener(gutterEl, "mousemove", onMousemove);
            event.addListener(gutterEl, "mouseout", onGutterMouseout);

            gutterEl.addEventListener("mousemove", function(e) {
                if (!showAuthorInfo || !util.isRealCollab(workspace))
                    return;
                var target = e.target;

                if (highlightedCell != target) {
                    var uid = target.getAttribute("uid");
                    if (uid) {
                        tooltip.style.display = "block";
                        highlightedCell = target;
                        var user = workspace.users[uid];
                        tooltip.textContent = user ? user.fullname : "";
                    }
                }
                if (highlightedCell) {
                    tooltip.style.top = e.clientY - 15 + "px";
                    tooltip.style.left = e.clientX + "px";
                } else {
                    onGutterMouseout();
                }
            });

            var mousePos;
            editor.addEventListener("mousemove", function(e) {
                if (!showAuthorInfo || !util.isRealCollab(workspace))
                    return;
                mousePos = { x: e.x, y: e.y };
                if (!editor.authorTooltipTimeout)
                    editor.authorTooltipTimeout = setTimeout(updateTooltip, tooltip.style.display === "block" ? 100 : 300);
            });
            editor.renderer.container.addEventListener("mouseout", function(e) {
                tooltip.style.display = "none";
            });

            function updateTooltip() {
                editor.authorTooltipTimeout = null;
                var session = editor.session;
                var otDoc = session.collabDoc;
                if (!otDoc)
                    return;

                var editorDoc = session.doc;
                var authAttribs = otDoc.authAttribs;

                var screenPos = editor.renderer.pixelToScreenCoordinates(mousePos.x, mousePos.y);
                var docPos = session.screenToDocumentPosition(screenPos.row, screenPos.column);
                var line = editorDoc.getLine(docPos.row);

                var hoverIndex = editorDoc.positionToIndex({ row: docPos.row, column: docPos.column });
                var authorKey = AuthorAttributes.valueAtIndex(authAttribs, hoverIndex);

                // ignore newline tooltip and out of text hovering
                if (!authorKey || line.length <= screenPos.column || editorDoc.$lines.length < screenPos.row)
                    return tooltip.style.display = "none";
                var lineOwnerKey = getLineAuthorKey(session, authAttribs, docPos.row);
                if (!lineOwnerKey || lineOwnerKey === authorKey)
                    return tooltip.style.display = "none";

                var reversedAuthorPool = workspace.reversedAuthorPool;
                var uid = reversedAuthorPool[authorKey];
                var fullname = workspace.users[uid] && workspace.users[uid].fullname;

                tooltip.style.display = "block";
                tooltip.textContent = fullname;
                tooltip.style.top = mousePos.y + 10 + "px";
                tooltip.style.left = mousePos.x + 10 + "px";
            }

            editor.addEventListener("mousewheel", function documentScroll() {
                clearTimeout(editor.authorTooltipTimeout);
                delete editor.authorTooltipTimeout;
                tooltip.style.display = "none";
            });
        }

        /***** Register and define API *****/
        register(null, {
            AuthorLayer: AuthorLayer
        });
    }
});
