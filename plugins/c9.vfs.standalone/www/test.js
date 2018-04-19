define(function(require, exports, module) {
    "use strict";
    
    var chai = require("lib/chai/chai");
    var mockPlugins = require("./mock_plugins.js");
    var architect = require("lib/architect/architect");

    chai.Assertion.includeStack = true; // enable stack trace in errors
    var expect = chai.expect;
    expect.mockPlugins = mockPlugins;
    expect.setupArchitectTest = setupArchitectTest;

    function html(path, message) {
        var htmlNode;
        if (typeof path != "object" || !(path instanceof HTMLElement))
            htmlNode = html.constr(path);
        else
            htmlNode = path;
        var not = false;
        
        function testOk(value) {
            if (not)
                expect(value, message || path).not.ok;
            else
                expect(value, message || path).ok;
            not = false;
        }
        
        var obj = {
            get is() { return obj; },
            get has() { return obj; },
            get have() { return obj; },
            get and() { return obj; },
            get to() { return obj; },
            get not() { not = true; return obj; },
            
            get ok() { testOk(htmlNode); return obj; },
            get exists() { testOk(htmlNode); return obj; },
            get exist() { testOk(htmlNode); return obj; },
            get node() { return htmlNode; },
            
            get visible() {
                testOk(htmlNode && (htmlNode.offsetWidth || htmlNode.offsetHeight));
                return obj;
            },
            
            text: function(text) {
                testOk(htmlNode.textContent.match(text));
                return obj;
            },
            
            icon: function(icon) {
                testOk(htmlNode.innerHTML.indexOf(icon) > -1);
                return obj;
            },
            
            className: function(name) {
                testOk(htmlNode.className.indexOf(name) > -1);
                return obj;
            },
            child: function(query) { 
                if (typeof query == "number") {
                    if (query < 0)
                        query = htmlNode.children.length + query;
                    htmlNode = htmlNode.children[query];
                } else {
                    htmlNode = htmlNode.querySelector(query); 
                }
                return obj;
            }
        };
        return obj;
    }
    expect.html = html;
    expect.html.setConstructor = function(fn) {
        html.constr = fn;
    };
     
    function setupArchitectTest(config, _, options) {
        if (options && options.mockPlugins) {
            config.push({
                consumes: options.existingPlugins || [],
                provides: options.mockPlugins,
                setup: mockPlugins
            });
        }
        architect.resolveConfig(config, function(err, config) {
            /*global describe it before after */
            if (err) throw err;
            var app = architect.createApp(config, function(err, app) {
                if (err && err.unresolved && !config.unresolved) {
                    mockPlugins({}, {}, function(a, mockServices) { 
                        err.missingMock = err.unresolved.filter(function(x) {
                            return !mockServices[x];
                        });
                        config.unresolved = err.unresolved.filter(function(x) {
                            return mockServices[x];
                        });
                    });
                    if (err.missingMock.length) {
                        console.error("Missing mock services for " + err.missingMock);
                    } else {
                        return setupArchitectTest(config, architect, {
                            mockPlugins: config.unresolved,
                            existingPlugins: err.resolved
                        });
                    }
                }
                if (typeof describe == "function") {
                    describe('app', function() {
                        it('should load test app', function(done) {
                            expect(err).not.ok;
                            done();
                        });
                    });
                }
                setTimeout(function() {
                    onload && onload();
                });
            });
            if (app) {
                app.on("service", function(name, plugin) { 
                    if (!plugin.name && typeof plugin != "function")
                        plugin.name = name; 
                });
                app.rerun = function() {
                    setupArchitectTest(config, architect);
                };
                window.app = app;
            }
            return app;
        });
    }
});