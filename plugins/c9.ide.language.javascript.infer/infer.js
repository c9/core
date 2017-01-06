
/**
 * Module that implements basic value inference. Type inference in Javascript
 * doesn't make a whole lot of sense because it is so dynamic. Therefore, this
 * analysis semi-evaluates the Javascript AST and attempts to do simple predictions
 * of the values an expression, function or variable may contain.
 */

define(function(require, exports, module) {

var values = require("./values");
var Value = values.Value;
var ValueCollection = values.ValueCollection;
var FunctionValue = values.FunctionValue;
var instantiate = values.instantiate;
var valueFromJSON = values.fromJSON;
var lookupValue = values.lookupValue;
var scopeAnalyzer = require("plugins/c9.ide.language.javascript/scope_analyzer");
var Scope = scopeAnalyzer.Scope;
var Variable = scopeAnalyzer.Variable;
var PROPER = scopeAnalyzer.PROPER;
var MAYBE_PROPER = scopeAnalyzer.MAYBE_PROPER;
var NOT_PROPER = scopeAnalyzer.NOT_PROPER;
var KIND_PACKAGE = scopeAnalyzer.KIND_PACKAGE;
var KIND_DEFAULT = scopeAnalyzer.KIND_DEFAULT;
var path = require("./path");
var completeUtil = require("plugins/c9.ide.language/complete_util");
require('treehugger/traverse');

var registeredSummaries = {};

if (typeof window !== "undefined") {
    completeUtil.fetchText("plugins/c9.ide.language.javascript.infer/builtin.jst", function(err, result) {
        if (err) return console.error(err);
        registeredSummaries.$builtin1$ = JSON.parse(result);
    });
}

var filePath;
var basePath;

function registerSummary(guid, summary) {
    if (!summary) {
        if (registeredSummaries[guid])
            delete registeredSummaries[guid];
        return;
    }
    
    registeredSummaries[guid] = summary;
}

Variable.prototype.addValue = function(value) {
    var values = this.values;
    for (var i = 0; i < values.length; i++) {
        if (values[i].guid === value.guid) {
            return;
        }
    }
    values.push(value);
};

/**
 * Hints at what the value of a variable may be 
 * @param variable name
 * @param val possible value
 */
Scope.prototype.hint = function(name, v, declarationConfidence, path, row, kind) {
    var variable = this.get(name, kind);
    if (!variable) {
        // Not properly declared variable, implicitly declare it in the current scope
        variable = this.declare(name);
    }
    for (var i = 0; i < variable.values.length; i++) {
        if (variable.values[i].guid === v.guid) {
            return;
        }
    }
    variable.addValue(v);
    return v;
};

Scope.prototype.hintMultiple = function(name, valueColl, declarationConfidence, path, row) {
    var variable = this.get(name);
    if (!variable) {
        // Not properly declared variable, implicitly declare it in the current scope
        variable = this.declare(name);
    }
    valueColl.forEach(function(v) {
        for (var i = 0; i < variable.values.length; i++) {
            if (variable.values[i].guid === v.guid) {
                return;
            }
        }
        variable.addValue(v);
    });
};

/**
 * Static evaluation of a function
 */
function evalFunction(scope, node, thisValues) {
    node.rewrite(
        'Function(name, fargs, body)', function(b, node) {
            var val = new FunctionValue(b.name.value, node);
            if (b.name.value)
                scope.hint(b.name.value, val, PROPER, filePath, tryGetRow(node));
            var proto = new Value("prototype", node);
            val.hint('prototype', proto);
            var localScope = this.getAnnotation("localScope");
            localScope.fn = val;
            localScope.declare("this", undefined, PROPER);
            localScope.hint("this", proto, PROPER, filePath, tryGetRow(node));
            if (thisValues)
                localScope.hintMultiple("this", thisValues, PROPER);
            b.fargs.forEach(function(farg, idx) {
                var fargName = farg[0].value;
                var fargVal;
                if (localScope.fnFargs && localScope.fnFargs[idx] && localScope.fnFargs[idx].type) {
                    fargVal = lookupValue(localScope.fnFargs[idx].type);
                }
                else {
                    fargVal = new Value(fargName);
                }
                val.hint("arg" + idx, fargVal, NOT_PROPER);
                localScope.declare(fargName);
                localScope.hint(fargName, fargVal, PROPER);
            });
            Value.enterContext(b.name.value || 'fn');
            staticEval(localScope, b.body);
            Value.leaveContext();
        }
    );
}

function hintValue(node, asV, declarationConfidence) {
    node.rewrite(
        'Var(x)', function(b) {
            var scope = this.getAnnotation("scope");
            scope.hint(b.x.value, asV, declarationConfidence);
        },
        'PropAccess(e, x)', function(b) {
            var vals = inferValues(b.e);
            vals.forEach(function(v) {
                v.hint(b.x.value, asV, declarationConfidence);
            });
        }
    );
}

/**
 * Statically evaluate the AST node, i.e.
 * - A traversal over the AST picking up only certain statements that
 *   modify variables, properties etc.
 */
function staticEval(scope, node, newFilePath, newBasePath) {
    if (newFilePath || newFilePath === "")
        filePath = newFilePath;
    if (newBasePath || newBasePath === "")
        basePath = newBasePath;
        
    node.traverseTopDown(
        "Function(_, _, _)", function() {
            evalFunction(scope, this);
            return this; // Stop traversal
        },
        "VarDeclInit(name, e)", "ConstDeclInit(name, e)", "LetDeclInit(name, e)", function(b, node) {
            staticEval(scope, b.e);
            scope.hintMultiple(b.name.value, inferValues(b.e), PROPER, filePath, tryGetRow(node));
            return this; // Stop traversal
        }, 
        'Assign(PropAccess(e1, prop), e2)', function(b, node) {
            staticEval(scope, b.e1);
            var vs = inferValues(b.e1);
            var isImportant = false;
            if (b.e2.cons === 'Function') {
                // This is the SomeThing.prototype.myMethod = function() { ... } case
                // Let's tell eval the function, hinting that "this" is in fact SomeThing.prototype
                evalFunction(scope, b.e2, vs);
                isImportant = true;
            }
            else if (b.e2.cons === 'ObjectInit') {
                staticEval(scope, this[0]); // PropAccess(e1, prop)
                var vs2 = inferValues(this[0]);
                b.e2[0].filter(
                    'PropertyInit(_, Function(_, _, _))', function(b) {
                        // Eval as method of vs2
                        evalFunction(scope, this[1], vs2);
                        return this;
                    },
                    function(b) {
                        staticEval(scope, this);
                    }
                );
                isImportant = true;
            }
            else {
                staticEval(scope, b.e2);
            }
            var vs3 = inferValues(b.e2);
            if (isImportant) {
                vs.values.forEach(function(v) {
                    v.hintMultiple(b.prop.value, vs3, MAYBE_PROPER, filePath, tryGetRow(node));
                });
            }
            else {
                vs.values.forEach(function(v) {
                    v.hintMultiple(b.prop.value, vs3, MAYBE_PROPER);
                });
            }
            return this;
        },
        "Assign(Var(name), e)", function(b) {
            staticEval(scope, this[0]);
            staticEval(scope, b.e);
            scope.hintMultiple(b.name.value, inferValues(b.e), MAYBE_PROPER);
            return this;
        },
        "ObjectInit(inits)", function(b) {
            // When finding an object literal with 
            var v = new Value("objLit");
            var vals = new ValueCollection([v]);
            b.inits.filter(
                'PropertyInit(prop, Function(_, _, _))', function(b) {
                    evalFunction(scope, this[1], vals);
                    v.hintMultiple(b.prop.value, inferValues(this[1]), PROPER, filePath, tryGetRow(this));
                },
                'PropertyInit(prop, e)', function(b) {
                    staticEval(scope, b.e);
                    v.hintMultiple(b.prop.value, inferValues(b.e), PROPER, filePath, tryGetRow(this));
                }
            );
            return this;
        },
        "OpAssign(op, Var(name), e)", function(b) {
            // TODO: Make this type dependent
            staticEval(scope, this[1]);
            staticEval(scope, b.e);
            scope.hintMultiple(b.name.value, inferValues(b.e), MAYBE_PROPER);
            if (b.op.value === '*' || b.op.value === '/' || b.op.value === '%' || b.op.value === '-') {
                scope.hint(b.name.value, lookupValue('es5:Number/prototype'));
            } else if (b.op.value === '+') {
                scope.hint(b.name.value, lookupValue('es5:Number/prototype'));
                scope.hint(b.name.value, lookupValue('es5:String/prototype'));
            }
            return this;
        },
        "PropAccess(e, prop)", function(b) {
            staticEval(scope, b.e);
            var vs = inferValues(this);
            if (!vs.isEmpty()) {
                return; // property is defined
            }
            // Apparently there's a property used in the code that
            // is defined elsewhere (or by some other means)
            // let's add it to the object
            vs = inferValues(b.e);
            vs.forEach(function(v) {
                v.hint(b.prop.value, new Value(b.prop.value), MAYBE_PROPER);
            });
            return this;
        },
        // (function() { ... }).call(Blabla.prototype) pattern
        'Call(PropAccess(Function(name, fargs, body), "call"), args)', function(b) {
            var fnNode = this[0][0]; // Function(name, ...)
            staticEval(scope, b.args);
            var objectValues = inferValues(b.args[0]);
            var funScope = fnNode.getAnnotation("localScope");
            var fargs = b.fargs;
            evalFunction(scope, fnNode, objectValues);
            for (var i = 0; i < b.args.length - 1; i++) {
                inferValues(b.args[i + 1]).forEach(function(v) {
                    if (i < fargs.length)
                        funScope.hint(fargs[i].value, v, NOT_PROPER);
                    objectValues.forEach(function(objV) {
                        objV.hint('arg' + i, v, NOT_PROPER);
                    });
                });
            }
            return this;
        },
        "Call(Var(name), args)", function(b) {
            // It's called as a function, hint the inferencer!
            var variable = scope.get(b.name.value);
            if (!variable) {
                // Not defined yet!? Declare it now
                variable = scope.declare(b.name.value);
                scope.hint(b.name.value, new FunctionValue(b.name.value, null, true), MAYBE_PROPER);
            } 
            else {
                var foundFunction = false;
                variable.values.forEach(function(v) {
                    if (v instanceof FunctionValue)
                        foundFunction = true;
                });
                if (!foundFunction)
                    scope.hint(b.name.value, new FunctionValue(b.name.value, null, true), MAYBE_PROPER);
            }
            staticEval(scope, b.args);
            // Now tell the function value about the argument types that were passed
            for (var i = 0; i < b.args.length; i++) {
                inferValues(b.args[i]).forEach(function(v) {
                    variable.values.forEach(function(fn) {
                        if (fn instanceof FunctionValue) {
                            fn.hint('arg' + i, v, NOT_PROPER);
                        }
                    });
                });
            }
            // Ensure there's a return value there
            variable.values.forEach(function(fn) {
                if (fn instanceof FunctionValue && fn.get("return").isEmpty())
                    fn.hint('return', new Value("implReturn"), PROPER);
            });
            return this;
        },
        "Call(PropAccess(e, prop), args)", function(b) {
            // property access is called as a function, let's hint that
            staticEval(scope, b.e);
            var eValues = inferValues(b.e);
            var fnValues = inferValuesPropAccess(eValues, b.prop.value, new ValueCollection());
            // Assign known information about the function to its arguments
            fnValues.forEach(function(fn) {
                if (fn instanceof FunctionValue) {
                    for (var i = 0; i < b.args.length; i++) {
                        var fargFargs = fn.fargs && fn.fargs[i] && fn.fargs[i].fargs;
                        var localScope = b.args[i].getAnnotation("localScope");
                        if (localScope)
                            localScope.fnFargs = fargFargs;
                    }
                }
            });
            staticEval(scope, b.args);
            if (fnValues.isEmpty()) {
                eValues.forEach(function(v) {
                    v.hint(b.prop.value, new FunctionValue(b.prop.value, null, true), MAYBE_PROPER);
                });
            }
            // Now tell the function value about the arguments passed
            fnValues.forEach(function(fn) {
                if (fn instanceof FunctionValue) {
                    for (var i = 0; i < b.args.length; i++) {
                        var vs = inferValues(b.args[i]);
                        vs.forEach(function(v) {
                            fn.hint('arg' + i, v, NOT_PROPER);
                        });
                    }
                    if (fn.get("return").isEmpty())
                        fn.hint('return', new Value("implReturn"), PROPER);
                }    
            });
            return this;
        },
        "Return(e)", function(b) {
            staticEval(scope, b.e);
            scope.fn && scope.fn.hintMultiple('return', inferValues(b.e), PROPER);
            return this;
        },
        "Var(name)", function(b) {
            var vs = scope.get(b.name.value);
            if (!vs) {
                // Implicitly declare it
                scope.declare(b.name.value);
                scope.hint(b.name.value, new Value(b.name.value, this), MAYBE_PROPER);
            }
            return this;
        },
        "ForIn(iter, _, _)", function(b) {
            // Hint that iteration variable will be a string
            b.iter.rewrite(
                "Var(x)", function(b) {
                    scope.hint(b.x.value, lookupValue("es5:String"));
                },
                "VarDecls([VarDecl(x)])", function(b) {
                    scope.hint(b.x.value, lookupValue("es5:String"));
                }
            );
        },
        "Op(op, e1, e2)", function(b) {
            staticEval(scope, b.e1);
            staticEval(scope, b.e2);
            switch (b.op.value) {
                case '<':
                case '<=':
                case '>':
                case '>=':
                    hintValue(b.e1, lookupValue("es5:Number"), NOT_PROPER);
                    hintValue(b.e1, lookupValue("es5:String"), NOT_PROPER);
                    hintValue(b.e2, lookupValue("es5:Number"), NOT_PROPER);
                    hintValue(b.e2, lookupValue("es5:String"), NOT_PROPER);
                    break;
            }
            return this;
        }
    );
    return scope;
}

/**
 * Attempts to infer the value, of possible values of expression `e`
 * @param e AST node repersenting an expression
 * @return a ValueCollection of possible values
 */
function inferValues(e) {
    var values = new ValueCollection();
    e.rewrite(
        "String(_)", function() {
            values.add(lookupValue("es5:String/prototype"));
            return this;
        },
        "RegExp(_,_)", function() {
            values.add(lookupValue("es5:RegExp/prototype"));
            return this;
        },
        "Num(_)", function() {
            values.add(lookupValue("es5:Number/prototype"));
            return this;
        },
        "Var(\"true\")", function() {
            values.add(lookupValue("es5:Boolean/prototype"));
            return this;
        },
        "Var(\"false\")", function() {
            values.add(lookupValue("es5:Boolean/prototype"));
            return this;
        },
        "Array(_)", function() {
            // TODO Do something with typed arrays
            values.add(lookupValue("es5:Array/prototype"));
            return this;
        },
        "Var(nm)", function(b) {
            var scope = this.getAnnotation("scope");
            if (!scope) {
                for (var root = this; root.parent;) root = root.parent;
                console.error("[infer] Cannot find scope of " + b.nm + "; analysis "
                    + (root.getAnnotation("scope") ? "incomplete" : "may not have been performed yet"));
                return;
            }
            var v = scope.get(b.nm.value) || scope.declare(b.nm.value);
            if (v.kind === KIND_DEFAULT)
                values.extend(v.values);
            return this;
        },
        "ObjectInit(inits)", function(b) {
            var v = instantiate(lookupValue("es5:Object"), undefined, this);
            b.inits.filter('PropertyInit(prop, e)', function(b) {
                v.hintMultiple(b.prop.value, inferValues(b.e), PROPER, filePath, tryGetRow(this));
            });
            values.add(v);
            return this;
        },
        "New(e, args)", function(b) {
            var vs = inferValues(b.e);
            vs.forEach(function(fn) {
                var value = instantiate(fn, undefined, undefined, b.e.cons === 'Var' && b.e[0].value);
                values.add(value);
            });
            return this;
        },
        "Call(Var(\"require\"), [String(name)])", function(b) {
            var scope = this[0].getAnnotation("scope");
            if (!scope)
                return;
            var required = b.name.value;
            if (path.isRelativePath(required) || path.isRelativePath(required)) {
                required = path.canonicalizePath(required, basePath).replace(/^\//, "");
                if (!required.match(/\.js$/))
                    required += ".js";
            }
            var result = scope.get(required, KIND_PACKAGE);
            if (!result)
                return;
            values.extend(result.values);
            return this;
        },
        "Call(PropAccess(e, method), args)", function(b) {
            var objectValues = inferValues(b.e);
            objectValues.forEach(function(objectValue) {
                var methods = objectValue.get(b.method.value);
                methods.forEach(function(fn) {
                    if (fn instanceof FunctionValue) {
                        values.extend(fn.get('return'));
                    }
                });
            });
            if (values.isEmpty())
                values.add(new Value("implRet"));
            return this;
        },
        "Call(e, args)", function(b) {
            var vs = inferValues(b.e);
            vs.forEach(function(fn) {
                if (fn instanceof FunctionValue) {
                    values.extend(fn.get('return'));
                }
            });
            if (values.isEmpty())
                values.add(new Value("implRet"));
            return this;
        },
        "PropAccess(e, prop)", function(b) {
            inferValuesPropAccess(inferValues(b.e), b.prop.value, values);
            return this;
        },
        "Function(name, fargs, _)", function(b) {
            values.add(this.getAnnotation("localScope").fn);
            return this;
        },
        'Assign(e1, e2)', function(b) {
            values = inferValues(b.e2);
        },
        'Op(op, e1, e2)', function(b) {
            // Make this dependent on types of operands
            switch (b.op.value) {
                case '*':
                case '/':
                case '%':
                case '-':
                    values.add(lookupValue('es5:Number/prototype'));
                    break;
                case '+':
                    values.add(lookupValue('es5:String/prototype'));
                    values.add(lookupValue('es5:Number/prototype'));
                    break;
                case '==':
                case '===':
                case '!==':
                case '!=':
                case '>':
                case '>=':
                case '<':
                case '<=':
                    values.add(lookupValue('es5:Boolean/prototype'));
                    break;
                case '||':
                case '&&':
                    values.extend(inferValues(b.e1));
                    values.extend(inferValues(b.e2));
                    break;
                default:
                    return false;
            }
            return this;
        },
        'PrefixOp(op, e)', function(b) {
            switch (b.op.value) {
                case '+':
                case '-':
                case '~':
                    values.add(lookupValue('es5:Number/prototype'));
                    break;
                case '!':
                    values.add(lookupValue('es5:Boolean/prototype'));
                    break;
                default:
                    return false;
            }
            return this;
        }
    );
    return values;
}

function inferValuesPropAccess(values, propName, results) {
    values.forEach(function(val) {
        results.extend(val.get(propName));
    });
    return results;
}

function createRootScope(scope, summaries) {
    if (!summaries)
        summaries = registeredSummaries;
    for (var p in summaries) {
        if (!summaries.hasOwnProperty(p))
            continue;
        var summarySet = summaries[p];
        for (var uri in summarySet) {
            if (!summarySet.hasOwnProperty(uri))
                continue;
            var summary = summarySet[uri];
            var TypeName = uri.split(':')[1];
            if (summary.kind === "default")
                summary.kind = KIND_DEFAULT;
            scope.declare(TypeName, undefined, PROPER, summary.kind);
            var value = valueFromJSON(summary);
            scope.hint(TypeName, value, PROPER, summary.path, summary.row, summary.kind);
    
            for (var j = 0; summary.altGuids && j < summary.altGuids.length; j++) {
                var guid = summary.altGuids[j].split(':')[1];
                scope.declare(guid, undefined, PROPER, summary.kind);
                scope.hint(guid, value, PROPER, summary.path, summary.row, summary.kind);   
            }
            
            if (summary.path) {
                scope.declareAlias(summary.kind, TypeName, summary.path);   
            }
        }
    }
    return scope;
}

function analyze(doc, ast, filePath, basePath, callback) {
    scopeAnalyzer.analyze(doc.getValue(), ast, function() {
        Value.enterContext('es5:unnamed');
        var scope = ast.getAnnotation("scope");
        values.reset();
        createRootScope(scope);
        Value.leaveContext();
        Value.enterContext("local:");
        staticEval(scope, ast, filePath, basePath);
        callback();
    }, true);
}

function tryGetRow(node) {
    var pos = node.getPos();
    return pos ? pos.sl : undefined;
}

exports.registerSummary = registerSummary;
exports.staticEval = staticEval;
exports.inferValues = inferValues;
exports.Scope = Scope;
exports.createRootScope = createRootScope;
exports.analyze = analyze;

});
