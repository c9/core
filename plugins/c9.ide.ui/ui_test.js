/*global describe:false, it:false */

"use client";

require(["lib/architect/architect", "lib/chai/chai"], function (architect, chai) {
    var expect = chai.expect;
    
    var skin = '<a:skin xmlns:a="http://ajax.org/2005/aml"><a:bar name="bar">\
        <a:style>\
            body{background:rgb(250, 255, 255);} \
            .rect{border:4px solid red;width:300px;height:100px;}\
        </a:style><a:presentation><a:main caption="text()">\
            <div class="rect"> </div>\
        </a:main></a:presentation></a:bar>\
    </a:skin>';
    
    expect.setupArchitectTest([
        "plugins/c9.core/ext",
        "plugins/c9.ide.ui/lib_apf",
        {
            packagePath: "plugins/c9.ide.ui/ui",
            staticPrefix: "plugins/c9.ide.ui",
            packedThemes: false
        },
        // Mock plugins
        {
            consumes: [],
            provides: ["c9"],
            setup: expect.html.mocked
        },
        {
            consumes: ["ui", "Plugin"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var ui = imports.ui;
        var Plugin = imports.Plugin;
        
        describe('ui', function() {
            it('should provide an easy way to create xml nodes', function(done) {
                expect(ui.n("<test />").xml()).to.equal("<test/>");
                done();
            });
            it('should provide a way to insert CSS into the browser', function(done) {
                var plugin = new Plugin("", []);
                plugin.load("test");
                
                var before = ui.getStyle(document.body, "backgroundColor");
                ui.insertCss("body{background:rgb(255, 0, 0)}", plugin);
                expect(ui.getStyle(document.body, "backgroundColor")).to.equal("rgb(255, 0, 0)");
                plugin.unload();
                expect(ui.getStyle(document.body, "backgroundColor")).to.equal(before);
                done();
            });
            it('should provide a way to insert a skin into the aml', function(done) {
                var plugin = new Plugin("", []);
                plugin.load("test");
                
                var before = ui.getStyle(document.body, "backgroundColor");
                ui.insertSkin({data: skin, name: "test"}, plugin);
                expect(ui.getStyle(document.body, "backgroundColor")).to.equal("rgb(250, 255, 255)");
                plugin.unload();
                // @TODO Unloading of skins is not supported atm
                // expect(ui.getStyle(document.body, "backgroundColor")).to.equal(before);
                done();
            });
            it('should provide a way to load html in an html parent - sync', function(done) {
                var plugin = new Plugin("", []);
                plugin.load("test");
                
                ui.insertHtml(document.body, "<div id='ruben'>asdads</div>", plugin);
                expect(document.querySelector("#ruben")).to.ok;

                plugin.unload();
                expect(document.querySelector("#ruben")).to.not.ok;
                
                done();
            });
            it('should provide a way to load markup with aml in a plugin - sync', function(done) {
                var plugin = new Plugin("", []);
                plugin.load("test");
                
                ui.insertSkin({data: skin, name: "test"}, plugin);
                ui.insertMarkup(apf.document.documentElement, "<a:application xmlns:a='http://ajax.org/2005/aml'><a:bar skinset='test'>test</a:bar></a:application>", plugin);
                ui.insertMarkup(apf.document.documentElement, "<a:application xmlns:a='http://ajax.org/2005/aml'><a:button id='test' skin='bar' skinset='test'>test</a:button></a:application>", plugin);

                var test = plugin.getElement("test");
                expect(test).property("localName").to.equal("button");
                expect(test.getWidth()).to.equal(308);

                plugin.unload();
                try {
                    plugin.getElement("test");
                    throw new Error("test should not exist");
                }
                catch (e) {}
                
                expect(test).property("$amlDestroyed").to.equal(true);
                
                done();
            });
            it('should provide a way to load markup with aml in a plugin - async', function(done) {
                var plugin = new Plugin("", []);
                plugin.load("test");
                
                plugin.getElement("test", function(test) {
                    expect(test).property("localName").to.equal("button");
                    expect(test.getWidth()).to.equal(308);
                    
                    plugin.unload();
                    try {
                        plugin.getElement("test");
                        throw new Error("test should not exist");
                    }
                    catch (e) {}
                    
                    expect(test).property("$amlDestroyed").to.equal(true);
                    
                    done();
                });
                
                ui.insertSkin({data: skin, name: "skinset"}, plugin);
                ui.insertMarkup(apf.document.documentElement, "<a:application xmlns:a='http://ajax.org/2005/aml'><a:bar skinset='skinset'>test</a:bar></a:application>", plugin);
                ui.insertMarkup(apf.document.documentElement, "<a:application xmlns:a='http://ajax.org/2005/aml'><a:button id='test' skin='bar' skinset='skinset'>test</a:button></a:application>", plugin);
            });
        });
        
        onload && onload();
    }
});