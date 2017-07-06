/*global tern*/
(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(
        require("../lib/infer"),
        require("../lib/tern"),
        require("../lib/comment"),
        require("acorn/util/walk"),
        require
    );
  if (typeof define == "function" && define.amd) // AMD
    return define([
        "tern/lib/infer",
        "tern/lib/tern",
        "tern/lib/comment",
        "acorn/dist/walk",
        "require",
        "exports"
    ], mod);
  mod(tern, tern);
})(function(infer, tern, comment, walk, require, exports) {

var architectPlugins;
var warnedPlugins = {};

if (exports)
    exports.setArchitectPlugins = function(value) {
        architectPlugins = value;
    };

tern.registerPlugin("architect_resolver", function(ternWorker, options) {
    ternWorker._architect = {
        modules: Object.create(null)
    };

    // Collect architect definitions on load
    ternWorker.on("afterLoad", function(file) {
        var provides;
        walk.simple(file.ast, {
            AssignmentExpression: function(node) {
                if (!isDependencyAssign(node, "provides"))
                    return;
                provides = node.right.elements.map(function(e) {
                    return e.value;
                }).filter(function(e) {
                    return e;
                });
            },
            FunctionDeclaration: function(node) {
                if ((node.id.name !== "main" && node.id.name !== "plugin")
                    || node.params.length !== 3
                    || node.params[1].name !== "imports"
                    || node.params[2].name !== "register")
                    return;
                
                var seen = {};

                walk.simple(node, {
                    CallExpression: function(node) {
                        if (node.callee.name === "register"
                            && node.arguments.length >= 2
                            && node.arguments[1].type === "ObjectExpression") {
                            var arg = node.arguments[1];
                            arg.properties.forEach(function(prop) {
                                var name = prop.key.name;
                                var value = arg.objType.props[name] && arg.objType.props[name].types && arg.objType.props[name].types[0];
                                if (!value || seen["_" + name])
                                    return;
                                ternWorker._architect.modules["_" + name] = value;
                            });
                        }
                        if (node.callee.type === "MemberExpression"
                            && node.callee.property.name === "freezePublicAPI"
                            && node.arguments.length >= 1
                            && node.arguments[0].type === "ObjectExpression") {
                            var name = provides[0];
                            if (provides.length !== 1
                                && !(provides.length === 2 && name === "ext" && !seen["_" + name]))
                                return console.warn("[architect_resolver_worker] exporting multiple client-side plugins with freezePublicAPI() not supported: " + node.sourceFile.name);
                            var type = node.arguments[0].objType;
                            ternWorker._architect.modules["_" + name] = type;
                            seen["_" + name] = true;
                            delete type.props._events;
                            
                            comment.ensureCommentsBefore(node.sourceFile.text, node);
                            if (node.commentsBefore)
                                type.doc = type.doc || node.commentsBefore[node.commentsBefore.length - 1];
                        }
                    }
                });
            }
        });
    });

    // Assign architect definitions to 'imports.*'
    function onPostInfer(ast, scope) {
        var path = ternWorker.cx.curOrigin;
        var baseDirMatch = path.match(/(.*\/)?plugins\//);
        if (!architectPlugins)
            return console.error("[architect_resolver_worker] architectPlugins not available");

        var consumes;
        walk.simple(ast, {
            AssignmentExpression: function(node) {
                if (!isDependencyAssign(node, "consumes"))
                    return;
                consumes = node.right.elements.map(function(e) {
                    return e.value;
                }).filter(function(e) {
                    return e;
                });
            },
            FunctionDeclaration: function(node) {
                if (node.id.name !== "main"
                    || node.params.length !== 3
                    || node.params[1].name !== "imports"
                    || node.params[2].name !== "register"
                    || !node.body.scope)
                    return;

                var importsVal = node.body.scope.prev.props.imports;

                // Seems like our argument doesn't want to complete without a type
                var type = new infer.Obj();
                importsVal.addType(type);
                
                // HACK: tern still doesn't like our type, so let's override this
                importsVal.gatherProperties = function(f) {
                    // for (var p in this.props) f(p, this, 0);
                    consumes.forEach(function(m) {
                        return f(m, importsVal, 0);
                    });
                };

                if (!consumes)
                    return console.warn("[architect_resolver_worker] main.consumes not defined");
                    
                if (!baseDirMatch) {
                    if (!warnedPlugins[path])
                        console.warn("[architect_resolver_worker] expected plugin to be in plugins/ dir: " + path);
                    warnedPlugins[path] = true;
                    return;
                }

                consumes.forEach(function(name) {
                    var path = getPath(name);
                    var def = ternWorker._architect.modules["_" + name];
                    if (!path && !def) {
                        if (!warnedPlugins[name])
                            console.warn("[architect_resolver_worker] could not resolve \"" + name + "\" plugin");
                        warnedPlugins[name] = true;
                        return;
                    }
                    if (path && baseDirMatch)
                        ternWorker.addFile(path, null, ternWorker.cx.curOrigin);
                    if (!def)
                        return;
                    
                    importsVal.getProp(name).addType(def);
                    type.getProp(name).addType(def);
                });
            }
        });

        function getPath(name) {
            var result = architectPlugins["_" + name];
            if (!result)
                return;
            return baseDirMatch[1] + result + ".js";
        }
    }

    function isDependencyAssign(node, kind) {
        return node.left.type === "MemberExpression"
            && (node.left.object.name === "main" || node.left.object.name === "plugin")
            && node.left.property.name === kind
            && node.right.type === "ArrayExpression";
    }

    return {
        passes: {
            postInfer: onPostInfer
        }
    };
});

});