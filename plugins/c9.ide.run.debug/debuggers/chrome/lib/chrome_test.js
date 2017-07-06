/*global describe it before */

"use client";


require([
    "plugins/c9.ide.run.debug/debuggers/chrome/lib/chrome", 
    "lib/chai/chai"
], function (Chrome, chai) {
    var assert = chai.assert;
    
    describe('connecting to Chrome', function () {
        describe('with default parameters', function () {
            it('should succeed with "connect" callback passed as an argument', function (done) {
                Chrome(function(chrome) {
                    chrome.close();
                    done();
                }).on('error', function () {
                    assert(false);
                });
            });
            it('should succeed with "connect" callback registered later', function (done) {
                Chrome().on('connect', function(chrome) {
                    chrome.close();
                    done();
                }).on('error', function () {
                    assert(false);
                });
            });
        });
        describe('with custom parameters', function () {
            it('should succeed with "connect" callback passed as an argument', function (done) {
                Chrome({ 'host': 'localhost', 'port': 9222 }, function(chrome) {
                    chrome.close();
                    done();
                }).on('error', function () {
                    assert(false);
                });
            });
            it('should succeed with "connect" callback registered later', function (done) {
                Chrome({ 'host': 'localhost', 'port': 9222 }).on('connect', function(chrome) {
                    chrome.close();
                    done();
                }).on('error', function () {
                    assert(false);
                });
            });
        });
        describe('with custom (wrong) parameters', function () {
            it('should fail (wrong port)', function (done) {
                Chrome({ 'port': 1 }, function () {
                    assert(false);
                }).on('error', function (error) {
                    assert(error instanceof Error);
                    done();
                });
            });
            it('should fail (wrong host)', function (done) {
                Chrome({ 'host': '255.255.255.255' }, function () {
                    assert(false);
                }).on('error', function (error) {
                    assert(error instanceof Error);
                    done();
                });
            });
            it('should fail (wrong tab)', function (done) {
                Chrome({ 'chooseTab': function () { return -1; } }, function () {
                    assert(false);
                }).on('error', function (error) {
                    assert(error instanceof Error);
                    done();
                });
            });
        });
        describe('two times', function () {
            it('should fail', function (done) {
                Chrome(function (chrome) {
                    Chrome(function () {
                        assert(false);
                    }).on('error', function (error) {
                        chrome.close();
                        assert(error instanceof Error);
                        done();
                    });
                }).on('error', function () {
                    assert(false);
                });
            });
        });
    });
    
    describe('closing a connection', function () {
        it('should allow a subsequent new connection', function (done) {
            Chrome(function (chrome) {
                chrome.close();
                Chrome(function (chrome) {
                    chrome.close();
                    done();
                }).on('error', function (error) {
                    assert(false);
                });
            }).on('error', function () {
                assert(false);
            });
        });
    });
    
    describe('registering event', function () {
        describe('"event"', function () {
            it('should give the raw message', function (done) {
                Chrome(function(chrome) {
                    chrome.once('event', function(message) {
                        chrome.close();
                        assert(message.method);
                        done();
                    });
                    chrome.send('Network.enable');
                    chrome.send('Tab.reload');
                });
            });
        });
        describe('"Console.messagesCleared"', function () {
            it('should give the payload ony', function (done) {
                Chrome(function(chrome) {
                    chrome.once('Network.requestWillBeSent', function(message) {
                        chrome.close();
                        assert(!message.method);
                        done();
                    });
                    chrome.send('Network.enable');
                    chrome.send('Tab.reload');
                });
            });
        });
    });
    
    describe('sending a command', function () {
        describe('without checking the result and without specifyng parameters', function () {
            it('should succeed', function (done) {
                Chrome(function(chrome) {
                    chrome.once('Network.requestWillBeSent', function() {
                        chrome.close();
                        done();
                    });
                    chrome.send('Network.enable');
                    chrome.send('Tab.reload');
                });
            });
        });
        describe('checking the result and without specifyng parameters', function () {
            it('should succeed', function (done) {
                Chrome(function(chrome) {
                    chrome.send('Tab.enable', function (error, response) {
                        chrome.close();
                        assert(!error);
                        done();
                    });
                });
            });
        });
        describe('checking the result and specifyng parameters', function () {
            it('should succeed', function (done) {
                Chrome(function(chrome) {
                    chrome.send('Network.setCacheDisabled', { 'cacheDisabled': true }, function (error, response) {
                        chrome.close();
                        assert(!error);
                        done();
                    });
                });
            });
        });
        describe('without checking the result and without specifyng parameters (shorthand)', function () {
            it('should succeed', function (done) {
                Chrome(function(chrome) {
                    chrome.once('Network.requestWillBeSent', function() {
                        chrome.close();
                        done();
                    });
                    chrome.Network.enable();
                    chrome.Tab.reload();
                });
            });
        });
        describe('checking the result and without specifyng parameters (shorthand)', function () {
            it('should succeed', function (done) {
                Chrome(function(chrome) {
                    chrome.Tab.enable(function (error, response) {
                        chrome.close();
                        assert(!error);
                        done();
                    });
                });
            });
        });
        describe('checking the result and specifyng parameters (shorthand)', function () {
            it('should succeed', function (done) {
                Chrome(function(chrome) {
                    chrome.Network.setCacheDisabled({ 'cacheDisabled': true }, function (error, response) {
                        chrome.close();
                        assert(!error);
                        done();
                    });
                });
            });
        });
    });
    
    onload && onload();
});
