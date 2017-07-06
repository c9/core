/**
 * GDB Debugger plugin for Cloud9
 *
 * @author Dan Armendariz <danallan AT cs DOT harvard DOT edu>
 */

define(function(require, exports, module) {
"use strict";

var MessageReader = require("./MessageReader");

var GDBProxyService = module.exports = function(socket, haltHandler) {
    this.$socket = socket;
    this.$haltHandler = haltHandler;
    this.$connected = false;
    this.$sequence_id = 0;   // message sequence number
    this.$commands = {};     // queue of commands to debugger
    this.$callbacks = [];    // callbacks to initiate when msg returned
};

(function() {

    this.attach = function(callback) {
        if (this.$connected)
            throw new Error("already attached!");

        var self = this;
        this.$reader = new MessageReader(this.$socket, function() {
            self.$reader.destroy();
            self.$reader = new MessageReader(self.$socket, self.$receiveMessage.bind(self));
            callback();
        });

        this.$socket.on("end", function() {
            for (var id in self.$callbacks) {
                if (!self.$callbacks.hasOwnProperty(id) || !self.$callbacks[id])
                    continue;
                self.$callbacks[id](new Error("Debug session ended"));
            }
        });

        this.$socket.on("connect", function() {
            self.$connected = true;
        });

        this.$socket.on("beforeBack", function() {
            if (self.$commands.length) {
                self.$commands.forEach(function (cmd) {
                    self.$send(cmd);
                });
            }
        });

        this.$socket.connect();
    };

    this.detach = function(callback) {
        if (this.$connected)
            this.sendCommand("detach");

        if (this.$socket)
            this.$socket.close();
        this.$socket = null;

        this.$connected = false;
        this.$commands = {};
        this.$callbacks = [];
        this.$haltHandler = function() {};
        if (this.$reader)
            this.$reader.destroy();
        callback && callback();
    };

    this.$send = function(args) {
        args = JSON.stringify(args);
        var msg = ["Content-Length:", args.length, "\r\n\r\n", args].join("");
        this.$socket && this.$socket.send(msg);
    };

    /*
     * Issue a command to debugger via proxy. Messages append a sequence
     * number to run pending callbacks when proxy replies to that id.
     */
    this.sendCommand = function(command, args, callback) {
        // build message
        if (typeof args === "undefined") {
            args = {};
        }
        args.command = command;

        // keep track of callback
        args._id = ++this.$sequence_id;
        if (typeof callback !== "undefined") {
            this.$callbacks[this.$sequence_id] = callback;
        }

        // send message
        this.$commands[this.$sequence_id] = args;
        this.$send(args);
    };

    /*
     * Process incoming messages from the proxy
     */
    this.$receiveMessage = function(message) {
        var responseParts = message.split("\r\n\r\n");

        try {
            var content = JSON.parse(responseParts[1]);
        }
        catch (ex) {
            console.log("Debugger can't parse JSON from GDB proxy");
            return;
        }

        if (content === null || typeof content !== "object")
            return;

        if (content.err === "killed" || content.err === "corrupt")
            return this.$haltHandler(content);

        // we've received a frame stack from GDB on break, segfault, pause
        if ("frames" in content)
            return this.$haltHandler(content);

        // run pending callback if sequence number matches one we sent
        if (typeof content._id == "undefined")
            return;

        // execute callback
        var callback = null;
        if (typeof this.$callbacks[content._id] === "function")
            callback = this.$callbacks[content._id];

        // generate an error if the command did not complete successfully
        var err = null;
        if (!content.hasOwnProperty("state") || content.state == "error") {
            var str = "Command " + this.$commands[content._id] + " failed";
            if (content.hasOwnProperty("msg"))
                str += content.msg;

            err = new Error(str);
        }

        // remove buffers
        delete this.$callbacks[content._id];
        delete this.$commands[content._id];

        // run callback
        callback && callback(err, content);
    };

}).call(GDBProxyService.prototype);

});