define(function(require, exports, module) {

"use strict";

var oop = require("ace/lib/oop");
var EventEmitter = require("ace/lib/event_emitter").EventEmitter;

var DevtoolsProtocol = module.exports = function(socket) {
    this.callbacks = {};
    this.$scripts = {};
    this.socket = socket;
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
            switch (message.method) {
                case "Debugger.scriptParsed":
                    this.$scripts[params.scriptId] = params;
                    this._signal("afterCompile", params);
                    break;
                case "Runtime.executionContextCreated":
                    // TODO add support for threads
                    break;
                case "Runtime.executionContextDestroyed":
                    this.detachDebugger();
                    break;
                case "Debugger.resumed":
                    this.$callstack = null;
                    this._signal("changeRunning", params);
                    break;
                case "Debugger.paused":
                    this.$callstack = params;
                    this._signal("changeRunning", params);
                    if (params.reason == "exception")
                        this._signal("exception", params);
                    else
                        this._signal("break", params);
                    break;
                case "Runtime.consoleAPICalled":
                    break;
            }
        }
    };
    
    this.detachDebugger = function() {
        if (this.ws)
            this.ws.send({ $: "detach" });
    }

    this.attach = function(port, cb) {
        this.ws = this.socket;
        this.ws.on("message", this.handleMessage.bind(this));
        this.$send("Profiler.enable");
        this.$send("Runtime.enable");
        this.$send("Debugger.enable");
        // TODO add support for these to debugger ui
        // this.$send("Debugger.setPauseOnExceptions", {"state":"uncaught"});
        // this.$send("Debugger.setBlackboxPatterns", {"patterns":[]});
        this.$send("Debugger.setAsyncCallStackDepth", { maxDepth: 32 });
        this.$send("Runtime.runIfWaitingForDebugger");
        cb();
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
                return this.$send("Debugger.setVariableValue", {
                    scopeNumber: variable.parent.index,
                    variableName: variable.name,
                    newValue: data.result,
                    callFrameId: frame.id,
                }, function(data, err) {
                    callback(err);
                });
            }
            
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
            // TODO add support for urlRegex:
            columnNumber: column || 0,
            condition: condition
        }, callback);
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
        this.$send("Debugger.setScriptSource", {
            scriptId: scriptId,
            scriptSource: newSource,
            dryRun: !!previewOnly
        }, function(result, error) {
            if (error && error.code == -32000 && !$retry) {
                // errors with code == -32000 usually go away after second try
                return this.changelive(scriptId, newSource, previewOnly, callback, true);
            }
            if (result && result.stackChanged) {
                return this.stepInto(function() {
                    callback({}, null);
                });
            }
            callback(result, error);
        }.bind(this));
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