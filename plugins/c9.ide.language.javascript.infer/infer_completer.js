define(function(require, exports, module) {

var baseLanguageHandler = require('plugins/c9.ide.language/base_handler');
var infer = require('./infer');
var path = require('./path');
var KIND_DEFAULT = require('plugins/c9.ide.language.javascript/scope_analyzer').KIND_DEFAULT;
var KIND_PACKAGE = require('plugins/c9.ide.language.javascript/scope_analyzer').KIND_PACKAGE;
var KIND_EVENT = require('plugins/c9.ide.language.javascript/scope_analyzer').KIND_EVENT;
var PROPER = require('plugins/c9.ide.language.javascript/scope_analyzer').PROPER;
var EXPAND_STRING = 1;
var EXPAND_REQUIRE = 2;
var EXPAND_REQUIRE_LIMIT = 5;
var REQUIRE_PROPOSALS_MAX = 80;
var REQUIRE_ID_REGEX = /(?!["'])./;
var FunctionValue = require('./values').FunctionValue;
var completeUtil = require("plugins/c9.ide.language/complete_util");
var traverse = require("treehugger/traverse");
var args = require("./infer_arguments");
var astUpdater = require("./ast_updater");

// Completion priority levels
// Should be used sparingly, since they disrupt the sorting order
var PRIORITY_INFER_LOW = 3;
var PRIORITY_INFER = 4;
var PRIORITY_INFER_TERN = 5;
var PRIORITY_INFER_HIGH = 6;

var completer = module.exports = Object.create(baseLanguageHandler);
var extraModuleCompletions;
    
completer.handlesLanguage = function(language) {
    // Note that we don't really support jsx here,
    // but rather tolerate it using error recovery...
    return language === "javascript" || language === "jsx";
};

completer.getIdentifierRegex = function() {
    // Allow slashes for package names
    return (/[a-zA-Z_0-9\$\/]/);
};

completer.getCompletionRegex = function() {
    return (/^[\.]$/);
};

completer.getCacheCompletionRegex = function() {
     // Match strings that can be an expression or its prefix
    return new RegExp(
        // 'if/while/for ('
        "(\\b(if|while|for|switch)\\s*\\("
        // other identifiers and keywords without (
        + "|\\b\\w+\\s+"
        // equality operators, operators such as + and -,
        // and opening brackets { and [
        + "|(===?|!==?|[-+]=|[-+*%<>?!|&{[])"
        // spaces
        + "|\\s)+"
    );
};

completer.getMaxFileSizeSupported = function() {
    // .25 of current base_handler default
    return .25 * 10 * 1000 * 80;
};

completer.setExtraModules = function(extraModules) {
    extraModuleCompletions = extraModules;
};

function valueToMatch(container, v, name, isPackage, isContextual) {
    // Node.js and the default behavior of require.js is not adding the .js extension
    if (isPackage)
        name = name.replace(/\.js$/, "");
    if ((v instanceof FunctionValue || v.properties._return) && !isPackage) {
        var showArgs = args.extractArgumentNames(v, true);
        var insertArgs = "opt" in showArgs ? args.extractArgumentNames(v, false) : showArgs;
        return {
            id: name,
            guid: v.guid + "[0" + name + "]",
            name: name + "(" + showArgs.argNames.join(", ") + ")",
            replaceText: name + (insertArgs.argNames.length === 0 && v.guid && v.guid.indexOf("es5:") !== 0 ? "()" : "(^^)"),
            icon: "method",
            priority: PRIORITY_INFER,
            inferredNames: showArgs.inferredNames,
            doc: v.doc,
            docUrl: v.docUrl,
            isFunction: true,
            type: v.properties._return && getGuid(v.properties._return.values[0]),
            isContextual: isContextual
        };
    }
    else {
        var isHighConfidence = 
            container && container.properties && container.properties["_" + name]
            && container.properties["_" + name].confidence >= 1;
        return {
            id: name,
            guid: container ? container.guid + "/" + name : v.guid + "[0" + name + "]",
            name: name,
            replaceText: name,
            doc: v.doc,
            docUrl: v.docUrl,
            icon: "property",
            priority: name === "__proto__" ? PRIORITY_INFER_LOW : PRIORITY_INFER,
            type: !isPackage && getGuid(v.properties.___proto__ ? v.properties.___proto__.values[0] : v.guid),
            isContextual: isHighConfidence
        };
    }
}

function getGuid(valueOrGuid) {
    if (!valueOrGuid)
        return;
    var result = valueOrGuid.guid || valueOrGuid;
    return result.substr && result.substr(-11) !== "/implReturn" ? result : undefined;
}

completer.predictNextCompletion = function(doc, fullAst, pos, options, callback) {
    if (!options.matches.length) {
        // Normally we wouldn't complete here, maybe we can complete for the next char?
        // Let's do so unless it looks like the next char may be a newline or equals sign
        if (options.line[pos.column - 1] && /(?![{;})\]\s"'\+\-\*])./.test(options.line[pos.column - 1]))
            return callback(null, { predicted: "" });
    }
    var predicted = options.matches.filter(function(m) {
        return m.priority >= PRIORITY_INFER;
    });
    if (predicted.length !== 1 || predicted[0].icon === "method")
        return callback();
    callback(null, {
        predicted: predicted[0].replaceText + ".",
        showEarly: predicted[0].icon === "property" && !/\./.test(options.line)
    });
};

completer.complete = function(doc, fullAst, pos, options, callback) {
    if (!options.node)
        return callback();
    var line = options.line;
    var identifier = options.identifierPrefix;
    var basePath = path.getBasePath(completer.path, completer.workspaceDir);
    var filePath = path.canonicalizePath(completer.path, basePath);
    if (fullAst.parent === undefined) {
        traverse.addParentPointers(fullAst);
        fullAst.parent = null;
    }
    astUpdater.updateOrReanalyze(doc, fullAst, filePath, basePath, pos, function(fullAst, currentNode) {
        var completions = {};
        var duplicates = {};
        currentNode.rewrite(
            'PropAccess(e, x)', function(b) {
                var allIdentifiers = [];
                var values = infer.inferValues(b.e);
                values.forEach(function(v) {
                    var propNames = v.getPropertyNames();
                    for (var i = 0; i < propNames.length; i++) {
                        if (propNames[i] !== b.x.value || v.isProperDeclaration(propNames[i]))
                            allIdentifiers.push(propNames[i]);
                    }
                });
                var matches = completeUtil.findCompletions(identifier, allIdentifiers);
                for (var i = 0; i < matches.length; i++) {
                    values.forEach(function(v) {
                        v.get(matches[i]).forEach(function(propVal) {
                            var match = valueToMatch(v, propVal, matches[i], false, true);
                            // Only override completion if argument names were _not_ inferred, or if no better match is known
                            var duplicate = duplicates["_" + match.id];
                            if (duplicate && duplicate.inferredNames)
                                delete completions["_" + duplicate.guid];
                            if (duplicate && match.inferredNames)
                                return;
                            duplicates["_" + match.id] = completions["_" + match.guid] = match;
                        });
                    });
                }
                return this;
            },
            // Don't complete definitions
            'FArg(_)', 'Function(_,_,_)', 'VarDeclInit(_,_)', 'VarDecl(_,_)',
            'ConstDeclInit(_,_)', 'ConstDecl(_,_)', function() { return this; },
            '_', function() {
                var me = this;
                if (this.traverseUp(
                    "Call(Var(\"require\"), args)",
                    function(b) {
                        if (b.args[0] !== me && this !== me)
                            return;
                        var scope = this[0].getAnnotation("scope");
                        var expand = b.args[0] && b.args[0].cons === "String" ? null : EXPAND_STRING;
                        identifier = completeUtil.retrievePrecedingIdentifier(line, pos.column, REQUIRE_ID_REGEX);

                        var useBasePath = path.isRelativePath(identifier) || path.isAbsolutePath(identifier) ? basePath : null;
                        completer.proposeRequire(identifier, expand, scope, completions, useBasePath);
                    }))
                    return this;
            },
            'ERROR()', 'PropertyInit(x,e)', 'ObjectInit(ps)', function(b, node) {
                if (b.ps) {
                    completer.proposeObjectProperty(node, identifier, completions);
                }
                else if (!b.x) {
                    if (currentNode.parent.cons !== "PropertyInit")
                        return; // Fallthrough
                    currentNode = currentNode.parent;
                    b.x = currentNode[0];
                    b.e = currentNode[1];
                }
                // get parent parent like in ObjectInit([PropertyInit("b",ERROR())])
                var objectInit = currentNode.parent.parent;
                if (!objectInit.parent || !objectInit.parent.parent || objectInit.parent.parent.cons !== "Call")
                    return node;
                completer.proposeObjectProperty(objectInit, identifier, completions);
                return node;
            },
            'Call(_, _)', function(b) {
                if ("function".indexOf(identifier) === 0)
                    completer.proposeClosure(this, doc, pos, completions);
                // Fallthrough to next rule
            },
            'Var(_)', function(b) {
                if (this.parent.parent && this.parent.parent.isMatch('Call(_, _)') && "function".indexOf(identifier) === 0)
                    completer.proposeClosure(this.parent.parent, doc, pos, completions);
                // Fallthrough to next rule
            },
            'Var(_)', function(b) {
                this.parent.rewrite('VarDeclInit(x, _)', 'ConstDeclInit(x, _)', function(b) {
                    if ("require".indexOf(identifier) !== 0)
                        return;
                    var scope = this.getAnnotation("scope");
                    // Propose relative and non-relative paths
                    completer.proposeRequire(b.x.value, EXPAND_REQUIRE, scope, completions);
                    completer.proposeRequire(b.x.value, EXPAND_REQUIRE, scope, completions, basePath);
                });
                // Fallthrough to next rule
            },
            // Else, let's assume it's a variable
            function() {
                var scope;
                this.traverseUp(function() {
                    if (!scope) scope = this.getAnnotation("scope");
                    if (this.rewrite("String(_)")) return this;
                });
                if (!scope)
                    return;
                var variableNames = scope.getVariableNames();
                if (this.cons === 'Var') { // Delete current var from proposals if not properly declared anywhere
                    var varName = this[0].value;
                    if (variableNames.indexOf(varName) !== -1 && (!scope.get(varName) || !scope.get(varName).isProperDeclaration()))
                        variableNames.splice(variableNames.indexOf(varName), 1);
                }
                var matches = completeUtil.findCompletions(identifier, variableNames);
                for (var i = 0; i < matches.length; i++) {
                    var v = scope.get(matches[i]);
                    if (!v)
                        continue;
                    if (!v.values.length && v.properDeclarationConfidence >= PROPER && currentNode.cons === "Var") {
                        completions[matches[i]] = {
                            id: matches[i],
                            name: matches[i],
                            replaceText: matches[i],
                            icon: "property",
                            priority: PRIORITY_INFER_TERN
                        };
                    }
                    v.values.forEach(function(propVal) {
                        var match = valueToMatch(null, propVal, matches[i]);
                        if (!match.name)
                            return;
                        // Only override completion if argument names were _not_ inferred, or if no better match is known
                        var duplicate = duplicates["_" + match.id];
                        if (duplicate && duplicate.inferredNames)
                            delete completions["_" + duplicate.guid];
                        if (duplicate && match.inferredNames)
                            return;
                        duplicates["_" + match.id] = completions["_" + match.guid] = match;
                    });
                }
            }
        );
        // Find completions equal to the current prefix
        var completionsArray = [];
        for (var id in completions) {
            completionsArray.push(completions[id]);
        }
        callback(completionsArray);
    });
};

/**
 * @param basePath  If specified, the base path to use for relative paths.
 *                  Enables listing relative paths.
 */
completer.proposeRequire = function(identifier, expand, scope, completions, basePath) {
    var names = scope.getNamesByKind(KIND_PACKAGE);
    
    if (basePath || basePath === "")
        identifier = path.canonicalizePath(identifier, basePath).replace(/^\.$/, "");
    
    if (expand === EXPAND_REQUIRE && extraModuleCompletions)
        names = names.concat(Object.keys(extraModuleCompletions));

    var matches = expand === EXPAND_REQUIRE
        ? filterRequireSubstring(identifier, names)
        : completeUtil.findCompletions(identifier === "/" ? "" : identifier, names);
    
    if (basePath || basePath === "")
        matches = matches.filter(function(v) { return v.match(/\.js$/) && !v.match(/(\/|^)node_modules\//); });
    else
        matches = matches.filter(function(v) { return !v.match(/\.js$/); });
    
    if (expand === EXPAND_REQUIRE && matches.length > EXPAND_REQUIRE_LIMIT)
        return;

    matches = matches.slice(0, REQUIRE_PROPOSALS_MAX);

    for (var i = 0; i < matches.length; i++) {
        var match = matches[i];
        var v = scope.get(match, KIND_PACKAGE);
        if (!v && expand === EXPAND_REQUIRE) {
            return completions["_" + match] = {
                id: match,
                icon: "package",
                name: 'require("' + match + '")',
                replaceText: 'require("' + match + '")',
                doc: "Origin: node<br/>"
                    + (extraModuleCompletions[match].doc || ""),
                priority: PRIORITY_INFER_HIGH
            };
        }
        v.values.forEach(function(propVal) {
            var match = valueToMatch(null, propVal, matches[i], true, expand);
            match.icon = "package";
            if (identifier.match(/^\//))
                match.replaceText = match.name = "/" + match.replaceText;
            else if (basePath || basePath === "")
                match.replaceText = match.name = path.uncanonicalizePath(match.replaceText, basePath);
            completions["_" + match.guid] = match;
            if (expand === EXPAND_REQUIRE) {
                match.replaceText = 'require("' + match.replaceText + '")';
                match.name = 'require("' + match.name + '")';
            }
            if (expand === EXPAND_STRING)
                match.replaceText = '"' + match.replaceText + '"';
            if (expand !== EXPAND_REQUIRE)
                match.identifierRegex = REQUIRE_ID_REGEX;
        });
    }
};

completer.proposeClosure = function(node, doc, pos, completions) {
    node.rewrite('Call(f, args)', function(b) {
        var argIndex = args.getArgIndex(this, doc, pos);
        var id = 0;
        infer.inferValues(b.f).forEach(function(v) {
            var argNames = args.extractArgumentNames(v, false);
            var code = argNames.argValueCodes[argIndex];
            if (!code)
                return;
            var codeName = code.split(/\n/)[0] + "}";
            var guid = v.guid + "-argfun" + (id++);
            completions[guid] = {
                id: codeName,
                guid: guid,
                name: codeName,
                replaceText: code,
                doc: v.fargs && v.fargs.doc,
                docUrl: v.fargs && v.fargs.docUrl,
                icon: "method",
                priority: PRIORITY_INFER_HIGH
            };
        });
    });
};

/**
 * Complete properties for an Object init in e.g.
 * Call(PropAccess(Var("http"),"example"),[ObjectInit([PropertyInit("b",ERROR())])])
 */    
completer.proposeObjectProperty = function(objectInit, identifier, completions) {
    var listIndex;
    for (var i = 0; i < objectInit.parent.length; i++)
        if (objectInit.parent[i] === objectInit) listIndex = i;
    var call = objectInit.parent.parent;
    infer.inferValues(call[0]).forEach(function(v) {
        if (!v.fargs || !v.fargs[listIndex] || !v.fargs[listIndex].properties)
            return;
        v.fargs[listIndex].properties.forEach(function(property) {
            completions["_$p$" + property.id] = {
                id: property.id,
                name: property.id,
                replaceText: property.id,
                doc: property.doc,
                docUrl: property.docUrl,
                icon: "property",
                priority: PRIORITY_INFER
            };
        });
    });
};

function filterRequireSubstring(name, names) {
    var nameClean = name.replace(/[^A-Za-z0-9_-]/g, ".");
    var nameRegex = new RegExp("^" + nameClean + "\\b|\\b" + nameClean + "$");
    return names.filter(function(n) {
        return nameRegex.test(n);
    });
}

});
