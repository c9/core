define(function(require, exports, module) {

"use strict";

var stream
/*global app*/
function getSocket(options, callback) {
    var c9 = app.c9
    var exe = c9.sourceDir + "/plugins/c9.ide.run.debug/debuggers/chrome/chrome-debug-proxy.js";
    
    var socketPath = c9.home + "/chrome.sock";
    if (c9.platform == "win32")
        socketPath = "\\\\.\\pipe\\" + socketPath.replace(/\//g, "\\");
    
    app.vfs.spawn("node", {
        args: [exe],
        // detached: true,
        // stdio: "ignore"
        stdoutEncoding: "utf8",
        stderrEncoding: "utf8",
        stdinEncoding: "utf8",
    }, function(err, meta) {
        console.log(err, meta)
    
        meta.process.stdout.on("data", function(e) {console.log(e)})
        meta.process.stderr.on("data", function(e) {console.log(e)})
        meta.process.on("exit", function(e) {console.log(e)})
    
        tryConnect(10, connectPort)
    })
    
    function tryConnect(retries, cb) {
        cb(function next(err) {
            if (err) {
                return setTimeout(function() {
                    tryConnect(retries-1, cb)
                }, 100)
            }
            cb()
        });
    }
    
    function connectPort(cb) {
        app.net.connect(socketPath, {}, function(err, s) {
            if (err) return cb(err)
            stream = s;
            var buff = [];
            stream.on("data", function(data) {
                var idx;
                while (true) {
                    idx = data.indexOf("\0");
                    if (idx === -1)
                        return data && buff.push(data);
                    buff.push(data.substring(0, idx));
                    var clientMsg = buff.join("");
                    data = data.substring(idx + 1);
                    buff = [];
                    var m;
                    try {
                        m = JSON.parse(clientMsg);
                    } catch (e) {
                        continue;
                    }
                    socket.emit("message", m);
                }
            });
            // Don't call end because session will remain in between disconnects
            stream.on("end", function(err) {
                console.log("end", err);
                socket.emit("end", err);
            });
            stream.on("error", function(err) {
                socket.emit("error", err);
            });
            socket.send({ $: "connect", port: options.port, host: options.host });
            socket.on("message", function me(m) {
                if (m && m.$ == "connected") {
                    socket.off("message", me);
                    callback(null, socket);
                }
            });
        });
    }
    
    var socket = Object.create(EventEmitter);
    socket.emit = socket._signal;
    socket.send = function(s) {
        stream.write(JSON.stringify(s) + "\0");
    };
    socket.close = function() {
        stream.end();
    };
}



var oop = require("ace/lib/oop");
var EventEmitter = require("ace/lib/event_emitter").EventEmitter;

var DevtoolsProtocol = module.exports = function() {
    this.callbacks = {};
    this.$scripts = {};
};

(function() {
    
    oop.implement(this, EventEmitter);
    
    this.events = [
        "changeRunning",
        "break",
        "exception",
        "afterCompile"
    ];

    this.$seq = 0;
    
    this.$send = function(method, params, callback) {
        this.$seq++;
        if (callback)
            this.callbacks[this.$seq] = callback;
        this.ws.send({
            id: this.$seq,
            method: method, 
            params: params || undefined,
        });
    };
    
    this.handleMessage = function(message) {
        if (message.id) {
            if (this.callbacks[message.id])
                return this.callbacks[message.id](message.result, message.error);
        } else {
            var params = message.params;
            if (message.method == "Debugger.scriptParsed") {
                this.$scripts[params.scriptId] = params;
                this._signal("afterCompile", params);
            }
            else if (message.method == "Runtime.executionContextCreated") {
                console.log(message.params);
            }
            else if (message.method == "Runtime.executionContextDestroyed") {
                console.log(message.params);
                this.detachDebugger();
            }
            else if (message.method == "Debugger.resumed") {
                this.$callstack = null;
                this._signal("changeRunning", params);
                console.warn(message);
            }
            else if (message.method == "Debugger.paused") {
                this.$callstack = params;
                this._signal("changeRunning", params);
                console.warn(message);
                if (params.reason == "exception") {
                    this._signal("exception", params);
                } else {
                    this._signal("break", params);
                }
            }
            else {
                console.warn(message);
            }
        }
    };
    
    this.detachDebugger = function() {
        if (this.ws)
            this.ws.send({ $: "detach" });
    }

    this.attach = function(port, cb) {
        var that = this;
        getSocket({
            host: "127.0.0.1",
            port: port
        }, function(err, ws) {
            that.ws = ws;
            that.ws.on("message", that.handleMessage.bind(that));
            that.$send("Profiler.enable");
            that.$send("Runtime.enable");
            that.$send("Debugger.enable");
            // that.$send("Debugger.setPauseOnExceptions", {"state":"uncaught"});
            // that.$send("Debugger.setBlackboxPatterns", {"patterns":[]});
            that.$send("Debugger.setAsyncCallStackDepth", { maxDepth: 32 });
            that.$send("Runtime.runIfWaitingForDebugger");
            cb();
        });
    };
    
    
    this.detach = function() {
        if (this.ws)
            this.ws.close();
    };

    this.isRunning = function() {
        return !this.$callstack;
    };

    this.stepInto = function(callback) {
        this.$send("Debugger.stepInto", null, callback);
    };
    this.stepOver = function(callback) {
        this.$send("Debugger.stepOver", null, callback);
    };
    this.stepOut = function(callback) {
        this.$send("Debugger.stepOut", null, callback);
    };
    this.resume = function(callback) {
        this.$send("Debugger.resume", null, callback);
    };
    this.suspend = function(callback) {
        this.$send("Debugger.pause", null, callback);
    };

    this.backtrace = function(callback) {
        callback(this.$callstack || []);
    };

    this.getProperties = function(params, callback) {
        this.$send("Runtime.getProperties", params, callback);
    };

    this.scripts = function(callback) {
        callback(this.$scripts);
    };
    
    this.getScriptSource = function(id, callback) {
        this.$send("Debugger.getScriptSource", { scriptId: id }, callback);
    };

    this.evaluate = function(expression, frame, global, disableBreak, callback) {
        if (frame) {
            this.$send("Debugger.evaluateOnCallFrame", {
                expression: expression,
                callFrameId: frame.id,
                objectGroup: "popover",
                includeCommandLineAPI: false,
                silent: true,
                returnByValue: false,
                generatePreview: false,
            }, callback);
        } else {
            this.$send("Runtime.evaluate", {
                expression: expression,
                objectGroup: "console",
                includeCommandLineAPI: true,
                silent: false,
                contextId: 1,
                returnByValue: false,
                generatePreview: true,
                userGesture: true,
                awaitPromise: false,
            }, callback);
        }
    };
    
    this.setexceptionbreak = function(state, callback) {
        this.$send("Debugger.setPauseOnExceptions", {
            state: state
        }, callback);
    };
    
    this.setvariablevalue = function(variable, value, frame, callback) {
        if (!variable.parent)
            return;
        this.evaluate("(" + value + ")", frame, null, true, function(data, err) {
            if (err)
                return callback(err);
            if (variable.parent.index != null) {
                this.$send("Debugger.setVariableValue", {
                    scopeNumber: variable.parent.index,
                    variableName: variable.name,
                    newValue: data.result,
                    callFrameId: frame.id,
                }, function(data, err) {
                    callback(err);
                });
            }
            else {
                this.$send("Runtime.callFunctionOn", {
                    "objectId": variable.parent.ref || variable.parent.id,
                    "functionDeclaration": "function(a, b) { this[a] = b; }",
                    "arguments": [
                        { "value": variable.name },
                        data.result
                    ],
                    "silent": true
                }, function(data, err) {
                    callback(err);
                });
            }
        }.bind(this));
    };

    this.setbreakpoint = function(target, line, column, enabled, condition, callback) {
        // lineNumber| columnNumber
        // url | urlRegex | scriptHash
        // condition
        var breakpointId = target + ":" + line + ":" + column;
        this.$send("Debugger.removeBreakpoint", {
            breakpointId: breakpointId
        }, function() {
            if (!enabled) callback(null, {});
        });
        
        if (!enabled) return;

        this.$send("Debugger.setBreakpointByUrl", {
            lineNumber: line,
            url: target,
            // urlRegex: 
            columnNumber: column || 0,
            condition: condition
        }, function(info) {
            callback(info);
        });
    };
    
    this.clearbreakpoint = function(breakpointId, callback) {
        this.$send("Debugger.removeBreakpoint", {
            breakpointId: breakpointId
        }, callback);
    };

    this.listbreakpoints = function(callback) {
        callback({
            breakpoints: []
        });
    };


    this.changelive = function(scriptId, newSource, previewOnly, callback, $retry) {
        var that = this;
        that.$send("Debugger.setScriptSource", {
            scriptId: scriptId,
            scriptSource: newSource,
            dryRun: !!previewOnly
        }, function(result, error) {
            if (error && error.code == -32000 && !$retry) {
                return that.changelive(scriptId, newSource, previewOnly, callback, true);
            }
            if (result && result.stackChanged) {
                return that.stepInto(function() {
                    callback({}, null);
                });
            }
            callback(result, error);
        });
    };
    
    this.restartframe = function(frameId, callback) {
        this.$send("Debugger.restartFrame", {
            callFrameId: frameId
        }, callback);
    };
    
    // TODO add support for this in debugger
    // this.disableBreak = function() {
    //     "Debugger.setBreakpointsActive"
    //     "Debugger.setSkipAllPauses"
    // };


}).call(DevtoolsProtocol.prototype);


});