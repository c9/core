module.exports = function (vfs, options, register) { 
    var Stream = require('stream');
    var stream, server;
    
    register(null, {
        connect: function (port, callback) {
            if (stream) return callback(null, { stream: stream });
            
            server = require('net').createServer(function(c) {
                var buffer = "";
                c.on("data", function(chunk) {
                    buffer += chunk;
                });
                c.on("end", function(){
                    stream.emit("data", buffer);
                });
            });
            server.on("error", function(err) {
                callback(err);
            });
            server.listen(port, process.env.OPENSHIFT_DIY_IP || "localhost", function(err) {
                if (err) return callback(err);
                callback(null, { stream: stream });
            });
            
            stream = new Stream();
            stream.readable = true;
        },
        
        disconnect: function(){
            try { server && server.close(); }
            catch (e) {}
            stream = null;
            server = null;
        }
    });
};