/*global apf*/

define(function(require, module, exports) {
    var events = require('./events');
    var util = require("ace/lib/oop");
    
    function NodeWebSocket(url) {
        this.url = url;
        this.ws = new WebSocket(url);
        var _self = this;
        
        this.ws.onopen = function (e) { _self.emit("open", e); };
        this.ws.onerror = function (error) { _self.emit("error", error); };
        this.ws.onmessage = function (e) { _self.emit("message", e.data); };
    }
    util.inherits(NodeWebSocket, events.EventEmitter);
    
    NodeWebSocket.prototype.send = function(data) {
        this.ws.send(data);
    };
    NodeWebSocket.prototype.close = function() {
        this.ws.close();
    };
    
    return NodeWebSocket;
});