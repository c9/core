/*global describe:false, it:false */

"use client";

require(["lib/architect/architect", "lib/chai/chai", "sinon"], function(architect, chai, sinon) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            workspaceId: "johndoe/dev",
            startdate: new Date(),
            debug: true,
            hosted: true,
            local: false,
        },
        
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/lib_apf",
        {
            packagePath: "plugins/c9.core/settings",
            testing: true
        },
        {
            packagePath: "plugins/c9.ide.ui/ui",
            staticPrefix: "plugins/c9.ide.ui"
        },
        "plugins/c9.ide.editors/document",
        "plugins/c9.ide.editors/undomanager",
        "plugins/c9.ide.editors/editors",
        "plugins/c9.ide.editors/editor",
        "plugins/c9.ide.editors/tabmanager",
        "plugins/c9.ide.ui/focus",
        "plugins/c9.ide.editors/pane",
        "plugins/c9.ide.editors/tab",
        "plugins/c9.ide.terminal/terminal",
        "plugins/c9.ide.terminal.monitor/monitor",
        
        {
            consumes: ["tabManager", "c9", "terminal", "terminal.monitor", "terminal.monitor.message_view"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var tabs = imports.tabManager;
        var monitor = imports["terminal.monitor"];
        var messageView = imports["terminal.monitor.message_view"];

        var messageMatchers = require("plugins/c9.ide.terminal.monitor/message_matchers")(imports.c9);
        var messages = messageMatchers.messages;
        
        describe("Message handler", function() {
            var formatMessageSpy;
            beforeEach(function() {
                if (formatMessageSpy) formatMessageSpy.restore();
                formatMessageSpy = sinon.spy(messageView, "show");
            });
            it("catches generic (listening at) wrong IP", function() {
                monitor.handleMessage("Server listening at http://localhost:3000/");
                expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
            });
            it("catches generic (listening at) wrong port", function() {
                monitor.handleMessage("Server listening at http://0.0.0.0:8081/");
                expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
            });
            it("catches generic (listening at) wrong port / IP", function() {
                monitor.handleMessage("Server listening at http://127.0.0.1:8081/");
                expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
            });
            it("catches generic (listening at) running", function() {
                monitor.handleMessage("Server listening at http://0.0.0.0:8080/");
                expect(formatMessageSpy.calledWith(messages.generic.appRunning)).to.equal(true);
            });
            it("catches generic (is listening at) wrong port", function() {
                monitor.handleMessage("Server is listening at http://localhost:3000/");
                expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
            });
            it("catches generic (is listening at) running", function() {
                monitor.handleMessage("Server is listening at http://0.0.0.0:8080/");
                expect(formatMessageSpy.calledWith(messages.generic.appRunning)).to.equal(true);
            });
            it("catches generic (is running on) wrong port", function() {
                monitor.handleMessage("Server is running on http://localhost:3000/");
                expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
            });
            it("catches generic (is running on) running", function() {
                monitor.handleMessage("Server is running on http://0.0.0.0:8080/");
                expect(formatMessageSpy.calledWith(messages.generic.appRunning)).to.equal(true);
            });
            it("catches ionic wrong port", function() {
                monitor.handleMessage("Running dev server: http://0.0.0.0:8081/");
                expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
            });
            it("catches ionic running", function() {
                monitor.handleMessage("Running dev server: http://0.0.0.0:8080/");
                expect(formatMessageSpy.calledWith(messages.generic.appRunning)).to.equal(true);
            });
            it("catches ionic running with different $IP", function() {
                monitor.handleMessage("Running dev server: http://127.101.12.0:8080/");
                expect(formatMessageSpy.calledWith(messages.generic.appRunning)).to.equal(true);
            });
            it("catches meteor wrong port", function() {
                monitor.handleMessage("App running at: http://localhost:3000/");
                expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
            });
            it("catches meteor running", function() {
                monitor.handleMessage("App running at: http://0.0.0.0:8080/");
                expect(formatMessageSpy.calledWith(messages.generic.appRunning)).to.equal(true);
            });
            it("catches Webrick running", function() {
                monitor.handleMessage("mostafaeweda@demo-project\r\n\
                    INFO  WEBrick::HTTPServer#start: pid=5462 port=8080");
                expect(formatMessageSpy.calledWith(messages.generic.appRunning)).to.equal(true);
            });
            it("catches Webrick wrong port", function() {
                monitor.handleMessage("mostafaeweda@demo-project\r\n\
                    INFO  WEBrick::HTTPServer#start: pid=5462 port=3000");
                expect(formatMessageSpy.calledWith(messages.rails.wrongPortIP)).to.equal(true);
            });
            it("catches rails/sinatra address in use error", function() {
                monitor.handleMessage("WARN  TCPServer Error: Address already in use - bind(2)");
                expect(formatMessageSpy.calledWith(messages.rails.wrongPortIP)).to.equal(true);
            });
            it("catches node address in use error", function() {
                monitor.handleMessage("events.js:48\n\
                        throw arguments[1]; // Unhandled 'error' event\n\
                        Error: listen EADDRINUSE\n\
                        at errnoException (net.js:670:11)\n\
                        at Array.0 (net.js:771:26)\n\
                        at EventEmitter._tickCallback (node.js:190:38)\n");
                expect(formatMessageSpy.calledWith(messages.generic.addressInUse)).to.equal(true);
            });
            it("catches generic port already in use error", function() {
                monitor.handleMessage("Error: That port is already in use\n");
                expect(formatMessageSpy.calledWith(messages.generic.addressInUse)).to.equal(true);
            });
            it("catches generic port already in use error (15454)", function() {
                monitor.handleMessage("Failed to open socket on port 15454\n");
                expect(formatMessageSpy.calledWith(messages.generic.debuggerPortInUse)).to.equal(true);
            });
            it("catches node permission error", function() {
                monitor.handleMessage("events.js:48\n\
                        throw arguments[1]; // Unhandled 'error' event\n\
                        Error: listen EACCESS\n\
                        at errnoException (net.js:670:11)\n\
                        at Array.0 (net.js:771:26)\n\
                        at EventEmitter._tickCallback (node.js:190:38)\n");
                expect(formatMessageSpy.calledWith(messages.generic.addressInUse)).to.equal(true);
            });
            
            it("catches django error", function () {
                monitor.handleMessage("Error: You don't have permission to access that port.\n");
                expect(formatMessageSpy.calledWith(messages.django.wrongPortIP)).to.equal(true);
            });
            
            it("catches grunt-serve running", function() {
                monitor.handleMessage("Server is running on port 8080...\n");
                expect(formatMessageSpy.calledWith(messages.generic.appRunning)).to.equal(true);
            });
            
            it("catches grunt-serve wrong port", function() {
                monitor.handleMessage("Server is running on port 9000...\n");
                expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
            });
            
            it("catches grunt-reload running", function() {
                monitor.handleMessage("Proxying http://0.0.0.0:8080/");
                expect(formatMessageSpy.calledWith(messages.generic.appRunning)).to.equal(true);
            });
            
            it("catches jekyll wrong port", function() {
                monitor.handleMessage("Server address: http://0.0.0.0:4000/");
                expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
            });
            
            it("catches jekyll running", function() {
                monitor.handleMessage("Server address: http://0.0.0.0:8080/");
                expect(formatMessageSpy.calledWith(messages.generic.appRunning)).to.equal(true);
            });
            
            it("catches grunt-reload wrong port", function() {
                monitor.handleMessage("Proxying http://0.0.0.0:9999/");
                expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
                monitor.handleMessage("Proxying http://localhost:12345/");
                expect(formatMessageSpy.calledWith(messages.generic.wrongPortIP)).to.equal(true);
            });
            
            it("catch reload server not supported", function() {
                monitor.handleMessage("reload server running at http://localhost:35729\n");
                expect(formatMessageSpy.calledWith(messages.generic.noLiveReload)).to.equal(true);
                monitor.handleMessage("reload server running at http://0.0.0.0:9000\n");
                expect(formatMessageSpy.calledWith(messages.generic.noLiveReload)).to.equal(true);
            });
            
        });
            
            
        if (!onload.remain) {
            after(function(done) {
                tabs.unload();
                
                document.body.style.marginBottom = "";
                done();
            });
        }
       
        
        register();
    }
});
