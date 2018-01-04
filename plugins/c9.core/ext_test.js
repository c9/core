/*global describe:false, it:false */

"use client";

require(["lib/architect/architect", "lib/chai/chai"], function (architect, chai) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        "plugins/c9.core/ext",
        {
            consumes: ["ext", "Plugin"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var ext = imports.ext;
        var Plugin = imports.Plugin;
        
        describe('plugin', function() {
            this.timeout(1000);
            
            it('should expose the constructor arguments', function(done) {
                var deps = [1, 2];
                var plugin = new Plugin("Ajax.org", deps);
                
                expect(plugin.developer).to.equal("Ajax.org");
                expect(plugin.deps).to.equal(deps);
                
                done();
            });
            it('should only allow setting the api once', function(done) {
                var plugin = new Plugin("Ajax.org", []);
                
                var func = function(a) {};
                plugin.freezePublicAPI({
                    test: func
                });
                
                plugin.test = "nothing";
                expect(plugin.test).to.equal(func);
                
                done();
            });
            it('should give access to the event emitter before freezing the api', function(done) {
                var plugin = new Plugin("Ajax.org", []);
                var emit = plugin.getEmitter();
                plugin.freezePublicAPI({});
                plugin.on("test", function() { done(); });
                emit("test");
            });
            it('should not give access to the event emitter after freezing the api', function(done) {
                var plugin = new Plugin("Ajax.org", []);
                plugin.freezePublicAPI({});
                expect(plugin.getEmitter).to.not.ok;
                done();
            });
            it('should call load event when name is set', function(done) {
                var plugin = new Plugin("Ajax.org", []);
                plugin.on("load", function() { done(); });
                plugin.name = "test";
            });
            it('should only allow the name to be set once', function(done) {
                var plugin = new Plugin("Ajax.org", []);
                plugin.name = "test";
                expect(function() { plugin.name = "test2";}).to.throw("Plugin Name Exception");
                done();
            });
            it('should call sticky event when adding handler later', function(done) {
                var plugin = new Plugin("Ajax.org", []);
                var emit = plugin.getEmitter();
                plugin.name = "test";
                emit.sticky("ready");
                plugin.on("ready", done);
            });
            it('should call sticky event for each plugin added', function(done) {
                var plugin = new Plugin("Ajax.org", []);
                var plugin2 = new Plugin("Ajax.org", []);
                var plugin3 = new Plugin("Ajax.org", []);
                var emit = plugin.getEmitter();
                plugin.name = "test";
                plugin2.name = "test2";
                plugin3.name = "test3";
                emit.sticky("create", {}, plugin2);
                emit.sticky("create", {}, plugin3);
                
                var z = 0;
                plugin.on("create", function() {
                    if (++z == 2) done();
                    else if (z > 2) 
                        throw new Error("Called too often initially");
                });
            });
            it('should call sticky event only for the non-unloaded plugins', function(done) {
                var plugin = new Plugin("Ajax.org", []);
                var plugin2 = new Plugin("Ajax.org", []);
                var plugin3 = new Plugin("Ajax.org", []);
                var emit = plugin.getEmitter();
                plugin.name = "test";
                plugin2.name = "test2";
                plugin3.name = "test3";
                emit.sticky("create", {}, plugin2);
                emit.sticky("create", {}, plugin3);
                
                var z = 0, q = 0, timer;
                plugin.on("create", function() {
                    if (++z == 2) {
                        plugin3.unload();
                        
                        plugin.on("create", function() {
                            ++q;
                            clearTimeout(timer);
                            timer = setTimeout(function() {
                                if (q == 1) done();
                                else throw new Error("Called too often after unload");
                            });
                        });
                    }
                    else if (z > 2) {
                        throw new Error("Called too often initially");
                    }
                });
            });
            it('should call unload event when unload() is called', function(done) {
                var plugin = new Plugin("Ajax.org", []);
                var loaded = false;
                plugin.on("unload", function error() { 
                    if (!loaded)
                        throw new Error("shouldn't call unload");
                    done();
                });
                plugin.unload();
                loaded = true;
                plugin.load();
                plugin.unload();
            });
            it('should call disable event when disable() is called', function(done) {
                var plugin = new Plugin("Ajax.org", []);
                plugin.on("disable", function() { done(); });
                plugin.enable();
                plugin.disable();
            });
            it('should call enable event when enable() is called', function(done) {
                var plugin = new Plugin("Ajax.org", []);
                plugin.on("enable", function() { done(); });
                plugin.enable();
            });
            it('should destroy all assets when it\'s unloaded', function(done) {
                var plugin = new Plugin("Ajax.org", []);
                
                var count = 0;
                function check() {
                    if (++count == 4)
                        done();
                }
                
                var el1 = { destroy: check, childNodes: []};
                var el2 = { destroy: check, childNodes: []};
                
                plugin.load();
                
                plugin.on("load", check);
                expect(plugin.listeners("load").length).to.equal(1);
                
                plugin.addElement(el1, el2);
                plugin.addEvent(plugin, "load", check);
                plugin.addOther(check);
                
                plugin.unload();
                
                if (!plugin.listeners("load").length)
                    check();
            });
            
            //@todo haven't tested getElement
        });
        
        describe('ext', function() {
            it('should register a plugin when the plugin\'s name is set', function(done) {
                var plugin = new Plugin("Ajax.org", []);
                expect(plugin.registered).to.equal(false);
                
                ext.on("register", function reg() {
                    expect(plugin.registered).to.equal(true);
                    done();
                    ext.off("register", reg);
                });
                
                plugin.name = "test";
            });
            it('should call the unregister event when the plugin is unloaded', function(done) {
                var plugin = new Plugin("Ajax.org", []);
                plugin.name = "test";
                
                ext.on("unregister", function unreg() {
                    expect(plugin.registered).to.equal(false);
                    done();
                    ext.off("register", unreg);
                });
                
                plugin.unload();
            });
            it('should return false on unload() when the dependency tree is not in check', function(done) {
                var plugin = new Plugin("Ajax.org", []);
                plugin.name = "test";
                var plugin2 = new Plugin("Ajax.org", ["test"]);
                plugin2.name = "test2";
                
                expect(plugin.unload()).to.equal(false);
                
                done();
            });
        });
        
        register();
    }
});