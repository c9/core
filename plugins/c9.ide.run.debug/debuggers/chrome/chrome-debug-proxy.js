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
var WebSocket = require("ws/index");
var MessageReader = require("./MessageReader");

var startT = Date.now();

/*** connect to cloud9 ***/

var socketPath = process.env.HOME + "/.c9/chrome.sock";
if (process.platform == "win32")
    socketPath = "\\\\.\\pipe\\" + socketPath.replace(/\//g, "\\");

console.log(socketPath);

function checkServer(id) {
    var client = net.connect(socketPath, function() {
        if (id) return;
        console.log("process already exists");
        process.exit(0);
    });
    client.on("data", function(data) {
        try {
            var msg = JSON.parse(data.toString().slice(0, -1));
        } catch (e) {}
        if (msg && msg.ping != id)
            process.exit(1);
        client.destroy();
    });
    
    client.on("error", function(err) {
        if (!id && err && (err.code === "ECONNREFUSED" || err.code === "ENOENT" || err.code === "EAGAIN")) {
            createServer();
        }
        else {
            process.exit(1);
        }
    });
}

var $id = 0;
var server;
var ideClients = {};
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
    server.on("error", function(e) {
        console.log("server error", e);
        process.exit(1);
    });
    server.on("close", function (e) {
        console.log("server closed", e);
        process.exit(1);
    });
    if (process.platform !== "win32") {
        try {
            fs.unlinkSync(socketPath);
        } catch (e) {
            if (e.code != "ENOENT")
                console.log(e);
        }
    }
    server.listen(socketPath, function() {
        console.log("server listening on ", socketPath);
        checkServer(process.pid);
    });
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
    var clients = this.clients = [];
    
    this.broadcast = function(message) {
        if (typeof message !== "string")
            message = JSON.stringify(message);
        clients.forEach(function(c) {
            c.write(message + "\0");
        });
    };
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
        if (this.ws)
            this.ws.send(JSON.stringify(message));
        else if (this.v8Socket)
            this.v8Socket.send(message);
        else
            console.error("recieved message when debugger is not ready", message);
    };
    
    this.connect = function(options) {
        getDebuggerData(options.port, function(err, res) {
            if (err) {
                this.broadcast({ $: "error", message: err.message });
                return console.log(err);
            }
            var tabs = res;
            
            if (!tabs) {
                this.connectToV8(options);
                return;
            }
            
            if (tabs.length > 1)
                console.log("connecting to first tab");
            
            if (tabs[0] && tabs[0].webSocketDebuggerUrl) {
                this.connectToWebsocket(tabs[0].webSocketDebuggerUrl);
            }
        }.bind(this));
    };
    
    this.connectToWebsocket = function(url) {
        var broadcast = this.broadcast;
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
    
    this.connectToV8 = function(options) {
        var broadcast = this.broadcast;
        
        var connection = net.connect(options.port, options.host);
        connection.on("connect", function() {
            console.log("netproxy connected to debugger");
            broadcast({ $: "connected", mode: "v8" });
        });
        connection.on("error", function(e) {
            console.log(e);
        });
        new MessageReader(connection, function(response) {
            broadcast(response.toString("utf8"));
        });
        connection.send = function(msg) {
            if (msg.arguments && !msg.arguments.maxStringLength)
                msg.arguments.maxStringLength = 10000;
            var data = new Buffer(JSON.stringify(msg));
            
            connection.write(new Buffer("Content-Length:" + data.length + "\r\n\r\n"));
            connection.write(data);
        };
        this.v8Socket = connection;
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

function request(options, callback) {
    var socket = new net.Socket();
    new MessageReader(socket, function(response) {
        console.log(response + "{}{}{}");
        socket.end();
        if (response) {
            try {
                response = JSON.parse(response);
            } catch (e) {}
        }
        callback(null, response);
    });
    socket.on("error", function(e) {
        console.log("Initial connection error", options, e);
        socket.end();
        callback(e);
    });
    socket.connect(options.port, options.host);
    socket.on("connect", function() {
        socket.write("GET " + options.path + " HTTP/1.1\r\nConnection: close\r\n\r\n");
    });
}

/*** =============== ***/
setInterval(function() {
    if (!Object.keys(ideClients).length && !Object.keys(debuggers).length)
        process.exit(0);
}, 60 * 1000);
checkServer();

