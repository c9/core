/**
 * V8Debugger
 * 
 * Copyright (c) 2010 Ajax.org B.V.
 * 
 * The MIT License (MIT)
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */
if (typeof process !== "undefined")
    require("amd-loader");

define(function(require, exports, module) {
"use strict";

var assert = require("assert");
var MsgStreamMock = require("./MsgStreamMock");
var V8DebuggerService = require("./V8DebuggerService");
var V8Debugger = require("./V8Debugger");
var V8Message = require("./V8Message");

function assertJsonEquals(expected, actual) {
    return assert.equal(JSON.stringify(expected), JSON.stringify(actual));
}

module.exports = {

    name: "V8Debugger",

    setUp: function(next) {
        this.$msgStream = new MsgStreamMock();
        this.$service = new V8DebuggerService(this.$msgStream);
        this.$debugger = new V8Debugger(2, this.$service);
        next();
    },

    sendMessage: function(content) {
        var headers = {
            Tool: "V8Debugger",
            Destination: 2
        };
        this.$msgStream.$send(headers, content);
    },

    "test: continue": function() {
        var called = false;

        V8Message.$seq = 245;

        this.$debugger.continueScript(null, null, function() {
            called = true;
        });

        var request = {
            "command": "debugger_command",
            "data": {
                "seq": 245,
                "type": "request",
                "command": "continue"
            }
        };
        assertJsonEquals(request, JSON.parse(this.$msgStream.requests[0].getContent()));

        var response = {
            "command": "debugger_command",
            "result": 0,
            "data": {
                "seq": 77,
                "request_seq": 245,
                "type": "response",
                "command": "continue",
                "success": true,
                "running": true
            }
        };
        this.sendMessage(JSON.stringify(response));
        assert.ok(called);
    },

    "test: step into": function() {
        var called = false;
        V8Message.$seq = 254;
        this.$debugger.continueScript("in", 1, function() {
            called = true;
        });

        var request = {
            "command": "debugger_command",
            "data": {
                "seq": 254,
                "type": "request",
                "command": "continue",
                "arguments": {
                    "stepcount": 1,
                    "stepaction": "in"
                }
            }
        };

        assertJsonEquals(request, JSON.parse(this.$msgStream.requests[0].getContent()));

        var response = {
            "command": "debugger_command",
            "result": 0,
            "data": {
                "seq": 10,
                "request_seq": 254,
                "type": "response",
                "command": "continue",
                "success": true,
                "running": true
            }
        };
        this.sendMessage(JSON.stringify(response));
        assert.ok(called);
    },

    "test: lookup": function() {
        var called = false;
        V8Message.$seq = 280;
        this.$debugger.lookup([83, 121, 123], false, function() {
            called = true;
        });

        var request = {
            "command": "debugger_command",
            "data": {
                "seq": 280,
                "type": "request",
                "command": "lookup",
                "arguments": {
                    "inlineRefs": false,
                    "handles": [83, 121, 123]
                }
            }
        };

        assertJsonEquals(request, JSON.parse(this.$msgStream.requests[0].getContent()));

        var response = {
            "command": "debugger_command",
            "result": 0,
            "data": {
                "seq": 60,
                "request_seq": 280,
                "type": "response",
                "command": "lookup",
                "success": true,
                "body": {
                    "83": {
                        "handle": 83,
                        "type": "number",
                        "value": 4,
                        "text": "4"
                    },
                    "121": {
                        "handle": 121,
                        "type": "number",
                        "value": 3,
                        "text": "3"
                    },
                    "123": {
                        "handle": 123,
                        "type": "string",
                        "value": "#text",
                        "length": 5,
                        "text": "#text"
                    },
                    "running": false
                }
            }
        };
        this.sendMessage(JSON.stringify(response));
        assert.ok(called);
    },

    "test: backtrace": function() {
        var called = false;
        V8Message.$seq = 4;
        this.$debugger.backtrace(null, null, null, true, function() {
            called = true;
        });

        var request = {
            "command": "debugger_command",
            "data": {
                "seq": 4,
                "type": "request",
                "command": "backtrace",
                "arguments": { "inlineRefs": true }
            }
        };

        assertJsonEquals(request, JSON.parse(this.$msgStream.requests[0].getContent()));

        var response = {
            "command": "debugger_command",
            "result": 0,
            "data": {
                "seq": 54,
                "request_seq": 4,
                "type": "response",
                "command": "backtrace",
                "success": true,
                "body": {
                    "fromFrame": 0,
                    "toFrame": 1,
                    "totalFrames": 1,
                    "frames": [{
                        "type": "frame",
                        "index": 0,
                        "receiver": { "ref": 1, "type": "object", "className": "HTMLTextAreaElement" },
                        "func": { "ref": 0, "type": "function", "name": "logKey", "inferredName": "", "scriptId": 18 },
                        "script": { "ref": 13 },
                        "constructCall": false,
                        "debuggerFrame": false,
                        "arguments": [{
                            "name": "e", "value": { "ref": 10, "type": "object", "className": "KeyboardEvent" }
                        }],
                        "locals": [{
                            "name": "x", "value": { "ref": 3, "type": "undefined" }
                        }],
                        "position": 735,
                        "line": 69,
                        "column": 4,
                        "sourceLineText": "    console.log(e.type, e.charCode, e.keyCode, e);",
                        "scopes": [
                              { "type": 1, "index": 0 },
                              { "type": 0, "index": 1 }
                        ],
                        "text": "#00 #<an HTMLTextAreaElement>.logKey(e=#<a KeyboardEvent>) file:///Users/fabianpb/Desktop/EclipseWorkspaces/ajax.org/editor/experiments/key_event_logger.html line 70 column 5 (position 736)" }
                    ]
                },
                "refs": [{
                    "handle": 13,
                    "type": "script",
                    "name": "file:///Users/fabianpb/Desktop/EclipseWorkspaces/ajax.org/editor/experiments/key_event_logger.html",
                    "id": 18,
                    "lineOffset": 38,
                    "columnOffset": 0,
                    "lineCount": 59,
                    "sourceStart": "\n    \nwindow.console = {};\n//if (!console.log) {\n    var logger = document.getEl",
                    "sourceLength": 1547,
                    "scriptType": 2,
                    "compilationType": 0,
                    "context": { "ref": 12 },
                    "text": "file:///Users/fabianpb/Desktop/EclipseWorkspaces/ajax.org/editor/experiments/key_event_logger.html (lines: 38-96)"
                }],
                "running": false
            }
        };

        this.sendMessage(JSON.stringify(response));
        assert.ok(called);
    },

    "test: scope": function() {
        var called = false;

        V8Message.$seq = 24;

        this.$debugger.scope(0, 0, true, function() {
            called = true;
        });

        var request = {
            "command": "debugger_command",
            "data": {
                "seq": 24,
                "type": "request",
                "command": "scope",
                "arguments": {
                    "number": 0,
                    "inlineRefs": true,
                    "frameNumber": 0
                }
            }
        };
        assertJsonEquals(request, JSON.parse(this.$msgStream.requests[0].getContent()));

        var response = {
            "command": "debugger_command",
            "result": 0,
            "data": {
                "seq": 42,
                "request_seq": 24,
                "type": "response",
                "command": "scope",
                "success": true,
                "body": {
                    "type": 1,
                    "index": 0,
                    "frameIndex": 0,
                    "object": {
                        "handle": -4,
                        "type": "object",
                        "className": "Object",
                        "constructorFunction": {
                            "ref": 21,
                            "type": "function",
                            "name": "Object",
                            "inferredName": ""
                        },
                        "protoObject": {
                            "ref": 22,
                            "type": "object",
                            "className": "Object"
                        },
                        "prototypeObject": {
                            "ref": 3,
                            "type": "undefined"
                        },
                        "properties": [],
                        "text": "#<an Object>"
                    },
                    "text": "#<a ScopeMirror>"
                },
                "refs": [],
                "running": false
            }
        };
        this.sendMessage(JSON.stringify(response));
        assert.ok(called);
    },

    "test: version": function() {
        var called = false;

        V8Message.$seq = 11;

        this.$debugger.version(function(version) {
            called = true;
            assert.equal("2.1.10.5", version.V8Version);
        });

        this.sendMessage('{"command":"debugger_command","result":0,"data":{"seq":17,"request_seq":11,"type":"response","command":"version","success":true,"body":{"V8Version":"2.1.10.5"},"refs":[],"running":true}}');

        assert.ok(called);
    },

    "test: scripts": function() {
        var called = false;

        V8Message.$seq = 14;

        this.$debugger.scripts(V8Debugger.NORMAL_SCRIPTS, null, true, function(scripts) {
            assert.equal(4, scripts.length);
            called = true;
        });

        var response = {
            "command": "debugger_command",
            "result": 0,
            "data": {
                "seq": 88,
                "request_seq": 14,
                "type": "response",
                "command": "scripts",
                "success": true,
                "body": [{
                    "handle": 3,
                    "type": "script",
                    "name": "chrome-extension://ognampngfcbddbfemdapefohjiobgbdl/data_loader.js",
                    "id": 25,
                    "lineOffset": 0,
                    "columnOffset": 0,
                    "lineCount": 68,
                    "source": "function isRecordDump() {});",
                    "sourceLength": 36039,
                    "scriptType": 2,
                    "compilationType": 0,
                    "context": { "ref": 6 },
                    "text": "undefined (lines: 972)"
                }, {
                    "handle": 8,
                    "type": "context",
                    "data": "page,1",
                    "text": "#<a ContextMirror>"
                }, {
                    "handle": 10,
                    "type": "context",
                    "text": "#<a ContextMirror>"
                }, {
                    "handle": 12,
                    "type": "context",
                    "data": "page,1",
                    "text": "#<a ContextMirror>"
                }],
                "running": true
            },
            "Tool": "V8Debugger",
            "Content-Length": 450
        };

        this.sendMessage(JSON.stringify(response));
        assert.ok(called);
    },

    "test: setBreakpoint": function() {
        var called = false;

        V8Message.$seq = 50;

        this.$debugger.setbreakpoint("script", "http://abc.nl/juhu.js", 24, 0, true, null, 0, function(body) {
            assert.equal("scriptName", body.type);
            assert.equal(1, body.breakpoint);
            assert.equal(24, body.line);
            called = true;
        });

        var request = {
            "command": "debugger_command",
            "data": {
                "seq": 50,
                "type": "request",
                "command": "setbreakpoint",
                "arguments": {
                    "type": "script",
                    "target": "http://abc.nl/juhu.js",
                    "line": 24,
                    "enabled": true
                }
            }
        };
        assertJsonEquals(request, JSON.parse(this.$msgStream.requests[0].getContent()));

        var response = {
            "command": "debugger_command",
            "result": 0,
            "data": {
                "seq": 70,
                "request_seq": 50,
                "type": "response",
                "command": "setbreakpoint",
                "success": true,
                "body": {
                    "type": "scriptName",
                    "breakpoint": 1,
                    "script_name": "http://abc.nl/juhu.js",
                    "line": 24,
                    "column": null
                },
                "refs": [],
                "running": true
            }
        };
        this.sendMessage(JSON.stringify(response));
        assert.ok(called);
    },

    "test: change breakpoint": function() {
        var called = false;

        V8Message.$seq = 225;

        this.$debugger.changebreakpoint(2, false, null, 0, function(body) {
            called = true;
        });

        var request = {
            "command": "debugger_command",
            "data": {
                "seq": 225,
                "type": "request",
                "command": "changebreakpoint",
                "arguments": {
                    "enabled": false,
                    "breakpoint": 2
                }
            }
        };
        assertJsonEquals(request, JSON.parse(this.$msgStream.requests[0].getContent()));

        var response = {
            "command": "debugger_command",
            "result": 0,
            "data": {
                "seq": 58,
                "request_seq": 225,
                "type": "response",
                "command": "changebreakpoint",
                "success": true,
                "running": true
            }
        };
        this.sendMessage(JSON.stringify(response));
        assert.ok(called);
    },

    "test: clear breakpoint": function() {
        var called = false;

        V8Message.$seq = 228;

        this.$debugger.clearbreakpoint(1, function(body) {
            called = true;
        });

        var request = {
            "command": "debugger_command",
            "data": {
                "seq": 228,
                "type": "request",
                "command": "clearbreakpoint",
                "arguments": {
                    "breakpoint": 1
                }
            }
        };
        assertJsonEquals(request, JSON.parse(this.$msgStream.requests[0].getContent()));

        var response = {
            "command": "debugger_command",
            "result": 0,
            "data": {
                "seq": 64,
                "request_seq": 228,
                "type": "response",
                "command": "clearbreakpoint",
                "success": true,
                "body": {
                    "breakpoint": 1
                },
                "refs": [],
                "running": true
            }
        };
        this.sendMessage(JSON.stringify(response));
        assert.ok(called);
    },

    "test: break event": function() {
        var called = false;

        this.$debugger.addEventListener("break", function(e) {
            called = true;
            assert.equal(1, e.data.breakpoints[0]);
        });

        var response = {
            "command": "debugger_command",
            "result": 0,
            "data": {
                "seq": 20,
                "type": "event",
                "event": "break",
                "body": {
                    "invocationText": "#<an HTMLTextAreaElement>.logKey(e=#<a KeyboardEvent>)",
                    "sourceLine": 69,
                    "sourceColumn": 4,
                    "sourceLineText": "    console.log(e.type, e.charCode, e.keyCode, e);",
                    "script": {
                        "id": 35,
                        "name": "file:///Users/fabianpb/Desktop/EclipseWorkspaces/ajax.org/editor/experiments/key_event_logger.html",
                        "lineOffset": 38,
                        "columnOffset": 0,
                        "lineCount": 58
                    },
                    "breakpoints": [1]
                }
            }
        };
        this.sendMessage(JSON.stringify(response));
        assert.ok(called);
    },

    "test: test exception event": function() {
        var called = false;

        this.$debugger.addEventListener("exception", function(e) {
            called = true;
        });

        var response = {
            "command": "debugger_command",
            "result": 0,
            "data": {
                "seq": 63,
                "type": "event",
                "event": "exception",
                "success": true,
                "body": {
                    "uncaught": true,
                    "exception": {
                        "handle": 0,
                        "type": "error",
                        "className": "Error",
                        "constructorFunction": { "ref": 4 },
                        "protoObject": { "ref": 5 },
                        "prototypeObject": { "ref": 6 },
                        "properties": [
                            { "name": "stack", "propertyType": 3, "ref": 6 },
                            { "name": "message", "ref": 7 }
                        ],
                        "text": "Error: Buhhh"
                    },
                    "sourceLine": 69,
                    "sourceColumn": 10,
                    "sourceLineText": "    throw new Error(\"Buhhh\");",
                    "script": {
                        "id": 50,
                        "name": "http://juhu.nl/key_event_logger.html",
                        "lineOffset": 38,
                        "columnOffset": 0,
                        "lineCount": 59
                    }
                },
                "refs": [{
                    "handle": 4,
                    "type": "function",
                    "className": "Function",
                    "constructorFunction": { "ref": 8 },
                    "protoObject": { "ref": 9 },
                    "prototypeObject": { "ref": 5 },
                    "name": "Error",
                    "inferredName": "",
                    "resolved": true,
                    "source": "function Error() { [native code] }",
                    "properties": [{
                        "name": "stackTraceLimit",
                        "propertyType": 1,
                        "ref": 10
                    }, {
                        "name": "arguments",
                        "attributes": 7,
                        "propertyType": 3,
                        "ref": 11
                    }, {
                        "name": "length",
                        "attributes": 7,
                        "propertyType": 3,
                        "ref": 12
                    }, {
                        "name": "captureStackTrace",
                        "propertyType": 2,
                        "ref": 13
                    }, {
                        "name": "name",
                        "attributes": 7,
                        "propertyType": 3,
                        "ref": 14
                    }, {
                        "name": "prototype",
                        "attributes": 7,
                        "propertyType": 3,
                        "ref": 5
                    }, {
                        "name": "caller",
                        "attributes": 7,
                        "propertyType": 3,
                        "ref": 11
                    }],
                    "text": "function Error() { [native code] }"
                }, {
                    "handle": 5,
                    "type": "error",
                    "className": "Error",
                    "constructorFunction": { "ref": 4 },
                    "protoObject": { "ref": 15 },
                    "prototypeObject": { "ref": 6 },
                    "properties": [{
                        "name": "message",
                        "propertyType": 1,
                        "ref": 16
                    }, {
                        "name": "toString",
                        "attributes": 2,
                        "propertyType": 1,
                        "ref": 17
                    }, {
                        "name": "name",
                        "propertyType": 1,
                        "ref": 14
                    }, {
                        "name": "constructor",
                        "attributes": 2,
                        "propertyType": 1,
                        "ref": 4
                    }],
                    "text": "Error"
                }, {
                    "handle": 6,
                    "type": "undefined",
                    "text": "undefined"
                }, {
                    "handle": 7,
                    "type": "string",
                    "value": "Buhhh",
                    "length": 5,
                    "text": "Buhhh"
                }]
            }
        };
        this.sendMessage(JSON.stringify(response));
        assert.ok(called);
    },

    "test: suspend": function() {
        var called = false;

        V8Message.$seq = 7;

        this.$debugger.suspend(function() {
            called = true;
        });

        var request = {
            "command": "debugger_command",
            "data": { "seq": 7, "type": "request", "command": "suspend" }
        };
        assertJsonEquals(request, JSON.parse(this.$msgStream.requests[0].getContent()));

        var response = {
            "command": "debugger_command",
            "result": 0,
            "data": {
                "seq": 18,
                "request_seq": 7,
                "type": "response",
                "command": "suspend",
                "success": true,
                "running": false
            }
        };
        this.sendMessage(JSON.stringify(response));
        assert.ok(called);
    }
};

if (typeof module !== "undefined" && !module.parent)
    require("asyncjs").test.testcase(module.exports).exec();

});