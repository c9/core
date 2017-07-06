/**
 * Completion utilities for language workers.
 * 
 * Import using
 * 
 *     require("plugins/c9.ide.language/complete_util")
 * 
 * @class language.complete_util
 */
define(function(require, exports, module) {

var ID_REGEX = /[a-zA-Z_0-9\$]/;
var REQUIRE_ID_REGEX = /(?!["'])./;
var staticPrefix = "";

function retrievePrecedingIdentifier(line, offset, regex) {
    regex = regex || ID_REGEX;
    var buf = [];
    for (var i = offset - 1; i >= 0 && line; i--) {
        if (regex.test(line[i]))
            buf.push(line[i]);
        else
            break;
    }
    return buf.reverse().join("");
}

function retrieveFollowingIdentifier(line, offset, regex) {
    regex = regex || ID_REGEX;
    var buf = [];
    for (var i = offset; line && i < line.length; i++) {
        if (regex.test(line[i]))
            buf.push(line[i]);
        else
            break;
    }
    return buf.join("");
}

function prefixBinarySearch(items, prefix) {
    var startIndex = 0;
    var stopIndex = items.length - 1;
    var middle = Math.floor((stopIndex + startIndex) / 2);
    
    while (stopIndex > startIndex && middle >= 0 && items[middle].indexOf(prefix) !== 0) {
        if (prefix < items[middle]) {
            stopIndex = middle - 1;
        }
        else if (prefix > items[middle]) {
            startIndex = middle + 1;
        }
        middle = Math.floor((stopIndex + startIndex) / 2);
    }
    
    // Look back to make sure we haven't skipped any
    while (middle > 0 && items[middle - 1].indexOf(prefix) === 0)
        middle--;
    return middle >= 0 ? middle : 0; // ensure we're not returning a negative index
}

function findCompletions(prefix, allIdentifiers) {
    allIdentifiers.sort();
    var startIdx = prefixBinarySearch(allIdentifiers, prefix);
    var matches = [];
    for (var i = startIdx; i < allIdentifiers.length && allIdentifiers[i].indexOf(prefix) === 0; i++)
        matches.push(allIdentifiers[i]);
    return matches;
}

function fetchTextSync(path) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', staticPrefix + "/" + path, false);
    try {
        xhr.send();
    }
    // Likely we got a cross-script error (equivalent with a 404 in our cloud setup)
    catch (e) {
        return false;
    }
    if (xhr.status === 200 || xhr.responseText) // when loading from file:// status is always 0
        return xhr.responseText;
    else
        return false;
}

function fetchText(path, callback) {
    var xhr = new XMLHttpRequest();
    try {
        xhr.open('GET', staticPrefix + "/" + path, true);
    } catch (e) {
        // ms edge throws an error here
        return done(e);
    }
    xhr.onload = function (e) {
        if (xhr.readyState !== 4)
            return;
        // loading from file:// returns 0
        if (xhr.status !== 200 && xhr.status !== 0)
            return done(new Error(xhr.statusText));
        done(null, xhr.responseText);
    };
    xhr.onerror = done;
    xhr.send(null);
    
    function done(err, result) {
        callback && callback(err, result);
        callback = null;
        if (err) {
            err.data = { path: path };
            setTimeout(function() { throw err; });
        }
    }
}

function setStaticPrefix(url) {
    staticPrefix = url;
}

/**
 * Determine if code completion results triggered for oldLine/oldPos
 * would still be applicable for newLine/newPos
 * (assuming you would filter them for things that no longer apply).
 */
function canCompleteForChangedLine(oldLine, newLine, oldPos, newPos, identifierRegex) {
    if (newLine.indexOf(oldLine.substr(0, oldPos.column)) !== 0)
        return false;
    
    for (var i = oldPos.column; i < newPos.column; i++) {
        if (!identifierRegex.test(newLine[i]))
            return false;
    }
    return true;
}

function precededByIdentifier(line, column, postfix, ace) {
    var id = retrievePrecedingIdentifier(line, column);
    if (postfix) id += postfix;
    return id !== "" && !(id[0] >= '0' && id[0] <= '9') 
        && (inCompletableCodeContext(line, column, id, ace) 
        || isRequireJSCall(line, column, id, ace));
}

function isRequireJSCall(line, column, identifier, ace, noQuote) {
    if (["javascript", "jsx"].indexOf(ace.getSession().syntax) === -1)
        return false;
    var id = identifier == null ? retrievePrecedingIdentifier(line, column, REQUIRE_ID_REGEX) : identifier;
    var LENGTH = 'require("'.length - (noQuote ? 1 : 0);
    var start = column - id.length - LENGTH;
    var substr = line.substr(start, LENGTH) + (noQuote ? '"' : '');

    return start >= 0 && substr.match(/require\(["']/)
        || line.substr(start + 1, LENGTH).match(/require\(["']/);
}

/**
 * Ensure that code completion is not triggered in comments and such.
 * Right now this only returns false when in a JavaScript regular expression.
 */
function inCompletableCodeContext(line, column, id, ace) {
    if (["javascript", "jsx"].indexOf(ace.getSession().syntax) === -1)
        return true;
    var isJavaScript = true;
    var inMode = null;
    for (var i = 0; i < column; i++) {
        if (line[i] === '"' && !inMode)
            inMode = '"';
        else if (line[i] === '"' && inMode === '"' && line[i - 1] !== "\\")
            inMode = null;
        else if (line[i] === "'" && !inMode)
            inMode = "'";
        else if (line[i] === "'" && inMode === "'" && line[i - 1] !== "\\")
            inMode = null;
        else if (line[i] === "/" && line[i + 1] === "/") {
            inMode = '//';
            i++;
        }
        else if (line[i] === "/" && line[i + 1] === "*" && !inMode) {
            if (line.substr(i + 2, 6) === "global")
                continue;
            inMode = '/*';
            i++;
        }
        else if (line[i] === "*" && line[i + 1] === "/" && inMode === "/*") {
            inMode = null;
            i++;
        }
        else if (line[i] === "/" && !inMode && isJavaScript)
            inMode = "/";
        else if (line[i] === "/" && inMode === "/" && line[i - 1] !== "\\")
            inMode = null;
    }
    return inMode != "/";
}

/**
 * @ignore
 * @return {Boolean}
 */
exports.precededByIdentifier = precededByIdentifier;

/**
 * @ignore
 */
exports.isRequireJSCall = isRequireJSCall;

/**
 * @internal Use {@link worker_util#getPrecedingIdentifier() instead.
 */
exports.retrievePrecedingIdentifier = retrievePrecedingIdentifier;

/**
 * @internal Use {@link worker_util#getFollowingIdentifier() instead. 
 */
exports.retrieveFollowingIdentifier = retrieveFollowingIdentifier;

/**
 * @ignore
 */
exports.findCompletions = findCompletions;

/**
 * @ignore
 */
exports.fetchText = fetchText;

/**
 * @ignore
 */
exports.fetchTextSync = fetchTextSync;

/**
 * @ignore
 */
exports.setStaticPrefix = setStaticPrefix;

/**
 * @ignore
 */
exports.DEFAULT_ID_REGEX = ID_REGEX;

/**
 * @ignore
 */
exports.canCompleteForChangedLine = canCompleteForChangedLine;
});