/*global describe it before after bar */

"use client";

require(["lib/architect/architect", "lib/chai/chai", "/vfs-root"], 
  function (architect, chai, baseProc) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        "plugins/c9.core/ext",
        "plugins/c9.core/util",
        {
            packagePath: "plugins/c9.core/settings",
            settings: "default",
            testing: true
        },
        "plugins/c9.ide.ui/lib_apf",
        "plugins/c9.ide.ui/anims",
        {
            packagePath: "plugins/c9.ide.ui/ui",
            staticPrefix: "plugins/c9.ide.ui"
        },
        {
            packagePath: "plugins/c9.ide.panels/panels",
            staticPrefix: "plugins/c9.ide.layout.classic",
            defaultActiveLeft: "test1",
            defaultActiveRight: "test3"
        },
        "plugins/c9.ide.panels/area",
        "plugins/c9.ide.panels/panel",
        
        {
            consumes: ["panels", "commands", "layout", "Panel"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var panels = imports.panels;
        var Panel = imports.Panel;
        var commands = imports.commands;
        var layout = imports.layout;
        
        var emitter = require("events").EventEmitter;
        var bar2;
        
        var p = [];
        
        var plugin1, plugin2, plugin3;
        
        // var plugin1 = new emitter();
        // var plugin2 = new emitter();
        // var plugin3 = new emitter();
        // var plugins = {};
        
        // var p = [plugin1, plugin2, plugin3];
        // ["red", "green", "blue"].forEach(function(color, i) {
        //     var plugin = p[i];
        //     plugin.getElement = function(){
        //         if (!this.bar) {
        //             this.bar = new apf.bar({ 
        //                 style   : "background:" + color, 
        //                 anchors : "0 0 0 0" 
        //             });
        //         }
        //         return this.bar;
        //     };
        //     plugin.name = "test" + (i + 1);
        //     plugins[plugin.name] = plugin;
        // });
        
        expect.html.setConstructor(function(tab) {
            if (typeof tab == "object")
                return tab.pane.aml.getPage("editor::" + tab.editorType).$ext;
        });
        
        describe('panels', function() {
            before(function(done) {
                layout.findParent();
                
                bar.$ext.style.background = "rgba(220, 220, 220, 0.93)";
                bar.$ext.style.position = "fixed";
                bar.$ext.style.width = "250px";
                bar.$ext.style.left = "";
                bar.$ext.style.height = "";
                bar.$ext.style.right = "20px";
                bar.$ext.style.bottom = "20px";
                bar.$ext.style.top = "50px";
                bar.$ext.style.overflow = "hidden";
                
                bar2 = new apf.bar();
                apf.document.documentElement.appendChild(bar2);
                bar2.$ext.style.background = "rgba(220, 220, 220, 0.93)";
                bar2.$ext.style.position = "fixed";
                bar2.$ext.style.width = "250px";
                bar2.$ext.style.left = "";
                bar2.$ext.style.height = "";
                bar2.$ext.style.right = "270px";
                bar2.$ext.style.bottom = "20px";
                bar2.$ext.style.top = "50px";
                bar2.$ext.style.overflow = "hidden";
      
                layout.findParent = function(x, where) {
                    if (where == "left") return bar2;
                    if (where == "right") return bar;
                    return new apf.bar();
                };
      
                done();
            });
            
            var options1, options2, options3;
            
            describe("register()", function() {
                it("should register a panel on the left side", function(done) {
                    var count = 0;
                    
                    panels.once("showPanelTest1", function() {
                        count++;
                    });
                    panels.once("register", function() {
                        count++;
                    });
                    
                    var pane;
                    var plugin = new Panel("example", [], {
                        index: 100,
                        caption: "Workspace",
                        elementName: "bar",
                        minWidth: 130
                    });
                    plugin.on("draw", function(e) {
                        if (pane) return pane;
                        pane = new apf.bar({
                            id: "bar",
                            style: "background:red", 
                            anchors: "0 0 0 0" 
                        });
                        e.aml.appendChild(pane);
                        plugin.addElement(pane);
                    });
                    plugin.load("test1");
                    plugin.setCommand({
                        name: "toggletree",
                        hint: "being cool",
                        bindKey: { mac: "Command-H", win: "Ctrl-H" }
                    });
                    p.push(plugin);
                    plugin1 = plugin;
                    
                    expect(commands.commands.toggletree).ok;
                    expect(count).equal(2);
                    expect.html(plugin.getElement("bar").$ext).visible;
                    expect.html(bar2.$ext).className("left");
                    done();
                });
                it("should register a second panel on the left side", function(done) {
                    var count = 0;
                    
                    panels.once("showPanelTest2", function() {
                        count++;
                    });
                    panels.once("register", function() {
                        count++;
                    });
                    
                    var pane;
                    var plugin = new Panel("example", [], {
                        index: 100,
                        caption: "Workspace2",
                        elementName: "bar",
                        minWidth: 130
                    });
                    plugin.on("draw", function(e) {
                        if (pane) return pane;
                        pane = new apf.bar({
                            id: "bar",
                            style: "background:red", 
                            anchors: "0 0 0 0" 
                        });
                        e.aml.appendChild(pane);
                        plugin.addElement(pane);
                    });
                    plugin.load("test2");
                    plugin.setCommand({
                        name: "toggletree",
                        hint: "being cool",
                        bindKey: { mac: "Command-H", win: "Ctrl-H" }
                    });
                    p.push(plugin);
                    plugin2 = plugin;
                    
                    expect(count).equal(1);
                    try {
                        plugin2.getElement("bar");
                        throw new Error("bar should not exists");
                    } catch (e) {}
                    expect.html(bar2.$ext).className("left");
                    done();
                });
                it("should register a panel on the right side", function(done) {
                    var count = 0;
                    
                    panels.once("showPanelTest3", function() {
                        count++;
                    });
                    panels.once("register", function() {
                        count++;
                    });
                    
                    var pane;
                    var plugin = new Panel("example", [], {
                        index: 100,
                        caption: "Workspace3",
                        elementName: "bar",
                        minWidth: 130,
                        where: "right"
                    });
                    plugin.on("draw", function(e) {
                        if (pane) return pane;
                        pane = new apf.bar({
                            id: "bar",
                            style: "background:red", 
                            anchors: "0 0 0 0" 
                        });
                        e.aml.appendChild(pane);
                        plugin.addElement(pane);
                    });
                    plugin.load("test3");
                    plugin.setCommand({
                        name: "toggletree",
                        hint: "being cool",
                        bindKey: { mac: "Command-H", win: "Ctrl-H" }
                    });
                    p.push(plugin);
                    plugin3 = plugin;
                    
                    expect(count).equal(2);
                    expect.html(plugin3.getElement("bar").$ext).visible;
                    expect.html(bar.$ext).className("right");
                    done();
                });
            });
            describe("enablePanel() and disablePanel()", function() {
                it("should disable a panel that is enabled", function() {
                    expect.html(plugin1.getElement("bar").$ext).visible;
                    
                    panels.disablePanel("test1");
                    expect.html(plugin1.getElement("bar").$ext).not.visible;
                    expect.html(plugin1.button.$ext).not.visible;
                    expect.html(plugin1.button.$ext.parentNode).visible;
                });
                it("should disable all panels so that the column hides", function(done) {
                    expect.html(plugin3.getElement("bar").$ext).visible;
                    expect.html(plugin3.button.$ext.parentNode).visible;
                    
                    panels.disablePanel("test3");
                    
                    setTimeout(function() {
                        expect.html(plugin3.getElement("bar").$ext).not.visible;
                        expect.html(plugin3.button.$ext).not.visible;
                        expect.html(plugin3.button.$ext.parentNode).not.visible;
                        done();
                    }, 500);
                });
                it("should do nothing when disabling a panel that is already disabled", function() {
                    expect.html(plugin1.getElement("bar").$ext).not.visible;
                    panels.disablePanel("test1");
                    expect.html(plugin1.getElement("bar").$ext).not.visible;
                    expect.html(plugin1.button.$ext).not.visible;
                    expect.html(plugin1.button.$ext.parentNode).visible;
                });
                it("should enable a panel that is disabled", function() {
                    expect.html(plugin1.getElement("bar").$ext).not.visible;
                    panels.enablePanel("test1");
                    expect.html(plugin1.getElement("bar").$ext).not.visible;
                    expect.html(plugin1.button.$ext).visible;
                    expect.html(plugin1.button.$ext.parentNode).visible;
                });
                it("should enable a panel in a hidden column so that it shows again", function() {
                    expect.html(plugin3.getElement("bar").$ext).not.visible;
                    expect.html(plugin3.button.$ext.parentNode).not.visible;
                    
                    panels.enablePanel("test3");
                    
                    expect.html(plugin3.getElement("bar").$ext).not.visible;
                    expect.html(plugin3.button.$ext).visible;
                    expect.html(plugin3.button.$ext.parentNode).visible;
                });
                it("should do nothing when enabling a panel that is already enabled", function() {
                    expect.html(plugin1.getElement("bar").$ext).not.visible;
                    expect.html(plugin1.button.$ext).visible;
                    panels.enablePanel("test1");
                    expect.html(plugin1.getElement("bar").$ext).not.visible;
                    expect.html(plugin1.button.$ext).visible;
                    expect.html(plugin1.button.$ext.parentNode).visible;
                });
            });
            describe("activate(), deactivate(), isActive and activePanels", function(done) {
                before(function() {
                    panels.activate("test2");
                    panels.activate("test3");
                    panels.activate("test1");
                });
                it("should activate a panel that is not active currently", function() {
                    var count = 0;
                    
                    var activePanels = panels.activePanels;
                    var active = panels.panels[activePanels[0]];
                    panels.once("showPanelTest2", function() {
                        count++;
                    });
                    expect.html(active.getElement("bar").$ext, "current").visible;
                    expect.html(plugin2.getElement("bar").$ext, "prior").not.visible;
                    
                    panels.activate("test2", true);
                    expect.html(plugin2.getElement("bar").$ext, "after").visible;
                    expect.html(active.getElement("bar").$ext, "old one").not.visible;
                    expect(count).to.equal(1);
                });
                it("should deactivate an active panel leaving no panel active in it's column", function() {
                    var count = 0;
                    panels.once("hidePanelTest2", function() {
                        count++;
                    });
                    
                    expect.html(plugin2.getElement("bar").$ext, "prior").visible;
                    panels.deactivate("test2", true);
                    expect.html(plugin2.getElement("bar").$ext, "after").not.visible;
                    expect(count).to.equal(1);
                });
                // it("should activate a panel that is autohiding", function(done) {
                // });
                // it("should activate blur a panel that is autohiding", function(done) {
                // });
                it("should activate a panel that is not active and is disabled", function(done) {
                    panels.disablePanel("test1");
                    setTimeout(function() {
                        panels.activate("test1");
                        
                        expect.html(plugin1.button.$ext).not.visible;
                        expect.html(plugin1.button.$ext.parentNode).visible;
                        expect.html(plugin1.getElement("bar").$ext).visible;
                        done();
                    }, 400);
                });
                it("should deactivate an active panel that is disabled", function(done) {
                    panels.deactivate("test1");
                    setTimeout(function() {
                        expect.html(plugin1.button.$ext).not.visible;
                        expect.html(plugin1.button.$ext.parentNode).visible;
                        expect.html(plugin1.getElement("bar").$ext).not.visible;
                        done();
                    }, 400);
                });
                it("should activate a panel that is not active and is disabled in a hidden column", function(done) {
                    panels.disablePanel("test3");
                    setTimeout(function() {
                        panels.activate("test3");
                        
                        expect.html(plugin3.button.$ext).not.visible;
                        expect.html(plugin3.button.$ext.parentNode).not.visible;
                        expect.html(plugin3.getElement("bar").$ext).visible;
                        done();
                    }, 400);
                });
                it("should deactivate an active panel leaving that is disabled in a hidden column", function(done) {
                    panels.deactivate("test3");
                    setTimeout(function() {
                        expect.html(plugin3.button.$ext).not.visible;
                        expect.html(plugin3.button.$ext.parentNode).not.visible;
                        expect.html(plugin3.getElement("bar").$ext).not.visible;
                        done();
                    }, 400);
                });
            });
            describe("unregister()", function() {
                it("should unregister 2 panels", function() {
                    var count = 0;
                    
                    var cb;
                    panels.on("unregister", cb = function() {
                        count++;
                    });
                    
                    panels.unregister(plugin1);
                    panels.unregister(plugin2);
                    
                    expect(Object.keys(panels.panels)).length(1);
                    expect(count).to.equal(2);
                    
                    plugin1.unload();
                    plugin2.unload();
                    
                    panels.off("unregister", cb);
                });
            });
            
            if (!onload.remain) {
                describe("unload()", function() {
                    it('should destroy all ui elements when it is unloaded', function(done) {
                        expect(Object.keys(panels.panels)).length(1);
                        panels.unload();
                        expect(Object.keys(panels.panels)).length(0);
                        expect(bar.$int.innerHTML.trim()).not.ok;
                        expect(bar2.$int.innerHTML.trim()).not.ok;
                        done();
                    });
                });
                
                //@todo Idea: show in the tabs whether the editor is running atm
                // @todo test fs integration
                
                after(function(done) {
                    document.body.style.marginBottom = "";
                    done();
                });
            }
        });
        
        register();
    }
});