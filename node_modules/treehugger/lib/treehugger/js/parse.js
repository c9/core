define(function(require, exports, module) {

var parser = require("acorn/dist/acorn_loose");
var tree = require('treehugger/tree');

// var REV = 0; // for debugging 

exports.parse = function(s) {
    // REV++;
    var result = parser.parse_dammit(
        s,
        {
            locations: true,
            ecmaVersion: 6,
            allowReturnOutsideFunction: true
        }
    );
    var node = exports.transform(result);
    if(result.error)
        node.setAnnotation("error", result.error);
    return node;
};


function setIdPos(n, resultNode) {
    if(n.loc) {        
        resultNode.setAnnotation("pos", {
            sl: n.loc.start.line, sc: n.loc.start.column,
            el: n.loc.end.line, ec: n.loc.end.column
        }); 
    }
    return resultNode;
}
function id(n, val) {
    var s = tree.string(val || (n && n.name) || "");
    s.$pos = n && n.loc;
    // s.REV = REV;
    return s;
}

exports.transform = function transform(n) {
    if (!n) {
        return tree.cons("None", []);
    }
    if (Array.isArray(n)) {
        return tree.list(n.map(transform));
    }
    var nodeName = n.type;
    
    var resultNode;
    
    switch(nodeName) {
        case "Program":
            resultNode = tree.list(n.body.map(transform));
            break;
        case "VariableDeclaration":
            if (n.kind === "var") {
                var VarDecls = "VarDecls", VarDeclInit = "VarDeclInit", VarDecl = "VarDecl";
            } else if (n.kind === "let") {
                var VarDecls = "LetDecls", VarDeclInit = "LetDeclInit", VarDecl = "LetDecl";
            } else if (n.kind === "const") {
                var VarDecls = "ConstDecls", VarDeclInit = "ConstDeclInit", VarDecl = "ConstDecl";
            }
            resultNode = tree.cons(VarDecls, [tree.list(n.declarations.map(function(varNode) {
                var idNode = id(varNode.id);
                if(varNode.init)
                    return tree.cons(VarDeclInit, [idNode, transform(varNode.init)]);
                else
                    return tree.cons(VarDecl, [idNode]);
            }))]);
            break;
        case "ExpressionStatement":
            return transform(n.expression);
        case "CallExpression":
            resultNode = tree.cons("Call", [transform(n.callee), tree.list(n.arguments.map(transform))]);
            break;
        case "ReturnStatement":
            resultNode = tree.cons("Return", [transform(n.argument)]);
            break;
        case "NewExpression":
            resultNode = tree.cons("New", [transform(n.callee), tree.list(n.arguments.map(transform))]);
            break;
        case "ObjectExpression":
            resultNode = tree.cons("ObjectInit", [tree.list(n.properties.map(function(propInit) {
                var key = propInit.key;
                var result = tree.cons("PropertyInit", [id(key, key.name || key.value), transform(propInit.value)]);
                result.kind = propInit.kind;
                return result;
            }))]);
            break;
        case "ArrayExpression":
            resultNode = tree.cons("Array", [tree.list(n.elements.map(transform))]);
            break;
        case "ConditionalExpression":
            resultNode = tree.cons("TernaryIf", [transform(n.test), transform(n.consequent), transform(n.alternate)]);
            break;
        case "LabeledStatement":
            resultNode = tree.cons("Label", [id(n.label), transform(n.body)]);
            break;
        case "AssignmentExpression":
            if(n.operator != "=") {
                resultNode = tree.cons("OpAssign", [tree.string(n.operator[0]), transform(n.left), transform(n.right)]);
            } else {
                resultNode = tree.cons("Assign", [transform(n.left), transform(n.right)]);
            }
            break;
        case "MemberExpression":
            resultNode = n.computed
                ? tree.cons("Index", [transform(n.object), transform(n.property)])
                : tree.cons("PropAccess", [transform(n.object), id(n.property)]);
            break;
        case "Identifier":
            resultNode = tree.cons("Var", [id(n)]);
            break;
        case "ThisExpression":
            resultNode = tree.cons("Var", [tree.string("this")]);
            break;
        case "FunctionDeclaration":
            // todo this doesn't handle error in id.name, but old parser doen't handle it as well
            resultNode = tree.cons("Function", [id(n.id), tree.list(n.params.map(function(arg) {
                return setIdPos(arg, tree.cons("FArg", [id(arg)]));
            })), tree.list(n.body.body.map(transform))]);
            break;
        case "FunctionExpression":
            var funName = id(n.id);
            var fargs = tree.list(n.params.map(function(arg) {
                return setIdPos(arg, tree.cons("FArg", [id(arg)]));
            }));
            resultNode = tree.cons("Function", [funName, fargs, tree.list(n.body.body.map(transform))]);
            break;
        case "LogicalExpression":
        case "BinaryExpression":
            resultNode = tree.cons("Op", [tree.string(n.operator), transform(n.left), transform(n.right)]);
            break;
        case "UpdateExpression":
        case "UnaryExpression":
            resultNode = tree.cons(n.prefix ? "PrefixOp" : "PostfixOp", [tree.string(n.operator), transform(n.argument)]);
            break;
        case "sub":
            resultNode = tree.cons("Index", [transform(n[1]), transform(n[2])]);
            break;
        case "ForStatement":
            resultNode = tree.cons("For", [transform(n.init), transform(n.test), transform(n.update), transform(n.body)]);
            break;
        case "ForInStatement":
            resultNode = tree.cons("ForIn", [transform(n.left), transform(n.right), transform(n.body)]);
            break;
        case "ForOfStatement":
            resultNode = tree.cons("ForOf", [transform(n.left), transform(n.right), transform(n.body)]);
            break;
        case "WhileStatement":
            resultNode = tree.cons("While", [transform(n.test), transform(n.body)]);
            break;
        case "DoWhileStatement": 
            resultNode = tree.cons("Do", [transform(n.body), transform(n.test)]);
            break;
        case "SwitchStatement":
            resultNode = tree.cons("Switch", [transform(n.discriminant), tree.list(n.cases.map(function(opt) {
                return tree.cons("Case", [transform(opt.test), tree.list(opt.consequent.map(transform))]);
            }))]);
            break;
        case "ContinueStatement":
            resultNode = tree.cons("Continue", [id(n.label)]);
            break;
        case "BreakStatement":
            resultNode = tree.cons("Break", [id(n.label)]);
            break;
        case "SequenceExpression":  // todo can we get rid of nesting?
            resultNode = n.expressions.reduceRight(function(a, b) {                
                return a ? tree.cons("Seq", [transform(b), a]) : transform(b);
            }, "");
            break;
        case "IfStatement":
            resultNode = tree.cons("If", [transform(n.test), transform(n.consequent), transform(n.alternate)]);
            break;
        case "EmptyStatement":
        case "BlockStatement":
            resultNode = tree.cons("Block", [tree.list(n.body ? n.body.map(transform) : [])]);
            break;
        case "ThrowStatement":
            resultNode = tree.cons("Throw", [transform(n.argument)]);
            break;
        case "DebuggerStatement":
            resultNode = tree.cons("Debugger", [transform(n.argument)]);
            break;
        case "TryStatement":
            resultNode = tree.cons("Try", [tree.list(n.block.body.map(transform)),
                tree.list(n.handler ? [tree.cons("Catch", [
                    id(n.handler.param), tree.list(n.handler.body.body.map(transform))
                ])] : []),
                n.finalizer ? tree.list(n.finalizer.body.map(transform)) : tree.cons("None", [])
            ]);
            break;
        case "WithStatement":
            resultNode = tree.cons("With", [transform(n.object), tree.list((n.body.body||[]).map(transform))]);
            break;
        case "Literal":
            var litType = typeof n.value;
            if (litType == "number") {
                resultNode = tree.cons("Num", [id(n, n.raw)]);
            } else if (litType == "string") {
                resultNode = tree.cons("String", [id(n, n.value)]);
            } else {
                var val = n.raw;
                if (val[0] == "/") {
                    var i = val.lastIndexOf("/");
                    resultNode = tree.cons("RegExp", [tree.string(val.slice(1, i)), tree.string(val.substr(i + 1))]);
                } else {
                    resultNode = tree.cons("Var", [tree.string(n.value + "")]);
                }
            }
            break;
        case "ERROR":
            resultNode = tree.cons("ERROR", []);
            break;
        case "ArrowFunctionExpression":
            resultNode = tree.cons("Arrow", [tree.list(n.params.map(function(arg) {
                return setIdPos(arg, tree.cons("FArg", [id(arg)]));
            })), tree.list(n.body.body ? n.body.body.map(transform) : transform(n.body))]);
            break;
        case "YieldExpression":
            resultNode = tree.cons("Yield", [transform(n.argument)]);
            break; 
        case "ImportDeclaration":
            resultNode = tree.cons("ImportDecls", [
                tree.list(n.specifiers.map(transform)),
                transform(n.source)
            ]);
            break;
        case "ImportSpecifier":
            resultNode = tree.cons("ImportDecl", [transform(n.id), transform(n.name)]);
            break;
        case "ExportSpecifier":
            resultNode = tree.cons("ExporDecl", [transform(n.id), transform(n.name)]);
            break;
        case "ImportBatchSpecifier":
            resultNode = tree.cons("ImportBatchDecl", [transform(n.name)]);
            break;
        case "ExportDeclaration":
            resultNode = tree.cons("ExportDecl", [
                n.default ? tree.list([tree.cons("Default", [])]) : tree.list([]),
                n.declaration ? transform(n.declaration) : transform(n.specifiers),
                transform(n.source)
            ]);
            break;
        case "SpreadElement":
            resultNode = tree.cons("Spread", [transform(n.argument)]);
            break;
        case "ArrayPattern":
            resultNode = tree.cons("ArrayPattern", transform(n.elements));
            break;
        case "ClassDeclaration":
            resultNode = tree.cons("Class", [id(n.id), id(n.superClass), transform(n.body)]);
            break;
        case "ClassBody":
            resultNode = tree.list(transform(n.body));
            break;
        case "MethodDefinition":
            resultNode = tree.cons("Method", [id(n.key), transform(n.value)]);
            break;
        case "ComprehensionBlock":
        case "ComprehensionExpression":
        default:
            console.log("Not yet supported: " + nodeName);
            // console.log("Current node: "+ JSON.stringify(n));
            resultNode = tree.cons(tree.string(nodeName), [tree.string(JSON.stringify(n, function(key, val) {
                if (key !== "loc") 
                    return val;
            }, 4))]);
    }

    resultNode.setAnnotation("origin", n);
    /*if(n.loc) {
        resultNode.setAnnotation("pos", {
            sl: n.loc.start.line, sc: n.loc.start.column,
            el: n.loc.end.line, ec: n.loc.end.column
        }); 
    }*/
    resultNode.$pos = n.loc;
    return resultNode;
};
});
