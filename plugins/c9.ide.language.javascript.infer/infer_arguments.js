define(function(require, exports, module) {

var tree = require("treehugger/tree");
var FunctionValue = require('./values').FunctionValue;
var ValueCollection = require('./values').ValueCollection;

/**
 * Gets the index of the selected function argument, or returns -1 if N/A.
 */
module.exports.getArgIndex = function(node, doc, cursorPos) {
    var cursorTreePos = { line: cursorPos.row, col: cursorPos.column };
    var result = -1;
    node.rewrite(
        'Call(e, args)', function(b) {
            // Try to determine at which argument the cursor is located in order
            // to be able to show a label
            result = -1;
            var line = doc.getLine(cursorPos.row);
            if (line[b.args.getPos().ec + 1] && line[b.args.getPos().ec + 1].match(/[ ,]/))
                b.args.getPos().ec++;

            if (b.args.length === 0 && this.getPos().ec - 1 === cursorPos.column) {
                result = 0;
            }
            else if (b.args.length === 0 && line.substr(cursorPos.column).match(/^\s*\)/)) {
                result = 0;
            }
            else if (!tree.inRange(this.getPos(), cursorTreePos, true)) {
                return this;
            }
            else if (cursorPos.row === this.getPos().sl && line.substr(0, cursorPos.column + 1).match(/,\s*\)$/)) {
                result = b.args.length;
                return this;
            }
            for (var i = 0; i < b.args.length; i++) {
                if (b.args[i].cons === "ERROR" && result === -1) {
                    result = i;
                    break;
                }
                b.args[i].traverseTopDown(function() {
                    var pos = this.getPos();
                    if (this === node) {
                        result = i;
                        return this;
                    }
                    else if (pos && pos.sl <= cursorPos.row && pos.sc <= cursorPos.column) {
                        if (pos.sl === cursorPos.row && pos.ec === cursorPos.column - 1 && line[pos.ec] === ")")
                            return result = -1;
                        result = i;
                    }
                });
            }
            return this;
        }
    );
    return result;
};

module.exports.extractArgumentNames = function(v, showOptionals) {
    var args = [];
    var argsCode = [];
    var inferredArguments = v.callOnly;
    var opt;
    var fargs = v instanceof FunctionValue ? v.getFargs() : [];
    var argColl = extractArgumentValues(v, fargs, 0);
    for (var idx = 0; fargs.length ? idx < fargs.length : !argColl.isEmpty(); idx++) {
        var argName;
        if (fargs[idx]) {
            argName = fargs[idx].id || fargs[idx];
            if (showOptionals && fargs[idx].opt) {
                argName = "[" + argName + "]";
                opt = opt || idx;
            }
        }
        else {
            argName = "arg" + idx;
            inferredArguments = true;
        }
        args.push(argName);
        argsCode.push(fargToClosure(fargs[idx]) || valueCollToClosure(argName, argColl));
        argColl = extractArgumentValues(v, fargs, idx + 1);
    }
    return {
        argNames: args,
        argValueCodes: argsCode,
        inferredNames: inferredArguments,
        opt: opt
    };
};

var extractArgumentValues = function(v, fargs, index) {
    var result;
    if (fargs[index] && fargs[index].id) {
        result = new ValueCollection();
        if (fargs[index].type)
            result.extend(fargs[index].type);
    }
    else {
        result = v.get("arg" + index);
    }
    return result;
};

function fargToClosure(farg) {
    if (!farg || !farg.fargs)
        return null;
    var args = [];
    for (var i = 0; i < farg.fargs.length; i++) {
        args.push(farg.fargs[i].id || farg.fargs[i]);
    }
    return "function(" + args.join(", ") + ") {\n    ^^\n}";
}

function valueCollToClosure(name, coll) {
    var result;
    coll.forEach(function(v) {
        if (result)
            return;
        if (v instanceof FunctionValue) {
            var args = [];
            var fargs = v.getFargs();
            var argColl = extractArgumentValues(v, fargs, idx);
            for (var idx = 0; !argColl.isEmpty() || idx < fargs.length; idx++) {
                var argName;
                if (fargs[idx])
                    argName = fargs[idx].id || fargs[idx];
                else
                    argName = "arg" + idx;
                args.push(argName);
                argColl = extractArgumentValues(v, fargs, idx + 1);
            }
            result = "function(" + args.join(", ") + ") {\n    ^^\n}";
        }
    });
    return result;
}

});
