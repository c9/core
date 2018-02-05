define(function(require, exports, module) {
"use strict";

module.exports = DbgpSession;

var inherits = require("util").inherits;
var Stream = require("stream").Stream;

var xmlToObject = require("./util").xmlToObject;
var base64Decode = require("./util").base64Decode;

function noop() {}

function toArray(value) {
    if (value == null) return [];
    if (!Array.isArray(value)) return [ value ];
    else return value;
}

/**
 * @class debugger.xdebug.DbgpSession
 *
 * The `DbgpSession` handles communication between the IDE and the debugger
 * engine. It is created when a new connection is established and destroyed
 * when the debugger engine stops.
 *
 * @constructor
 */
function DbgpSession() {
    Stream.call(this);

    this.writable = true;

    this.status = "starting";
    this.initialized = false;
    this._seq = 0;
    this._callbacks = {};

    var session = this;
    this.on("stopping", function() {
        session.end();
    });
}

inherits(DbgpSession, Stream);

/**
 * @event init
 * Emitted when the init handshake is complete and the session is ready to send
 * and receive commands.
 */

/**
 * @event end
 * Emitted when the debugging session ends and the IDE cannot continue sending
 * commands. This happens when the debugger engine stops, the IDE detaches, or
 * the connection to the engine is lost.
 */

/**
 * @event error
 * Emitted when an unexpected error occurs.
 *
 * @param {Error} err
 */

// message handling ///////////////////////////////////////////////////////////

/**
 * Send a raw command with the given arguments and payload data to the debugger
 * engine.
 *
 * @param {string}  command  The command name.
 * @param {Object=} args     A hash of arguments.
 * @param {*=}      data     The payload data.
 *
 * @return {number}  The sequence number (`transaction_id`) of the sent
 *   command.
 */
DbgpSession.prototype.sendCommand = function(command, args, data, callback) {
    var seq = this._seq++;

    this.emit("data", {
        seq: seq,
        command: command,
        args: args,
        data: data
    });

    this._callbacks["" + seq] = callback;

    return seq;
};

DbgpSession.prototype.write = function(xml) {
    var type = Object.keys(xml)[0];

    switch (type) {
        case "init":
            return this._handleInit(xml[type]);

        case "response":
            return this._handleResponse(xml[type]);

        default:
            this.emit("error", new Error("Unhandled message type: " + type));
    }
};

DbgpSession.prototype.end = function() {
    this.emit("end");
};

DbgpSession.prototype._handleInit = function(init) {
    this.protocolVersion = init["@protocol_version"];

    this.appId = init["@appid"];
    this.ideKey = init["@idekey"];
    this.sessionId = init["@session"];
    this.threadId = init["@thread"];
    this.parentAppId = init["@parent"];

    this.language = init["@language"];
    this.fileURI = init["@fileuri"];

    this.engine = {
        name: init.engine && init.engine["$"],
        version: init.engine && init.engine["@version"],
        info: {},
    };

    for (var key in init) {
        if (key[0] === "@" || key === "engine") continue;
        this.engine.info[key] = init[key];
    }

    var _self = this;

    // verify connection
    this.getStatus(function(err) {
        if (err) {
            _self.emit("error", err);
            return;
        }
        _self.emit("init");
    });

    this.initialized = true;
};

DbgpSession.prototype._handleResponse = function(response) {
    // command response

    var command = response["@command"];
    var seq = response["@transaction_id"];

    if (command) {
        this._handleCommandResponse(command, seq, response);
    }

    // status

    var status = response["@status"];
    var reason = response["@reason"];

    if (status) {
        this._handleStatus(status);
    }
};

DbgpSession.prototype._handleCommandResponse = function(command, seq, response) {
    var callback = this._callbacks[seq];
    delete this._callbacks[seq];

    // error

    if (response.error) {
        var errorCode = response.error["@code"];
        var errorMessage = response.error.message;

        var err = new Error(errorMessage || "Debugger error");
        err.code = errorCode;

        callback && callback(err, {});
        return;
    }

    // success

    callback && callback(null, response);
};

DbgpSession.prototype._handleStatus = function(status) {
    if (this.status !== status) {
        this.status = status;
        this.emit("status", status);
        this.emit(status);
    }
};

// misc ///////////////////////////////////////////////////////////////////////

/** @method getStatus */
DbgpSession.prototype.getStatus = function(callback) {
    callback = callback || noop;
    this.sendCommand("status", null, null, callback);
};

/** @method eval */
DbgpSession.prototype.eval = function(script, callback) {
    callback = callback || noop;

    var _self = this;
    var params = {
        l: script.length
    };

    _self.sendCommand("eval", params, script, function(err, response) {
        callback(err, response.property);
    });
};

/**
 * Get the content of the given source file.
 *
 * @param {string} fileURI The file URI of the source.
 * @param {Function} callback
 * @param {Error=} callback.err
 * @param {string} callback.source The content of the source.
 */
DbgpSession.prototype.getSource = function(fileURI, callback) {
    callback = callback || noop;

    var _self = this;
    var params = {
        f: fileURI
    };

    _self.sendCommand("source", params, null, function(err, response) {
        if (err) return callback(err);

        var source = response["$"];

        if (response["@encoding"] === "base64") {
            source = base64Decode(source);
        }

        callback(null, source);
    });
};

// continuation ////////////////////////////////////////////////////////////////

DbgpSession.prototype.run = function(callback) {
    this._continue("run", callback);
};

DbgpSession.prototype.stepInto = function(callback) {
    this._continue("step_into", callback);
};

DbgpSession.prototype.stepOver = function(callback) {
    this._continue("step_over", callback);
};

DbgpSession.prototype.stepOut = function(callback) {
    this._continue("step_out", callback);
};

DbgpSession.prototype.stop = function(callback) {
    this._continue("stop", callback);
};

DbgpSession.prototype._continue = function(command, callback) {
    callback = callback || noop;
    this._handleStatus("running");
    this.sendCommand(command, null, null, noop);
    callback();
};

// feature negotiation /////////////////////////////////////////////////////////

/**
 * The feature commands are used to request feature support from the debugger
 * engine.
 *
 * @param {string} feature The name of the feature flag.
 *
 * @param {Function} callback
 * @param {Error=} callback.err
 * @param {*} callback.value The current value of the feature flag.
 */
DbgpSession.prototype.getFeature = function(feature, callback) {
    callback = callback || noop;

    var _self = this;
    var params = {
        n: feature
    };

    _self.sendCommand("feature_get", params, null, function(err, response) {
        if (err) return callback(err);

        if (response["@supported"] !== 1)
            return callback(new Error("No support for debugger feature: " + feature));

        callback(null, response["$"]);
    });
};

/**
 * The feature set command allows a IDE to tell the debugger engine what
 * additional capabilities it has.
 *
 * @param {string} feature The name of the feature flag.
 * @param {*} value The new value of the feature flag.
 *
 * @param {Function} callback
 * @param {Error=} callback.err
 */
DbgpSession.prototype.setFeature = function(feature, value, callback) {
    callback = callback || noop;

    var _self = this;
    var params = {
        n: feature,
        v: value
    };

    _self.sendCommand("feature_set", params, null, function(err, response) {
        if (err) return callback(err);

        if (response["@success"] !== 1)
            return callback(new Error("Could not set debugger feature: " + feature));

        callback();
    });
};

// stacks //////////////////////////////////////////////////////////////////////

/**
 * Returns stack information for a given stack depth.
 *
 * If the stack depth is specified, only one stack element is returned, for the
 * depth requested, though child elements may be returned also. The current
 * context is stack depth of zero, the 'oldest' context (in some languages
 * known as 'main') is the highest numbered context.
 *
 * @param {number} stackDepth The depth to retrieve.
 *
 * @param {Function} callback
 * @param {Error=} callback.err
 * @param {Object[]} callback.frames
 */
DbgpSession.prototype.getStackFrames = function(stackDepth, callback) {
    callback = callback || noop;

    var _self = this;
    var params = {
        d: stackDepth
    };

    _self.sendCommand("stack_get", params, null, function(err, response) {
        callback(err, toArray(response.stack));
    });
};

// contexts ////////////////////////////////////////////////////////////////////

/**
 * Returns an array of properties in a given context at a given stack depth.
 *
 * If the stack depth is omitted, the current stack depth is used.  If the
 * context name is omitted, the context with an id zero is used (generally the
 * 'locals' context).
 *
 * @param {number} stackDepth The depth to retrieve.
 * @param {number} contextId The context to retrieve.
 *
 * @param {Function} callback
 * @param {Error=} callback.err
 * @param {Object[]} callback.properties
 */
DbgpSession.prototype.getContextProperties = function(stackDepth, contextId, callback) {
    callback = callback || noop;

    var _self = this;
    var params = {
        d: stackDepth,
        c: contextId
    };

    _self.setFeature("max_depth", 0, function() {
        _self.sendCommand("context_get", params, null, function(err, response) {
            callback(err, toArray(response.property));
        });
    });
};

// properties //////////////////////////////////////////////////////////////////

/**
 * Get the attributes and value of the given property.
 *
 * @param {string} propertyName The long name of the property, as given by the debugger engine.
 * @param {number} stackDepth The depth of the stack the property exists in.
 * @param {number} contextId The context the property exists in.
 *
 * @param {Function} callback
 * @param {Error=} callback.err
 * @param {Object} callback.property The property object.
 * @param {*} callback.property.$ The property value.
 */
DbgpSession.prototype.getProperty = function(propertyName, stackDepth, contextId, callback) {
    callback = callback || noop;

    var _self = this;
    var params = {
        d: stackDepth,
        c: contextId,
        n: propertyName
    };

    _self.setFeature("max_depth", 0, function() {
        _self.sendCommand("property_get", params, null, function(err, response) {
            if (err) return callback(err);

            var property = response.property;

            _self.sendCommand("property_value", params, null, function(err, response) {
                property["$"] = response["$"];
                callback(err, property);
            });
        });
    });
};

/**
 * Set the value of the given property.
 *
 * @param {string} propertyName The long name of the property, as given by the debugger engine.
 * @param {number} stackDepth The depth of the stack the property exists in.
 * @param {number} contextId The context the property exists in.
 * @param {*} value The new property value.
 *
 * @param {Function} callback
 * @param {Error=} callback.err
 * @param {Object} callback.property The property object.
 */
DbgpSession.prototype.setPropertyValue = function(propertyName, stackDepth, contextId, value, callback) {
    callback = callback || noop;

    var _self = this;
    var params = {
        d: stackDepth,
        c: contextId,
        n: propertyName
    };

    _self.sendCommand("property_set", params, value, function(err, response) {
        if (err) return callback(err);

        if (response["@success"] !== 1)
            return callback(new Error("Could not set property value"));

        callback();
    });
};

/**
 * Get the child properties of the given property.
 *
 * @param {string} propertyName The long name of the property, as given by the debugger engine.
 * @param {number} stackDepth The depth of the stack the property exists in.
 * @param {number} contextId The context the property exists in.
 *
 * @param {Function} callback
 * @param {Error=} callback.err
 * @param {Object[]} callback.properties The child properties.
 */
DbgpSession.prototype.getPropertyChildren = function(propertyName, stackDepth, contextId, callback) {
    callback = callback || noop;

    var _self = this;
    var params = {
        d: stackDepth,
        c: contextId,
        n: propertyName
    };

    _self.setFeature("max_depth", 1, function() {
        _self.sendCommand("property_get", params, null, function(err, response) {
            callback(err, toArray(response.property.property));
        });
    });
};

// breakpoints /////////////////////////////////////////////////////////////////

/**
 * Set a breakpoint in the given file with the given options.
 *
 * To allow a breakpoint's condition to be updated using `updateBreakpoint()`,
 * all breakpoints are set as the `conditional` type. If no break condition is
 * defined in `options.condition`, the condition is set to `true` so it always
 * triggers.
 *
 * @param {string} fileURI The file URI of the source.
 *
 * @param {Object} options
 * @param {number} options.line The line number to break on, starting from line 1.
 * @param {boolean=} [options.enabled=true] If the breakpoint is active or not.
 * @param {string=} options.condition Only break if this expression evaluates
 *   to `true`.
 * @param {number=} options.ignoreCount Only break after the breakpoint
 *   triggered at least _n_ times.
 *
 * @param {Function} callback
 * @param {Error=} callback.err
 * @param {string} callback.breakpointId An arbitrary string that uniquely
 *   identifies this breakpoint in the debugger engine.
 */
DbgpSession.prototype.setBreakpoint = function(fileURI, options, callback) {
    callback = callback || noop;

    var _self = this;
    var params = {
        t: "conditional",
        s: options.enabled !== false ? "enabled" : "disabled",
        f: fileURI,
        n: options.line,
        h: options.ignoreCount
    };
    var condition = options.condition || "true";

    _self.sendCommand("breakpoint_set", params, condition, function(err, response) {
        callback(err, response["@id"]);
    });
};

/**
 * Update the given breakpoint with attributes with the given options.
 *
 * @param {string} breakpointId The unique identifier given by
 *   {@link #method-setBreakpoint setBreakpoint()}.
 * @param {Object} options
 * @param {number=} options.line The line number to break on, starting from line 1.
 * @param {boolean=} options.enabled If the breakpoint is active or not.
 * @param {string=} options.condition Only break if this expression evaluates
 *   to `true`.
 * @param {number=} options.ignoreCount Only break after the breakpoint
 *   triggered at least _n_ times.
 *
 * @param {Function} callback
 * @param {Error=} callback.err
 */
DbgpSession.prototype.updateBreakpoint = function(breakpointId, options, callback) {
    callback = callback || noop;

    var _self = this;
    var params = {
        d: breakpointId
    };

    if (options.line != null) {
        params.n = options.line;
    }
    if (options.enabled != null) {
        params.s = options.enabled !== false ? "enabled" : "disabled";
    }
    if (options.ignoreCount != null) {
        params.h = options.ignoreCount;
    }

    var condition;
    if (options.condition != null) {
        condition = options.condition;
    }

    _self.sendCommand("breakpoint_update", params, condition, function(err, response) {
        callback(err);
    });
};

/**
 * Remove the given breakpoint.
 *
 * @param {string} breakpointId The unique identifier given by
 *   {@link #method-setBreakpoint setBreakpoint()}.
 *
 * @param {Function} callback
 * @param {Error=} callback.err
 */
DbgpSession.prototype.removeBreakpoint = function(breakpointId, callback) {
    callback = callback || noop;

    var _self = this;
    var params = {
        d: breakpointId
    };

    _self.sendCommand("breakpoint_remove", params, null, function(err, response) {
        callback(err);
    });
};

});
