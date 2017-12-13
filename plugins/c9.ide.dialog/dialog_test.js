/*global describe, it, after */

"use client";

require(["lib/architect/architect", "lib/chai/chai"], function (architect, chai) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        "plugins/c9.ide.ui/lib_apf",
        {
            packagePath: "plugins/c9.ide.ui/ui",
            staticPrefix: "plugins/c9.ide.ui"
        },
        
        "plugins/c9.core/ext",
        {
            packagePath: "plugins/c9.ide.dialog/dialog",
            staticPrefix: "plugins/c9.ide.layout.classic"
        },

        {
            consumes: ["Dialog"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var d;
        
        describe('layout', function() {
            it('should update items', function(done) {
                d = new Dialog('', [], {
                    elements: [{
                        type: "checkbox",
                        id: "foobar",
                        caption: "foo bar",
                        checked: false
                    }]
                });
                d.show();
                setTimeout(function() {
                    expect.html(d.aml.$html).visible;
                    expect.html(d.aml.$html.querySelector(".cbcontainer:not(.checked)")).visible;
                    expect.html(d.aml.$html).text("foo bar");
                    expect(d.aml.$html.querySelector(".cbcontainer.cbcontainerChecked")).to.not.ok;
                    d.update([{ id: "foobar", caption: "updated", checked: true }]);
                    setTimeout(function() {
                        expect.html(d.aml.$html.querySelector(".cbcontainer.cbcontainerChecked")).to.ok;
                        d.hide();
                        setTimeout(function() {
                            expect.html(d.aml.$html).not.visible;
                            done();
                        });
                    });
                });
            });
        });
        
        if (!onload.remain) {
            describe("unload()", function() {
                it('should destroy all ui elements when it is unloaded', function() {
                    d.unload();
                });
            });
            
            after(function(done) {
                document.body.style.marginBottom = "";
                done();
            });
        }
        
        register();
    }
});