define(function(require, exports, module) {
    main.consumes = ["Plugin", "net", "proc", "c9"];
    main.provides = ["debugger.socket"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var net = imports.net;
        var c9 = imports.c9;
        var proc = imports.proc;
        var nodeBin = Array.isArray(options.nodeBin)
            ? options.nodeBin[0]
            : options.nodeBin || "node"; 

        var DISCONNECTED = 0;
        var CONNECTED = 1;
        var CONNECTING = 2;
        
        var counter = 0;
        var timer = null;
        
        function Socket(port, proxy, reconnect) {
            var socket = new Plugin();
            var emit = socket.getEmitter();
            var state, stream, connected, away;
            
            if (proxy == false)
                return socket;
            
            if (typeof proxy == "string")
                proxy = { source: proxy };
            
            if (!proxy.port)
                proxy.port = port + 1;
            
            var proxySource = proxy.source;
            socket.__defineGetter__("state", function() { return state; });
            
            c9.on("connect", function() {
                if (away) {
                    reconnect = true;
                    connect();
                }
            }, socket);
            c9.on("away", function() {
                if (!away) {
                    away = true;
                    state = "away";
                    emit("away");
                }
            }, socket);
            c9.on("back", function() {
                if (away) {
                    connectToPort(function(err) {
                        if (err) {
                            if (err.code == "ECONNREFUSED") {
                                state = null;
                                emit("end");
                                connect(true);
                            }
                            else
                                emit("error", err);
                            return;       
                        }
                    });
                }
            }, socket);
            c9.on("disconnect", function() {
                if (!away) {
                    away = true;
                    state = "away";
                    emit("away");
                }
            }, socket);
            
            socket.on("unload", function() {
                close();
            });
            
            function connect(force) {
                if (state == "connected" || state == "connecting") 
                    return;
                
                connected = CONNECTING;
                state = "connecting";
                
                if ((reconnect || proxy.reuseExisting) && !force) {
                    connectToPort(function(err) {
                        if (!err) return;
                        
                        state = null;
                        
                        if (err.code == "ECONNREFUSED") {
                            emit("end");
                            connect(true);
                        }
                        else
                            return emit("err", err);
                    });
                }
                else if (proxy.socketpath) {
                    var retries = proxy.retries || 100;
                    proxy.retryInterval = proxy.retryInterval || 300;

                    connectToSocket(retries);
                }
                else if (proxy.detach) {
                    proc.spawn(nodeBin, {
                        args: ["-e", proxySource],
                        detached: true,
                        stdio: "ignore"
                    }, function(err, process) {
                        if (err)
                            return emit("error", err);
                        connectToPort();
                    });
                }
                else {
                    proc.spawn(nodeBin, {
                        args: ["-e", proxySource]
                    }, function(err, process) {
                        if (err)
                            return emit("error", err);
                        
                        process.stderr.on("data", function(data) {
                            console.log("[netproxy]", data);
                        });
                        
                        process.stdout.on("data", function(data) {
                            if (data.match(/ß/))
                                connectToPort();
                            else
                                console.log("[netproxy] unexpected data", data);
                        });

                        process.on("exit", function(code) {
                            connected = DISCONNECTED;
                            state = "disconnected";
                            // debugger will call connect again if process is still running 
                            emit("error", { code: code });
                        });
                        
                        // Make sure the process keeps running
                        process.unref();
                    });
                }
            }

            function connectToSocket(retries) {
                if (state !== "connecting")
                    return;

                connectToPort(function (err) {
                    if (!err)
                        return;

                    if (retries <= 0 || (err.code !== "ENOENT" && err.code !== "ECONNREFUSED"))
                        return emit("error", err);

                    timer = setTimeout(function() {
                        connectToSocket(--retries);
                    }, proxy.retryInterval);
                });
            }

            function connectToPort(callback) {
                net.connect(proxy.socketpath || proxy.port, {}, function(err, s) {
                    if (err)
                        return callback ? callback(err) : emit("error", err);
                    
                    stream = s;
                    stream.on("data", function(data) {
                        emit("data", data);
                    });
                    // Don't call end because session will remain in between disconnects
                    stream.on("end", function(err) {
                        console.log("end", err);
                        emit("end", err);
                    });
                    stream.on("error", function(err) {
                        emit("error", err);
                    });
                    
                    if (reconnect)
                        emit("data", "Content-Length:0\r\n\r\n");
                    
                    connected = CONNECTED;
                    
                    state = "connected";
                    emit("connect");
                    
                    if (away) {
                        if (emit("beforeBack") !== false)
                            enable();
                    }
                    
                    callback && callback();
                });
            }
        
            function close(err) {
                stream && stream.end();
                timer && clearTimeout(timer);
                if (state) {
                    state = null;
                    connected = DISCONNECTED;
                    emit("end", err);
                }
            }
        
            function send(msg) {
                stream && stream.write(msg, "utf8");
            }
            
            function enable() {
                away = false;
                state = "connected";
                emit("back");
            }
        
            socket.freezePublicAPI({
                /**
                 * 
                 */
                DISCONNECTED: DISCONNECTED,
                /**
                 * 
                 */
                CONNECTED: CONNECTED,
                /**
                 * 
                 */
                CONNECTING: CONNECTING,
                
                /**
                 * 
                 */
                get connected() { return connected; },
                
                // Backward compatibility
                addEventListener: socket.on,
                removeListener: socket.off,
                setMinReceiveSize: function() {},
                
                /**
                 * 
                 */
                connect: connect,
                
                /**
                 * 
                 */
                enable: enable,
                
                /**
                 * 
                 */
                close: close,
                
                /**
                 * 
                 */
                send: send
            });
            
            socket.load("socket" + counter++);
            
            return socket;
        }
        
        register("", {
            "debugger.socket": Socket
        });
    }
});