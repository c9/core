var net = require("net");
var fs = require("fs");

var debug = function() {};
// var debug = console.error.bind(console);
var socketPath = process.env.HOME + "/.c9/xdebug.sock";
if (process.platform == "win32")
    socketPath = "\\\\.\\pipe\\" + socketPath.replace(/\//g, "\\");

var host = "{HOST}" || "127.0.0.1";
var port = parseInt("{PORT}", 10) || 9000;

var browserBuffer = [];
var debugBuffer = [];
var browserClient;
var debugClient;

var log = console.log;

console.warn = console.log = function() {
    return console.error.apply(console, arguments);
};
function send() {
    log.apply(console, arguments);
}


/*** --- ***/

var browserServer = net.createServer(function(client) {
    debug("browserClient::connect");

    if (browserClient)
        browserClient.end();

    browserClient = client;
    debugBuffer = [];

    browserClient.on("end", function() {
        debug("browserClient::end");
        process.exit(0);
        browserClient = null;
    });

    browserClient.on("data", function(data) {
        debug("browserClient::data:", data.toString("utf8"));
        if (debugClient) {
            debugClient.write(data);
        } else {
            debugBuffer.push(data);
        }
    });

    if (browserBuffer.length) {
        browserBuffer.forEach(function(data) {
            browserClient.write(data);
        });
        browserBuffer = [];
    }
});


if (process.platform !== "win32") {
    try {
        fs.unlinkSync(socketPath);
    } catch (e) {
        if (e.code != "ENOENT")
            console.log(e);
    }
}
browserServer.listen(socketPath, function() {
    debug("netproxy listening for " + socketPath);
    start();
});

browserServer.on("error", function(err) {
    console.log(err);
    process.exit(0);
});
browserServer.on("close", function(err) {
    console.log(err);
    process.exit(0);
});

/*** --- ***/

var debugServer = net.createServer(function(client) {
    debug("debugClient::connect");

    if (debugClient)
        debugClient.end();

    debugClient = client;

    debugBuffer = [];
    browserBuffer = [];

    debugClient.on("end", function() {
        debug("debugClient::end");
        process.exit(0);
    });

    debugClient.on("data", function(data) {
        debug("debugClient::data:", data.toString("utf8"));
        if (browserClient) {
            browserClient.write(data);
        } else {
            browserBuffer.push(data);
        }
    });

    if (debugBuffer.length) {
        debugBuffer.forEach(function(data) {
            debugClient.write(data);
        });
        debugBuffer = [];
    }
});

debugServer.listen(port, host, function() {
    debug("netproxy listening for debugger on port " + port);
    start();
});

debugServer.on("error", function(err) {
    console.log(err);
    process.exit(0);
});

/*** --- ***/

var I = 0;
function start() {
    if (++I == 2)
        send("ß");
}
