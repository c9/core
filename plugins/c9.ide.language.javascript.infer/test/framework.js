require("amd-loader");
require("../../../test/setup_paths");

var parser = require("treehugger/js/parse");
var traverse = require("treehugger/traverse");
var scopeAnalyzer = require('plugins/c9.ide.language.javascript/scope_analyzer');
var infer = require('../infer');
var Value = require('../values').Value;
var externalize = require('../externalize').externalize;
var assert = require("assert");
var fs = require('fs');
var util = require('util');

disabledFeatures = {};

function canBeInstanceOf(n, guid) {
    var yup = false;
    //console.log("Can be instance of " + n);
    console.log("Infering type of: " + n);
    var values = infer.inferValues(n);
    //console.log(values);
    values.forEach(function(v) {
        if (v.guid)
            console.log("Could be: " + v.guid);
        if (v.guid === guid) {
            yup = true;
            return;
        }
        v.get('__proto__').forEach(function(v) {
            if (v.guid) {
                console.log("Could be: " + v.guid);
            }
            if (v.guid === guid) {
                yup = true;
            }
        });
    });
    if (!yup && guid.search(/\/prototype$/) === -1) {
        return canBeInstanceOf(n, guid + "/prototype");
    }
    else if (!yup) {
        console.log(""+n);
        console.log("Not what we expected: " + util.inspect(values, null, 7));
    }
    return yup;
}

function extractTypeAnnotations(code) {
    var lines = code.split("\n");
    var annotations = [];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.indexOf('//#') === 0) { // annotation line
            var regex = /\^ ([^ \n\|]+)/g;
            var match;
            while (match = regex.exec(line)) {
                var firstNonAnnoLineIdx = i-1;
                while (firstNonAnnoLineIdx > 0 && lines[firstNonAnnoLineIdx].indexOf('//#') === 0)
                    firstNonAnnoLineIdx--;
                annotations.push({
                    line: firstNonAnnoLineIdx,
                    col: match.index,
                    type: match[1]
                });
            }
        }
    }
    return annotations;
}

exports.buildTest = function(filename, exportSymbol) {
    return function(done) {
        var code = fs.readFileSync(__dirname + "/" + filename, 'utf-8').replace(/\r/g, "");
        var builtins1 = fs.readFileSync(__dirname + "/../builtin.jst", 'utf-8');
        var builtins2 = fs.readFileSync(__dirname + "/../builtin.custom.jst", 'utf-8');
        var builtins3 = fs.readFileSync(__dirname + "/../builtin.nodejs.jst", 'utf-8');
        var builtins = [JSON.parse(builtins1), JSON.parse(builtins2), JSON.parse(builtins3)];
        var node = parser.parse(code);
        traverse.addParentPointers(node);
        scopeAnalyzer.analyze(code, node, function() { /* Risky, but we know this is sync in this context */ });
        Value.enterContext('es5:unnamed');
        var typeAnnotations = extractTypeAnnotations(code);
        var scope = infer.createRootScope(node.getAnnotation("scope"), builtins);
        Value.leaveContext();
        Value.enterContext(filename);
        infer.staticEval(scope, node);
        // console.log("AST: "+node);
        
        for (var i = 0; i < typeAnnotations.length; i++) {
            var anno = typeAnnotations[i];
            var n = node.findNode(anno);
            assert.ok(canBeInstanceOf(n, anno.type), "Went wrong on this one: " + JSON.stringify(anno));
        }
        var exportValue;
        if (exportSymbol) scope.get(exportSymbol).values.forEach(function(v) { exportValue = v; });
        var extern = externalize(filename, exportValue);
        if (exportSymbol) extern[exportSymbol] = exportValue.guid;
        require('fs').writeFile(__dirname + "/" + filename + '.jst', JSON.stringify(extern, null, 2), done);
    };
};
