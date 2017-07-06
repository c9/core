var fs = require('fs');
var marked = require('marked');
var util = require("./util");
var patch = require("./patch.js");
var addLinkTargets = util.addLinkTargets;
var stripHtml = util.stripHtml;
var nodeJSON = JSON.parse(fs.readFileSync(__dirname + "/nodemanual.input.jst", 'UTF-8'));
var builtins = JSON.parse(fs.readFileSync(__dirname + "/../builtin.jst", 'UTF-8'));
var VERSION = "latest";
var URL_PREFIX = "http://nodemanual.org/" + VERSION + "/nodejs_ref_guide/";
var GUID_PREFIX = "nodejs_" + VERSION + ":";
var KIND_PACKAGE = "package";
var KIND_HIDDEN = "hidden";
var KIND_DEFAULT = undefined;
var LINK_TARGET = "c9doc";

marked.setOptions({
  gfm: true,
  pedantic: false,
  sanitize: false,
  /* callback for code highlighter
  highlight: function(code, lang) {
    if (lang === 'js') {
      return javascriptHighlighter(code);
    }
    return code;
  }
  */
});

function Container(id) {
    this.guid = toC9TypeName(id);
    this.properties = {
        _prototype: [{
            guid: this.guid + "/prototype",
            properties: {}
        }]
    };
    this.kind = this.guid.match("/") ? KIND_HIDDEN : KIND_PACKAGE;
    console.log(this.guid);
}

Container.prototype.add = function(id, property) {
    var props;
    if (isStatic(property, this)) {
        props = this.properties;
        property.guid = this.guid + "/" + property.guid;
        // console.log(this.guid + ":" + id);
    } else {
        props = this.properties._prototype[0].properties;
        property.guid = this.guid + "/prototype/" + property.guid;
        // console.log(this.guid + "." + id);
    }
    var targetProps = props["_" + id] = props["_" + id] || [];
    targetProps.push(property);
};

function Property(parent, id) {
    this.guid = id;
    this.properties = {};
}

function extractRoot(root) {
    var results = {};
    /* Preprocess classes to recognize globals
    for (var i = 0; i < root.tree.children.length; i++) {
        var child = root.tree.children[i];
        if (child.type === "class")
            extractItem(child, results);
    }
    */
    // Process all children
    for (var i = 0; i < root.tree.children.length; i++) {
        var child = root.tree.children[i];
        extractItem(child, results);
    }
    return results;
}

function extractItem(item, results) {
    if (item.id === "Modules") // HACK: Modules is not a class
        return;

    if (item.type === "class method" || item.type === "class property")
        extractProperty(item, results);
    else if (item.type === "class")
        extractContainer(item, results);
    else if (item.type === "constructor")
        extractConstructor(item, results);
    else if (item.type === "event")
        extractEvent(item, results);
    else
        throw new Error("Unknown item type: " + item.type);
}

function extractContainer(item, results) {
    var matcher = item.id.match(/^(.*)\.(.*?)$/);
    if (matcher) {
        var parentId = matcher[1];
        var parentClass = results[toC9TypeName(parentId)];
        if (!parentClass)
            parentClass = results[toC9TypeName(parentId)] = new Container(parentId);
    }
    
    var result = results[toC9TypeName(item.id)] || new Container(item.id);
    results[toC9TypeName(item.id)] = result;
    
    // TODO: don't copy doc from class to _prototype??
    result.docUrl = result.properties._prototype.docUrl = extractDocUrl(item);
    result.doc = result.properties._prototype.doc = extractDoc(item);
    
    if (result.kind === KIND_PACKAGE && (isClassNotPackage(item) || matcher)) {
        result.kind = KIND_DEFAULT;
        // TODO: prototype chain
    }
    
    for (var i = 0; i < item.children.length; i++) {
        extractItem(item.children[i], results);
    }
}

function isClassNotPackage(item) {
    if (item.metadata) {
        if (item.metadata.indexOf)
            item.metadata = JSON.parse(item.metadata);
        if (item.metadata.type === "global")
            return true;
    }
    // HACK: assume if something is a constructor, it is a class with instance properties
    for (var i = 0; i < item.children.length; i++) {
        if (item.children[i].type === "constructor")
            return true;
    }
    
    return false;
}

function isStatic(property, container) {
    // HACK: we don't have metadata for this yet
    return container.kind === "package" ||
        property.guid.match(/^[A-Z]/) || container.guid.match("(/|:)[a-z][^/]*$");
}

function extractProperty(item, results, isConstructor) {
    var matcher = item.id.match(/^(.*)\.(.*?)$/);
    var parentId = matcher[1];
    var childId = matcher[2];
    var parentClass = results[toC9TypeName(parentId)];
    if (!parentClass)
        parentClass = results[toC9TypeName(parentId)] = new Container(parentId);
    
    var signatures = item.signatures || [{}];
    
    for (var i = 0; i < signatures.length; i++) {
        var signature = signatures[i];
        var result = new Property(parentClass, childId + "[" + i + "]");
        result.docUrl = extractDoc(signature) || extractDocUrl(item);
        result.doc = extractDoc(item) || extractDoc(item);
        extractSignature(item, signature, result);
        if (isConstructor)
            extractSignature(item, signature, parentClass);
        parentClass.add(childId, result);
    }
}

function extractSignature(item, signature, result) {
    var returns = extractType(signature.returns ? signature.returns[0].type : null);
    
    if (item.type === "class property") {
        result.properties.___proto__ = returns;
        return;
    }
    
    result.properties._return = returns;
    result.fargs = [];
    result.properties.___proto__ = result.properties.___proto__ || [];
    result.properties.___proto__.push("es5:Function/prototype");

    if (!signature.args)
        return;

    extractSignatureArgs(signature, result.fargs);
}

function extractSignatureArgs(signature, results) {
    for (var i = 0; i < signature.args.length; i++) {
        // TODO: store callback signatures
        //       for example, see readline.interface.question
        // TODO: store function sig like { name: 'callback', args: [], optional: true }
        var arg = signature.args[i];
        var argFargs = arg.args && extractSignatureArgs(arg, []);
        results.push({
            id: arg.name,
            type: extractType(arg.type),
            doc: arg.description,
            opt: arg.optional,
            fargs: argFargs
        });
    }
    return results;
}

function extractConstructor(item, results) {
    item.id = item.id.replace(/^new (.*)/, "$1") + ".constructor";
    extractProperty(item, results, true);
}

function extractEvent(item, results) {
    // TODO: extract events?
}

function extractType(type) {
    if (type) {
        if (builtins["es5:" + type])
            return ["es5:" + type + "/prototype"];
        else if (type instanceof Array)
            return type.map(extractType);
        else
            return [toC9TypeName(type) + "/prototype"];
    }
    else {
        return ["es5:Object/prototype"];
    }
}

function toC9TypeName(typename) {
    return GUID_PREFIX + typename.replace(/\./g, "/");
}

function extractDocUrl(item) {
    // TODO: why do urls like http://nodemanual.org/latest/nodejs_ref_guide/debugger.html#L145 not exist?
    return URL_PREFIX + item.resultingFile;
}

function extractDoc(item) {
    if (!item.short_description || item.short_description.match(/^Stability:[^\\]*(\\n[^\\]*)?/))
        return null;
    // TODO: support (some) documentation links?
    var result = marked(item.short_description);
    result = result.replace(/\[\[[^ \]]+\s+([^\]]+)\]\]/gm, "$1");
    result = result.replace(/\[([^\]]+)\]\([^\)]+\)/gm, "$1");
    result = addLinkTargets(result, LINK_TARGET);
    return result;
}

var allResults = extractRoot(nodeJSON);
allResults = patch.patchNodemanual(allResults);
fs.writeFileSync(__dirname + "/../builtin.nodejs.jst", JSON.stringify(allResults, null, 2), "UTF-8");

