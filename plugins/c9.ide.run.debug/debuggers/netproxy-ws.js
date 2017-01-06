var net = require("net");
var WebSocketServer = require('ws').Server;
var port = parseInt("{PORT}", 10);

var buffer = [];
var browserClient, debugClient;

var MAX_RETRIES = 100;
var RETRY_INTERVAL = 300;

var log = console.log;

console.warn = console.log = function() {
    return console.error.apply(console, arguments);
};
function send() {
    log.apply(console, arguments);
}

var server = net.createServer(function(client) {
    if (browserClient)
        browserClient.destroy(); // Client is probably unloaded because a new client is connecting
    
    browserClient = client;
    
    browserClient.on("end", function() {
        browserClient = null;
    });
    
    browserClient.on("data", function(data) {
        debugClient.send(data);
    });
    
    if (buffer.length) {
        buffer.forEach(function(data) {
            browserClient.write(data);
        });
        buffer = [];
    }
});

var host = "127.0.0.1";
// console.log("started netproxy on ", host + ":" + (port+1));

// Start listening for browser clients
server.listen(port + 1, host, function() {
    // console.log("netproxy listening on port " + (port+1));
    start();
});

// Handle errors
server.on("error", function() { process.exit(0); });

function tryConnect(retries, callback) {
    if (!retries)
        return callback(new Error("Cannot connect to port " + port));
    
    var wss = new WebSocketServer({ port: process.env.PORT || 8080 });
    
    wss.on('connection', function(ws) {
        wss.removeListener("error", onError);
        
        // We only allow a single connection
        if (debugClient)
            return ws.terminate();
        
        debugClient = ws;
    
        debugClient.on('message', function(data) {
            if (browserClient) {
                browserClient.write(data);
            } else {
                buffer.push(data);
            }
        });
        
        debugClient.on("error", function(e) {
            console.error(e);
            debugClient = null;
        });
        
        debugClient.on("end", function(data) {
            debugClient = null;
        });
        
        callback(null, ws);
    });
    
    wss.addListener("error", onError); // @TODO test error state (port in use)
    function onError(e) {
        if (e.code !== "ECONNREFUSED")
            return callback(e);
        
        debugClient = null;
        setTimeout(function() {
            tryConnect(retries - 1, callback);
        }, RETRY_INTERVAL);
    }
}

tryConnect(MAX_RETRIES, function(err, ws) {
    if (err)
        return console.error(err);
        
    start(); // @TODO if this is too early, move this to for instance when a first message is received from the device
});


var I = 0;
function start() {
    if (++I == 2)
        send("ß");
}