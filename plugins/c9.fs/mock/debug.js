/**
 * in meteor runner restarts debug process after each save.
 * this emulates same sequence of events  without all of the complexity of meteor
 * 
 * add the following run config, run test.js file, write timeout value in output window
 * and press enter to restart test.js after a timeout
 * 
 *     "run": {
 *         "@path": "/.c9/runners",
 *         "configs": {
 *             "@inited": "true",
 *             "json()": {
 *                 "mock-meteor": {
 *                     "command": "test.js",
 *                     "debug": true,
 *                     "name": "mock-meteor",
 *                     "runner": "Node.js.test"
 *                 }
 *             }
 *         }
 *     },
 **/

var net = require("net");
var spawn = require("child_process").spawn;

var argv = process.argv;
var port = argv[2];
var debugPort = 5758;

var p, interceptServer;
var outConnection = [];
var inConnection = [];
var RETRY_INTERVAL = 500;
function start() {
    console.log(argv[0], ["--debug-brk=" + debugPort].concat(argv.slice(3)));
    p = spawn(argv[0], ["--debug-brk=" + debugPort].concat(argv.slice(3)), {});
    p.stdout.on("data", function(e) {
        process.stdout.write(e);
    });
    p.stderr.on("data", function(e) {
        process.stderr.write(e);
    });
    
    function tryConnect(port, retries, callback) {
        console.log("tryConnect", retries, port);
        if (!retries)
            return callback(new Error("Cannot connect to port " + port));
            
        var connection = net.connect(port, "localhost");
        
        connection.on("connect", function() {
            console.log("netproxy connected to debugger");
            connection.removeListener("error", onError);
            callback(null, connection);
        });
        
        connection.addListener("error", onError);
        function onError(e) {
            if (e.code !== "ECONNREFUSED")
                return callback(e);
            
            setTimeout(function() {
                tryConnect(port, retries - 1, callback);
            }, RETRY_INTERVAL);
        }
    }
    
    tryConnect(debugPort, 100, function(e, debugConnection) {
        console.log("-----------------------------");
        debugConnection.on("data", function(data) {
            console.log(data + "" + (!outConnection.write ? "<buffer>" : ""));
            if (outConnection.write)
                outConnection.write(data);
            else
                outConnection.push(data);
        });
        inConnection = debugConnection;
        debugConnection.once("data", startServer);
        debugConnection.on("error", function(e) {
            console.log(e);
        });
    });
    
    outConnection = outConnection || [];
    inConnection = [];
    
    function startServer() {
        console.log("start-server")
        interceptServer = net.createServer(function(socket) {
            console.log(socket)
            outConnection.forEach(function(e) {socket.write(e)});
            outConnection = socket;
            socket.on("data", function(buffer) {
                inConnection.write(buffer);
            });
            socket.on("error", function(e) {
                console.log(e);
            })
            socket.on("end", function(e) {
                outConnection = null
            });
        }).on("error", function(e) {
            interceptServer = null;
            console.error(e);
        }).listen(port);
    }
}

function stop() {
    if (start.timer) clearTimeout(start.timer);
    p && p.kill();
    interceptServer && interceptServer.close();
    inConnection.end && inConnection.end();
    // outConnection.end && outConnection.end();
}

process.stdin.resume();
process.stdin.setRawMode(true);
process.stdin.setEncoding("utf8");
process.on('SIGINT', function() {
    console.log('Got SIGINT.  Press Control-D to exit.');
});

process.on("SIGINT", function() {
    console.log(process.argv);
});
var buffer = "";
process.stdin.on("data", function(s) {
    process.stdout.write(s);
    buffer += s;
    var i = buffer.search(/\s/);
    if (i == -1) return;
    if (/^d-out/.test(buffer)) {
        console.log("end netproxy connection");
        outConnection.end && outConnection.end();
        return;
    }
    var t = parseInt(buffer.slice(0, i), 0);
    buffer = "";
    function wait() {
        console.log("killed the process, waiting" +  t + "ms before restart");
        if (t > 1000) {
            t -= 1000;
            setTimeout(wait, 1000);
        } else {
            setTimeout(start, t);
        }
    }
    wait();
    stop();
});
start();
console.log(process.argv);
