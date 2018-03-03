 /*
  * Copyright (C) 2015,  Ajax.org B.V.
  * This software is available under the Cloud9 SDK License, available from 
  * https://github.com/c9/core/blob/master/LICENSE.
  */

var net = require("net");
var debuggedProcessHost = "{DEBUGGED_PROCESS_HOST}";
var debuggedProcessPort = parseInt("{DEBUGGED_PROCESS_PORT}", 10);

var debugBuffer = [];
var browserBuffer = [];
var browserClient, 
    debugClient;

var MAX_RETRIES = 600;
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
    debugBuffer = [];
    
    browserClient.on("end", function() {
        browserClient = null;
    });
    
    browserClient.on("data", function(data) {
        console.error("data = " + data);
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

// Start listening for browser clients
server.listen(debuggedProcessPort + 1, "127.0.0.1", function() {
    //console.log("netproxy listening on port " + ( debuggedProcessPort + 1) );
    start();
});

// Handle errors
server.on("error", function() { process.exit(0); });

function tryConnect(retries, callback) {
    if (!retries)
        return callback(new Error("Cannot connect to port " + debuggedProcessPort));
        
    var connection = net.connect(debuggedProcessPort, debuggedProcessHost);
    
    connection.on("connect", function() {
        //console.log("netproxy connected to debugger");
        connection.removeListener("error", onError);
        callback(null, connection);
    });
    
    connection.addListener("error", onError);
    function onError(e) {
        if (e.code !== "ECONNREFUSED")
            return callback(e);
        
        setTimeout(function() {
            tryConnect(retries - 1, callback);
        }, RETRY_INTERVAL);
    }
}

tryConnect(MAX_RETRIES, function(err, connection) {
    if (err)
        return errHandler(err);
        
    debugClient = connection;
    browserBuffer = [];
    
    debugClient.on("data", function(data) {
        if (browserClient) {
            browserClient.write(data);
        } else {
            browserBuffer.push(data);
        }
    });
    
    function errHandler(e) {
        console.log(e);
        process.exit(0);
    }
    
    debugClient.on("error", errHandler);
    
    debugClient.on("end", function(data) {
        server.close();
    });
    
    start();
    
    if (debugBuffer.length) {
        console.error("sending buffer to debugger...");
        console.error("debugBuffer  = " + debugBuffer);
        debugBuffer.forEach(function(data) {
            debugClient.write(data);
        });
        debugBuffer = [];
    }
});


var I = 0;
function start() {
    if (++I == 2)
        send("ß");
}