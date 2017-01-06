define(function(require, exports, module) {

var fileIndexer = require("./file_indexer");
var assert = require("c9/assert");
var ctagsUtil = require("./ctags/ctags_util");
var handler;

module.exports.init = function(_handler) {
    handler = _handler;
};

module.exports.outline = function(doc, ast, callback) {
    return fileIndexer.analyzeCurrent(handler.path, doc.getValue(), ast, { service: "outline" }, function(err, entry) {
        if (err) {
            console.error(err);
            return callback(); // can't pass error to this callback
        }
        
        var result = createOutline(null, entry, -1);
        var rootInfo = {
            displayPos: { el: doc.getLength() - 1 }
        };
        result = addDisplayPos(result, rootInfo);
        result.isGeneric = true;
        callback(result);
    });
};

function createOutline(name, entry, defaultIndent, parent) {
    var indent = entry.indent || defaultIndent;
    var fullName = entry.guessFargs
        ? name + ctagsUtil.guessFargs(entry.docHead, name)
        : name;
    var result = {
        icon: entry.icon || entry.kind,
        name: fullName,
        pos: { sl: entry.row, sc: entry.column },
        items: [],
        indent: indent,
        parent: parent,
    };
    if (!entry.properties)
        return result;
    assert(!Array.isArray(entry.properties));
    
    for (var uname in entry.properties) {
        entry.properties[uname].forEach(function(prop) {
            result.items.push(createOutline(uname.substr(1), prop, indent + 1, result));
        });
    }
    
    // Sort out-of-order parsed outline; not needed with flat/indent outline
    result.items = sortOutline(result.items);
    var candidateParent;
    result.items = result.items.filter(function(prop) {
        var parent = findParent(prop, candidateParent);
        if (parent !== result)
            parent.items.push(prop);
        else
            candidateParent = prop;
        return parent === result;
    });
    return result;
    
    function findParent(prop, parent) {
        if (!prop.indent || prop.indent <= indent || !parent)
            return result;
        
        if (parent.indent >= prop.indent)
            return findParent(prop, parent.parent);
            
        return parent;
    }
}

function sortOutline(items) {
    return items.sort(function(a, b) {
        return a.pos.sl - b.pos.sl;
    });
}

function addDisplayPos(outline, parent) {
    if (!outline.items)
        return outline;
    outline.displayPos = outline.displayPos || outline.pos;
    for (var i = 0; i < outline.items.length; i++) {
        var item = outline.items[i];
        var next = outline.items[i + 1];
        var nextLine = next ? next.pos.sl : parent.displayPos.el;
        item.displayPos = item.pos;
        item.pos = {
            sl: item.pos.sl,
            sc: item.pos.sc,
            el: nextLine,
            ec: nextLine > item.pos.sl ? 0 : item.pos.ec
        };
        addDisplayPos(item, outline);
    }
    return outline;
}

});