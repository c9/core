/*global describe, it, before, expect, after, bar */

"use client";

require(["lib/architect/architect", "lib/chai/chai"], function (architect, chai) {
    var expect = chai.expect;

    expect.setupArchitectTest([
        "plugins/c9.core/ext",
        "plugins/c9.core/util",
        "plugins/c9.ide.ui/docklayout",
        
        // Mock plugins
        {
            consumes: [],
            provides: ["c9"],
            setup: expect.html.mocked
        },
        {
            consumes: ["DockableLayout", "DockableWidget", "DockableAbsoluteRenderer"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var DockableLayout = imports.DockableLayout;
        var DockableWidget = imports.DockableWidget;
        var DockableAbsoluteRenderer = imports.DockableAbsoluteRenderer;
        
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
        
        var container;
        
        describe('DockableLayout', function() {
            before(function(){
                container = document.createElement("div");
                document.body.appendChild(container);
                
                container.style.position = "absolute";
                container.style.left = "20px";
                container.style.right = "20px";
                container.style.top = "20px";
                container.style.bottom = "20px";
                // container.style.height = "500px";
                container.style.backgroundColor = "rgba(0,0,0,0.1)";
                
                // container.onmousedown = function(e) {
                //     var x = e.x;
                //     document.onmousemove = function(e) {
                //         container.style.width = (e.x - (x - e.x) - 20) + "px";
                //         layout.resize();
                //     }
                // }
            });
            
            var layout = "";
            
            describe("Basic Layout", function(){
                it('should add widgets to the layout', function(done) {
                    layout = new DockableLayout("Ajax.org", [], {
                        parent: container,
                        renderer: new DockableAbsoluteRenderer()
                    });
                    layout.load("DockLayout1");
                    
                    layout.columns = "200px, 1, 100px";
                    layout.rows = "50px, 100px, 1, 1";
                    layout.edge = "10 10 10 10"; // "20 30 40 50";
                    layout.padding = 5;
                    
                    layout.add(new DockableWidget("", []), 0, 0, 1, 3);
                    layout.add(new DockableWidget("", []), 0, 3, 3, 1);
                    layout.add(new DockableWidget("", []), 1, 0, 2, 1);
                    layout.add(new DockableWidget("", []), 1, 1, 1, 1);
                    layout.add(new DockableWidget("", []), 1, 2, 1, 1);
                    layout.add(new DockableWidget("", []), 2, 1, 1, 2);
                    
                    // done();
                });
            });
            
            if (!onload.remain) {
               after(function(done) {
                   
                   document.body.style.marginBottom = "";
                   done();
               });
            }
        });
        
        onload && onload();
    }
});