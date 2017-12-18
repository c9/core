/*global describe:false, it:false */

"use client";

require(["lib/architect/architect", "lib/chai/chai"], function (architect, chai) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        "plugins/c9.core/ext",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/ui",
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.editors/document",
        "plugins/c9.ide.editors/undomanager",
        {
            consumes: ["Document", "ui"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var Document = imports.Document;
        var ui = imports.ui;
        
        describe('document', function() {
            it('should load it\'s state from the constructor', function(done) {
                var doc = new Document({
                    value: "test"
                });
                
                expect(doc.value).to.equal("test");
                
                done();
            });
            it('should emit value.set when setting the value', function(done) {
                var doc = new Document();
                
                doc.on("setValue", function(e) {
                    expect(e.value).to.equal("test");
                    done();
                });
                
                doc.value = "test";
            });
            it('should emit state.get when calling getState', function(done) {
                var doc = new Document();
                
                doc.on("getState", function(e) {
                    expect(e.doc).to.equal(doc);
                    done();
                });
                
                doc.getState();
            });
            it('should allow anyone to set properties on the meta object', function(done) {
                var doc = new Document();
                doc.meta.test = 1;
                expect(doc.meta.test).to.equal(1);
                done();
            });
            it('should not serialize properties of the meta object starting with a $', function(done) {
                var doc = new Document();
                doc.meta.test = 1;
                doc.meta.$test = 1;
                var state = doc.getState();
                
                expect(state.meta.test).to.ok;
                expect(state.meta.$test).to.not.ok;
                done();
            });
            it('should emit state.set when calling setState', function(done) {
                var doc = new Document();
                
                doc.on("setState", function(e) {
                    expect(e.doc).to.equal(doc);
                    done();
                });
                
                doc.setState({});
            });
            it('should allow anyone to get the session object', function(done) {
                var doc = new Document();
                doc.editor = { type: "test" };
                var session = doc.getSession();
                session.test = 1;
                expect(session.test).to.ok;
                done();
            });
        });
        
        register();
    }
});