/*global describe:false, it:false */

"use client";

require(["lib/architect/architect", "lib/chai/chai"], function (architect, chai) {
    var expect = chai.expect;
    
    var defSettings = { user: { "@bar": "foo", "bar": { "json()": "test" }}, state: { oi: { hi: 10 }}, project: { hi: 0 }};
    var copySettings = JSON.parse(JSON.stringify(defSettings));
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            
            workspaceId: "user/javruben/dev",
            env: "test",
        },
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        "plugins/c9.core/api",
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.ide.ui/lib_apf",
        {
            packagePath: "plugins/c9.core/settings",
            settings: defSettings,
            debug: true
        },
        "plugins/c9.ide.ui/ui",
        {
            consumes: ["settings"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var settings = imports.settings;
        
        describe('settings', function() {
            it('should expose the settings in it\'s model', function(done) {
                expect(settings.model.project).to.deep.equal(defSettings.project);
                expect(settings.model.user).to.deep.equal(defSettings.user);
                expect(settings.model.state).to.deep.equal(defSettings.state);
                done();
            });
            it('should expose the tree via the get method', function(done) {
                expect(settings.get('user/@bar')).to.equal("foo");
                expect(settings.get('user/bar')).to.equal("test");
                done();
            });
            it('should allow altering the tree via the set method', function(done) {
                var v = Math.random().toString();
                settings.set('user/@bar', v);
                expect(settings.get('user/@bar')).to.equal(v);
                
                v = Math.random().toString();
                settings.set('user/bar', v);
                expect(settings.get('user/bar')).to.equal(v);
                
                done();
            });
            it('should allow new settings to be read from json', function(done) {
                settings.read(copySettings);
                settings.once("read", function() {
                    expect(settings.get("user/@bar")).to.equal("foo");
                    done();
                });
            });
            it('should call event listener on tree node', function(done) {
                settings.once("user", function() {
                    expect(settings.get("user/@bar")).to.equal("test");
                    done();
                });
                settings.set("user/@bar", "test");
            });
            it('should allow type conversion for JSON and Booleans', function(done) {
                settings.set('user/@bar', "true");
                expect(settings.getBool('user/@bar')).to.equal(true);
                
                settings.setJson('user/bar', { test: 1 });
                expect(settings.getJson('user/bar')).property("test").to.equal(1);
                
                done();
            });
            it('should set default values only when they are not set already', function(done) {
                settings.setDefaults('user', [
                    ["bar", "10"],
                    ["test", "15"]
                ]);
                expect(settings.exist('user')).to.equal(true);
                expect(settings.get('user/@bar')).to.not.equal("10");
                expect(settings.get('user/@test')).to.equal("15");
                
                done();
            });
            it('should set default values the node doesn\'t exist yet', function(done) {
                settings.setDefaults('new', [
                    ["bar", "10"],
                    ["test", "15"]
                ]);
                expect(settings.exist('new')).to.equal(true);
                expect(settings.get('new/@bar')).to.equal("10");
                expect(settings.get('new/@test')).to.equal("15");
                
                done();
            });
        });
        
        register();
    }
});