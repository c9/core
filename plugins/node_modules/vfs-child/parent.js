var Consumer = require('vfs-socket/consumer').Consumer;
var inherits = require('util').inherits;
var spawn = require('child_process').spawn;
var fs = require("fs");

exports.Parent = Parent;

function Parent(fsOptions) {
    Consumer.call(this);
    var options = {};
    if (fsOptions.hasOwnProperty("gid")) {
        options.gid = fsOptions.gid;
        delete fsOptions.gid;
    }
    if (fsOptions.hasOwnProperty("uid")) {
        options.uid = fsOptions.uid;
        delete fsOptions.uid;
    }
    options.stdio = [-1, -1, 2];
    var args = [require.resolve('./child.js'), JSON.stringify(fsOptions)];
    var nodeBin = fsOptions.nodeBin || [process.execPath];
    var child;

    // Override Consumer's connect since the transport logic is internal to this module
    this.connect = connect.bind(this);
    function connect(callback) {
        var _self = this;
        try {
            if (!fs.existsSync(nodeBin[0]))
                return tryNext(new Error("Couldn't find valid node binary"));
            child = spawn(nodeBin[0], args, options).on("error", tryNext);
        }
        catch (e) {
            return done(e);
        }
        child.stdin.readable = true;
        Consumer.prototype.connect.call(this, [child.stdout, child.stdin], done);
        child.on("exit", disconnect);
        child.stdin.resume();
        
        function tryNext(err) {
             if (nodeBin.length > 1) {
                nodeBin.shift();
                _self.emit("error", err);
                _self.connect(callback);
             } else {
                 return done(err);
             }
        }
        
        function done(err, vfs) {
            if (!callback) return;
            child.removeListener("error", done);
            child.on("error", function ignore(err) {});
            callback(err, vfs);
            callback = null;
        }
    }

    // Override Consumer's disconnect to kill the child process afterwards
    this.disconnect = disconnect.bind(this);
    function disconnect() {
        if (!this.transport) return;
        Consumer.prototype.disconnect.apply(this, arguments);
        child.kill();
    }
    
    if (fsOptions.inProcess) {
        this.connect = function(callback) {
            var vfs = require('vfs-local')(fsOptions);
            setImmediate(function(){
                callback(null, vfs);
            });
        };
    }
}
inherits(Parent, Consumer);

