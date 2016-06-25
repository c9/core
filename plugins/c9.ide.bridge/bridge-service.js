module.exports = function (vfs, options, register) { 
    var stream;
    
    var net = require("net");
    var Stream = require('stream');
    
    var SOCKET = process.platform == "win32"
         ? "\\\\.\\pipe\\.c9\\bridge.default.socket"
         : process.env.HOME + "/.c9/bridge.default.socket";

    function createListenClient(api){
        console.log(SOCKET)
        var client = net.connect(SOCKET, function(data){
            api.onConnect(client);
        });
        client.setEncoding("utf8");
        client.unref();
        
        client.on("data", function(data){
            if (data) api.onData(data);
        });
        
        client.on("error", function(err){
            if (err.code == "ECONNREFUSED") {
                require("fs").unlink(SOCKET, function(){ 
                    createListenServer(api);
                });
            }
            else if (err.code == "ENOENT") {
                createListenServer(api);
            }
            else
                api.onError(err);
        });
        
        client.on("end", function(){
            createListenServer(api);
        });
        
        
        api.disconnect = function(){
            client.end();
        };
        
        return client;
    }
    
    function createListenServer(api){
        function broadcast(data, client) {
            clients.forEach(function(c) {
                if (c != client)
                    c.write(data);
            });
        }
        function registerClient(client) {
            if (client.setEncoding)
                client.setEncoding("utf8");
            
            client.on("data", function(data){
                // TODO add a way for sending message to one client
                broadcast(data, client);
            });
            function cleanup(e) {
                var i = clients.indexOf(client);
                if (i != -1)
                    clients.splice(i, 1);

                client.removeListener("end", cleanup);
                client.removeListener("error", cleanup);
            }
            client.on("end", cleanup);
            client.on("error", cleanup);
            

            clients.push(client);
        }

        api
        var clients = [];
        var stream = new Stream();
        stream.readable = true;
        stream.writable = true;
        stream.write = function(e) {
            api.onData(e);
        };
        registerClient(stream);
        api.onConnect({ write: function(e) { 
            stream.emit("data", e) }
        });
        var unixServer = net.createServer(registerClient);
        unixServer.listen(SOCKET);
        
        unixServer.on("error", function(err){
            if (err.code == "EADDRINUSE") {
                createListenClient(api);
            }
            else
                api.onError(err);
        });
        
        api.disconnect = function(){
            unixServer.close();
        };
    }
    
    register(null, {
        genSocket:function(socketKey,callback){
            if(!socketKey || !callback) return;
            
            SOCKET = process.platform == "win32"
                ? "\\\\.\\pipe\\.c9\\bridge."+socketKey+".socket"
                : process.env.HOME + "/.c9/bridge."+socketKey+".socket";
                
            callback();
        },
        connect: function (callback) {
            if (stream) return callback(null, { stream: stream });
            
            stream = new Stream();
            stream.readable = true;
            stream.writable = true;
            stream.write = function(data){
                if (client) client.write(data);
            };
            
            var client;
            var sent = false;
            var api = this.api = {
                id: Math.random(), 
                onConnect: function(c){
                    client = c;
                    if (sent) return;
                    
                    callback(null, { stream: stream });
                    sent = true;
                },
                onData: function(data){
                    stream && stream.emit("data", data);
                },
                onError: function(err){
                    stream && stream.emit("error", err);
                }
            };
            
            // createListenServer
            createListenClient(api);
        },
        
        disconnect: function(){
            try { this.api && this.api.disconnect(); }
            catch (e) {}
            
            stream = null;
            delete this.api;
        },
        
        destroy: function(){
            this.disconnect();
        }
    });
};