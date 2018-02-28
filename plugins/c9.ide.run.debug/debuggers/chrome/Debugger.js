var net = require("net");
var WebSocket = require("ws/index");
var MessageReader = require("./MessageReader");
var EventEmitter = require("events").EventEmitter;

var RETRY_INTERVAL = 300;
var MAX_RETRIES = 100;


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
    this.__proto__ = EventEmitter.prototype;

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
                this.disconnect();
                return console.log(err);
            }
            var tabs = res;
            
            if (!tabs) {
                this.connectToV8(options);
                return;
            }
            
            if (tabs.length > 1)
                console.log("connecting to first tab from " + tabs.length);
            
            if (tabs[0] && tabs[0].webSocketDebuggerUrl) {
                this.connectToWebsocket(tabs[0].webSocketDebuggerUrl);
            }
        }.bind(this));
    };
    
    this.connectToWebsocket = function(url) {
        var broadcast = this.broadcast;
        var self = this;
        var ws = new WebSocket(url);
        ws.on("open", function open() {
            console.log("connected");
            broadcast({ $: "connected" });
        });
        ws.on("close", function close() {
            console.log("disconnected");
            self.disconnect();
        });
        ws.on("message", function incoming(data) {
            try {
                var parsed = JSON.parse(data);
            } catch (e) {
            }
            // console.log("<<" + data);
            // ignore for now since this is noisy, and is not used on the client
            if (parsed && parsed.method == "Runtime.consoleAPICalled")
                return;
            
            broadcast(data);
        });
        ws.on("error", function(e) {
            console.log("error", e);
            broadcast({ $: "error", err: e });
            self.disconnect();
        });
        this.ws = ws;
    };
    
    this.connectToV8 = function(options) {
        var broadcast = this.broadcast;
        var self = this;
        
        var connection = net.connect(options.port, options.host);
        connection.on("connect", function() {
            console.log("netproxy connected to debugger");
            broadcast({ $: "connected", mode: "v8" });
        });
        connection.on("error", function(e) {
            console.log("error in v8 connection", e);
            self.disconnect();
        });
        connection.on("close", function(e) {
            console.log("v8 connection closed", e);
            self.disconnect();
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
        this.emit("disconnect");
        this.clients.forEach(function(client) {
            client.end();
        });
        if (this.ws)
            this.ws.close();
        if (this.v8Socket)
            this.v8Socket.destroy();
    };
    
}).call(Debugger.prototype);


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
        console.log("Initial connection response:", response);
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

module.exports = Debugger;
