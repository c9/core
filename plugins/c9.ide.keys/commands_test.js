/*global describe it before after = */

"use client";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root"], 
  function (architect, chai, baseProc) {
    var expect = chai.expect;
    var assert = chai.assert;
    
    expect.setupArchitectTest([
        "plugins/c9.core/ext",
        "plugins/c9.ide.keys/commands",
        
        // Mock plugins
        {
            consumes: [],
            provides: [
                "settings"
            ],
            setup: expect.html.mocked
        },
        {
            consumes: ["commands"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var cm = imports.commands;
        var command;
        
        var plugin = { addOther : function(){} };
        
        describe('commands', function() {
            beforeEach(function(done) {
                command = {
                    name: "gotoline",
                    bindKey: {
                        mac: "Command-L",
                        win: "Ctrl-L"
                    },
                    called: false,
                    exec: function(editor) { this.called = true; }
                };
                
                cm.addCommand(command, plugin);
                done();
            });
        
            it("should register command", function() {
                expect(cm.commands.gotoline).ok;
                cm.exec("gotoline");
                assert.ok(command.called);
            });
        
            it("should remove command by object", function() {
                cm.removeCommand(command);
        
                cm.exec("gotoline");
                assert.ok(!command.called);
        
                assert.equal(cm.commands.gotoline, null);
            });
        
            it("should remove command by name", function() {
                cm.removeCommand("gotoline");
        
                cm.exec("gotoline");
                assert.ok(!command.called);
        
                assert.equal(cm.commands.gotoline, null);
            });
        
            it("should adding a new command with the same name as an existing one should remove the old one first", function() {
                var cmd = {
                    name: "gotoline",
                    bindKey: {
                        mac: "Command-L",
                        win: "Ctrl-L"
                    },
                    called: false,
                    exec: function(editor) { this.called = true; }
                };
                cm.addCommand(cmd, plugin);
        
                cm.exec("gotoline");
                assert.ok(cmd.called);
                assert.ok(!command.called);
        
                assert.equal(cm.commands.gotoline, cmd);
            });
        
            it("should retrieve the hotkey for a command", function(){
                cm.changePlatform("mac");
                expect(cm.getHotkey("gotoline")).to.equal("Command-L");
                expect(cm.commandManager.gotoline).to.equal("Command-L");
                
                cm.changePlatform("win");
                expect(cm.getHotkey("gotoline")).to.equal("Ctrl-L");
                expect(cm.commandManager.gotoline).to.equal("Ctrl-L");
            })
        });
        
        onload && onload();
    }
});