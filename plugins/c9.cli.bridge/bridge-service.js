module.exports = function (vfs, options, register) { 
    var stream;
    
    var net = require("net");
    var Stream = require('stream');
    
    var SOCKET = process.platform == "win32"
        ? "\\\\.\\pipe\\.c9\\bridge.socket"
        : process.env.HOME + "/.c9/bridge.socket";

    function createListenClient(api){
        var client = net.connect(SOCKET, function(data){
            if (data) api.onData(data);
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
        
        api.onConnect(client);
        
        api.disconnect = function(){
            client.end();
        };
        
        return client;
    }
    
    function createListenServer(api){ 
        // var timeout = setTimeout(function(){
        //     unixServer.close();
        // }, 500);
    
        var unixServer = net.createServer(function(client) {
            client.setEncoding("utf8");
            
            client.on("data", function(data){
                if (data) api.onData(data);
            });
            
            client.on("error", function(data){
                // console.error("ERROR", api.id, data);
            });
            
            api.onConnect(client);
        });
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
        connect: function (callback) {
            if (stream) return callback(null, { stream: stream });
            
            stream = new Stream();
            stream.readable = true;
            stream.writable = true;
            
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
            
            stream.write = function(data){
                if (client) client.write(data);
            };
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