define(function(require, exports, module) {

var parser = require("treehugger/js/parse");
var traverse = require("treehugger/traverse");
var baseLanguageHandler = require("plugins/c9.ide.language/base_handler");

var handler = module.exports = Object.create(baseLanguageHandler);

handler.init = function() {
    // Create a new event handler. 
    handler.sender.on("mocha_outline", function(e) {
        var code = e.data.code.replace(/^(#!.*\n)/, "//$1");
        var ast = parser.parse(code);
        
        handler.sender.emit("mocha_outline_result", {
            id: e.data.id, // Some unique id for this request
            result: getTestCases(ast)
        });
    });
};

handler.handlesLanguage = function() {
    return false;
};

// BDD
function parseBDD(ast, items) {
    ast.traverseTopDown( 
        'Call(Var("before"), _)', function(b, node) {
            items.push({
                label: "before all",
                type: "prepare",
                pos: node.getPos()
            });
            return true;
        },
        'Call(Var("beforeEach"), _)', function(b, node) {
            items.push({
                label: "before each",
                type: "prepare",
                pos: node.getPos()
            });
            return true;
        },
        'Call(Var("after"), _)', function(b, node) {
            items.push({
                label: "after all",
                type: "prepare",
                pos: node.getPos()
            });
            return true;
        },
        'Call(Var("afterEach"), _)', function(b, node) {
            items.push({
                label: "before each",
                type: "prepare",
                pos: node.getPos()
            });
            return true;
        },
        'Call(Var("it"), [String(description), _])', function(b, node) {
            items.push({
                label: b.description.value,
                kind: "it",
                type: "test",
                selpos: b.description.getPos(),
                pos: node.getPos()
            });
            return true;
        },
        'Call(PropAccess(Var("it"), "only"), [String(description), _])', function(b, node) {
            items.push({
                label: b.description.value,
                kind: "it",
                type: "test",
                selpos: b.description.getPos(),
                pos: node.getPos()
            });
            return true;
        },
        'Call(Var("describe"), [String(description), body])', function(b, node) {
            items.push({
                label: b.description.value,
                items: parseBDD(b.body, []),
                type: "testset",
                isOpen: true,
                selpos: b.description.getPos(),
                pos: node.getPos()
            });
            return node;
        },
        'Call(PropAccess(Var("describe"), "only"), [String(description), body])', function(b, node) {
            items.push({
                label: b.description.value,
                items: parseBDD(b.body, []),
                type: "testset",
                isOpen: true,
                selpos: b.description.getPos(),
                pos: node.getPos()
            });
            return node;
        },
        'Call(Var("context"), [String(description), body])', function(b, node) {
            items.push({
                label: b.description.value,
                items: parseBDD(b.body, []),
                type: "testset",
                isOpen: true,
                selpos: b.description.getPos(),
                pos: node.getPos()
            });
            return node;
        },
        'Call(PropAccess(Var("context"), "only"), [String(description), body])', function(b, node) {
            items.push({
                label: b.description.value,
                items: parseBDD(b.body, []),
                type: "testset",
                isOpen: true,
                selpos: b.description.getPos(),
                pos: node.getPos()
            });
            return node;
        }
    );
    
    return items;
}

function parseTDD(ast, items) {
    ast.traverseTopDown( 
        'Call(Var("setup"), _)', function(b, node) {
            items.push({
                label: "setup",
                type: "prepare",
                pos: node.getPos()
            });
            return true;
        },
        'Call(Var("teardown"), _)', function(b, node) {
            items.push({
                label: "teardown",
                type: "prepare",
                pos: node.getPos()
            });
            return true;
        },
        'Call(Var("suiteSetup"), _)', function(b, node) {
            items.push({
                label: "suite setup",
                type: "prepare",
                pos: node.getPos()
            });
            return true;
        },
        'Call(Var("suiteTeardown"), _)', function(b, node) {
            items.push({
                label: "suite teardown",
                type: "prepare",
                pos: node.getPos()
            });
        },
        'Call(Var("test"), [String(description), _])', function(b, node) {
            items.push({
                label: b.description.value,
                type: "test",
                selpos: b.description.getPos(),
                pos: node.getPos()
            });
            return true;
        },
        'Call(Var("suite"), [String(description), body])', function(b, node) {
            items.push({
                label: b.description.value,
                items: parseTDD(b.body, []),
                type: "testset",
                isOpen: true,
                selpos: b.description.getPos(),
                pos: node.getPos()
            });
            return node;
        }
    );
    
    return items;
}

function parseExports(ast, items) {
    ast.traverseTopDown(
        'Assign(PropAccess(Var("module"), "exports"), body)', function(b) {
            parseExports(b.body, items); 
            return true;
        },
        'PropertyInit("before", _)', function(b, node) {
            items.push({
                label: "before all",
                type: "prepare",
                pos: node.getPos()
            });
            return true;
        },
        'PropertyInit("after", _)', function(b, node) {
            items.push({
                label: "after all",
                type: "prepare",
                pos: node.getPos()
            });
            return true;
        },
        'PropertyInit("beforeEach", _)', function(b, node) {
            items.push({
                label: "before each",
                type: "prepare",
                pos: node.getPos()
            });
            return true;
        },
        'PropertyInit("afterEach", _)', function(b, node) {
            items.push({
                label: "after each",
                type: "prepare",
                pos: node.getPos()
            });
            return true;
        },
        'PropertyInit(name, ObjectInit(body))', function(b, node) {
           items.push({
                label: b.name.value,
                items: parseExports(b.body, []),
                type: "testset",
                isOpen: true,
                selpos: b.name.getPos(),
                pos: node.getPos()
            });
           return true;
        },
        'PropertyInit(name, Function(_))', function(b, node) {
           items.push({
                label: b.name.value,
                type: "test",
                selpos: b.name.getPos(),
                pos: node.getPos()
            });
            return true;
        }
    );
    
    return items;
}

function parseQUnit(ast, items) {
    var context = items;
    
    ast.traverseTopDown( 
        'Call(Var("before"), _)', function(b, node) {
            context.push({
                label: "before all",
                type: "prepare",
                pos: node.getPos()
            });
            return true;
        },
        'Call(Var("after"), _)', function(b, node) {
            context.push({
                label: "after all",
                type: "prepare",
                pos: node.getPos()
            });
            return true;
        },
        'Call(Var("beforeEach"), _)', function(b, node) {
            context.push({
                label: "before each",
                type: "prepare",
                pos: node.getPos()
            });
            return true;
        },
        'Call(Var("afterEach"), _)', function(b, node) {
            context.push({
                label: "after each",
                type: "prepare",
                pos: node.getPos()
            });
            return true;
        },
        'Call(Var("test"), [String(description), _])', function(b, node) {
            context.push({
                label: b.description.value,
                type: "test",
                selpos: b.description.getPos(),
                pos: node.getPos()
            });
            return true;
        },
        'Call(Var("suite"), [String(description)])', function(b, node) {
            context.push({
                label: b.description.value,
                items: context = [],
                type: "testset",
                isOpen: true,
                selpos: b.description.getPos(),
                pos: node.getPos()
            });
            return node;
        }
    );
}

function getTestCases(ast) {
    var items = [];
    
    // Traverse the AST with some pattern matching
    // for debugging, do ast.toString() or node.toString()
    
    ast.traverseTopDown(
        // BDD
        'Call(Var("describe"), [_, body])', function(b, node) {
            parseBDD(ast, items);
            return true;
        },
    
        // TDD
        'Call(Var("suite"), [_, body])', function(b, node) {
            parseTDD(ast, items);
            return true;
        },
    
        // Exports
        'Assign(PropAccess(Var("module"), "exports"), body)', function(b) {
            parseExports(b.body, items);
            return true;
        },
        
        // QUnit
        'Call(Var("suite"), [_])', function(b, node) {
            parseQUnit(ast, items);
            return true;
        }
        
        // Require
        // TODO Need @lennartcl's help
    );
    
    return items;
}

});