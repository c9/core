/*
Copyright (c) 2013 Andrea Cardaci <cyrus.and@gmail.com>
I.S.T.I. - C.N.R. Pisa

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

define(function(require, exports, module) {
    var protocol = require('./protocol.js');
    var util = require("ace/lib/oop");
    var events = require('events');
    var http = require('http');
    var WebSocket = require('ws');
    
    var Chrome = function (options, callback) {
        if (!(this instanceof Chrome))
            return new Chrome(options, callback);
        
        if (typeof options === 'function') {
            callback = options;
            options = undefined;
        }
        options = options || {};
        options.host = options.host || 'localhost';
        options.port = options.port || 9222;
        options.chooseTab = options.chooseTab || function () { return 0; };
        
        var notifier = new events.EventEmitter();
        if (typeof callback === 'function')
            notifier.on('connect', callback);

        setTimeout(function() {
            // the default listener just disconnects from Chrome, this can be used
            // to simply check the connection
            if (notifier.listeners('connect').length === 0) {
                notifier.on('connect', function(chrome) {
                    chrome.close();
                });
            }
        });
        
        var self = this;
        addCommandShorthands.call(self);
        self.notifier = notifier;
        self.callbacks = {};
        self.nextCommandId = 1;
        connectToChrome.call(self, options.host, options.port, options.chooseTab);
        
        return notifier;
    };
    
    util.inherits(Chrome, events.EventEmitter);
    
    Chrome.prototype.send = function (method, params, callback) {
        var self = this;
        var id = self.nextCommandId++;
        if (typeof params === 'function') {
            callback = params;
            params = undefined;
        }
        var message = { 'id': id, 'method': method, 'params': params };
        self.ws.send(JSON.stringify(message));
        // register command response callback
        if (typeof callback === 'function') {
            self.callbacks[id] = callback;
        }
    };
    
    Chrome.prototype.close = function () {
        var self = this;
        self.ws.removeAllListeners();
        self.ws.close();
    };
    
    function addCommand(domain, command) {
        var self = this;
        Chrome.prototype[domain][command] = function (params, callback) {
            self.send(domain + '.' + command, params, callback);
        };
    }
    
    function addCommandShorthands() {
        var self = this;
        for (var domain in protocol.commands) {
            Chrome.prototype[domain] = {};
            var commands = protocol.commands[domain];
            for (var i = 0; i < commands.length; i++) {
                var command = commands[i];
                addCommand.call(self, domain, command);
            }
        }
    }
    
    function connectToChrome(host, port, chooseTab) {
        var self = this;
        var options = { 'host': host, 'port': port, 'path': '/json' };
        var request = http.get(options, function (response) {
            var data = '';
            response.on('data', function (chunk) {
                data += chunk;
            });
            response.on('end', function () {
                var error;
                var tabs = JSON.parse(data);
                var tab = tabs[chooseTab(tabs)];
                if (tab) {
                    var tabDebuggerUrl = tab.webSocketDebuggerUrl;
                    if (tabDebuggerUrl) {
                        connectToWebSocket.call(self, tabDebuggerUrl);
                    } else {
                        // a WebSocket is already connected to this tab?
                        error = new Error('Unable to connect to the WebSocket');
                        self.notifier.emit('error', error);
                    }
                } else {
                    error = new Error('Invalid tab index');
                    self.notifier.emit('error', error);
                }
            });
        });
        request.on('error', function (error) {
            self.notifier.emit('error', error);
        });
    }
    
    function connectToWebSocket(url) {
        var self = this;
        self.ws = new WebSocket(url);
        self.ws.on('open', function() {
            self.notifier.emit('connect', self);
        });
        self.ws.on('message', function (data) {
            var message = JSON.parse(data);
            // command response
            if (message.id) {
                var callback = self.callbacks[message.id];
                if (callback) {
                    if (message.result) {
                        callback(false, message.result);
                    } else if (message.error) {
                        callback(true, message.error);
                    }
                    // unregister command response callback
                    delete self.callbacks[message.id];
                }
            }
            // event
            else if (message.method) {
                self.emit('event', message);
                self.emit(message.method, message.params);
            }
        });
        self.ws.on('error', function (error) {
            self.notifier.emit('error', error);
        });
    }
    
    return Chrome;
});