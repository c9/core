/*global describe it before after */

"use client";

require([
    "lib/architect/architect", 
    "lib/chai/chai",
    "/vfs-root"
], function (architect, chai, baseProc) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        {
            packagePath: "plugins/c9.core/c9",
            workspaceId: "ubuntu/ip-10-35-77-180",
            startdate: new Date(),
            debug: true,
            hosted: true,
            local: false,
            davPrefix: "/"
        },
        
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/forms",
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.ui/menus",
        "plugins/c9.ide.ui/anims",
        "plugins/c9.ide.threewaymerge/threewaymerge",
        {  
            packagePath: "plugins/c9.core/settings",
            testing: true
        },
        "plugins/c9.core/api.js",
        "plugins/c9.ide.keys/commands",
        "plugins/c9.ide.keys/editor",
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
        "plugins/c9.ide.ace/ace",
        {
            packagePath: "plugins/c9.ide.preferences/preferences",
            staticPrefix: "plugins/c9.ide.preferences"
        },
        "plugins/c9.ide.preferences/preferencepanel",
        "plugins/c9.ide.preferences/general",
        {
            packagePath: "plugins/c9.fs/fs",
            baseProc: baseProc
        },
        "plugins/c9.fs/proc",
        "plugins/c9.vfs.client/vfs_client",
        "plugins/c9.vfs.client/endpoint",
        "plugins/c9.ide.auth/auth",
        
        // Mock plugins
        {
            consumes: ["apf", "ui", "Plugin"],
            provides: [
                "menus", "layout", "watcher", "save", "clipboard",
                "dialog.confirm", "dialog.alert", "auth.bootstrap", "info",
                "dialog.error"
            ],
            setup: expect.html.mocked
        },
        {
            consumes: ["Plugin", "tabManager", "preferences", "settings", "ui", "util", "commands", "preferences.general"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var tabs = imports.tabManager;
        var ui = imports.ui;
        var prefs = imports.preferences;
        var settings = imports.settings;
        var commands = imports.commands;
        var Plugin = imports.Plugin;
        var general = imports["preferences.general"];
        
        expect.html.setConstructor(function(tab) {
            if (typeof tab == "object")
                return tab.pane.aml.getPage("editor::" + tab.editorType).$ext;
        });
        
        describe('preferences', function() {
            before(function(done) {
                apf.config.setProperty("allow-select", false);
                apf.config.setProperty("allow-blur", false);
                
                bar.$ext.style.height = "66%";
                
                document.body.style.marginBottom = "66%";
                
                tabs.once("ready", function(){
                    prefs.activate(general);
                    done();
                });
            });
            
            var plugin = new Plugin();
            
            describe("addSettings", function(){
                this.timeout(10000);
                
                it('should open a pane with just an editor', function(done) {
                    settings.set("user/general/keybindings/@preset", "custom");
                    
                    prefs.add({
                        "General" : {
                            "Application" : {},
                            "Run / Debug" : {}
                        },
                        "Code Tools" : {
                            "Language Support" : {},
                            "Code Tools" : {},
                            "Code Formatter" : {}
                        }
                    }, plugin);
                    
                    [
                        {
                            name: "resume",
                            group: "Run & Debug",
                            hint: "resume the current paused process",
                            bindKey: {mac: "F8", win: "F8"}
                        },
                        {
                            name: "stepinto",
                            group: "Run & Debug",
                            hint: "step into the function that is next on the execution stack",
                            bindKey: {mac: "F11", win: "F11"}
                        },
                        {
                            name: "stepover",
                            group: "Run & Debug",
                            hint: "step over the current expression on the execution stack",
                            bindKey: {mac: "F10", win: "F10"}
                        },
                        {
                            name: "stepout",
                            group: "Run & Debug",
                            hint: "step out of the current function scope",
                            bindKey: {mac: "Shift-F11", win: "Shift-F11"}
                        },
                        {
                            name: "testing",
                            group: "Code Editor",
                            hint: "step out of the current function scope",
                            bindKey: {mac: "Shift-F11", win: "Shift-F11"}
                        }
                    ].forEach(function(cmd) {
                        commands.addCommand(cmd, prefs);
                    })
                    
                    tabs.openEditor("preferences", function(err, tab) {
                        expect(tabs.getTabs()).length(1);
                        
                        done();
                    });
                });
            });
            describe("unload()", function(){
               this.timeout(10000)
               
               it('should unload the preferences', function(done) {
                   general.unload();
                   prefs.unload();
                   tabs.getTabs()[0].editor.unload();
                   tabs.getTabs()[0].unload();
                   tabs.unload();
                   done();
               });
           });
           
           after(function(done) {
               document.body.style.marginBottom = "";
               done();
           });
        });
        
        onload && onload();
    }
});