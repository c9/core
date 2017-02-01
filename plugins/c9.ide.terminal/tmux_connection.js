/**
 * Terminal for the Cloud9
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {

module.exports = function(c9, proc, installPath, shell) {
    function reconnectTimed(session, force) {
        if (session.killed) { // Session has been killed
            console.warn("Reconnecting while session has been killed");
            return;
        }
        
        setTimeout(function() {
            reconnect(session, force);
        }, session.reconnecting === 0 ? 0 : 
            (session.reconnecting < 10 ? 100 : 1000));
    }
    
    function reconnect(session, force) {
        // Make sure we have process control
        if (!c9.has(c9.PROCESS)) {
            console.warn("Reconnecting while not online");
            // We'll let the stateChange handler retry
            return;
        }
        
        if ((session.connecting || session.connected) && !force) {
            console.error("Reconnecting while already connected/connecting. Abort.");
            return false;
        }
        
        // A little counter for debugging purpose
        if (!session.reconnecting)
            session.reconnecting = 0;
        session.reconnecting++;
        
        // Make sure the pty is no longer active
        session.disregard && session.disregard(true);
        
        // Lets get our TMUX process
        getTMUX(session, function(err) {
            if (err) {
                console.error("Error creating TMUX session: ", err.message);
                
                if (err.code != "EACCESS")
                    reconnectTimed(session, true);
                else
                    console.warn("Terminal EACCESS error");
            }
        });
    }
    
    function getOutputHistory(options, cb) {
        options.id = options.id || this.id;
        options.retries = (options.retries || 0) + 1;
        var start = typeof options.start == "number" ? options.start : -32768;
        var end = typeof options.end == "number" ? options.end : 1000;
        var paneId = (options.id || this.id) + ":0.0"; // for now let's assume there is only one pane
        
        if (c9.platform == "win32") return;
        
        proc.tmux("", { 
            capturePane: {
                start: start,
                end: end,
                pane: paneId.trim(),
                joinLines: options.joinLines
            }
        }, function(err, _1, _2, meta) {
            if (err || !meta.process) return cb(err);
            var buffer = "", errBuffer = "";
            meta.process.stdout.on("data", function(data) {
                buffer += data.toString();
            });
            meta.process.stderr.on("data", function(data) {
                errBuffer += data.toString();
            });
            meta.process.on("close", function() {
                if (!buffer && !errBuffer && options.retries < 4) {
                    // tmux doesn't produce any output if two instances are invoked at the same time
                    return setTimeout(function() {
                        getOutputHistory(options, cb);
                    }, options.retries * 100 + 300);
                }
                if (buffer) {
                    var i = buffer.search(/\x1b\[1mPane is dead\x1b\[0m\s*$/);
                    if (i != -1)
                        buffer = buffer.slice(0, i).replace(/\s*$/, "\n");
                }
                cb(errBuffer, buffer);
            });
        });
    }
    
    function getStatus(options, cb) {
        if (options.id == null)
            options.id = this.id;
        proc.tmux("", {
            getStatus: options
        }, function(err, _1, _2, meta) {
            cb(err, meta.status);
        });
    }
    
    function sendTmuxCommand(command, exec, terminal) {
        if (c9.platform == "win32") return;
        if (!terminal || !terminal.send)
            terminal = this.terminal;
        terminal.send("\u0002:" + command + (!exec ? "\r\u001b" : exec == 1 ? "\r" : ""));
    }
    
    function clearHistory() {
        sendTmuxCommand("send-keys -R ; clear-history", 1, this.terminal);
    }
    
    function changeMode() { return false; }
    
    function getTMUX(session, callback) {
        var disregarded;
        
        session.getOutputHistory = getOutputHistory;
        session.getStatus = getStatus;
        session.sendTmuxCommand = sendTmuxCommand;
        session.clearHistory = clearHistory;
        
        var cwd = session.cwd || "";
        if (!/^~(\/|$)/.test(cwd))
            cwd = session.root + cwd;
        var command = "";
        var options = {
            cwd: cwd,
            cols: session.cols || 80,
            rows: session.rows || 24,
            name: "xterm-color",
            base: installPath && installPath.replace(/^~/, c9.home || "~")
        };
        
        // Output Mode
        if (session.output) {
            options.idle = true;
            options.session = session.id;
            options.attach = true;
            options.output = true;
            options.detachOthers = !session.hasConnected;
        }
        // Terminal Mode
        else {
            command = shell || "";
            
            if (!session.id) {
                session.id = c9.workspaceId.split("/", 2).join("@") 
                    + "_" + Math.round(Math.random() * 1000);
                options.attach = false;
            }
            else {
                options.attach = true;
            }
            
            options.session = session.id;
            options.output = false;
            options.terminal = true;
            options.detachOthers = !session.hasConnected;
            options.defaultEditor = session.defaultEditor;
        }
        
        // Connect to backend and start tmux session
        session.connecting = true;
        session.connected = false;
        session.setState("connecting");
        
        session.reconnect = reconnect.bind(null, session);
        
        proc.tmux(command, options, function(err, pty) {
            if (session.pty && session.pty != pty) {
                console.warn("trying to set pty twice", session.pty);
                session.pty._events = {};
            }
            
            // Document was unloaded before connection was made
            if (!session.connecting) {
                if (!err && !session.connected) {
                    session.pty = pty;
                    session.kill();
                    console.error("Got into weird terminal state.");
                }
                return callback(new Error("Session was not connecting"));
            }
            
            // Handle a possible error
            if (err) {
                console.warn("Error connecting to the terminal: ", err);
                
                session.connecting = false;
                session.setState("error");
                
                return callback(err);
            }
            
            session.pty = pty;
            session.reconnecting = 0;
            
            session.disregard = function(keepId) {
                if (!keepId && !session.output)
                    delete session.id;
                
                console.warn("Disregard terminal: ", session.id);
                    
                disregarded = true;
                pty.kill();
                delete session.pty;
            };
            
            session.pty.on("exit", function() {
                if (!disregarded) {
                    session.connected = false;
                    session.connecting = false;
                    
                    session.terminal.off("changeMode", changeMode);
                    if (session.monitor.wasQuitSent()) {
                        session.tab.meta.$ignore = true;
                        session.tab.close();
                    }
                    else if (session.tab.isActive() && session.tab.pane.visible
                        && document.hasFocus()
                    ) {
                        reconnect(session);
                    }
                }
            });
            
            session.pty.on("data", function(data) {
                if (!disregarded) {
                    if (typeof data == "object") {
                        if (data.started)
                            return;
                        else if (data.code) {
                            if (data.type == "exception") { // Error
                                session.disregard();
                                console.error("Error creating TMUX session: ", err.message);
                                session.setState("error");
                            }
                            else
                                session.warn(data);
                            return;
                        }
                        else
                            return session.setSize(data);
                    }
                    
                    if (session.filter)
                        data = session.filter(data);
                    if (data)
                        session.write(data);
                }
            });
            
            // first message from tmux clears screen discarding 
            session.terminal.once("changeMode", changeMode);
            
            // Success
            session.connecting = false;
            session.connected = true;
            session.hasConnected = true;
            session.setState("connected");
            
            // Resize the terminal to the size of the container
            session.updatePtySize();
            
            callback();
            session.getEmitter()("connected");
        });
    }
    
    return {
        init: function(session, cb) {
            getTMUX(session, function(err) {
                if (err) {
                    // util.alert(
                    //     "Error opening Terminal",
                    //     "Error opening Terminal",
                    //     "Could not open terminal with the following reason:"
                    //         + err);
                    console.error("Error opening Terminal: " + err.message);
                    
                    session.setState("error");
                    
                    if (err.code != "EACCESS")
                        reconnectTimed(session, true);
                    else
                        console.warn("Terminal EACCESS error");
                }
                
                // Lets wait until we get process control back
                c9.on("stateChange", function(e) {
                    if (e.state & c9.PROCESS && !session.connected) {
                        console.warn("Terminal reconnect due to connection regain");
                        reconnect(session);
                    }
                }, session);
                
                cb && cb(err, session);
            });
        },
        kill: function(session) {
            console.warn("KILLING SESSION:", session.id);
            
            if (session.id) {
                proc.tmux("", {
                    session: session.id,
                    kill: true
                }, function(err) {
                    // Ignore errors for now
                    if (err)
                        return console.error(err);
                });
            }
            
            console.warn("Killed tmux session: ", session.id);
            
            // If we're still connecting disregard will not be set yet
            // The callback of the connection process will check 
            // the connecting property and terminate the connection
            // then.
            if (session && session.disregard)
                session.disregard();
            
            delete session.id;
            //doc.terminal.onResize(); ??
            
            session.killed = true;
            session.connecting = false;
            session.connected = false;
            session.setState("killed");
        }
    };
};
    
});