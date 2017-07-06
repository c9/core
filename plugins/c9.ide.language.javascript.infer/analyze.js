require("../../../../support/cloud9/support/requireJS-node");
require.paths.unshift(__dirname + "/../../../../support/cloud9/support/treehugger/lib");
require.paths.unshift(__dirname + "/../../../../support/cloud9/client");
require.paths.unshift(__dirname + "/../../.."); // cloud9infra/client/c9
var parser = require("treehugger/js/parse");
var infer = require('./infer');
var Value = require('./values').Value;
var externalize = require('./externalize').externalize;
var scopeAnalyzer = require('plugins/c9.ide.language.javascript/scope_analyzer');
var fs = require('fs');

var builtins1 = JSON.parse(fs.readFileSync(__dirname + "/builtin.jst", 'UTF-8'));
var builtins2 = JSON.parse(fs.readFileSync(__dirname + "/builtin.custom.jst", 'UTF-8'));

disabledFeatures = {};

function analyze(path) {
    fs.readFile(path, 'ascii', function(err, code) {
        if (err) throw err;

        var node = parser.parse(code);
        scopeAnalyzer.analyze(null, node);
        Value.enterContext('es5:unnamed');
        var scope = infer.createRootScope(node.getAnnotation("scope"), [builtins1, builtins2]);
        Value.leaveContext();
        Value.enterContext(path + ':');
        infer.staticEval(scope, node);
        var exportValue;
        if (scope.get('module'))
            scope.get('module').values.forEach(function(v) {
                exportValue = v;
            });
        else if (scope.get('exports'))
            scope.get('exports').values.forEach(function(v) {
                exportValue = v;
            });
        var extern = externalize(path, exportValue);
        if (exportValue)
            extern[path] = exportValue.guid;
        fs.writeFileSync(path + '.jst', JSON.stringify(extern));
        console.log(JSON.stringify(extern, null, 2));
    });
}

analyze(process.argv[2]);
