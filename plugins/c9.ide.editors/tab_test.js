/*global describe:false, it:false */

"use client";

require(["lib/architect/architect", "lib/chai/chai"], function (architect, chai) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        "plugins/c9.core/ext",
        "plugins/c9.core/util",
        "plugins/c9.ide.dialog/dialog",
        "plugins/c9.ide.dialog.common/alert",
        "plugins/c9.ide.dialog.common/alert_internal",
        "plugins/c9.ide.ui/ui",
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.editors/tab",
        "plugins/c9.ide.editors/document",
        "plugins/c9.ide.ui/focus",
        "plugins/c9.ide.editors/undomanager", // Mock plugins
        {
            consumes: ["apf", "ui", "Plugin"],
            provides: [
                "commands", "settings"
            ],
            setup: expect.html.mocked
        },
        
        //Mock Plugins
        {
            consumes: [],
            provides: ["c9"],
            setup: expect.html.mocked
        },
        {
            consumes: ["ui", "Plugin"],
            provides: ["layout"],
            setup: expect.html.mocked
        },
        {
            consumes: ["Tab", "ui", "Document"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var Tab = imports.Tab;
        var Document = imports.Document;
        var ui = imports.ui;
        
        var page1, page2;
        var pane = {}
        pane.aml = {
            cloud9pane: pane,
            setAttribute: function(){},
            getPages: function(){ return [page1, page2] },
            getPage: function(){ return pane.active.aml },
            set: function(tab){pane.active = tab.cloud9tab},
            localName: "tab",
            insertBefore: function(){
                if (this.oninsert) this.oninsert();
            }
        };
        
        // @todo all these tests for tabs without a path
        
        describe('tab', function() {
            it('should load it\'s state from the constructor', function(done) {
                page1 = new Tab({
                    editorType: "test",
                    document: {
                        value: "test",
                        title: "test",
                        tooltip: "test"
                    },
                    path: "test/test/test.txt",
                    pane: pane,
                    init: true,
                    active: true
                });
                
                expect(page1.document.value, "docvalue").to.equal("test");
                expect(page1.document.changed).to.equal(false);
                expect(page1.path).to.equal("test/test/test.txt");
                expect(page1.editorType).to.equal("test");
                expect(page1.title, "title").to.equal("test");
                expect(page1.tooltip, "tooltip").to.equal("test");
                
                done();
            });
            it('should set changed to true when a change occurs', function(done) {
                page1.document.undoManager.add({undo:function(){}, redo:function(){}})
                expect(page1.document.changed).to.equal(true);
                done();
            });
            it('should be able to bind itself to a pane', function(done) {
                 page2 = new Tab({
                    editorType: "test",
                    document: { value: "test" },
                    path: "test/test/test.txt"
                });
                
                pane.aml.oninsert = function(){
                    done();
                    pane.aml.oninsert = null;
                }
                
                page2.attachTo(pane);
            });
            it('should be able to set itself active', function(done) {
                page2.activate();
                expect(pane.active).to.equal(page2);
                done();
            });
            it('should emit getState when calling getState', function(done) {
                page2.on("getState", function(e) {
                    expect(e.state.active).to.equal(true);
                    done();
                });
                
                page2.getState();
            });
            it('should destroy all ui elements when it is unloaded', function(done) {
                page1.unload();
                page2.unload();
                
                expect(page1.aml.$amlDestroyed).to.ok;
                expect(page2.aml.$amlDestroyed).to.ok;
                
                done();
            });
        });
        
        onload && onload();
    }
});