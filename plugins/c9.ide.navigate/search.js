/**
 * File name and definition search for the Cloud9
 *
 * @copyright 2013, Ajax.org B.V.
 */

define(function(require, exports, module) {

var Heap = require("./heap");

var fileTypes = {
    "js": 1, "json": 11, "css": 5, "less": 5, "scss": 5, "sass": 5, "xml": 11, 
    "rdf": 15, "rss": 15, "svg": 5, "wsdl": 11, "xslt": 5, "atom": 5, 
    "mathml": 5, "mml": 5, "php": 1, "phtml": 1, "html": 5, "xhtml": 5, 
    "coffee": 1, "py": 1, "ru": 1, "gemspec": 5, "rake": 5, "rb": 1, "c": 1, 
    "cc": 1, "cpp": 1, "cxx": 1, "h": 2, "hh": 2, "hpp": 2, "cs": 1, "java": 1, 
    "clj": 1, "groovy": 1, "logic": 1, "lql": 1, "scala": 1, "ml": 1, "mli": 1, "md": 2, 
    "markdown": 2, "textile": 5, "latex": 5, "tex": 5, "ltx": 5, "lua": 1, 
    "pl": 1, "pm": 2, "ps1": 1, "cfm": 1, "sql": 2, "sh": 1, "bash": 1, 
    "bmp": 10, "djv": 10, "djvu": 10, "gif": 10, "ico": 10, "jpg": 10, 
    "jpeg": 10, "pbm": 10, "pgm": 10, "png": 10, "pnm": 10, "ppm": 10, 
    "psd": 10, "tiff": 10, "xbm": 10, "xpm": 10,
    "go": 5, "hx": 5, "yaml": 5, "psql": 2
};

/**
 * Search through a list of filenames.
 */
module.exports.fileSearch = function(filelist, keyword) {
    if (!keyword) keyword = "";
    
    var klen = keyword.length;
    var keywordLower = keyword.toLowerCase();

    /**
     * FULL MATCHES                              >= 50
     *   full filename with extension             1000
     *   name part without the extension           201
     *   start of filename                         200
     *   part of filename                          100
     *   depth of path (or length to optimize)     200 - 10 * count("/")
     *   full part of path                          50
     *
     * SCATTERED MATCHES                         <= 45
     *   number of match groups                     20 - 3 * #groups
     *   path depth                                 15 - 2 * count("/")
     *   match diff                                 10 - len(diff)
     *
     * Extension weight                             -1 * lut[ext]
     */

    var type = "value";
    var toS = function() {
        return this[type];
    };
    
    var newlist = [];
    var l = filelist.length;
    var big = l > 50000;
    
    var name, res = big ? [] : new Heap(), value, ext, displayName;
    for (var i = 0, s, j, k, q, p, m, n; i < l; i++) {
        displayName = filelist[i];
        name = displayName.toLowerCase();

        // We only add items that have the keyword in it's path
        value = 0;
        if ((j = name.lastIndexOf(keywordLower)) > -1) {
            if (big) {
                res.push(displayName);
                continue;
            }
            // We prioritize ones that have the name in the filename
            if (j > (q = name.lastIndexOf("/"))) {
                k = name.lastIndexOf("/" + keywordLower);
                if (k > -1) {
                    // We give first prio to full filename matches
                    if (name.length == klen + 1 + k)
                        value += 1000;

                    // Then to match of name prior to extension
                    else if (name.lastIndexOf(".") == k + klen + 1)
                        value += 201;

                    // Then to matches from the start of the filename
                    else if (k == q)
                        value += 200;

                    // Then anywhere in the filename
                    else
                        value += 100;
                }

                // The shorter the path depth, the higher prio we give
                value += 200 - Math.min(name.split("/").length * 10, 150);
            }
            // Detect a path search
            else if (keywordLower.indexOf("/") > -1) {
                var idx = keywordLower.lastIndexOf("/");
                var rest = name.substr(j + idx + 1);
                var file = keywordLower.substr(idx + 1);
                
                // We give prio to full path matches
                if (j === 0)
                    value += 1000;
                
                // When searching for a file extension, 
                if (file.indexOf(".") > -1) {
                    // Prioritize filename matches
                    if (rest.indexOf(file) === 0)
                        value += 200;
                    
                    // The shorter the filename length, the higher prio we give
                    value += 200 - Math.min((rest.length - file.length) * 10, 150);
                }
                // When the full filename is matched, give a higher prio
                else if (rest.substr(file.length).match(/^\..*(\/|$)/))
                    value += 201;
                else
                    value += 50;
            }
            // Then the rest
            else
                value += 50;
        }
        // Check for spatial matches
        else {
            if (big || name.split("/").length > 10)
                continue;
                
            var result;
            result = matchPath(name, keywordLower);
            if (!result.length || result.length > 20)
                continue;
                
            var matched = name.substring(result[0].val.length);
            // The less the number of groups matched, the higher prio we give
            value += 20 - Math.min((result.length - 2) * 3, 19);
            // The shorter the path depth, the higher prio we give
            value += 15 - Math.min(name.split("/").length * 2, 14);
            // The shorter the match diff, the higher prio we give
            value += 10 - Math.min(matched.length - keyword.length, 9);
            value += 20; // extension
        }

        if (value > 0) {
            newlist.push(displayName);
            
            // Check extension
            s = name.lastIndexOf(".");
            if (s > -1)
                value -= 10 * (fileTypes[name.substr(s + 1)] || 0) || 20;
            else
                value -= 20;

            if (res.size() === 100 && value > res.min().value)
                res.pop();
            if (res.size() < 100)
                res.push({
                    toString: toS,
                    value: value,
                    name: displayName
                });
        }
    }

    if (big) {
        res.newlist = res;
        return res;
    }

    var ret = [];
    while (res.size())
        ret.unshift(res.pop().name);
    
    ret.newlist = newlist;

    return ret;
};

// function score (e, term) {
//     var c = 0,
//         d = term.length,
//         f = e.length,
//         g, h, i = 1,
//         j;
//     if (e == term) return 1;
//     for (var k = 0, l, m, n, o, p, q; k < d; ++k) {
//         n = term[k], o = e.indexOf(n.toLowerCase()), p = e.indexOf(n.toUpperCase()), q = Math.min(o, p), m = q > -1 ? q : Math.max(o, p);
//         if (m === -1) {
//             return 0;
//         }
//         l = .1, e[m] === n && (l += .1), m === 0 ? (l += .6, k === 0 && (g = 1)) : e.charAt(m - 1) === " " && (l += .8), e = e.substring(m + 1, f), c += l
//     }
//     return h = c / d, j = (h * (d / f) + h) / 2, j /= i, g && j + .15 < 1 && (j += .15), j
// };

var treeSearch = module.exports.treeSearch = function(tree, keyword, caseInsensitive, results, head, indexProperty) {
    if (caseInsensitive)
        keyword = keyword.toLowerCase();
    
    results = results || [];
    head = head || 0;
    
    for (var i = 0; i < tree.length; i++) {
        var node = tree[i];
        var name = indexProperty
            ? node[indexProperty] || ""
            : node.name || node.label || node.caption || (typeof node == "string" ? node : "");
            
        if (caseInsensitive)
            name = name.toLowerCase();
            
        var index = name.indexOf(keyword);
        if (index === -1) {
            if (node.items && !node.keepChildren)
                results = treeSearch(node.items, keyword, caseInsensitive, results, head);
            continue;
        }
        
        var result = node.clone ? node.clone() : {};
        result.items = node.items
            ? (result.keepChildren
                ? result.items
                : treeSearch(node.items, keyword, caseInsensitive))
            : [];
        
        if (!node.clone) {
            for (var p in node) {
                if (node[p] && p !== "items")
                    result[p] = node[p];
            }
        }
        
        if (index === 0) {
            results.splice(head, 0, result);
            head++;
        }
        else {
            results.push(result);
        }
    }
    return results;
};

var matchPath = module.exports.matchPath = function (path, keyword) {
    var result = [];
    var pathSplits = path.split("/");
    // Optimization
    if (pathSplits.length > 4) {
        pathSplits = [pathSplits.slice(0, pathSplits.length - 4).join("/") + "/"]
            .concat(pathSplits.slice(pathSplits.length - 4, pathSplits.length));
        if (pathSplits[0] == "/")
            pathSplits[0] = "";
    }
    var value = "";
    var k, i, j = -1;
    for (k = pathSplits.length - 1; k >= 0 && !result.length; k--) {
        value = (k > 0 ? "/" : "") + pathSplits[k] + value;
        // find matched parts
        var matchI = null;
        var missI = null;
        for (i = 0, j = 0; i < value.length && j < keyword.length; i++) {
            if (value[i] === keyword[j]) {
                matchI = matchI === null ? i : matchI;
                j++;
                if (missI !== null) {
                    result.push({ val: value.substring(missI, i) });
                    missI = null;
                }
            }
            else {
                missI = missI === null ? i : missI;
                if (matchI !== null) {
                    result.push({ match: true, val: value.substring(matchI, i) });
                    matchI = null;
                }
            }
        }
        if (j !== keyword.length) {
            result = [];
            continue;
        }

        if (missI !== null)
            result.push({ val: value.substring(missI, i) });
        if (matchI !== null)
            result.push({ match: true, val: value.substring(matchI, i) });
        result.push({ val: value.substring(i, value.length) });
        // Add the first non matched part if exists
        if (k)
            result.unshift({ val: pathSplits.slice(0, k).join('/') });
    }
    return result;
};

});
