var childProcess = require("child_process");

var GSSH = __dirname + "/../../scripts/gssh";

function findServers(pattern, options, callback) {
    if (!callback && typeof options == "function") {
        return findServers(pattern, {}, options);
    }
    
    childProcess.exec(GSSH + " --print-names " + pattern, function (err, stdout) {
        if (err) return callback(err);
        
        var serverNames = stdout.split("\n")
            .filter(function(name) { return !!name; })
            .map(function (name) { return name.replace(/ubuntu@/, ""); });
            
        return callback(null,  serverNames);
    });
    
}

function runCommand(pattern, command, options, callback) {
    if (!callback && typeof options == "function") {
        return runCommand(pattern, command, {}, options);
    }
    
    var optionsArray = [];
    if (options.parallel) {
        optionsArray.push("-P");
    }
    if (options.cacheOnly) {
        optionsArray.push("--cache-only");
    }
    
    var gsshCommand = GSSH + " " + optionsArray.join(" ") + " " + pattern + " '" + command + "'";
    childProcess.exec(gsshCommand, function (err, stdout) {
        return callback(err, stdout);
    });
}

module.exports = {
    find: findServers,
    run: runCommand
}