/*global describe:false, it:false */

"use client";

require(["lib/architect/architect", "lib/chai/chai", "events"], function (architect, chai, events) {
    var expect = chai.expect;
    var EventEmitter = events.EventEmitter;
    
    expect.setupArchitectTest([
        "plugins/c9.core/ext",
        "plugins/c9.ide.ui/ui",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.editors/document",
        "plugins/c9.ide.editors/undomanager",
        "plugins/c9.ide.editors/editors",
        "plugins/c9.ide.editors/editor",
        {
            consumes: ["editors", "Editor"],
            provides: [],
            setup: main
        }
    ], architect, {
        mockPlugins: ["menus", "util", "clipboard", "c9"]
    });
    
    function main(options, imports, register) {
        var editors = imports.editors;
        var Editor = imports.Editor;
        
        var extensions = ["txt"];
        function NewEditor() {
            var plugin = new Editor("Ajax.org", [], extensions);
            plugin.freezePublicAPI({ success: 1 });
            return plugin;
        }
        
        describe('editors', function() {
            it('should register an editor when the it\'s name is set', function(done) {
                editors.on("register", function reg() {
                    done();
                    editors.off("register", reg);
                });
                
                var handle = editors.register("test", "Test", NewEditor, extensions);
                handle.unload();
            });
            it('should call the unregister event when the plugin is unloaded', function(done) {
                var handle = editors.register("test", "Test", NewEditor, extensions);
                
                editors.on("unregister", function reg() {
                    done();
                    editors.off("unregister", reg);
                });
                
                handle.load("test");
                handle.unload();
            });
            it('should allow for the creation and discovery of editors', function(done) {
                var handle = editors.register("test", "Test", NewEditor, extensions);
                
                expect(editors.findEditor("test"), "findEditor")
                    .to.equal(NewEditor);
                expect(editors.findEditorByFilename("test.txt"), "findEditorByFilename")
                    .to.equal(NewEditor);
                editors.createEditor("test", function(err, editor) {
                    if (err) throw err;
                    
                    expect(editor, "createEditor")
                        .property("success").to.equal(1);
                    
                    handle.load("test");
                    handle.unload();
                    
                    done();
                });
            });
        });
        
        register();
    }
});