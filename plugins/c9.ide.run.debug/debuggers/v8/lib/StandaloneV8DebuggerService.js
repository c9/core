define(function(require, exports, module) {
"use strict";

var oop = require("ace/lib/oop");
var EventEmitter = require("ace/lib/event_emitter").EventEmitter;

var StandaloneV8DebuggerService = module.exports = function(socket) {
    this.$socket = socket;
    this.$attached = false;
    this.$pending = [];
    this.$connected = false;
};

(function() {

    oop.implement(this, EventEmitter);

    this.attach = function(tabId, callback) {
        if (this.$attached)
            throw new Error("already attached!");

        this.$socket.on("message", this.$onMessage.bind(this));
        callback(null, null);
    };

    this.detach = function(tabId, callback) {
        this.$socket.close();
        this.$attached = false;
        this.$connected = false;
        callback && callback();
    };

    this.$onMessage = function(message) {
        if (!message) {
            this.$connected = true;
            return;
        }
        
        for (var i = 0; i < this.$pending.length; i++) {
            if (this.$pending[i][1].seq == message.request_seq) {
                this.$pending.splice(i, 1);
                break;
            }
        }
        
        this._signal("debugger_command_0", { data: message });
    };

    this.debuggerCommand = function(tabId, v8Command, noPending) {
        if (!noPending && v8Command.command != "scripts")
            this.$pending.push([tabId, v8Command]);

        this.$send(v8Command);
    };
       
    this.$send = function(msg) {
        this.$socket.send(msg);
    };

}).call(StandaloneV8DebuggerService.prototype);

});