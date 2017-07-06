define(function(require, exports, module) {

var baseLanguageHandler = require('plugins/c9.ide.language/base_handler');

var handler = module.exports = Object.create(baseLanguageHandler);
    
handler.handlesLanguage = function(language) {
    return language === "javascript";
};

handler.handlesEditor = function() {
    return this.HANDLES_IMMEDIATE;
};

var requestId = 0;
handler.complete = function(doc, fullAst, pos, options, callback) {
    var currentNode = options.node;
    if (!currentNode || !currentNode.getPos())
        return callback();
    
    if (!isSafe(currentNode))
        return callback();
    
    var expr = getExpression(doc, currentNode.getPos());
    var myRequestId = ++requestId;
    
    this.sender.once("js_immediate_complete_results", function(e) {
        if (myRequestId !== e.data.id)
            return;
        callback(e.data.results);
    });
    this.sender.emit(
        "js_immediate_complete",
        {
            immediateWindow: this.immediateWindow,
            expr: expr,
            id: myRequestId
        }
    );
};

function isSafe(node) {
    var badNodes = node.collectTopDown(
        "Call(x, _)", function(b) {
            return !b.x.rewrite('Var("require")');
        }
    );
    return !badNodes.length && ["Call", "PropAccess", "Var"].indexOf(node.cons) > -1;
}

function getExpression(doc, pos) {
    if (pos.sl === pos.el) {
        return doc.getLine(pos.sl).substring(pos.sc, pos.ec);
    }
    var result = doc.getLine(pos.sl).substr(pos.sc);
    for (var i = pos.sl + 1; i < pos.el; i++) {
        result += doc.getLine(i);
    }
    result += doc.getLine(pos.el).substr(0, pos.ec);
    return result;
}


});
