/**
 * jsonalyzer Python code linting
 *
 * @copyright 2015, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var baseHandler = require("plugins/c9.ide.language/base_handler");
var workerUtil = require("plugins/c9.ide.language/worker_util");

var handler = module.exports = Object.create(baseHandler);
var pythonVersion = "python2";
var pythonPath = "";
var pylintFlags = "";
var launchCommand;
var hosted;
var PYLINT_DEFAULTS = [
    "-d", "all",
    "-e", "E", 
    "-e", "F", 
    "-e", "W0101", // Unreachable code
    "-e", "W0109", // Duplicate key in dictionary
    "-e", "W0199", // Assert called on a 2-tuple. Did you mean \'assert x,y\'?
    "-e", "W0612", // Unused variable
    "-e", "W0602", // Used global without assignment
];
var PYLINT_CONFIG = [
    "-r", "n", 
    "--msg-template={line}:{column}:\\ [{msg_id}]\\ {msg}",
    "--load-plugins", "pylint_flask,pylint_django",
];

handler.handlesLanguage = function(language) {
    return language === "python";
};

handler.init = function(callback) {
    var emitter = handler.getEmitter();
    emitter.on("set_python_config", function(e) {
        pythonVersion = e.pythonVersion;
        pythonPath = e.pythonPath;
        pylintFlags = e.pylintFlags;
    });
    emitter.on("set_python_scripts", function(e) {
        launchCommand = e.launchCommand;
        hosted = e.hosted;
    });
    callback();
};

handler.analyze = function(docValue, fullAst, options, callback) {
    // Get a copy of pylint. For ssh workspaces we need to use a helper script;
    // in other cases we have the "pylint2" and "pylint3" commands.
    var commands = hosted
        ? ["-c", pythonVersion === "python2" ? "pylint2" : "pylint3"]
        : ["-c", launchCommand, "--", pythonVersion, "$ENV/bin/pylint"];
    commands[commands.length - 1] += " " + (pylintFlags || PYLINT_DEFAULTS.join(" "))
        + " " + PYLINT_CONFIG.join(" ")
        + " '$FILE'";
    if (!launchCommand)
        return callback(new Error("Warning: python_linter not initialized yet"));

    var hasStarImports = /from\s+[^\s]+\s+import\s+\*/.test(docValue);
    var markers = [];
    workerUtil.execAnalysis(
        "bash",
        {
            mode: "local-tempfile",
            args: commands,
            maxCallInterval: 800,
            env: {
                PYTHONPATH: pythonPath,
                PYLINTHOME: "/tmp/.pylint.d",
            }
        },
        function(err, stdout, stderr) {
            if (err && !stdout) return callback(err);

            stdout.split("\n").forEach(function(line) {
                var marker = parseLine(line, hasStarImports);
                marker && markers.push(marker);
            });
            
            callback(null, markers);
        }
    );
};

function parseLine(line, hasStarImports) {
    var match = line.match(/(\d+):(\d+): \[([^\]]+)\] (.*)/);
    if (!match)
        return;
    var row = match[1];
    var column = match[2];
    var code = match[3];
    var message = match[4];
    var level = getLevel(code);
    
    if (/print statement used/.test(message))
        return;
    if (hasStarImports && /undefined variable/i.test(message)) {
        level = "info";
        message += "?";
    }
    // Downgrade unbalanced-tuple-unpacking upgraded to error in pylint 1.5,
    // matching e.g. script, filename = argv
    if (/E0632/.test(code))
        level = "info";
    // Downgrade other errors upgraded to error in pylint 1.5
    if (/E1128|E0633/.test(code))
        level = "warning";
    // Ignore import errors, as relative imports and temp files don't play together
    if (/E0401/.test(code))
        return;
    if (/Django is not available on/.test(message))
        return;
        
    return {
        pos: {
            sl: parseInt(row, 10) - 1,
            sc: parseInt(column, 10)
        },
        message: message,
        code: code,
        level: level
    };
}

function getLevel(code) {
    if (code[0] === "E" || code[0] === "F")
        return "error";
    if (code === "W0612") // unused variable
        return "info";
    if (code === "W0602") // global without assignment
        return "info";
    return "warning";
}

});