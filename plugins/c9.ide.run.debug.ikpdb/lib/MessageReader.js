/**
 * This file is part of IKPdb Cloud9 debugger plugin.
 * Copyright (c) 2016 by Cyril MORISSE, Audaxis
 * Licence MIT. See LICENCE at repository root
 */
 
define(function(require, exports, module) {
    "use strict";
    
    var MessageReader = module.exports = function(socket, callback) {
        this.IKPDB_MAGIC_CODE = "LLADpcdtbdpac";
        this.IKPDB_LENGTH_PREFIX = "length=";
        
        this.C9_MAGIC_CODE = "\r\n\r\n";
        this.C9_LENGTH_PREFIX = "Content-Length:";
        this.C9_PING_MESSAGE = this.C9_LENGTH_PREFIX + "0" + this.C9_MAGIC_CODE;

        this._socket = socket;
        this._callback = callback;
    
        this._receivedData = "";
        
        // We want the data handling callback to be ran 
        // with this = MessageReader instance
        this._boundOnReceive = this._onReceive.bind(this);
        socket.on("data", this._boundOnReceive);
    };
    
    (function() {
    
        this._onReceive = function(data) {
            // console.debug("_onReceive(data) => ", data.length," ", data);
            this._receivedData += data;
            var fullResponse = null;
            while (fullResponse = this._checkForWholeMessage()) {
                if (fullResponse != this.C9_PING_MESSAGE) {
                    this._callback(fullResponse);
                } else {
                    console.log("Received \"ping\" message from Cloud9 (" + this.C9_PING_MESSAGE + ")");
                }
            }
        };

        /**
         * try to detects protocol in received data and returns a list
         * with [{{protocol}}, {{ilengthPrefixIdx}}, {{magicCodeIdx}}]
         * if protocol detection failed, returns null
         */
        this._tryToDetectProtocol = function(receivedData) {
            var lengthPrefixIdx = null,
                magicCodeIdx = null;
                
            if ((magicCodeIdx = receivedData.indexOf(this.IKPDB_MAGIC_CODE)) != -1) {
                if ((lengthPrefixIdx = receivedData.indexOf(this.IKPDB_LENGTH_PREFIX)) != -1) {
                    return ['IKPdb', lengthPrefixIdx, magicCodeIdx];
                    
                }
            } else if ((magicCodeIdx = receivedData.indexOf(this.C9_MAGIC_CODE)) != -1) {
                if ((lengthPrefixIdx = receivedData.indexOf(this.C9_LENGTH_PREFIX)) != -1) {
                    return ['C9', lengthPrefixIdx, magicCodeIdx];
                }
            }
            return null;
        };

        this._checkForWholeMessage = function() {
            var messageLength,
                responseLength,
                fullResponse = false,
                lengthPrefixIdx = 0,
                magicCodeIdx = 0,
                protocol = null,
                received = this._receivedData,
                MAGIC_CODE, LENGTH_PREFIX;
            
            protocol = this._tryToDetectProtocol(received);
            if (protocol) {
                lengthPrefixIdx = protocol[1];
                magicCodeIdx = protocol[2];
                MAGIC_CODE = protocol[0] == 'IKPdb' ? this.IKPDB_MAGIC_CODE : this.C9_MAGIC_CODE;
                LENGTH_PREFIX = protocol[0] == 'IKPdb' ? this.IKPDB_LENGTH_PREFIX : this.C9_LENGTH_PREFIX;

                messageLength = received.substring(lengthPrefixIdx + LENGTH_PREFIX.length);
                messageLength = messageLength.substring(0, messageLength.indexOf(MAGIC_CODE));
                responseLength = magicCodeIdx + MAGIC_CODE.length + parseInt(messageLength, 10);
                if (responseLength <= received.length) {
                    fullResponse = received.substring(0, responseLength);
                    this._receivedData = received.substring(responseLength);
                }
            } 
            return fullResponse;
        };
    
        this.destroy = function() {
            this._socket && this._socket.removeListener("data", this._boundOnReceive);
            delete this._socket;
            delete this._callback;
            this._received = "";
        };
    
    }).call(MessageReader.prototype);

});