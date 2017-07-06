/**
 * This file is part of IKPdb Cloud9 debugger plugin.
 * Copyright (c) 2016 by Cyril MORISSE, Audaxis
 * Licence MIT. See LICENCE at repository root
 */
 
define(function(require, exports, module) {
    
    "use strict";

    var MessageReader = require("./MessageReader");

    var IKPdbService = module.exports = function(socket, breakHandler) {
        this.MAGIC_CODE = "LLADpcdtbdpac";
        this._socket = socket;
        
        /*****
         * Will be called asynchronously when debugger halts on breakpoint, 
         * exception, ....
         */
        this._breakHandler = breakHandler; 
        
        this._attached = false;
        this._pending = [];
        this._connected = false;
        this._commandId = 0;
        this._callbacks = [];  // a slit of ids used as key of _commandQueue below
        this._commandsQueue = {}; // queue of commands to debugger
    };
    
    (function() {
        /**
         * attach to debugger
         */
        this.attach = function(callback) {
            // console.debug("IKPdbService attach");
            if (this._connected)
                throw new Error("IKPdbService already attached!");

            var self = this;
            this._reader = new MessageReader(this._socket, function() {
                self._reader.destroy();
                self._reader = new MessageReader(self._socket, self._receiveMessage.bind(self));
                callback();
            });

            this._socket.on("connect", function() {
                // console.debug("IKPdb socket connection succeeded!");
                this._connected = true; 
            });
            
            this._socket.on("end", function() {
                for (var id in self._callbacks) {
                    if (!self._callbacks[id])
                        continue;
                    self._callbacks[id](new Error("IKPdb debug session ended."));
                }
            });

            this._socket.connect();
        };

        this.detach = function(callback) {
            //if (this._connected)
            //    this.sendCommand("detach");
    
            if (this._socket)
                this._socket.close();
            this._socket = null;
    
            this._connected = false;
            this._commands = {};
            this._callbacks = [];
            this._breakHandler = function() {};
            callback && callback();
        };


        this._jsonSend = function(args) {
            args = JSON.stringify(args);
            var msg = ["length=", args.length, this.MAGIC_CODE, args].join("");
            this._socket.send(msg);
        };

        /*
         * Issue a command to debugger via proxy. Messages append a sequence
         * number to run pending callbacks when proxy replies to that id.
         */
        this.sendCommand = function(command, args, callback) {
            // build message
            var obj = {};
            if (typeof args === "undefined") {
                args = {};
            }
            obj.command = command;
            obj._id = ++this._commandId; // keep track of callback
            obj.args = args;

            if (typeof callback !== "undefined") {
                this._callbacks[this._commandId] = callback;
            }
    
            // send message
            this._commandsQueue[this._commandId] = obj;
            this._jsonSend(obj);
        };

        /*
         * Process incoming messages from the proxy
         */
        this._receiveMessage = function(message) {
            // console.debug("_receiveMessage(message) <= message=",message);
            var responseParts = message.split(this.MAGIC_CODE);
    
            try {
                var content = JSON.parse(responseParts[1]);
            } 
            catch (ex) {
                console.error("Debugger can't parse JSON from IKPdb proxy", responseParts[1]);
                return;
            }
    
            if (content === null || typeof content !== "object")
                return;
    
            if (content.command == "programEnd") {
                return this._breakHandler(content);
            }
    
            // we've received a stack frame from IKPdb on break or unhandeld exeception
            if (content.command == "programBreak")
                return this._breakHandler(content);
    
            // run pending callback if sequence number matches one we sent
            if (typeof content._id == "undefined")
                return;
            // execute callback
            var callback = null;
            if (typeof this._callbacks[content._id] === "function")
                callback = this._callbacks[content._id];
    
            /****
             * generate an error if the command did not complete successfully.
             * The Error will be processed by the callback since we have not 
             * to gui here.
             */ 
            var err = null;
            if (content.commandExecStatus == "error") {
                var str = '';
                if (!content.error_messages.length) {
                    /****
                     * IKPdb did not supply an error message. We build one
                     * from the command
                     */
                    str += "Command '" + this._commandsQueue[content._id].command + "'' failed.";
                    content.error_messages = [str];
                } else {
                    str += content.error_messages.join(" ");
                }
                err = new Error(str);
            }
    
            // remove buffers
            delete this._callbacks[content._id];
            delete this._commandsQueue[content._id];
    
            // run callback
            callback && callback(err, content);
        };

    }).call(IKPdbService.prototype);

});