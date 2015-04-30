define(function(require, exports, module) {

var EventEmitter = require("events").EventEmitter;

module.exports = function(stream) {
    var emit = this.emit;
    
    var buffer = "";
    stream.on("data", function(chunk) {
        buffer += chunk;
        
        var parts = buffer.split("\n");
        while (parts.length) {
            try { 
                var message = JSON.parse(buffer[0]); 
                emit("data", { message: message });
                buffer.shift();
            }
            catch (e) {
                if (parts.length !== 1) {
                    emit("error", e);
                    buffer.shift();
                }
                else {
                    break;
                }
            }
        }
        buffer = parts.join("\n");
    });

    stream.on("error", function(err){
        emit("error", err)
    });
    
    stream.on("close", function(data){
        emit("close", data);
    });
    
    this.write = function(data){
        stream.write(JSON.stringify(data));
    }
};

module.exports.prototype = new EventEmitter();

});