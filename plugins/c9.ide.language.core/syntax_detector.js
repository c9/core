/**
 * Cloud9 Language Foundation
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {

var mixedLanguages = {
    php: {
        "default": "html",
        "php-start": /<\?(?:php|\=)?/,
        "php-end": /\?>/,
        "css-start": /<style[^>]*>/,
        "css-end": /<\/style>/,
        "javascript-start": /<script(?:\"[^\"]*\"|'[^']*'|[^'">])*>/,
        "javascript-end": /<\/script>/
    },
    html: {
        "css-start": /<style[^>]*>/,
        "css-end": /<\/style>/,
        "javascript-start": /<script(?:\"[^\"]*\"|'[^']*'|[^'">])*>/,
        "javascript-end": /<\/script>/
    }
};
mixedLanguages.handlebars = mixedLanguages.html;
var scriptTypeTests = {
    javascript: function(v) {
        var m = /type\s*=\s*("[^"]+"|'[^']+'|[^\s'">]+)/.exec(v);
        if (m && !/javascript|ecmascript/i.test(m[1]))
            return false;
        return true;
    }
};
/* Now:
 * - One level syntax nesting supported
 * Future: (if worth it)
 * - Have a stack to repesent it
 * - Maintain a syntax tree for an opened file
 */
function getSyntaxRegions(doc, originalSyntax) {
     if (!mixedLanguages[originalSyntax])
        return [{
            syntax: originalSyntax,
            sl: 0,
            sc: 0,
            el: doc.getLength() - 1,
            ec: doc.getLine(doc.getLength() - 1).length
        }];

    var lines = doc.getAllLines();
    var type = mixedLanguages[originalSyntax];
    var defaultSyntax = type["default"] || originalSyntax;
    var starters = Object.keys(type).filter(function (m) {
        return m.indexOf("-start") === m.length - 6;
    });
    var syntax = defaultSyntax;
    var regions = [{ syntax: syntax, sl: 0, sc: 0 }];
    var starter, endLang;
    var tempS, tempM;
    var i, m, cut, inLine = 0;

    for (var row = 0; row < lines.length; row++) {
        var line = lines[row];
        m = null;
        if (endLang) {
            m = endLang.exec(line);
            if (m) {
                endLang = null;
                syntax = defaultSyntax;
                regions[regions.length - 1].el = row;
                regions[regions.length - 1].ec = m.index + inLine;
                regions.push({
                    syntax: syntax,
                    sl: row,
                    sc: m.index + inLine
                });
                cut = m.index + m[0].length;
                lines[row] = line.substring(cut);
                inLine += cut;
                row--; // continue processing of the line
            }
            else {
                inLine = 0;
            }
        }
        else {
            for (i = 0; i < starters.length; i++) {
                tempS = starters[i];
                tempM = type[tempS].exec(line);
                if (tempM && (!m || m.index > tempM.index)) {
                    m = tempM;
                    starter = tempS;
                }
            }
            if (m) {
                syntax = starter.replace("-start", "");
                if (scriptTypeTests[syntax] && !scriptTypeTests[syntax](m[0]))
                    syntax = defaultSyntax;
                endLang = type[syntax + "-end"];
                regions[regions.length - 1].el = row;
                regions[regions.length - 1].ec = inLine + m.index + m[0].length;
                regions.push({
                    syntax: syntax,
                    sl: row,
                    sc: inLine + m.index + m[0].length
                });
                cut = m.index + m[0].length;
                lines[row] = line.substring(m.index + m[0].length);
                row--; // continue processing of the line
                inLine += cut;
            }
            else {
                inLine = 0;
            }
        }
    }
    regions[regions.length - 1].el = lines.length;
    regions[regions.length - 1].ec = lines[lines.length - 1].length;
    return regions;
}

function getContextSyntaxPart(doc, pos, originalSyntax) {
     if (!mixedLanguages[originalSyntax]) {
        var value;
        var result = {
            language: originalSyntax,
            region: getSyntaxRegions(doc, originalSyntax)[0],
            index: 0,
            getLine: function(l) {
                return doc.getLine(l);
            },
            getLines: function(firstRow, lastRow) {
                return doc.getLines(firstRow, lastRow);
            },
            getAllLines: function() {
                return doc.getAllLines();
            },
            getValue: function() {
                if (!value)
                    value = doc.getValue();
                return value;
            },
            getLength: function() {
                return doc.getLength();
            }
        };
        // TODO: remove this; not exposed as public API
        result.__defineGetter__("value", function() {
            console.error("part.value is deprecated: use getValue() instead");
            return this.getValue();
        });
        return result;
    }
    var regions = getSyntaxRegions(doc, originalSyntax);
    for (var i = 0; i < regions.length; i++) {
        var region = regions[i];
        if ((pos.row > region.sl && pos.row < region.el) ||
            (pos.row === region.sl && pos.column >= region.sc && pos.column <= region.ec))
            return regionToCodePart(doc, region, i);
    }
    return null; // should never happen
}

function getContextSyntax(doc, pos, originalSyntax) {
    var part = getContextSyntaxPart(doc, pos, originalSyntax);
    return part && part.language; // should never happen
}

function regionToCodePart(doc, region, index) {
    var lines = doc.getLines(region.sl, region.el);
    if (!lines.length) {
        console.error("region and document state are not consistent!!!");
        lines = [""];
    }
    var allLines;
    var value;
    var result = {
        language: region.syntax,
        region: region,
        index: index,
        getLines: function(firstRow, lastRow) {
            return this.getAllLines().slice(firstRow, lastRow + 1);
        },
        getLine: function(l) {
            if (region.sl === region.el)
                return lines[0].substring(region.sc, region.ec);
            if (l === 0)
                return lines[0].substring(region.sc);
            if (l === lines.length - 1)
                return lines[lines.length - 1].substring(0, region.ec);
            return lines[l];
        },
        getAllLines: function() {
            if (!allLines)
                allLines = region.sl === region.el
                    ? [lines[0].substring(region.sc, region.ec)]
                    : [lines[0].substring(region.sc)].concat(lines.slice(1, lines.length - 1)).concat([lines[lines.length - 1].substring(0, region.ec)]);
            return allLines;
        },
        getValue: function() {
            if (!value)
                value = this.getAllLines().join(doc.getNewLineCharacter());
            return value;
        },
        getLength: function() {
            return region.el - region.sl + 1;
        }
    };
    // TODO: remove this; not exposed as public API
    result.__defineGetter__("value", function() {
        console.error("part.value is deprecated: use getValue() instead");
        return this.getValue();
    });
    return result;
}

function getCodeParts(doc, originalSyntax) {
    var regions = getSyntaxRegions(doc, originalSyntax);
    return regions.map(function (region, i) {
        return regionToCodePart(doc, region, i);
    });
}

function posToRegion(region, pos) {
    if ("row" in pos)
        return {
            row: pos.row - region.sl,
            column: pos.column,
            path: pos.path
        };
    return {
        sl: pos.sl - region.sl,
        column: pos.sc,
        el: pos.el - region.sl,
        ec: pos.ec,
        path: pos.path
    };
}

function posFromRegion(region, pos) {
    if ("row" in pos)
        return {
            row: pos.row + region.sl,
            column: pos.column,
            path: pos.path
        };
    return {
        sl: pos.sl + region.sl,
        sc: pos.sc,
        el: pos.el + region.sl,
        ec: pos.ec,
        path: pos.path
    };
}

exports.getContextSyntax = getContextSyntax;
exports.getContextSyntaxPart = getContextSyntaxPart;
exports.getSyntaxRegions = getSyntaxRegions;
exports.getCodeParts = getCodeParts;
exports.posToRegion = posToRegion;
exports.posFromRegion = posFromRegion;

});