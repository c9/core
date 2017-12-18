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
            packagePath: "plugins/c9.ide.dialog.common/error",
            staticPrefix: "plugins/c9.ide.layout.classic"
        },

        {
            consumes: ["dialog.error"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var error = imports["dialog.error"];
        
        describe('layout', function() {
            it('should show an error notification', function(done) {
                error.show("Test");
                setTimeout(function() {
                    expect.html(document.querySelector(".errorlabel")).visible;
                    expect.html(document.querySelector(".errorlabel")).text(/Test/);
                    done();
                }, 250);
            });
            it('should hide the error notification', function(done) {
                error.hide(function() {
                    expect.html(document.querySelector(".errorlabel")).not.visible;
                    done();
                });
            });
        });
        
        if (!onload.remain) {
            describe("unload()", function() {
                it('should destroy all ui elements when it is unloaded', function() {
                    error.unload();
                });
            });
            
            //@todo Idea: show in the tabs whether the editor is running atm
            // @todo test fs integration
            
            after(function(done) {
                document.body.style.marginBottom = "";
                done();
            });
        }
        
        register();
    }
});