/**
 * JavaScript scope analysis module and warning reporter.
 * 
 * This handler does a couple of things:
 * 1. It does scope analysis and attaches a scope object to every variable, variable declaration and function declaration
 * 2. It creates markers for undeclared variables
 * 3. It creates markers for unused variables
 * 4. It implements the local variable refactoring
 * 
 * @depend ext/jslanguage/parse
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {

var baseLanguageHandler = require('plugins/c9.ide.language/base_handler');
var completeUtil = require("plugins/c9.ide.language/complete_util");
var handler = module.exports = Object.create(baseLanguageHandler);
var JSResolver = require('plugins/c9.ide.language.javascript/JSResolver').JSResolver;
require("treehugger/traverse"); // add traversal functions to trees

var CALLBACK_METHODS = ["forEach", "map", "reduce", "filter", "every", "some",
    "__defineGetter__", , "__defineSetter__"];
var CALLBACK_FUNCTIONS = ["require", "setTimeout", "setInterval"];
var PROPER = module.exports.PROPER = 80;
var MAYBE_PROPER = module.exports.MAYBE_PROPER = 1;
var NOT_PROPER = module.exports.NOT_PROPER = 0;
var KIND_EVENT = module.exports.KIND_EVENT = "event";
var KIND_PACKAGE = module.exports.KIND_PACKAGE = "package";
var KIND_HIDDEN = module.exports.KIND_HIDDEN = "hidden";
var KIND_DEFAULT = module.exports.KIND_DEFAULT = undefined;
var IN_CALLBACK_DEF = 1;
var IN_CALLBACK_BODY = 2;
var IN_CALLBACK_BODY_MAYBE = 3;

var lastValue;
var lastAST;

// Based on https://github.com/jshint/jshint/blob/master/jshint.js#L331
var GLOBALS = {
    // Literals
    "true": true,
    "false": true,
    "undefined": true,
    "null": true,
    "arguments": true,
    "Infinity": true,
    onmessage: true,
    postMessage: true,
    importScripts: true,
    "continue": true,
    "return": true,
    "else": true,
    // Browser
    ArrayBuffer: true,
    Attr: true,
    Audio: true,
    addEventListener: true,
    applicationCache: true,
    blur: true,
    clearInterval: true,
    clearTimeout: true,
    close: true,
    closed: true,
    DataView: true,
    defaultStatus: true,
    document: true,
    event: true,
    FileReader: true,
    Float32Array: true,
    Float64Array: true,
    FormData: true,
    getComputedStyle: true,
    Int16Array: true,
    Int32Array: true,
    Int8Array: true,
    parent: true,
    print: true,
    removeEventListener: true,
    resizeBy: true,
    resizeTo: true,
    self: true,
    screen: true,
    scroll: true,
    scrollBy: true,
    scrollTo: true,
    sessionStorage: true,
    setInterval: true,
    setTimeout: true,
    SharedWorker: true,
    Uint16Array: true,
    Uint32Array: true,
    Uint8Array: true,
    WebSocket: true,
    window: true,
    Worker: true,
    XMLHttpRequest: true,
    // Devel
    alert: true,
    confirm: true,
    console: true,
    prompt: true,
    // require.js
    define: true,
    // node.js
    __filename: true,
    __dirname: true,
    Buffer: true,
    exports: true,
    GLOBAL: true,
    global: true,
    module: true,
    process: true,
    require: true,
    // Standard
    Array: true,
    Boolean: true,
    Date: true,
    decodeURI: true,
    decodeURIComponent: true,
    encodeURI: true,
    encodeURIComponent: true,
    Error: true,
    'eval': true,
    EvalError: true,
    Function: true,
    hasOwnProperty: true,
    isFinite: true,
    isNaN: true,
    JSON: true,
    Math: true,
    Number: true,
    Object: true,
    parseInt: true,
    parseFloat: true,
    RangeError: true,
    ReferenceError: true,
    RegExp: true,
    String: true,
    requestAnimationFrame: true,
    SyntaxError: true,
    TypeError: true,
    URIError: true,
    // non-standard
    escape: true,
    unescape: true,
    // meteor
    Match: true,
    MeteorSubscribeHandle: true,
    Accounts: true,
    Blaze: true,
    DDP: true,
    EJSON: true,
    Meteor: true,
    Mongo: true,
    Tracker: true,
    Assets: true,
    App: true,
    Plugin: true,
    Package: true,
    Npm: true,
    Cordova: true,
    currentUser: true,
    loggingIn: true,
    Template: true,
    MethodInvocation: true,
    Subscription: true,
    CompileStep: true,
    check: true,
    Email: true,
    HTTP: true,
    ReactiveVar: true,
    Session: true,
    PackageAPI: true,
};

var KEYWORDS = [
    "break",
    "const",
    "continue",
    "delete",
    "do",
    "while",
    "export",
    "for",
    "in",
    "function",
    "if",
    "else",
    "import",
    "instanceof",
    "new",
    "return",
    "switch",
    "this",
    "throw",
    "try",
    "catch",
    "typeof",
    "void",
    "with",
    "debugger"
];

/** @internal */
handler.GLOBALS = GLOBALS;

handler.addGlobals = function(globals) {
    globals.forEach(function(g) {
        GLOBALS[g] = true;
    });
};

handler.handlesLanguage = function(language) {
    // Note that we don't really support jsx here,
    // but rather tolerate it...
    return language === "javascript" || language === "jsx";
};
 
handler.getResolutions = function(value, ast, markers, callback) {
    var resolver = new JSResolver(value, ast);
    resolver.addResolutions(markers);
    callback(markers);
};

handler.getMaxFileSizeSupported = function() {
    // .25 of current base_handler default
    return .25 * 10 * 1000 * 80;
};

/*
handler.hasResolution = function(value, ast, marker) {
    if (marker.resolutions && marker.resolutions.length) {
        return true;
    }
    var resolver = new JSResolver(value, ast);
    return resolver.getType(marker);
};
*/

var scopeId = 0;

var Variable = module.exports.Variable = function Variable(declaration) {
    this.declarations = [];
    if (declaration)
        this.declarations.push(declaration);
    this.uses = [];
    this.values = [];
};

Variable.prototype.addUse = function(node) {
    this.uses.push(node);
};

Variable.prototype.addDeclaration = function(node) {
    this.declarations.push(node);
};

Variable.prototype.markProperDeclaration = function(confidence) {
    if (!confidence)
        return;
    else if (!this.properDeclarationConfidence)
        this.properDeclarationConfidence = confidence;
    else if (this.properDeclarationConfidence < PROPER)
        this.properDeclarationConfidence += confidence;
};

Variable.prototype.isProperDeclaration = function() {
    return this.properDeclarationConfidence > MAYBE_PROPER;
};

/**
 * Implements Javascript's scoping mechanism using a hashmap with parent
 * pointers.
 */
var Scope = module.exports.Scope = function Scope(parent) {
    this.id = scopeId++;
    this.parent = parent;
    this.vars = {};
};

/**
 * Declare a variable in the current scope
 */
Scope.prototype.declare = function(name, resolveNode, properDeclarationConfidence, kind) {
    var result;
    var vars = this.getVars(kind);
    if (!vars['_' + name]) {
        result = vars['_' + name] = new Variable(resolveNode);
    }
    else if (resolveNode) {
        result = vars['_' + name];
        result.addDeclaration(resolveNode);
    }
    if (result) {
        result.markProperDeclaration(properDeclarationConfidence);
        result.kind = kind;
    }
    return result;
};

Scope.prototype.declareAlias = function(kind, originalName, newName) {
    var vars = this.getVars(kind);
    vars["_" + newName] = vars["_" + originalName];
};

Scope.prototype.getVars = function(kind) {
    if (kind)
        return this.vars[kind] = this.vars[kind] || {};
    else
        return this.vars;
};

Scope.prototype.isDeclared = function(name) {
    return !!this.get(name);
};

/**
 * Get possible values of a variable
 * @param name name of variable
 * @return Variable instance
 */
Scope.prototype.get = function(name, kind) {
    var vars = this.getVars(kind);
    if (vars['_' + name])
        return vars['_' + name];
    else if (this.parent)
        return this.parent.get(name, kind);
};

Scope.prototype.getVariableNames = function() {
    return this.getNamesByKind(KIND_DEFAULT);
};

Scope.prototype.getNamesByKind = function(kind) {
    var results = [];
    var vars = this.getVars(kind);
    for (var v in vars) {
        if (vars.hasOwnProperty(v) && v !== KIND_HIDDEN && v !== KIND_PACKAGE)
            results.push(v.slice(1));
    }
    if (this.parent) {
        var namesFromParent = this.parent.getNamesByKind(kind);
        for (var i = 0; i < namesFromParent.length; i++) {
            results.push(namesFromParent[i]);
        }
    }
    return results;
};

var SCOPE_ARRAY = Object.keys(GLOBALS).concat(KEYWORDS);

handler.getIdentifierRegex = function() {
    // Allow slashes for package names
    return (/[a-zA-Z_0-9\$\/]/);
};

handler.complete = function(doc, ast, pos, options, callback) {
    if (!options.node || options.node.cons === "Var" || options.line[pos.column] === ".")
        return callback();

    var identifier = options.identifierPrefix;
    
    var matches = completeUtil.findCompletions(identifier, SCOPE_ARRAY);
    callback(matches.map(function(m) {
        return {
          name: m,
          replaceText: m,
          icon: null,
          meta: "EcmaScript",
          priority: 0,
          isGeneric: true
        };
    }));
};

/**
 * @param minimalAnalysis  Only analyse bare basics, don't investigate errors.
 *                         Most useful for inference analysis.
 */
handler.analyze = function(value, ast, callback, minimalAnalysis) {
    var handler = this;
    var markers = [];
    
    if (minimalAnalysis && value === lastValue && lastAST == ast)
        return callback();
    lastValue = value;
    lastAST = ast;
    
    // Preclare variables (pre-declares, yo!)
    function preDeclareHoisted(scope, node) {
        node.traverseTopDown(
            // var bla;
            'VarDecl(x)', 'ConstDecl(x)', 'LetDecl(x)', function(b, node) {
                node.setAnnotation("scope", scope);
                scope.declare(b.x.value, b.x, PROPER);
                return node;
            },
            // var bla = 10;
            'VarDeclInit(x, e)', 'ConstDeclInit(x, e)', 'LetDeclInit(x, e)', function(b, node) {
                node.setAnnotation("scope", scope);
                scope.declare(b.x.value, b.x, PROPER);
            },
            // function bla(farg) { }
            'Function(x, _, _)', function(b, node) {
                node.setAnnotation("scope", scope);
                if (b.x.value) {
                    scope.declare(b.x.value, b.x, PROPER);
                }
                return node;
            },
            'ImportDecl(_, x)', 'ImportBatchDecl(x)', function(b, node) {
                if (b.x.cons !== "Var")
                    return node;
                scope.declare(b.x[0].value, b.x[0], PROPER);
                return node;
            }
        );
    }
    
    function scopeAnalyzer(scope, node, parentLocalVars, inCallback) {
        preDeclareHoisted(scope, node);
        node.setAnnotation("scope", scope);
        function analyze(scope, node, inCallback) {
            node.traverseTopDown(
                'Assign(Var(x), e)', function(b, node) {		
                    if (scope.isDeclared(b.x.value)) {
                        node[0].setAnnotation("scope", scope);		
                        scope.get(b.x.value).addUse(node[0]);		
                    }		
                    analyze(scope, b.e, inCallback);		
                    return node;		
                },
                /*
                'Var("this")', function(b, node) {
                    if (inCallback === IN_CALLBACK_BODY) {
                        markers.push({
                            pos: this.getPos(),
                            level: 'warning',
                            type: 'warning',
                            message: "Use of 'this' in callback function"
                        });
                    }
                    else if (inCallback === IN_CALLBACK_BODY_MAYBE) {
                        markers.push({
                            pos: this.getPos(),
                            level: 'info',
                            type: 'info',
                            message: "Use of 'this' in closure"
                        });
                    }
                },
                */
                'ImportDecl(_, x)', 'ImportBatchDecl(x)', function(b, node) {
                    return node;
                },
                'Var(x)', function(b, node) {
                    node.setAnnotation("scope", scope);
                    if (scope.isDeclared(b.x.value)) {
                        scope.get(b.x.value).addUse(node);
                    }
                    else if (b.x.value === "self"
                        && !scope.isDeclared(b.x.value)
                        && handler.isFeatureEnabled("undeclaredVars")) {
                        markers.push({
                            pos: this.getPos(),
                            level: 'warning',
                            type: 'warning',
                            message: "Use 'window.self' to refer to the 'self' global."
                        });
                        return;
                    }
                    return node;
                },
                'Function(x, fargs, body)', function(b, node) {
                    var newScope = new Scope(scope);
                    node.setAnnotation("localScope", newScope);
                    newScope.declare("this");
                    b.fargs.forEach(function(farg) {
                        farg.setAnnotation("scope", newScope);
                        newScope.declare(farg[0].value, farg);
                    });
                    var inBody = inCallback === IN_CALLBACK_DEF ? IN_CALLBACK_BODY : isCallback(node);
                    scopeAnalyzer(newScope, b.body, null, inBody);
                    return node;
                },
                'Arrow(fargs, body)', function(b, node) {
                    var newScope = new Scope(scope);
                    node.setAnnotation("localScope", newScope);
                    newScope.declare("this");
                    b.fargs.forEach(function(farg) {
                        farg.setAnnotation("scope", newScope);
                        newScope.declare(farg[0].value, farg);
                    });
                    scopeAnalyzer(newScope, b.body, null, inCallback);
                    return node;
                },
                'Catch(x, body)', function(b, node) {
                    var oldVar = scope.get(b.x.value);
                    // Temporarily override
                    scope.vars["_" + b.x.value] = new Variable(b.x);
                    scopeAnalyzer(scope, b.body, parentLocalVars, inCallback);
                    // Put back
                    scope.vars["_" + b.x.value] = oldVar;
                    return node;
                },
                /*
                 * Catches errors like these:
                 * if (err) callback(err);
                 * which in 99% of cases is wrong: a return should be added:
                 * if (err) return callback(err);
                 */
                'If(Var("err"), Call(fn, args), None())', function(b, node) {
                    // Check if the `err` variable is used somewhere in the function arguments.
                    if (b.args.collectTopDown('Var("err")').length > 0 &&
                        !b.fn.isMatch('PropAccess(Var("console"), _)') &&
                        !b.fn.isMatch('PropAccess(_, "log")'))
                        markers.push({
                            pos: b.fn.getPos(),
                            type: 'warning',
                            level: 'warning',
                            message: "Did you forget a 'return' here?"
                        });
                },
                'PropAccess(_, "lenght")', function(b, node) {
                    markers.push({
                        pos: node.getPos(),
                        type: 'warning',
                        level: 'warning',
                        message: "Did you mean 'length'?"
                    });
                },
                'Call(PropAccess(e1, "bind"), e2)', function(b) {
                    analyze(scope, b.e1, 0);
                    analyze(scope, b.e2, inCallback);
                    return this;
                },
                'Call(e, args)', function(b, node) {
                    analyze(scope, b.e, inCallback);
                    var newInCallback = inCallback || (isCallbackCall(node) ? IN_CALLBACK_DEF : 0);
                    analyze(scope, b.args, newInCallback);
                    return node;
                },
                'Block(_)', function(b, node) {
                    node.setAnnotation("scope", scope);
                },
                'For(e1, e2, e3, body)', function(b) {
                    analyze(scope, b.e1, inCallback);
                    analyze(scope, b.e2, inCallback);
                    analyze(scope, b.body, inCallback);
                    analyze(scope, b.e3, inCallback);
                    return node;
                },
                'ForIn(e1, e2, body)', 'ForOf(e1, e2, body)', function(b) {
                    analyze(scope, b.e2, inCallback);
                    analyze(scope, b.e1, inCallback);
                    analyze(scope, b.body, inCallback);
                    return node;
                }
            );
        }
        analyze(scope, node, inCallback);
    }
    
    if (ast) {
        var rootScope = new Scope();
        scopeAnalyzer(rootScope, ast);
        addDefineWarnings(ast, markers);
    }
    return callback(markers);
};

function addDefineWarnings(ast, markers) {
    var isArchitect;
    var outerStrictNode;
    ast.forEach(function(node) {
        node.rewrite(
            'String("use strict")', function(b, node) {
                outerStrictNode = node;
            },
            'Call(Var("define"), [Function(_, _, body)])', function(b, node) {
                b.body.forEach(function(node) {
                    if (outerStrictNode) {
                        markers.push({
                            pos: outerStrictNode.getPos(),
                            type: 'warning',
                            level: 'warning',
                            message: '"use strict" outside define()'
                        });
                    }

                    node.rewrite(
                        'Assign(PropAccess(Var("main"), "provides"),_)', function(b, node) {
                            isArchitect = true;
                        },
                        'Function("main", _, body)', function(b, node) {
                            if (!isArchitect)
                                return;
                            addCloud9PluginWarnings(b.body, markers);
                        }
                    );
                });
            }
        );
    });
}

function addCloud9PluginWarnings(body, markers) {
    var isCoreSource = /plugins\/c9\./.test(handler.path);
    var pluginVars = {};
    var unloadFunction;
    var unloadReference;
    var maybeUnloadFunction;

    body.forEach(function(node) {
        node.rewrite(
            'VarDecls(vars)', function(b, node) {
                b.vars.forEach(function(v) {
                    v.rewrite(
                        'VarDecl(x)', 'LetDecl(x)',
                        'VarDeclInit(x, _)', 'LetDeclInit(x, _)',
                        function(b, node) {
                            pluginVars[b.x.value] = node;
                        }
                    );
                });
            },
            'Call(PropAccess(Var("plugin"), "on"), [String("unload"), Function(_, _, fn)])', function(b, node) {
                unloadFunction = b.fn;
            },
            'Call(PropAccess(Var("plugin"), "on"), [String("unload"), ref])', function(b, node) {
                unloadReference = b.ref;
            },
            'Function("unload", _, fn)', function(b, node) {
                maybeUnloadFunction = b.fn;
            }
        );
    });

    if (!unloadFunction && unloadReference && maybeUnloadFunction
        && unloadReference[0] && unloadReference[0].value === "unload")
        unloadFunction = maybeUnloadFunction;

    if (!unloadFunction) {
        if (pluginVars.plugin && !unloadReference) {
            markers.push({
                pos: pluginVars.plugin.getPos(),
                type: isCoreSource ? "info" : "warning",
                message:
                    isCoreSource
                        ? "No plugin.on(\"load\", function() {}) and/or plugin.on(\"unload\", function() {}) found"
                        : "Missing plugin.on(\"load\", function() {}) or plugin.on(\"unload\", function() {})"
            });
        }
        return;
    }

    var mustUninitVars = {};
    body.traverseTopDown(
        'Assign(Var(x), _)', 'Call(Var(x), "push", _)', function(b, node) {
            if (pluginVars[b.x.value])
                mustUninitVars[b.x.value] = pluginVars[b.x.value];
        }
    );
    
    unloadFunction.traverseTopDown(
        'Var(x)', function(b, node) {
            delete mustUninitVars[b.x.value];
        }
    );

    for (var v in mustUninitVars) {
        if (v === v.toUpperCase())
            continue;
        markers.push({
            pos: mustUninitVars[v].getPos(),
            type: isCoreSource ? "info" : "warning",
            message: "Plugin state; please uninit/reset '" + v + "' in plugin unload function"
        });
    }
}

/**
 * Determine if any callbacks in the current call
 * should definitely get a warning for any uses of 'this'.
 */
var isCallbackCall = function(node) {
    var result;
    node.rewrite(
        'Call(PropAccess(_, p), args)', function(b) {
            if (b.args.length === 1 && CALLBACK_METHODS.indexOf(b.p.value) !== -1)
                result = true;
        },
        'Call(Var(f), _)', function(b) {
            if (CALLBACK_FUNCTIONS.indexOf(b.f.value) !== -1)
                result = true;
        }
    );
    return result;
};

/**
 * Determine if the current callback should get a warning marker
 * (IN_CALLBACK_BODY) for any uses of this, or just an info marker
 * (IN_CALLBACK_BODY_MAYBE). Or, none at all (0).
 */
var isCallback = function(node) {
    var parent = node.parent;
    var parentParent = parent && parent.parent;
    if (!parentParent)
        return false;
    try {
        if (!parentParent.isMatch)
            console.log("isCallback debug:", JSON.stringify(parentParent));
    } catch (e) {
        // Cannot print circular JSON in server-side tests
    }
    if (parent.isMatch('PropAccess(_, "call")')
        || parent.isMatch('PropAccess(_, "apply")')
        || parent.isMatch('PropAccess(_, "bind")')
        || !parentParent.isMatch('Call(_, _)')
        || (parentParent.cons === "Call" &&
            parentParent[0].cons === "PropAccess" &&
            parentParent[1].length > 1 &&
            CALLBACK_METHODS.indexOf(parentParent[0][1].value) > -1)
        )
        return false;
    var result = 0;
    node.rewrite(
        'Function(_, fargs, _)', function(b) {
            if (b.fargs.length === 0 || b.fargs[0].cons !== 'FArg')
                return result = IN_CALLBACK_BODY_MAYBE;
            var name = b.fargs[0][0].value;
            result = name === 'err' || name === 'error' || name === 'exc'
                ? IN_CALLBACK_BODY
                : IN_CALLBACK_BODY_MAYBE;
        }
    );
    return result;
};

handler.getRefactorings =
handler.highlightOccurrences = function(doc, fullAst, cursorPos, options, callback) {
    if (!options.node)
        return callback();
    
    if (!fullAst.annos.scope) {
        return handler.analyze(doc.getValue(), fullAst, function() {
            handler.highlightOccurrences(doc, fullAst, cursorPos, options, callback);
        }, true);
    }

    var markers = [];
    var enableRefactorings = [];
    
    function highlightVariable(v) {
        if (!v)
            return;
        v.declarations.forEach(function(decl) {
            if (decl.getPos())
                markers.push({
                    pos: decl.getPos(),
                    type: 'occurrence_main'
                });
        });
        v.uses.forEach(function(node) {
            markers.push({
                pos: node.getPos(),
                type: 'occurrence_other'
            });
        });
    }
    options.node.rewrite(
        'Var(x)', function(b, node) {
            var scope = node.getAnnotation("scope");
            if (!scope)
                return;
            var v = scope.get(b.x.value);
            highlightVariable(v);
            // Let's not enable renaming 'this' and only rename declared variables
            if (b.x.value !== "this" && v)
                enableRefactorings.push("rename");
        },
        'VarDeclInit(x, _)', 'ConstDeclInit(x, _)', 'LetDeclInit(x, _)', function(b) {
            highlightVariable(this.getAnnotation("scope").get(b.x.value));
            enableRefactorings.push("rename");
        },
        'VarDecl(x)', 'ConstDecl(x)', 'LetDecl(x)', function(b) {
            highlightVariable(this.getAnnotation("scope").get(b.x.value));
            enableRefactorings.push("rename");
        },
        'FArg(x)', function(b) {
            highlightVariable(this.getAnnotation("scope").get(b.x.value));
            enableRefactorings.push("rename");
        },
        'Function(x, _, _)', function(b, node) {
            // Only for named functions
            if (!b.x.value || !node.getAnnotation("scope"))
                return;
            highlightVariable(node.getAnnotation("scope").get(b.x.value));
            enableRefactorings.push("rename");
        }
    );

    callback({
        markers: markers,
        refactorings: enableRefactorings
    });
};

handler.getRenamePositions = function(doc, fullAst, cursorPos, options, callback) {
    var currentNode = options.node;
    if (!fullAst || !currentNode)
        return callback();
    
    if (!fullAst.annos.scope) {
        return handler.analyze(doc.getValue(), fullAst, function() {
            handler.getRenamePositions(doc, fullAst, cursorPos, options, callback);
        }, true);
    }

    var v;
    var mainNode;
    currentNode.rewrite(
        'VarDeclInit(x, _)', 'ConstDeclInit(x, _)', 'LetDeclInit(x, _)', function(b, node) {
            v = node.getAnnotation("scope").get(b.x.value);
            mainNode = b.x;
        },
        'VarDecl(x)', 'ConstDecl(x)', 'LetDecl(x)', function(b, node) {
            v = node.getAnnotation("scope").get(b.x.value);
            mainNode = b.x;
        },
        'FArg(x)', function(b, node) {
            v = node.getAnnotation("scope").get(b.x.value);
            mainNode = node;
        },
        'Function(x, _, _)', function(b, node) {
            if (!b.x.value)
                return;
            v = node.getAnnotation("scope").get(b.x.value);
            mainNode = b.x;
        },
        'Var(x)', function(b, node) {
            v = node.getAnnotation("scope").get(b.x.value);
            mainNode = node;
        }
    );
    
    // no mainnode can be found then invoke callback wo value because then we've got no clue
    // what were doing
    if (!mainNode) {
        return callback();
    }
    
    var pos = mainNode.getPos();
    var declarations = [];
    var uses = [];

    var length = pos.ec - pos.sc;
    
    // if the annotation cant be found we will skip this to avoid null ref errors
    v && v.declarations.forEach(function(node) {
         if (node !== currentNode[0]) {
            var pos = node.getPos();
            declarations.push({ column: pos.sc, row: pos.sl });
        }
    });
    
    v && v.uses.forEach(function(node) {
        if (node !== currentNode) {
            var pos = node.getPos();
            uses.push({ column: pos.sc, row: pos.sl });
        }
    });
    callback({
        length: length,
        pos: {
            row: pos.sl,
            column: pos.sc
        },
        others: declarations.concat(uses),
        declarations: declarations,
        uses: uses
    });
};

});
