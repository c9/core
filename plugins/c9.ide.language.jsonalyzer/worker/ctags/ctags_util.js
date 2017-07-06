/*
 * jsonalyzer CTAGs-based analyzer utility functions
 *
 * @class ctags_util
 */
define(function(require, exports, module) {

var assert = require("c9/assert");
var workerUtil = require("plugins/c9.ide.language/worker_util");
var jsonalyzer;

var MAX_DOCHEAD_LENGTH = 80;
var EXTENSION_GROUPS;

module.exports.MAX_DOCHEAD_LENGTH = MAX_DOCHEAD_LENGTH;

module.exports.EXTENSION_GROUPS = EXTENSION_GROUPS;

module.exports.init = function(ctags, _jsonalyzer) {
    if (typeof _jsonalyzer === "function") {
        // called by server; return callback()
        return _jsonalyzer();
    }
    
    jsonalyzer = _jsonalyzer || jsonalyzer;
    EXTENSION_GROUPS = ctags.LANGUAGES.map(function(l) { return l.extensions; });
};

module.exports.extractDocumentationAtRow = function(lines, row) {
    var prevRow = row > 0 ? row - 1 : 0;
    
    // # hash comments
    var line = lines[prevRow];
    if (line && line.match(/^\s*#/)) {
        line = line.match(/^\s*#\s*(.*)/)[1];
        var results = [line];
        for (var start = prevRow - 1; start >= 0; start--) {
            line = lines[start];
            if (!line.match(/^\s*#/))
                break;
            results.push(line.match(/^\s*#\s*(.*)/)[1]);
        }
        return workerUtil.filterDocumentation(results.join("\n"));
    }

    // """ python docstrings """
    if (lines[row + 1] && lines[row + 1].match(/^\s*"""/)) {
        var result = "";
        for (var cur = row + 1; lines[cur]; cur++) {
            result += lines[cur].replace(/^\s*|\s*"""\s*/g, "") + "\n";
            if (lines[cur].match(/[^\s"]+\s*"""/))
                break;
        }
        return result;
    }
    
    // /* c style comments */
    var end = null;
    for (var cur = prevRow; cur >= 0; cur--) {
        line = lines[cur];
        for (var col = line.length - 2; col >= 0; col--) {
            if (!end) {
                if (line.substr(col, 2) === "*/") {
                    end = { sl: cur, sc: col };
                    col--;
                } else if (!line[col].match(/[\s\/]/)) {
                    return;
                }
            } else if (line.substr(col, 2) === "/*") {
                var rows = ["", line.substr(col + 3)];
                for (var r = cur + 1; r < end.sl; r++)
                    rows.push(lines[r]);
                rows.push(lines[end.sl].substr(0, end.sc));
                if (end.sl === cur)
                    rows = ["", line.substring(col + 3, end.sc)];
                return workerUtil.filterDocumentation(rows.join("\n"));
            }
        }
    }
};

/**
 * Find all summary entries that match the given tags.
 *
 * @param {String} path
 * @param {String} docValue
 * @param {Object} tag
 * @param {RegExp} tag.regex
 * @param {String} tag.kind
 * @param {Boolean} tag.docOnly
 * @param {Boolean} extractDocumentation
 * @param {Boolean} guessFargs
 * @param {Object[]} [results]
 */
module.exports.findMatchingTags = function(path, docValue, tag, guessFargs, extractDocumentation, results) {
    assert(tag.regex.global, "Regex must use /g flag: " + tag.regex);
    var _self = this;
    var lines = path === jsonalyzer.path && jsonalyzer.doc
        ? jsonalyzer.doc.getAllLines()
        : docValue.split(/\n/);
    
    docValue.replace(tag.regex, function(fullMatch, name, offset) {
        assert(typeof offset === "number", "Regex must have exactly one capture group: " + tag.regex);
        
        var addedOffset = fullMatch.indexOf(name);
        var row = getOffsetRow(docValue, offset + (addedOffset === -1 ? 0 : addedOffset));
        var line = lines[row];
        
        var doc, docHead;
        if (extractDocumentation && line) {
            docHead = line.length > MAX_DOCHEAD_LENGTH
                ? line.substr(line.length - MAX_DOCHEAD_LENGTH) + "..."
                : line;
            doc = _self.extractDocumentationAtRow(lines, row);
        }
        
        results["_" + name] = results["_" + name] || [];
        
        if (tag.docOnly) { // HACK: tag that only contributes documentation
            if (!doc)
                return;
            if (results["_" + name][0]) {
                results["_" + name][0].doc = doc;
                return;
            }
        }
        
        results["_" + name].push({
            row: row,
            docHead: docHead,
            guessFargs: guessFargs,
            doc: doc,
            kind: tag.kind,
            indent: tag.indent,
        });
        return fullMatch;
    });
    
    return results;
};

/**
 * Find all open files with a file extension that matches that of the current path.
 *
 * @param {String} path
 * @return {String[]}
 */
module.exports.findMatchingOpenFiles = function(path) {
    var openFiles = workerUtil.getOpenFiles();
    var extension = getExtension(path);
    var supported = getCompatibleExtensions(extension);
    var imports = openFiles.filter(function(path) {
        return supported.indexOf(getExtension(path)) > -1;
    });
    return imports;
};

module.exports.guessFargs = function(line, name) {
    if (!line)
        return "";
    var guess = /\([A-Za-z0-9$_,\s]*(\))?/;
    guess.lastIndex = line.indexOf(name) + name.length;
    var match = guess.exec(line);
    return match && match[0] + (match[1] ? "" : "...") || "";
};

function getExtension(path) {
    return path.match(/[^\.\\\/]*$/)[0];
}

/**
 * Get an array of compatible extensions, e.g. ["js", "html"] for "js".
 */
function getCompatibleExtensions(extension) {
    for (var i = 0; i < EXTENSION_GROUPS.length; i++) {
        if (EXTENSION_GROUPS[i].indexOf(extension) > -1)
            return EXTENSION_GROUPS[i];
    }
    return [extension];
}

var getOffsetRow = module.exports.getOffsetRow = function(contents, offset) {
    var result = 0;
    var lastIndex = offset + 1;
    for (;;) {
        lastIndex = lastIndex === 0
            ? -1
            : contents.lastIndexOf("\n", lastIndex - 1);
        if (lastIndex < 0)
            return result;
        result++;
    }
};

/**
 * @deprecated Use {@link language.worker_util#filterDocumentation} instead.
 */
module.exports.filterDocumentation = workerUtil.filterDocumentation;

module.exports.getParameterDocs = function(doc) {
    var result = {};
    doc && doc.replace(
        /@param (?:\{[^}]*\} )?([^ ]*)\s+([^@]*)/g,
        function(input, name, description) {
            result["_" + name] = workerUtil.filterDocumentation(description);
            return input;
        }
    );
    return result;
};

});