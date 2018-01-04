/*
Copyright (c) 2012 Ajax.org B.V

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
( // Module boilerplate to support browser globals, node.js and AMD.
  (typeof module !== "undefined" && function (m) { module.exports = m(require('events'), require('msgpack-js')); }) ||
  (typeof define === "function" && function (m) { define("smith", ["events", "msgpack-js"], m); }) ||
  (function (m) { window.smith = m(window.events, window.msgpack); })
)(function (events, msgpack) {
"use strict";
var EventEmitter = events.EventEmitter;

function inherits(Child, Parent) {
  Child.prototype = Object.create(Parent.prototype, { constructor: { value: Child }});
}

var exports = {};

exports.msgpack = msgpack;
exports.Agent = Agent;
exports.Transport = Transport;
exports.deFramer = deFramer;
exports.liven = liven;
exports.freeze = freeze;
exports.getType = getType;

////////////////////////////////////////////////////////////////////////////////

// Transport is a connection between two Agents.  It lives on top of a duplex,
// binary stream.
// @input - the stream we listen for data on
// @output - the stream we write to (can be the same object as input)
// @send(message) - send a message to the other side
// "message" - event emitted when we get a message from the other side.
// "disconnect" - the transport was disconnected
// "error" - event emitted for stream error or disconnect
// "drain" - drain event from output stream
function Transport(input) {
    var self = this;
    var output;
    if (Array.isArray(input)) {
        output = input[1];
        input = input[0];
    } else {
        output = input;
    }
    this.input = input;
    this.output = output;

    if (!input.readable) throw new Error("Input is not readable");
    if (!output.writable) throw new Error("Output is not writable");

    // Attach event listeners
    input.on("data", onData);
    input.on("end", onDisconnect);
    input.on("timeout", onDisconnect);
    input.on("close", onDisconnect);
    input.on("error", onError);
    output.on("drain", onDrain);
    if (output !== input) {
        output.on("end", onDisconnect);
        output.on("timeout", onDisconnect);
        output.on("close", onDisconnect);
        output.on("error", onError);
    }

    var parse = deFramer(function(err, frame) {
        if (err)
            return self.emit("error", err);
        
        var message;
        try {
            message = msgpack.decode(frame);
        } catch (err) {
            return self.emit("error", err);
        }

        exports.debug && console.log(process.pid + " <- " + require('util').inspect(message, false, 2, true));
        self.emit("message", message);
    });

    // Route data chunks to the parser, but check for errors
    function onData(chunk) {
        parse(chunk);
    }

    // Forward drain events from the writable stream
    function onDrain() {
        self.emit("drain");
    }
    // Forward all error events to the transport
    function onError(err) {
        self.emit("error", err);
    }
    function onDisconnect() {
        // Remove all the listeners we added and destroy the streams
        input.removeListener("data", onData);
        input.removeListener("end", onDisconnect);
        input.removeListener("timeout", onDisconnect);
        input.removeListener("close", onDisconnect);
        output.removeListener("drain", onDrain);
        if (input.destroy) input.destroy();
        if (input !== output) {
            output.removeListener("end", onDisconnect);
            output.removeListener("timeout", onDisconnect);
            output.removeListener("close", onDisconnect);
            if (output.destroy && output !== process.stdout) output.destroy();
        }
        self.emit("disconnect");
    }
    this.disconnect = onDisconnect;
}
inherits(Transport, EventEmitter);

Transport.prototype.send = function (message) {
    // Uncomment to debug protocol
    exports.debug && console.log(process.pid + " -> " + require('util').inspect(message, false, 2, true));

    // Serialize the messsage.
    var frame = msgpack.encode(message);

    // Send a 4 byte length header before the frame.
    var header = new Buffer(10);
    header.writeUInt32BE(frame.length, 0);

    // Compute 4 byte jenkins hash
    var a = frame.length >> 24,
        b = (frame.length >> 16) & 0xff,
        c = (frame.length >> 8) & 0xff,
        d = frame.length & 0xff;

    // Little bit inlined, but fast
    var hash = 0;
    hash += a;
    hash += hash << 10;
    hash += hash >> 6;
    hash += b;
    hash += hash << 10;
    hash += hash >> 6;
    hash += c;
    hash += hash << 10;
    hash += hash >> 6;
    hash += d;
    hash += hash << 10;
    hash += hash >> 6;

    // Shuffle bits
    hash += hash << 3;
    hash = hash ^ (hash >> 11);
    hash += hash << 15;
    hash |= 0;
    header.writeInt32BE(hash, 4, true);

    // 2 Reserved bytes for future usage
    header.writeUInt16BE(0, 8);

    this.output.write(header);


    // Send the serialized message.
    return this.output.write(frame);
};

// A simple state machine that consumes raw bytes and emits frame events.
// Returns a parser function that consumes buffers.  It emits message buffers
// via onMessage callback passed in.
function deFramer(onFrame) {
    var buffer;
    var state = 0;
    var length = 0;
    var expected_hash = 0;
    var hash = 0;
    var offset;
    return function parse(chunk) {
        for (var i = 0, l = chunk.length; i < l; i++) {
            switch (state) {
            case 0:
                length |= chunk[i] << 24;
                expected_hash = 0;
                state = 1;
                break;
            case 1: length |= chunk[i] << 16; state = 2; break;
            case 2: length |= chunk[i] << 8; state = 3; break;
            case 3:
                length |= chunk[i];
                expected_hash += chunk[i];
                expected_hash += expected_hash << 10;
                expected_hash += expected_hash >> 6;

                // Shuffle bits
                expected_hash += expected_hash << 3;
                expected_hash = expected_hash ^ (expected_hash >> 11);
                expected_hash += expected_hash << 15;
                expected_hash |= 0;

                hash = 0;
                state = 4;
                break;
            case 4: hash |= chunk[i] << 24; state = 5; break;
            case 5: hash |= chunk[i] << 16; state = 6; break;
            case 6: hash |= chunk[i] << 8; state = 7; break;
            case 7: hash |= chunk[i]; state = 8;
                if (hash !== expected_hash) {
                    return onFrame(new Error("Hash mismatch, expected: " + expected_hash +
                                  " got: " + hash + ", chunk: " + chunk));
                }

                if (length > 100 * 1024 * 1024) {
                    return onFrame(new Error("Too big buffer " + length +
                                  ", chunk: " + chunk));
                }

                buffer = new Buffer(length);
                offset = 0;
                state = 9;
                break;
            // Two reserved bytes
            case 9: state = 10; break;
            case 10: state = 11; break;

            // Data itself
            case 11:
                var len = l - i;
                var emit = false;
                if (len + offset >= length) {
                    emit = true;
                    len = length - offset;
                }
                // TODO: optimize for case where a copy isn't needed can a slice can
                // be used instead?
                chunk.copy(buffer, offset, i, i + len);
                offset += len;
                i += len - 1;
                if (emit) {
                    onFrame(null, buffer);
                    state = 0;
                    length = 0;
                    buffer = undefined;
                    offset = undefined;
                }
                break;
            }

            // Common case
            if (state <= 3 && !emit) {
              expected_hash += chunk[i];
              expected_hash += expected_hash << 10;
              expected_hash += expected_hash >> 6;
            }

            emit = false;
        }
    };
}

////////////////////////////////////////////////////////////////////////////////

// Agent is an API serving node in the architect-agent rpc mesh.  It contains
// a table of functions that actually do the work and serve them to a Agent
// agent.  An agent can connect to one other agent at a time.
function Agent(api) {
    if (!this instanceof Agent) throw new Error("Forgot to use new with Agent constructor");

    this.api = api || {};

    // Bind event handlers and callbacks
    this.disconnect = this.disconnect.bind(this);
    this._onMessage = this._onMessage.bind(this);
    this._onDrain = this._onDrain.bind(this);
    this._onReady = this._onReady.bind(this);
    this._getFunction = this._getFunction.bind(this);
    this._storeFunction = this._storeFunction.bind(this);

    this.remoteApi = {}; // Persist the API object between connections
    this.transport = undefined;
    this.callbacks = undefined;
    this.nextKey = undefined;
}
inherits(Agent, EventEmitter);

// Time to wait for Agent connections to finish
Agent.prototype.connectionTimeout = 10000;

Agent.prototype.connect = function (transport, callback) {
    // If they passed in a raw stream, wrap it.
    if (!(transport instanceof Transport))
        transport = new Transport(transport);

    this.transport = transport;
    this.callbacks = {};
    this.nextKey = 1;

    transport.on("error", this.disconnect);
    transport.on("disconnect", this.disconnect);
    transport.on("message", this._onMessage);
    transport.on("drain", this._onDrain);

    // Handshake with the other end
    this.send(["ready", this._onReady]);

    // Start timeout and route events to callback
    this.on("connect", onConnect);
    this.on("disconnect", onDisconnect);
    this.on("error", onError);
    var timeout;
    if (this.connectionTimeout) {
        timeout = setTimeout(onTimeout, this.connectionTimeout);
    }

    var self = this;
    function onConnect(api) {
        reset();
        if (callback) callback(null, api);
    }
    function onDisconnect(err) {
        onError(err || new Error("EDISCONNECT: Agent disconnected"));
    }
    function onError(err) {
        reset();
        if (callback) callback(err);
        else self.emit("error", err);
    }
    function onTimeout() {
        reset();
        var err = new Error("ETIMEDOUT: Timeout while waiting for Agent agent to connect.");
        err.code = "ETIMEDOUT";
        self.emit("error", err);
    }
    // Only one event should happen, so stop event listeners on first event.
    function reset() {
        self.removeListener("connect", onConnect);
        self.removeListener("disconnect", onDisconnect);
        self.removeListener("error", onError);
        clearTimeout(timeout);
    }
};

Agent.prototype.send = function (message) {
    message = freeze(message, this._storeFunction);
    if (!this.transport) {
        console.log("smith can't send:")
        // console.dir(this)
        console.dir(message)
        console.trace()
        return
    }
    
    try { var result = this.transport.send(message); }
    catch(e) { console.error("Agent Smith Could not send message: ", e.stack, e.message); }
    
    return result;
};

Agent.prototype._onReady = function (names, env) {
    if (!Array.isArray(names)) return;
    var self = this;
    names.forEach(function (name) {
        // Ignore already set functions so that existing function references
        // stay valid.
        if (self.remoteApi.hasOwnProperty(name)) return;
        self.remoteApi[name] = function () {
            // When disconnected we can't forward the call.
            if (!self.transport) {
                var callback = arguments[arguments.length - 1];
                if (typeof callback === "function") {
                    setTimeout(function(){
                        var err = new Error("ENOTCONNECTED: Agent is offline, try again later");
                        err.code = "ENOTCONNECTED";
                        callback(err);
                    }, 10);
                }
                return;
            }
            var args = [name];
            args.push.apply(args, arguments);
            return self.send(args);
        };
    });
    this.remoteEnv = env;
    this._emitConnect();
};

Agent.prototype._emitConnect = function () {
    this.emit("connect", this.remoteApi);
};

// Disconnect resets the state of the Agent, flushes callbacks and emits a
// "disconnect" event with optional error object.
Agent.prototype.disconnect = function (err) {
    if (!this.transport) {
        // Agent is already disconnected
        return;
    }

    var cerr = err;
    if (!cerr) {
        cerr = new Error("EDISCONNECT: Agent disconnected");
        cerr.code = "EDISCONNECT";
    }

    // Flush any callbacks
    if (this.callbacks) {
        var callbacks = this.callbacks;
        this.callbacks = undefined;
        forEach(callbacks, function (callback) {
            callback(cerr);
        });
    }
    
    // Disconnect from transport
    if (this.transport) {
        this.transport.removeListener("error", this.disconnect);
        this.transport.removeListener("disconnect", this.disconnect);
        this.transport.removeListener("message", this._onMessage);
        this.transport.removeListener("drain", this._onDrain);
        this.transport.disconnect();
        this.transport = undefined;
    }

    this.emit("disconnect", err);
    this.nextKey = undefined;
};

// Forward drain events
Agent.prototype._onDrain = function () {
    this.emit("drain");
};

// Route incoming messages to the right functions
Agent.prototype._onMessage = function (message) {

    if (!(Array.isArray(message) && message.length)) {
        return this.emit("error", new Error("Message should be an array"));
    }
    
    message = liven(message, this._getFunction);
    var id = message[0];
    
    var fn;
    if (id === "ready") {
        var keys = Object.keys(this.api);
        var env = this.api.env ;
        fn = function (callback) {
            callback(keys, env);
        };
    }
    else {
        fn = typeof id === "string" ? this.api[id] : this.callbacks[id];
        if (!fn) console.log("MISSING ID", id);
    }
    if (typeof fn !== "function") {
        return this.emit("error",  new Error("Should be function"));
    }
    fn.apply(this, message.slice(1));
};

// Create a proxy function that calls fn key on the Agent side.
// This is for when a Agent passes a callback to a local function.
Agent.prototype._getFunction = function (key) {
    // var transport = this.transport;
    var _self = this;
    return function () {
        // Call a Agent function using [key, args...]
        var args = [key];
        // Push is actually fast http://jsperf.com/array-push-vs-concat-vs-unshift
        args.push.apply(args, arguments);
        return _self.send(args);
    };
};

// This is for when we call a Agent function and pass in a callback
Agent.prototype._storeFunction = function (fn) {
    if (!this.callbacks)
        return new Error("Agent disconnected");
        
    var key = this.nextKey;
    while (this.callbacks.hasOwnProperty(key)) {
        key = (key + 1) >> 0;
        if (key === this.nextKey) {
            throw new Error("Ran out of keys!!");
        }
    }
    this.nextKey = (key + 1) >> 0;

    var callbacks = this.callbacks;
    var self = this;
    // Wrap is a self cleaning function and store in the index
    callbacks[key] = function () {
        delete callbacks[key];
        self.nextKey = key;
        return fn.apply(this, arguments);
    };
    return key;
};

// Convert a js object into a serializable object when functions are
// encountered, the storeFunction callback is called for each one.
// storeFunction takes in a function and returns a unique id number. Cycles
// are stored as object with a single $ key and an array of strigs as the
// path. Functions are stored as objects with a single $ key and id as value.
// props. properties starting with "$" have an extra $ prepended.
function freeze(value, storeFunction) {
    var seen = [];
    var paths = [];
    function find(value, path) {
        // find the type of the value
        var type = getType(value);
        // pass primitives through as-is
        if (type !== "function" && type !== "object" && type !== "array" && type !== "date") {
            return value;
        }

        // Look for duplicates
        var index = seen.indexOf(value);
        if (index >= 0) {
            return { "$": paths[index] };
        }
        // If not seen, put it in the registry
        index = seen.length;
        seen[index] = value;
        paths[index] = path;

        var o;
        // Look for functions
        if (type === "function") {
            o = storeFunction(value);
        }

        if (type === "date") {
            o = {d:value.getTime()};
        }

        if (o) return {$:o};

        // Recurse on objects and arrays
        return map(value, function (sub, key) {
            return find(sub, path.concat([key]));
        }, null, function (key) {
          return key[0] === "$" ? "$" + key : key;
        });
    }
    return find(value, []);
}

// Converts flat objects into live objects.  Cycles are re-connected and
// functions are inserted. The getFunction callback is called whenever a
// frozen function is encountered. It expects an ID and returns the function
function liven(message, getFunction) {
    function find(value, parent, key) {
        // find the type of the value
        var type = getType(value);

        // Unescape $$+ escaped keys
        if (key[0] === "$") key = key.substr(1);

        // pass primitives through as-is
        if (type !== "function" && type !== "object" && type !== "array") {
            parent[key] = value;
            return value;
        }

        // Load Specials
        if (value.hasOwnProperty("$")) {
            var special = value.$;
            // Load backreferences
            if (Array.isArray(special)) {
              parent[key] = get(obj.root, special);
              return parent[key];
            }
            if (typeof special === "object") {
                parent[key] = new Date(special.d);
                return parent[key];
            }
            // Load functions
            parent[key] = getFunction(special);
            return  parent[key];
        }

        // Recurse on objects and arrays
        var o = Array.isArray(value) ? [] : {};
        parent[key] = o;
        forEach(value, function (sub, key) {
            find(sub, o, key);
        });
        return obj;
    }
    var obj = {};
    find(message, obj, "root");
    return obj.root;
}

////////////////////////////////////////////////////////////////////////////////

// Typeof is broken in javascript, add support for null and buffer types
function getType(value) {
    if (value === null) {
        return "null";
    }
    if (Array.isArray(value)) {
        return "array";
    }
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
        return "buffer";
    }
    // TODO: find a way to work with Date instances from other contexts.
    if (value instanceof Date) {
        return "date";
    }
    return typeof value;
}

// Traverse an object to get a value at a path
function get(root, path) {
    var target = root;
    for (var i = 0, l = path.length; i < l; i++) {
        target = target[path[i]];
    }
    return target;
}

// forEach that works on both arrays and objects
function forEach(value, callback, thisp) {
    if (typeof value.forEach === "function") {
        return value.forEach.call(value, callback, thisp);
    }
    var keys = Object.keys(value);
    for (var i = 0, l = keys.length; i < l; i++) {
        var key = keys[i];
        callback.call(thisp, value[key], key, value);
    }
}

// map that works on both arrays and objects
function map(value, callback, thisp, keyMap) {
    if (typeof value.map === "function") {
        return value.map.call(value, callback, thisp);
    }
    var obj = {};
    var keys = Object.keys(value);
    for (var i = 0, l = keys.length; i < l; i++) {
        var key = keys[i];
        obj[keyMap ? keyMap(key) : key] = callback.call(thisp, value[key], key, value);
    }
    return obj;
}


exports.WebSocketTransport = WebSocketTransport;
inherits(WebSocketTransport, Transport);

// "message" - event emitted when we get a message from the other side.
// "disconnect" - the transport was disconnected
// "error" - event emitted for stream error or disconnect
// "drain" - drain event from output stream
function WebSocketTransport(socket) {
    this.socket = socket;
    var self = this;

    socket.on("message", onMessage);
    socket.on("close", onDisconnect);
    socket.on("error", onError);
    function onError(err) {
        self.emit("error", err);
    }
    function onMessage(data) {
        var message;
        try { message = msgpack.decode(data); }
        catch (err) { return onError(err); }
        exports.debug && console.log(process.pid + " <- " + require('util').inspect(message, false, 2, true));
        self.emit("message", message);
    }
    function onDisconnect() {
        // Remove all the listeners we added and destroy the socket
        socket.removeListener("message", onMessage);
        socket.removeListener("close", onDisconnect);
        self.emit("disconnect");
    }
    this.disconnect = onDisconnect;
    // TODO: Implement "drain" event, pause(), and resume() properly.
    // function onDrain() {
    //   self.emit("drain");
    // }
}

WebSocketTransport.prototype.send = function (message) {
    // Uncomment to debug protocol
    exports.debug && console.log(process.pid + " -> " + require('util').inspect(message, false, 2, true));
    var data;
    try { data = msgpack.encode(message); }
    catch (err) { return this.emit("error", err); }
    this.socket.send(data, {binary: true});
};

exports.BrowserTransport = BrowserTransport;
inherits(BrowserTransport, Transport);

function BrowserTransport(websocket) {
    this.websocket = websocket;
    var self = this;

    websocket.binaryType = 'arraybuffer';
    websocket.onmessage = function (evt) {
        var message;
        try { message = msgpack.decode(evt.data); }
        catch (err) { return onError(err); }
        exports.debug && console.log("<-", message);
        self.emit("message", message);
    };

    websocket.onclose = function (evt) {
    };

    websocket.onerror = function (evt) {
        onError(new Error(evt.data));
    };

    function onError(err) {
        self.emit("error", err);
    }

    function onDisconnect() {
        // Remove all the listeners we added and destroy the socket
        delete websocket.onmessage;
        delete websocket.onclose;
        self.emit("disconnect");
    }
    this.disconnect = onDisconnect;
}

BrowserTransport.prototype.send = function (message) {
    // Uncomment to debug protocol
    exports.debug && console.log("->", message);
    var data;
    try { data = msgpack.encode(message); }
    catch (err) { return this.emit("error", err); }
    this.websocket.send(data);
};

exports.EngineIoTransport = EngineIoTransport;
inherits(EngineIoTransport, Transport);
function EngineIoTransport(socket) {
  var self = this;
  this.socket = socket;
  
  // Route errors from socket to transport.
  function onError(err) {
    self.emit("error", err);
  }
  
  // Parse and route messages from socket to transport.
  function onMessage(message) {
    if (Array.isArray(message)) {
      if (exports.debug) {
        console.log("<-", message);
      }
      self.emit("message", message);
    }
    else {
      self.emit("legacy", message);
    }
  }
  
  // Route close events as disconnect events
  function onClose(reason) {
    self.emit("disconnect", reason);
    cleanup();
  }
  
  function onDrain() {
    self.emit("drain");
  }
  
  function onDisconnect(err) {
    self.emit("disconnect", err);
    cleanup();
  }
  
  socket.on("error", onError);
  socket.on("message", onMessage);
  socket.on("close", onClose);
  socket.on("drain", onDrain);
  socket.on("disconnect", onDisconnect);

  this.disconnect = function () {
    socket.close();
  };
  
  function cleanup() {
    socket.removeListener("error", onError);
    socket.removeListener("message", onMessage);
    socket.removeListener("close", onClose);
    socket.removeListener("drain", onDrain);
    socket.removeListener("disconnect", onDisconnect);
  }

  // Encode and route send calls to socket.
  this.send = function (message) {
    if (exports.debug && Array.isArray(message)) {
      console.log("->", message);
    }
    return socket.send(message);
  };

}


return exports;
});
