(function() {

var parent = window.opener || window.parent;
if (!parent) return;

var host = (location.search.match(/_c9_host=(.*?)(?:$|&)/) || false)[1];
var id = (location.search.match(/[?&]_c9_id=([a-zA-Z0-9]+)(?:$|&)/) || false)[1];

if (!host || !id) {
    var cookies = document.cookie.split(";");
    cookies.forEach(function(c) {
        var parts = c.split("=");
        var key = parts.shift().replace(/^\s+/, "");
        
        if (key == "_c9_host") host = parts.join(";");
        else if (key == "_c9_id") id = parts.join(";");
    });
    
    if (!host || !id)
        return;
}
else {
    document.cookie = "_c9_host=" + host;
    document.cookie = "_c9_id=" + id;
}

var mainPath = location.href.split("?")[0];
var isHosted = mainPath.indexOf("/preview") == -1;
var importedStyles = {};
var session, reloader;

function init(id) {
    if (session)
        return console.error("connection alreay established");
    
    reloader = new Reloader(window, console);

    window.addEventListener("message", function(e) {
        var data = e.data;
        
        // TODO check origin
        if (data.id != id || host != "local" && e.origin !== host)
            return;
       
        if (data.type == "updatecss") {
            reloader.reloadStyleSheet(data.path, data.data);
            resize();
        }
        else if (data.type == "domedits")
            editHandler.apply(data.edits);
        else if (data.type == "initdom")
            editHandler.initDom(data.dom);
        else if (data.type == "simpledom") {
            var dom = getSimpleDOM();
            send({ message: "callback", data: dom, cb: data.cb });
        }
        else if (data.type == "keys")
            setKeys(data.keys);
        else if (data.type == "stylerule") {
            updateStyleRule(data.url, data.rule);
            resize();
        }
        else if (data.type == "highlight")
            highlightByCssQuery(data.query);
        else if (data.type == "reload")
            window.location.reload();
        else if (data.type == "reveal") {
            highlightByCssQuery(data.query);
            var el = document.querySelector(data.query);
            if (el)
                (el.scrollIntoViewIfNeeded || el.scrollIntoView).call(el);
        }
    });
    
    var styles = reloader.getAllStylesheets();
    var scripts = reloader.getAllScripts();
    
    session = {
        id: id,
        styles: styles,
        scripts: scripts //@todo
    };
    
    setTimeout(function() {
        send({
            message: "html.ready",
            data: {
                styles: session.styles.map(function(n) { return n.path; }),
                scripts: session.scripts.map(function(n) { return n.path; }),
                href: document.location.pathname.replace(/^\/preview\//, "/")
            }
        });
    }, 1000);
}

function urlToPath(url, base) {
    // Absolute Path
    if (url.charAt(0) == "/") {
        // return url;
    }
    // Absolute URL
    else if (url.match(/^https?:\/\//)) {
        var origin = location.origin;
        if (url.substr(0, origin.length) == origin) {
            url = url.substr(origin.length);
        }
        // return url;
    }
    else {
        if (!base) base = dirname(location.pathname);
        url = join(base, url);
    }
    
    if (!isHosted)
        url = url.replace(/^\/preview/, "");
    
    return url;
}

function getDataUrl(data) { return "data:text/css," + data.replace(/\n/g, ""); }
function dirname(path) { return path.substr(0, path.lastIndexOf("/")); }
function join(base, path) {
    if (path.charAt(0) != "/") {
        var parts = path.split("/");
        var sparts = base.split("/");
        for (var i = 0; i < parts.length; i++) {
            if (parts[i] == "..")
                sparts.pop();
            else
                sparts.push(parts[i]);
        }
        return sparts.join("/");
    }
    
    return path;
}

/**** RELOADER ****/

/*global CSSRule*/
function Reloader(win, console) {
    
    function getAllStylesheets() {
        var results = [];
        var nodes, node, i, path;
        
        // Link tags
        nodes = win.document.querySelectorAll("link");
        for (i = 0; i < nodes.length; i++) {
            node = nodes[i];
            path = urlToPath(node.href);
            results.push({ path: path, href: node.href, node: node });
            findImportedSheets(node, node.sheet, results, dirname(path));
        }
        
        // Style tags
        nodes = win.document.querySelectorAll("style");
        for (i = 0; i < nodes.length; i++) {
            node = nodes[i];
            if (node.c9__path)
                results.push({ path: node.c9__path, href: node.c9__href, node: node });
            if (node.sheet)
                findImportedSheets(node, node.sheet, results, 
                    dirname(node.c9__path || mainPath));
        }
        
        if (win.StyleFix) {
            nodes = win.document.querySelectorAll('style[data-href]');
            for (i = 0; i < nodes.length; i++) {
                var href = urlToPath(nodes[i].getAttribute('data-href'));
                results.push({ path: urlToPath(href), href: href, node: nodes[i] });
            }
        }
        
        return results;
    }
    
    function getAllScripts() {
        var results = [];
        var nodes, node, i, path;
        
        // Link tags
        nodes = win.document.querySelectorAll("script[src]");
        for (i = 0; i < nodes.length; i++) {
            node = nodes[i];
            if (node.src.indexOf("/livecss.js") > -1) continue;
            
            path = urlToPath(node.src);
            results.push({ path: path, src: node.src, node: node });
        }
        
        return results;
    }
    
    function findStylesheet(path) {
        var results = session.styles; //getAllStylesheets();
        
        return pickBestMatch(path, results, function(item) {
            return item.path;
        });
    }
    
    function findImportedSheets(node, styleSheet, results, base) {
        try {
            var rules = styleSheet !== null ? styleSheet.cssRules : void 0;
        } catch (_error) {
            return;
        }
        
        if (rules && rules.length) {
            var rule;
            for (var i = rules.length - 1; i >= 0; i--) {
                rule = rules[i];
                switch (rule.type) {
                    case CSSRule.CHARSET_RULE:
                        continue;
                    case CSSRule.IMPORT_RULE:
                        var path = urlToPath(rule.href, base);
                        if (importedStyles[path]) {
                            styleSheet.deleteRule(i);
                            break;
                        }
                        
                        results.push({
                            node: node,
                            rule: rule,
                            index: i,
                            path: path,
                            href: rule.href
                        });
                        findImportedSheets(node, rule.styleSheet, results, dirname(path));
                        break;
                    default:
                        break;
                }
            }
        }
    }
    
    function pickBestMatch(path, objects, pathFunc) {
        var bestMatch, object, score, _i, _len;
        bestMatch = {
            score: 0
        };
        for (_i = 0, _len = objects.length; _i < _len; _i++) {
            object = objects[_i];
            score = numberOfMatchingSegments(path, pathFunc(object));
            if (score > bestMatch.score) {
                bestMatch = {
                    object: object,
                    score: score
                };
            }
        }
        if (bestMatch.score > 0) {
            return bestMatch;
        } else {
            return null;
        }
    }
    
    function numberOfMatchingSegments(path1, path2) {
        var comps1, comps2, eqCount, len;
        path1 = path1.replace(/^\/+/, '').toLowerCase();
        path2 = path2.replace(/^\/+/, '').toLowerCase();
        if (path1 === path2) {
            return 10000;
        }
        comps1 = path1.split('/').reverse();
        comps2 = path2.split('/').reverse();
        len = Math.min(comps1.length, comps2.length);
        eqCount = 0;
        while (eqCount < len && comps1[eqCount] === comps2[eqCount]) {
            ++eqCount;
        }
        return eqCount;
    }
    
    // Normalize Image Paths
    function normalizeImagePaths(cssPath, data) {
        cssPath = cssPath.match(/^https?:\/\//) // If an absolute url
            ? dirname(cssPath) // Retrieve the absolute path
            : join(mainPath, dirname(cssPath)); // Normalize path, based on main path
        
        var expando = generateUniqueString();
        
        return data.replace(/\burl\s*\("?([^)]*?)"?\)/g, function(match, src) {
            if (!src.match(/^https?:\/\//)) { // Ignore absolute paths
                var path = join(cssPath, src);
                return "url(" + (generateCacheBustUrl(path, expando)) + ")";
            } else {
                return match;
            }
        });
    }
    
    function generateUniqueString() {
        return 'livereload=' + Date.now();
    }

    function generateCacheBustUrl(url, expando) {
        if (!expando)
            expando = this.generateUniqueString();
        
        var parts = url.split("#");
        var base = parts[0];
        var hash = parts[1] || "";
        
        var newBase = base.replace(/(\?|&)livereload=(\d+)/, function(match, sep) {
            return "" + sep + expando;
        });
        if (newBase === base)
            newBase += (~base.indexOf("?") ? "&" : "?") + expando;
        return newBase + hash;
    }
    
    function reloadStyleSheet(path, content) {
        // Find Stylesheet
        var match = findStylesheet(path);
        if (!match) return;
        
        match = match.object;
        var replaced, node;
        
        // If Imported Rule
        if (match.rule) {
            node = document.createElement("style");
            node.c9__path = match.path;
            node.c9__href = match.href;
            
            // Delete Rule
            match.rule.parentStyleSheet.deleteRule(match.index);
            delete match.rule;
            
            // Insert style rule
            match.node.parentNode.insertBefore(node, match.node);
            match.node = node;
            
            // Add to list of replaces import rules
            importedStyles[match.path] = match;
            
            replaced = true;
        }
        // If Link, replace link with style node
        else if (match.node.tagName == "LINK") {
            node = document.createElement("style");
            node.c9__path = match.path;
            node.c9__href = match.href;
            
            match.node.parentNode.insertBefore(node, match.node);
            match.node.parentNode.removeChild(match.node);
            match.node = node;
            
            for (var i = session.styles.length - 1; i >= 0; i--) {
                if (session.styles[i].rule && session.styles[i].node == node)
                    session.styles.splice(i);
            }
            
            replaced = true;
        }
        
        // Set content
        match.node.textContent = normalizeImagePaths(match.href, content);
        
        if (replaced)
            findImportedSheets(node, node.sheet, session.styles, dirname(match.path));
    }
    
    function reloadImage(path) {
        
    }
    
    return {
        reloadStyleSheet: reloadStyleSheet,
        
        reloadImage: reloadImage,
        
        findStylesheet: findStylesheet,
        
        getAllStylesheets: getAllStylesheets,
        
        getAllScripts: getAllScripts
    };
}

// Keys
var ckb;
function setKeys(list) {
    if (window.opener) return; // do not forward keys when not in iframe
    ckb = {};
    
    list.forEach(function(item) {
        var binding = item.binding;
        var command = item.command;
        var hashId = binding.hashId;
        var hash = (ckb[hashId] || (ckb[hashId] = {}));
        
        if (!hash[binding.key]) {
            hash[binding.key] = command;
        } else {
            if (!Array.isArray(hash[binding.key]))
                hash[binding.key] = [hash[binding.key]];
            
            hash[binding.key].push(command);
        }
    }, this);
}

document.addEventListener("keydown", function(e) {
    var hashId = 0 | (e.ctrlKey ? 1 : 0) | (e.altKey ? 2 : 0)
        | (e.shiftKey ? 4 : 0) | (e.metaKey ? 8 : 0);
    
    var keys = ckb && ckb[hashId];
    var cmd = keys && keys[e.keyCode];
    
    if (cmd) {
        send({ message: "exec", command: cmd });
        
        e.preventDefault();
        e.stopPropagation();
    }
});

window.addEventListener("focus", function() {
    send({ message: "focus" });
    removeHighlight();
});

// Highlight

var HIGHLIGHT_CLASSNAME = "c9___highlighter";

var last = [], lastHighlight;
function removeHighlight() {
    last.forEach(function(item) {
        item.destroy();
    });
}

function Highlight(div, text, setDisplayName) {
    var cover = document.documentElement.appendChild(document.createElement("c9__div"));
    cover.style.position = "fixed";
    cover.style.zIndex = 10000000000;
    cover.style.border = "1px solid rgba(238, 238, 48, 0.5)"; //rgba(128, 128, 128, 0.85)"
    cover.style.boxSizing = "border-box";
    cover.style.boxShadow = "0 0 20px rgba(0,0,0,0.5)";
    cover.style.pointerEvents = "none";
    cover.style.color = "black";
    cover.className = HIGHLIGHT_CLASSNAME;
    cover.innerHTML = "<c9__div><c9__div></c9__div><c9__label></c9__label></c9__div>";
    cover.style.background = "transparent"; //"rgba(53, 239, 255, 0.5)";
    
    var child = cover.firstChild;
    child.style.whiteSpace = "nowrap";
    
    var arrow = child.firstChild;
    var label = child.lastChild;
    
    arrow.style.border = "7px inset blue";
    arrow.style.borderColor = "transparent transparent rgb(228, 214, 140) transparent";
    arrow.style.position = "absolute";
    arrow.style.left = "3px";
    arrow.style.top = "-13px";
    
    child.style.position = "absolute";
    child.style.bottom = "-20px";
    child.style.left = "0";
    child.style.fontFamily = "Arial";
    child.style.fontSize = "11px";
    child.style.background = "rgb(228, 214, 140)"; //"rgb(238, 238, 48)";
    child.style.color = "rgb(0, 0, 0)"; 
    child.style.padding = "2px 4px 3px 4px";
    child.style.borderRadius = "3px";
    child.style.boxShadow = "rgba(0, 0, 0, 0.7) 0px 1px 3px";
    label.style.color = child.style.color;
    
    
    if (setDisplayName) {
        text = div.tagName.toLowerCase()
            + (div.id ? "<c9__span style='color:rgb(41, 91, 180)'>#" + div.id + "</c9__span>" : "")
            + (div.className ? "<c9__span style='color:rgb(72, 128, 12)'>." + div.className.replace(/ /g, "") + "</c9__span>" : "");
    }
    
    this.resize = function() {
        var pos = div.getBoundingClientRect();
        cover.style.left = (pos.left - 1) + "px";
        cover.style.top = (pos.top - 1) + "px";
        cover.style.width = (pos.width + 2) + "px";
        cover.style.height = (pos.height + 2) + "px";
        
        label.innerHTML = "<c9__span style='color:maroon'>" + text + "</c9__span> " 
            + pos.width + "<c9__span style='color:gray'>px</c9__span>"
            + " x "
            + pos.height + "<c9__span style='color:gray'>px</c9__span>";
    };
    
    this.destroy = function() {
        if (cover.parentNode)
            cover.parentNode.removeChild(cover);
    };
    
    this.resize();
}

function highlightByCssQuery(query) {
    removeHighlight();
    last = [];
    if (!query) {
        lastHighlight = null;
        return;
    }
    
    var setDisplayName = query.match(/\[data\-\w+\-id='\d+'\]/) ? true : false;
    
    var nodes = document.querySelectorAll(query);
    var len = Math.min(10, nodes.length);
    for (var i = len - 1; i >= 0; i--) {
        last.push(new Highlight(nodes[i], query, setDisplayName));
    }
    
    lastHighlight = { fn: highlightByCssQuery, query: query };
}

function redrawHighlights() {
    if (lastHighlight) {
        lastHighlight.fn(lastHighlight.query);
    }
}

function resize() {
    last.forEach(function(item) {
        item.resize();
    });
    
    showSize();
    clearTimeout(timer);
    timer = setTimeout(hideSize, 1000);
}

var timer, sizeDiv;
function showSize() {
    if (!sizeDiv) {
        sizeDiv = document.createElement("div");
        sizeDiv.style.position = "absolute";
        sizeDiv.style.zIndex = 100000000000;
        sizeDiv.style.right = 0;
        sizeDiv.style.top = 0;
        sizeDiv.style.background = "rgba(255,255,255,0.7)";
        sizeDiv.style.color = "#333";
        sizeDiv.style.fontFamily = "Arial";
        sizeDiv.style.fontSize = "20px";
        sizeDiv.style.padding = "2px 6px";
        sizeDiv.style.borderRadius = "0 0 0 3px";
    }
    
    document.documentElement.appendChild(sizeDiv);
    sizeDiv.innerHTML = window.innerWidth + "px \u00D7 " + window.innerHeight + "px";
}
function hideSize() {
    if (sizeDiv.parentNode)
        document.documentElement.removeChild(sizeDiv);
}

window.addEventListener("resize", resize);
window.document.addEventListener("scroll", resize);


// Editing

/**
 * Constructor
 * @param {Document} htmlDocument
 */
function DOMEditHandler(htmlDocument) {
    this.htmlDocument = htmlDocument;
    this.rememberedNodes = null;
    this.entityParseParent = htmlDocument.createElement("div");
}

/**
 * @private
 * Find the first matching element with the specified data-cloud9-id
 * @param {string} id
 * @return {Element}
 */
DOMEditHandler.prototype._queryBracketsID = function (id) {
    if (!id) {
        return null;
    }
    
    if (this.rememberedNodes && this.rememberedNodes[id]) {
        return this.rememberedNodes[id];
    }
    
    var results = this.htmlDocument.querySelectorAll("[data-cloud9-id='" + id + "']");
    return results && results[0];
};

/**
 * @private
 * Insert a new child element
 * @param {Element} targetElement Parent element already in the document
 * @param {Element} childElement New child element
 * @param {Object} edit
 */
DOMEditHandler.prototype._insertChildNode = function (targetElement, childElement, edit) {
    var before = this._queryBracketsID(edit.beforeID),
        after = this._queryBracketsID(edit.afterID);
    
    if (edit.firstChild) {
        before = targetElement.firstChild;
    } else if (edit.lastChild) {
        after = targetElement.lastChild;
    }
    
    if (!childElement || !targetElement) {
        return console.error("missing tagID");
    }
    
    if (before) {
        targetElement.insertBefore(childElement, before);
    } else if (after && (after !== targetElement.lastChild)) {
        targetElement.insertBefore(childElement, after.nextSibling);
    } else {
        targetElement.appendChild(childElement);
    }
};

/**
 * @private
 * Given a string containing encoded entity references, returns the string with the entities decoded.
 * @param {string} text The text to parse.
 * @return {string} The decoded text.
 */
DOMEditHandler.prototype._parseEntities = function (text, forTextarea) {
    // Kind of a hack: just set the innerHTML of a div to the text, which will parse the entities, then
    // read the content out.
    if (forTextarea) text = "<textarea>" + text + "</textarea>";
    this.entityParseParent.innerHTML = text;
    var result = forTextarea
        ? this.entityParseParent.firstChild.value
        : this.entityParseParent.textContent;
    this.entityParseParent.textContent = "";
    return result;
};

/**
 * @private
 * @param {Node} node
 * @return {boolean} true if node expects its content to be raw text (not parsed for entities) according to the HTML5 spec.
 */
function _isRawTextNode(node) {
    return (node.nodeType === Node.ELEMENT_NODE && /script|style|noscript|noframes|noembed|iframe|xmp/i.test(node.tagName));
}

/**
 * @private
 * Replace a range of text and comment nodes with an optional new text node
 * @param {Element} targetElement
 * @param {Object} edit
 */
DOMEditHandler.prototype._textReplace = function (targetElement, edit) {
    function prevIgnoringHighlights(node) {
        do {
            node = node.previousSibling;
        } while (node && node.className === HIGHLIGHT_CLASSNAME);
        return node;
    }
    function nextIgnoringHighlights(node) {
        do {
            node = node.nextSibling;
        } while (node && node.className === HIGHLIGHT_CLASSNAME);
        return node;
    }
    function lastChildIgnoringHighlights(node) {
        node = (node.childNodes.length ? node.childNodes.item(node.childNodes.length - 1) : null);
        if (node && node.className === HIGHLIGHT_CLASSNAME) {
            node = prevIgnoringHighlights(node);
        }
        return node;
    }
    
    if (targetElement.tagName === "TEXTAREA")
        return targetElement.value = this._parseEntities(edit.content, true);
    
    var start = (edit.afterID) ? this._queryBracketsID(edit.afterID) : null,
        startMissing = edit.afterID && !start,
        end = (edit.beforeID) ? this._queryBracketsID(edit.beforeID) : null,
        endMissing = edit.beforeID && !end,
        moveNext = start && nextIgnoringHighlights(start),
        current = moveNext || (end && prevIgnoringHighlights(end)) || lastChildIgnoringHighlights(targetElement),
        next,
        lastRemovedWasText,
        isText,
        textNode;
    if (edit.content !== undefined) 
        textNode = this.htmlDocument.createTextNode(_isRawTextNode(targetElement) 
            ? edit.content : this._parseEntities(edit.content));
    
    // remove all nodes inside the range
    while (current && (current !== end)) {
        isText = current.nodeType === Node.TEXT_NODE;

        // if start is defined, delete following text nodes
        // if start is not defined, delete preceding text nodes
        next = (moveNext) ? nextIgnoringHighlights(current) : prevIgnoringHighlights(current);

        // only delete up to the nearest element.
        // if the start/end tag was deleted in a prior edit, stop removing
        // nodes when we hit adjacent text nodes
        if ((current.nodeType === Node.ELEMENT_NODE) ||
                ((startMissing || endMissing) && (isText && lastRemovedWasText))) {
            break;
        } else {
            lastRemovedWasText = isText;

            current.remove();
            current = next;
        }
    }
    
    if (textNode) {
        // OK to use nextSibling here (not nextIgnoringHighlights) because we do literally
        // want to insert immediately after the start tag.
        if (start && start.nextSibling) {
            targetElement.insertBefore(textNode, start.nextSibling);
        } else if (end) {
            if (end.parentNode !== targetElement)
                return console.error("missing tagID");
            targetElement.insertBefore(textNode, end);
        } else {
            targetElement.appendChild(textNode);
        }
    }
};

/**
 * @private
 * Apply an array of DOM edits to the document
 * @param {Array.<Object>} edits
 */
DOMEditHandler.prototype.apply = function (edits) {
    var targetID,
        targetElement,
        childElement,
        self = this;
    
    this.rememberedNodes = {};
    
    edits.forEach(function (edit) {
        var editIsSpecialTag = edit.type === "elementInsert" && (edit.tag === "html" || edit.tag === "head" || edit.tag === "body");
        
        if (edit.type === "rememberNodes") {
            edit.tagIDs.forEach(function (tagID) {
                var node = self._queryBracketsID(tagID);
                if (node) {
                self.rememberedNodes[tagID] = node;
                node.remove();
                }
            });
            return;
        }
        
        targetID = edit.type.match(/textReplace|textDelete|textInsert|elementInsert|elementMove/) ? edit.parentID : edit.tagID;
        targetElement = self._queryBracketsID(targetID);
        
        if (!targetElement && !editIsSpecialTag) {
            console.error("data-cloud9-id=" + targetID + " not found");
            return;
        }
        
        switch (edit.type) {
        case "attrChange":
        case "attrAdd":
            targetElement.setAttribute(edit.attribute, self._parseEntities(edit.value));
            break;
        case "attrDelete":
            targetElement.removeAttribute(edit.attribute);
            break;
        case "elementDelete":
            targetElement.remove();
            break;
        case "elementInsert":
            childElement = null;
            if (editIsSpecialTag) {
                // If we already have one of these elements (which we should), then
                // just copy the attributes and set the ID.
                childElement = self.htmlDocument[edit.tag === "html" ? "documentElement" : edit.tag];
                if (!childElement) {
                    // Treat this as a normal insertion.
                    editIsSpecialTag = false;
                }
            }
            if (!editIsSpecialTag) {
                childElement = self.htmlDocument.createElement(edit.tag);
            }
            
            Object.keys(edit.attributes).forEach(function (attr) {
                childElement.setAttribute(attr, self._parseEntities(edit.attributes[attr]));
            });
            childElement.setAttribute("data-cloud9-id", edit.tagID);
            
            if (!editIsSpecialTag) {
                self._insertChildNode(targetElement, childElement, edit);
            }
            break;
        case "elementMove":
            childElement = self._queryBracketsID(edit.tagID);
            self._insertChildNode(targetElement, childElement, edit);
            break;
        case "textInsert":
            var textElement = self.htmlDocument.createTextNode(_isRawTextNode(targetElement) ? edit.content : self._parseEntities(edit.content));
            self._insertChildNode(targetElement, textElement, edit);
            break;
        case "textReplace":
        case "textDelete":
            self._textReplace(targetElement, edit);
            break;
        }
    });
    
    this.rememberedNodes = {};
    
    // update highlight after applying diffs
    redrawHighlights();
};

DOMEditHandler.prototype.initDom = function (docState) {
    if (docState.idMap && !this.initialized) {
        this.initialized = true;
        var idMap = docState.idMap;
        var walk = function (el) {
            var id = el.getAttribute("data-cloud9-id");
            if (idMap[id])
                el.setAttribute("data-cloud9-id", idMap[id]);
            var ch = el.children;
            for (var i = 0; i < ch.length; i++) walk(ch[i]);
        };
        walk(document.documentElement);
    }
    else if (docState.dom) {
        var dom = docState.dom;
        if (!dom.children || document.documentElement.hasAttribute("data-cloud9-id"))
            return;
        var filter = function(dom) {
            return dom.children = dom.children && dom.children.filter(function(x) {
                if (x.children)
                    return filter(x);
            });
        };
        filter(dom);
        
        var init = function(htmlNode, dom) {
            htmlNode.setAttribute("data-cloud9-id", dom.tagID);
            var children = htmlNode.children;
            var domChildren = dom.children;
            var match = false;
            for (var i = 0, j = 0; i < children.length; i++) {
                var htmlCh = children[i];
                var domCh = domChildren[j];
                j++;
                if (!domCh || domCh.tag !== htmlCh.tagName.toLowerCase())
                    continue;
                match = true;
                init(children[i], domChildren[i]);
            }
            if (domChildren.length != children.length) {
                if (!match && children.length == 1)
                    init(children[0], dom);
            }
        };
        
        document.documentElement.setAttribute("data-cloud9-id", 1);
        var head = document.head;
        var body = document.body;
        head.setAttribute("data-cloud9-id", 2);
        body.setAttribute("data-cloud9-id", 3);
        var root = {
            children: [],
            setAttribute: function() {}
        };
        for (var ch = head.children, i = 0; i < ch.length; i++) {
            root.children.push(ch[i]);
        }
        for (var ch = body.children, i = 0; i < ch.length; i++) {
            root.children.push(ch[i]);
        }
        
        var flatten = function(node, i) {
            var args = [i, 1].concat(node.children[i].children);
            node.children.splice.apply(node.children, args);
        };
        
        if (dom.tag == "html") {
            for (var ch = dom.children, i = ch.length; i--;) {
                if (ch[i].tag == "head" || ch[i].tag == "body")
                    flatten(dom, i);
            }
        }
        
        init(root, dom);
    }
    if (docState.edits)
        this.apply(docState.edits);
};

/**
 *
 * @param {Element} elem
 */
function _domElementToJSON(elem) {
    var json = { tag: elem.tagName.toLowerCase(), attributes: {}, children: []},
        i,
        len,
        node,
        value;
    
    len = elem.attributes.length;
    for (i = 0; i < len; i++) {
        node = elem.attributes.item(i);
        value = (node.name === "data-cloud9-id") ? parseInt(node.value, 10) : node.value;
        json.attributes[node.name] = value;
    }
    
    len = elem.childNodes.length;
    for (i = 0; i < len; i++) {
        node = elem.childNodes.item(i);
        
        // ignores comment nodes and visuals generated by live preview
        if (node.nodeType === Node.ELEMENT_NODE && node.className !== HIGHLIGHT_CLASSNAME) {
            json.children.push(_domElementToJSON(node));
        } else if (node.nodeType === Node.TEXT_NODE) {
            json.children.push({ content: node.nodeValue });
        }
    }
    
    return json;
}

function getSimpleDOM() {
    return JSON.stringify(_domElementToJSON(document.documentElement));
}

// init
var editHandler = new DOMEditHandler(window.document);

// Update Style Rule
function findCssRule(name, stylesheet) {
    // chrome normalizes pseudo-elements to :: and firefox to :
    name = name.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1')
        .replace(/::?(after|before)/g, "::?$1");
    var nameRe = new RegExp("^" + name + "$", "i");
    var rules, i;
    
    if (!stylesheet) {
        var sheets = window.document.styleSheets;
        for (var j = sheets.length - 1; j >= 0; j--) {
            try {
                rules = sheets[j].cssRules;
                for (i = 0; i < rules.length; i++) {
                    if (nameRe.test(rules.item(i).selectorText)) {
                        return rules.item(i);
                    }
                }
            }
            catch (e) {}
        }
    }
    else {
        if (typeof stylesheet == "number")
            stylesheet = window.document.styleSheets[stylesheet || 0];
        rules = stylesheet.cssRules;
        if (!rules) return false;
        for (i = 0; i < rules.length; i++) {
            if (nameRe.test(rules.item(i).selectorText)) {
                return rules.item(i);
            }
        }
    }
}

/**
 * This method sets a single CSS rule.
 * @param {String} name         The CSS name of the rule (i.e. `.cls` or `#id`).
 * @param {String} type         The CSS property to change.
 * @param {String} value        The CSS value of the property.
 * @param {String} [stylesheet] The name of the stylesheet to change.
 * @param {Object} [win]        A reference to a window
 */
function setStyleRule(name, type, value, stylesheet, win) {
    var rule = findCssRule(name, stylesheet);
    if (rule) {
        if (value.indexOf("!important") > -1) {
            rule.style.cssText = type + ":" + value;
        } else {
            type = type.replace(/-(\w)/g, function(_, a) {return a.toUpperCase();});
            rule.style[type] = value;
        }
    }
    return !!rule;
}

function updateStyleRule(url, rule) {
    var link = reloader.findStylesheet(url);
    if (!link) return;
    
    setStyleRule(rule.selector, rule.key, rule.value, 
        link.object.rule ? link.object.rule.styleSheet : link.object.node.sheet);
}

function send(message) {
    if (!session) return;
    
    message.id = session.id;
    parent.postMessage(message, 
        host == "local" ? "*" : host);
}

window.addEventListener("message", function(e) {
    if (e.data == "start-c9-livecss") {
        parent = e.source;
        init(id);
    }
});

// Make sure everything is loaded
if (parent != window)
    init(id);

})();
