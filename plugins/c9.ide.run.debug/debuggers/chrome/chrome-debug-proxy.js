/*
  ide1       ide2
   |          |
vfsServer1  vfsServer2  vfsServer3 ... clients
   |          |   
   |          |    filesocket
   |          |
chrome-debug-proxy
   |
   |    websocket
   |
node-process1  node-process2 ... debuggers
*/

var fs = require("fs");
var net = require("net");
var Debugger = require("./Debugger");
var MessageReader = require("./MessageReader");

var startT = Date.now();
var IS_WINDOWS = process.platform == "win32";

/*** connect to cloud9 ***/

var socketPath = process.env.HOME + "/.c9/chrome.sock";
if (IS_WINDOWS)
    socketPath = "\\\\.\\pipe\\" + socketPath.replace(/\//g, "\\");

var force = process.argv.indexOf("--force") != -1;
console.log("Using socket", socketPath);

function checkServer(id) {
    var client = net.connect(socketPath, function() {
        if (id) return;
        if (!force) {
            console.log("process already exists");
            process.exit(0);
        }
        else {
            console.log("trying to replace existing process");
            var strMsg = JSON.stringify({ $: "exit" });
            client.write(strMsg + "\0");
        }
    });
    client.on("data", function(data) {
        if (force)
            return console.log("old pid" + data);
        try {
            var msg = JSON.parse(data.toString().slice(0, -1));
        } catch (e) {}
        if (msg && msg.ping != id)
            process.exit(1);
        client.destroy();
    });
    
    client.on("error", function(err) {
        if (!id && err) {
            var code = err.code;
            if (code == "ECONNREFUSED" || code === "ENOENT" || code === "EAGAIN")
                return createServer();
        }
        
        process.exit(1);
    });
    
    if (force) {
        client.once("close", function() {
            if (!server)
                createServer();
        });
    }
}

var $id = 0;
var server;
var ideClients = {};
var debuggers = {};
function createServer() {
    server = net.createServer(function(client) {
        var isClosed = false;
        client.id = $id++;
        ideClients[client.id] = client;

        client.send = function(msg) {
            if (isClosed)
                return;
            var strMsg = JSON.stringify(msg);
            client.write(strMsg + "\0");
        };

        client.on("data", onData);

        var buff = [];

        function onData(data) {
            data = data.toString();
            var idx;
            while (true) {
                idx = data.indexOf("\0");
                if (idx === -1)
                    return data && buff.push(data);
                buff.push(data.substring(0, idx));
                var clientMsg = buff.join("");
                data = data.substring(idx + 1);
                buff = [];
                if (clientMsg[0] == "{") {
                    try {
                        var msg = JSON.parse(clientMsg);
                    } catch (e) {
                        console.log("error parsing message", clientMsg);
                        return client.close();
                    }
                } else {
                    msg = clientMsg;
                }
                client.emit("message", msg);
            }
        }

        client.on("close", onClose);
        client.on("end", onClose);
        
        client.on("message", function(message) {
            if (actions[message.$])
                actions[message.$](message, client);
            else if (client.debugger)
                client.debugger.handleMessage(message);
        });

        function onClose() {
            if (isClosed) return;
            isClosed = true;
            delete ideClients[client.id];
            if (client.debugger)
                client.debugger.removeClient(client);
            client.emit("disconnect");
        }

        client.on("error", function(err) {
            console.log(err);
            onClose();
            client.destroy();
        });
        
        client.send({ ping: process.pid });
    });
    server.on("error", function(err) {
        console.error("server error", err);
        throw err;
    });
    server.on("close", function (e) {
        console.log("server closed", e);
        process.exit(1);
    });

    removeStaleSocket();
    server.listen(socketPath, function() {
        console.log("server listening on ", socketPath);
        checkServer(process.pid);
    });
}

function removeStaleSocket() {
    if (IS_WINDOWS)
        return;
    try {
         fs.unlinkSync(socketPath);
    } catch (e) {
        if (e.code != "ENOENT")
            console.error(e);
    }
}

var actions = {
    exit: function(message, client) {
        process.exit(1);
    },
    ping: function(message, client) {
        message.$ = "pong";
        message.t = Date.now();
        client.send(message);
    },
    connect: function(message, client, callback) {
        if (!debuggers[message.port]) {
            var dbg = debuggers[message.port] = new Debugger();
            debuggers[message.port].connect(message);
            debuggers[message.port].on("disconnect", function() {
                if (debuggers[message.port] == dbg)
                    delete debuggers[message.port];
            });
        }
        
        debuggers[message.port].addClient(client);
    },
    detach: function(message, client, callback) {
        if (client.debugger)
            client.debugger.disconnect();
    },
};


/*** =============== ***/
var idle = 0;
setInterval(function() {
    console.log(Object.keys(ideClients), Object.keys(debuggers))
    if (!Object.keys(ideClients).length && !Object.keys(debuggers).length) {
        idle++;
    } else {
        idle = 0;
    }
    if (idle > 2) {
        console.log("No open connections, exiting");
        process.exit(0);
    }
}, 30 * 1000);
checkServer();

