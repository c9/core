/**
 * Cloud9 Language Foundation
 *
 * @copyright 2013, Ajax.org B.V.
 */

// contains language specific debugger bindings
define(function(require, exports, module) {

    var baseLanguageHandler = require('plugins/c9.ide.language/base_handler');
    
    var expressionBuilder = module.exports = Object.create(baseLanguageHandler);
    
    /*** publics ***/
    
    expressionBuilder.handlesLanguage = function(language) {
        return language === "javascript" || language === "jsx";
    };
        
    // builds an expression for the v8 debugger based on a node
    expressionBuilder.getInspectExpression = function(doc, fullAst, pos, options, callback) {
        if (!options.node) return callback();
        
        callback(getExpression(options.node));
    };
    
    /*** privates ***/
    
    // get a string value of any expression
    var getExpression = function(node) {
        if (node.value)
            return { value: node.value, pos: node.getPos() };
        
        var result;
        
        // TODO: simplify this; we can simply get the string
        
        node.rewrite(
            // var someVar = ...
            'VarDeclInit(x, _)', 'ConstDeclInit(x, _)', function(b) {
                node = b.x;
                result = b.x.value;
            },
            // var someVar;
            'VarDecl(x)', 'ConstDecl(x)', function(b) {
                node = b.x;
                result = b.x.value;
            },
            // e.x
            'PropAccess(e, x)', function(b) {
                result = getExpression(b.e) + "." + b.x.value;
            },
            // x
            'Var(x)', function(b) {
                result = b.x.value;
            },
            // 10
            'Num(n)', function(b) {
                result = b.n.value;
            },
            // e[idx]
            'Index(e, idx)', function(b) {
                result = getExpression(b.e) + "[" + getExpression(b.idx) + "]";
            },
            // new SomeThing(arg, ...)
            'New(e, args)', function(b) {
                var method = getExpression(b.e);
                var args = b.args.toArray().map(getExpression).join(", ");
                result = "new " + method + "(" + args + ")";
            },
            // x (function argument)
            'FArg(x)', function(b) {
                result = b.x.value;
            },
            // 10 + 4
            'Op(op, e1, e2)', function(b) {
                result = getExpression(b.e1) + " " + b.op.value + " " + getExpression(b.e2);
            },
            // if nuthin' else matches
            function() {
                if (!result)
                    result = "";
            }
        );
        
        if (result === "")
            return;
        
        return { value: result, pos: node.getPos() };
    };

});
