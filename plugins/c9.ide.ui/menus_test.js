/*global describe, it, before, expect, after, bar */

"use client";

require(["lib/architect/architect", "lib/chai/chai"], function (architect, chai) {
    var expect = chai.expect;

    expect.setupArchitectTest([
        "plugins/c9.core/ext",
        "plugins/c9.ide.ui/ui",
        "plugins/c9.ide.ui/lib_apf",
        {
            packagePath: "plugins/c9.ide.ui/menus",
            autoInit: true
        },
        
        {
            consumes: ["menus", "Plugin"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var menus = imports.menus;
        var plugin = new imports.Plugin();
        
        expect.html.setConstructor(function(aml) {
            if (typeof aml == "object")
                return aml.$ext;
        });
        
        function countEvents(count, expected, done) {
            if (count == expected) 
                done();
            else
                throw new Error("Wrong Event Count: "
                    + count + " of " + expected);
        }
        
        describe('menus', function() {
            before(function(done) {
                bar.$ext.style.position = "fixed";
                bar.$ext.style.left = "20px";
                bar.$ext.style.right = "300px";
                bar.$ext.style.top = "20px";
                bar.$ext.style.height = "33px";
                
                menus.on("getEditor", function() {
                    return {};
                });
                menus.on("focusEditor", function() {
                    // do nothing
                });
      
                done();
            });
            
            describe("setRootMenu() addItemByPath() expand() collapse() click()", function() {
                it('should create root menus stacked and ordered properly', function(done) {
                    menus.setRootMenu("Tools", 700, plugin);
                    menus.setRootMenu("Goto", 600, plugin);
                    menus.setRootMenu("View", 500, plugin);
                    menus.setRootMenu("Find", 400, plugin);
                    menus.setRootMenu("Selection", 300, plugin);
                    menus.setRootMenu("Edit", 200, plugin);
                    menus.setRootMenu("File", 100, plugin);
                    
                    var menubar = menus.getElement("menubar");
                    expect.html(menubar, "invalid order")
                        .text(/File[\s\S]*Edit[\s\S]*Selection[\s\S]*Find[\s\S]*View[\s\S]*Goto[\s\S]*Tools/);
                    
                    expect(menubar.$ext.parentNode).to.ok;
                    
                    done();
                });
                it('should create submenus stacked and ordered properly', function(done) {
                    var count = 0;
                    
                    menus.addItemByPath("File/~", new apf.divider(), 100, plugin);
                    menus.addItemByPath("File/Quit", new apf.item({
                        onclick: function() { count++; }
                    }), 200, plugin);
                    menus.addItemByPath("File/Hello", new apf.item({
                    }), 10, plugin);
                    
                    var menu = menus.expand("File");

                    expect.html(menu, "exist and visible").to.exist.and.is.visible;
                    expect.html(menu, "invalid order").text(/Hello[\s\S]*Quit/);

                    menus.click("File/Quit");
                    
                    expect.html(menu, "exist and visible").is.not.visible;
                    
                    countEvents(count, 1, done);
                });
                it('should create submenus of depth 5', function(done) {
                    var count = 0;
                    
                    menus.addItemByPath("File/First", new apf.item(), plugin);
                    menus.addItemByPath("File/First/Second", new apf.item(), plugin);
                    menus.addItemByPath("File/First/Second/Third", new apf.item(), plugin);
                    menus.addItemByPath("File/First/Second/Third/Fourth", new apf.item(), plugin);
                    
                    menus.addItemByPath("File/First/Second/Third/Fourth/Fifth", 
                        new apf.item({
                            onclick: function() { count++; }
                        }), 200, plugin);

                    var menu = menus.expand("File/First/Second/Third/Fourth");

                    expect.html(menu, "exist and visible").to.exist.and.is.visible;

                    menus.collapse("File");
                    menus.click("File/First/Second/Third/Fourth/Fifth");
                    
                    expect.html(menu, "exist and not visible").is.not.visible;
                    
                    countEvents(count, 1, done);
                });
            });
            
            describe("enable() disable() remove() get()", function() {
                it('should disable items when the menu is already visible', function(done) {
                    var first = menus.get("File/First");
                    var hello = menus.get("File/Hello");
                    
                    menus.expand("File");
                    menus.disableItem("File/First");
                    expect.html(first.item, "first disabled").has.className("disabled");
                    menus.enableItem("File/First");
                    expect.html(first.item, "first disabled").not.have.className("disabled");
                    
                    menus.disableItem("File/Hello");
                    expect.html(hello.item, "hello disabled").has.className("disabled");
                    menus.enableItem("File/Hello");
                    expect.html(hello.item, "hello disabled").not.have.className("disabled");
                    
                    done();
                });
                it('should disable items when the menu is not yet visible', function(done) {
                    var first = menus.get("File/First");
                    var hello = menus.get("File/Hello");
                    
                    menus.disableItem("File/First");
                    expect.html(first.item, "first disabled").has.className("disabled");
                    
                    menus.disableItem("File/Hello");
                    expect.html(hello.item, "hello disabled").has.className("disabled");
                    
                    menus.expand("File");

                    menus.enableItem("File/First");
                    expect.html(first.item, "first disabled").not.have.className("disabled");
                    
                    menus.enableItem("File/Hello");
                    expect.html(hello.item, "hello disabled").not.have.className("disabled");
                    
                    done();
                });
                it('should remove and item when the menu is already visible', function(done) {
                    var hello = menus.get("File/Hello");
                    
                    menus.expand("File");
                    menus.remove("File/Hello");
                    expect(hello.item.$amlDestroyed, "hello not exist").to.ok;
                    expect(menus.get("File/Hello").item).not.ok;
                    expect(menus.get("File/Hello").menu).not.ok;
                    menus.collapse("File");
                    
                    done();
                });
                it('should remove an item and it\'s subtree when the menu is not yet visible', function(done) {
                    var first = menus.get("File/First");
                    var second = menus.get("File/First/Second");
                    var third = menus.get("File/First/Second/Third");
                    var fourth = menus.get("File/First/Second/Third/Fourth");
                    var fifth = menus.get("File/First/Second/Third/Fourth/Fifth");
                    
                    menus.remove("File/First");
                    
                    expect(first.item.$amlDestroyed, "first not exist").to.ok;
                    expect(second.item.$amlDestroyed, "second not exist").to.ok;
                    expect(third.item.$amlDestroyed, "third not exist").to.ok;
                    expect(fourth.item.$amlDestroyed, "fourth not exist").to.ok;
                    expect(fifth.item.$amlDestroyed, "fifth not exist").to.ok;
                    
                    expect(menus.get("File/First").item).not.ok;
                    expect(menus.get("File/First").menu).not.ok;
                    expect(menus.get("File/Second").item).not.ok;
                    expect(menus.get("File/Second").menu).not.ok;
                    expect(menus.get("File/Second/Third").item).not.ok;
                    expect(menus.get("File/Second/Third").menu).not.ok;
                    expect(menus.get("File/Second/Third/Fourth").item).not.ok;
                    expect(menus.get("File/Second/Third/Fourth").menu).not.ok;
                    expect(menus.get("File/Second/Third/Fourth/Fifth").item).not.ok;
                    expect(menus.get("File/Second/Third/Fourth/Fifth").menu).not.ok;
                    
                    menus.expand("File");
                    menus.collapse("File");
                    
                    done();
                });
            });
            
            if (!onload.remain) {
               after(function(done) {
                    menus.unload();
                   
                   document.body.style.marginBottom = "";
                   done();
               });
            }
        });
        
        register();
    }
});