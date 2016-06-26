var sysLog = console.log;
var sysWarn = console.warn;
var sysError = console.error;
var server = require("./server");

console.log = function() {
    writeLog.apply(null, arguments);
    sysLog.apply(console, arguments);
};
console.warn = function() {
    writeLog.apply(null, arguments);
    sysWarn.apply(console, arguments);
};
console.error = function() {
    writeLog.apply(null, arguments);
    sysError.apply(console, arguments);
};

function writeLog(varargs) {
    var args = [];
    for (var i = 0; i < arguments.length; i++) {
        args[i] = typeof arguments[i] == "string"
            ? arguments[i]
            : tryStringify(arguments[i]);
    }
    server.appendLog(args.join(" ") + "\n");
}

function tryStringify(o) {
    try {
        return JSON.stringify(o);
    } catch (e) {
        return "" + o;
    }
}

window.onerror = function(message, url, line, errorObj) {
    writeLog("ERROR:", message, "at", url, ":", line, errorObj.stack);
};
