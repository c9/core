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
var WebSocket = require("ws");
var startT = Date.now();

/*** helpers ***/


/*** connect to cloud9 ***/

var socketPath = process.env.HOME + "/chrome.sock";
if (process.platform == "win32")
    socketPath = "\\\\.\\pipe\\" + socketPath.replace(/\//g, "\\");

console.log(socketPath);

function checkServer() {
    var currentT
    var client = net.connect(socketPath, function() {
        console.log("process already exists");
        // process.exit(0);
    });
    fs.stat(__filename, function(err, stat) {
        currentT = stat ? stat.mtime.valueOf() : 0;
        console.log(currentT);
        // client.send({ $: "exit" });
    });
    client.on("data", function(data) {
        var m = JSON.parse(data.slice(0, -1));
        console.log(data + "");
        if (m.$ == "refresh" && m.t < currentT)
            client.write(JSON.stringify({ $: "exit" }) + "\0");
    });
    
    client.on("error", function(err) {
        if (err && (err.code === "ECONNREFUSED" || err.code === "ENOENT" || err.code === "EAGAIN")) {
            createServer();
        }
        else {
            process.exit(1);
        }
    });
}
var ideClients = {};
var counter = 0;
var server;
function createServer() {
    server = net.createServer(function(client) {
        var isClosed = false;
        client.id = counter++;
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
                client.emit("message", JSON.parse(clientMsg));
            }
        }

        client.on("close", onClose);
        client.on("end", onClose);
        
        client.on("message", function(message) {
            console.log(message);
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
        
        client.send({ $: "refresh", t: startT });
    });
    server.on("error", function(e) {
        console.log(e);
        console.log("+++++++++++++++++++++++++++");
        process.exit(1);
    });
    if ((process.platform == "win32")) {
        server.listen(socketPath, function() {
            console.log("---------------------------");
        });
    }
    else {
        fs.unlink(socketPath, function(e) {
            server.listen(socketPath, function() {
                console.log("---------------------------");
            });
        });
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
        // if (!debuggers[message.port]) {
            debuggers[message.port] = new Debugger();
            debuggers[message.port].connect(message);
        // }
        
        debuggers[message.port].addClient(client);
    },
    detach: function(message, client, callback) {
        if (client.debugger)
            client.debugger.disconnect();
    },
};
/*** connect to node ***/

function Debugger(options) {
    this.clients = [];
}

(function() {
    this.addClient = function(client) {
        this.clients.push(client);
        // client.send({$: 1});
        client.debugger = this;
    };
    this.removeClient = function(client) {
        var i = this.clients.indexOf(client);
        if (i != -1)
            this.clients.splice(i, 1);
        client.debugger = null;
    };
    this.handleMessage = function(message) {
        console.log(">>" + JSON.stringify(message))
        if (this.ws)
            this.ws.send(JSON.stringify(message));
        else
            console.log(message);
    };
    
    this.connect = function(options) {
        getDebuggerData(options.port, function(err, res) {
            if (err) console.log(err) //TODO
            var header = res[0];
            var tabs = res[1];
            
            if (!tabs) {
                return // old debugger
            }
            
            if (tabs.length > 1)
                console.log("===========================");
            
            if (tabs[0] && tabs[0].webSocketDebuggerUrl) {
                this.connectToWebsocket(tabs[0].webSocketDebuggerUrl);
            }
        }.bind(this));
    };
    
    this.connectToWebsocket = function(url) {
        var clients = this.clients;
        function broadcast(message) {
            if (typeof message !== "string")
                message = JSON.stringify(message);
            clients.forEach(function(c) {
                console.log(c.id, "[][]");
                c.write(message + "\0");
            });
        }
        var ws = new WebSocket(url);
        ws.on("open", function open() {
            console.log("connected");
            broadcast({ $: "connected" });
        });
        ws.on("close", function close() {
            console.log("disconnected");
        });
        ws.on("message", function incoming(data) {
            console.log("<<" + data);
            broadcast(data);
        });
        ws.on("error", function(e) {
            console.log("error", e);
            broadcast({ $: "error", err: e });
        });
        this.ws = ws;
    };
    
    this.disconnect = function() {
        if (this.ws)
            this.ws.close();
        this.clients.forEach(function(client) {
            client.end();
        });
    };
    
}).call(Debugger.prototype);


var RETRY_INTERVAL = 300;
var MAX_RETRIES = 100;
var debuggers = {};


function getDebuggerData(port, callback, retries) {
    console.log("Connecting to port", port, retries);
    if (retries == null) retries = MAX_RETRIES;
    request({
        host: "127.0.0.1",
        port: port,
        path: "/json/list",
    }, function(err, res) {
        if (err && retries > 0) {
            return setTimeout(function() {
                getDebuggerData(port, callback, retries - 1);
            }, RETRY_INTERVAL);
        }
        console.log(res);
        callback(err, res);
    });
}

function request(options, cb) {
    var socket = new net.Socket();
    var received = "";
    var expectedBytes = 0;
    var offset = 0;
    function readBytes(str, start, bytes) {
        // returns the byte length of an utf8 string
        var consumed = 0;
        for (var i = start; i < str.length; i++) {
            var code = str.charCodeAt(i);
            if (code < 0x7f) consumed++;
            else if (code > 0x7f && code <= 0x7ff) consumed += 2;
            else if (code > 0x7ff && code <= 0xffff) consumed += 3;
            if (code >= 0xD800 && code <= 0xDBFF) i++; // leading surrogate
            if (consumed >= bytes) { i++; break; }
        }
        return { bytes: consumed, length: i - start };
    }
    function parse(data) {
        var fullResponse = false;
        received += data;
        if (!expectedBytes) { // header
            var i = received.indexOf("\r\n\r\n");
            if (i !== -1) {
                var c = received.lastIndexOf("Content-Length:", i);
                if (c != -1) {
                    var l = received.indexOf("\r\n", c);
                    var len = parseInt(received.substring(c + 15, l), 10);
                    expectedBytes = len;
                }
                offset = i + 4;
            }
        }
        if (expectedBytes) { // body
            var result = readBytes(received, offset, expectedBytes);
            expectedBytes -= result.bytes;
            offset += result.length;
        }
        if (offset && expectedBytes <= 0) {
            fullResponse = received.substring(0, offset);
            received = received.substr(offset);
            offset = expectedBytes = 0;
        }
        return fullResponse && fullResponse.split("\r\n\r\n");
    }

    socket.on("data", function(data) {
        console.log(data + "")
        var response = parse(data);
        if (response) {
            socket.end();
            if (response[1]) {
                try {
                    response[1] = JSON.parse(response[1]);
                } catch (e) {}
            }
            cb(null, response);
        }
    });
    socket.on("error", function(e) {
        console.log("==~==", e)
        socket.end();
        cb(e);
    });
    socket.connect(options.port, options.host);
    socket.on("connect", function() {
        console.log("~==")
        socket.write("GET " + options.path + " HTTP/1.1\r\nConnection: close\r\n\r\n");
    });
}


/*** =============== ***/
checkServer();

setInterval(function() {
    console.log(Date.now());
}, 60000);