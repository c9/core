define(function(require, exports, module) {
    var EventEmitter = require("events").EventEmitter;
    
    module.exports = function(process){
        var pty = new EventEmitter();
        pty.write = function(data){
            process.stdin.write(data);
        };
        pty.resize = function(){};
        pty.destroy =
        pty.end = function(){
            process.kill();
        };
        
        process.stdout.on("data", function(chunk){
            pty.emit("data", chunk);
        });
        process.stderr.on("data", function(chunk){
            pty.emit("data", chunk);
        });
        process.on("exit", function(code){
            pty.emit("exit", code);
        });
        
        return pty;
    }
});