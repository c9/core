/*global tern*/
(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(require("acorn/acorn"), require("acorn/acorn_loose"), require);
  if (typeof define == "function" && define.amd) // AMD
    return define(["acorn/dist/acorn", "acorn/dist/acorn_loose", "require", "exports"], mod);
  mod(tern, tern);
})(function(acorn, acornLoose, require, exports) {
var File = function() {}; // TODO? use require("tern/lib/tern").File
var parse = acorn.parse;
var parse_dammit = acornLoose.parse_dammit;

var lastInput;
var lastOutput;
var lastInputLoose;
var lastOutputLoose;
var language;

if (exports)
    exports.setLanguage = function(value) {
        language = value;
    };

acorn.parse = function(input, options) {
    return acornLoose.parse_dammit(input, options);
};

acornLoose.parse_dammit = function(input, options) {
    if (language === "jsx") {
        // HACK: as long as we used an unpatched acorn, make jsx easier to parse
        input = input.replace(/\/>|<\//g, " -").replace(/[<>]/g, "-");
    }
    // console.log("call")
    if (input === lastInputLoose) {
        // console.log("reuse")
        if (options.directSourceFile && lastOutputLoose.sourceFile != options.directSourceFile) {
            // console.log("copy")
            for (var i in options.directSourceFile)
                lastOutputLoose.sourceFile[i] = options.directSourceFile[i];
            lastOutputLoose.sourceFile.ast = lastOutputLoose;
        }
        return lastOutputLoose;
    }
    if (!options.directSourceFile) {
        options.directSourceFile = new File();
        options.directSourceFile;
    }
    // console.log("recompute")
    lastOutputLoose = filterDefine(parse_dammit(input, options));
    lastInputLoose = input;
    return lastOutputLoose;
};

function filterDefine(ast) {
    // HACK: replace 'define(function(require, exports, module)' with
    //               'define(function()' to fix exported symbols
    ast.body.forEach(function(statement) {
        // define(function(...) {})
        if (statement.type === "ExpressionStatement"
            && statement.expression.type === "CallExpression"
            && statement.expression.callee.name === "define"
            && statement.expression.arguments.length
            && statement.expression.arguments[0].type === "FunctionExpression") {
            var func = statement.expression.arguments[0];
            func.params = func.params.filter(function(p) {
                return ["require", "exports", "module"].indexOf(p.name) === -1;
            });
        }
    });
    return ast;
}

});