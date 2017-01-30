"use client";


define(function(require, exports, module) {
    main.consumes = ["plugin.test", "myplugin"];
    main.provides = [];
    return main;

    function main(options, imports, register) {
        var test = imports["plugin.test"];
        var myplugin = imports.myplugin;
        
        var describe = test.describe;
        var it = test.it;
        var before = test.before;
        var after = test.after;
        var beforeEach = test.beforeEach;
        var afterEach = test.afterEach;
        var assert = test.assert;
        var expect = test.expect;
        
        /***** Initialization *****/
        
        describe(myplugin.name, function() {
            this.timeout(2000);
            
            it("shows a helloworld div", function() {
                myplugin.show();
                expect(document.querySelector(".helloworld")).to.ok;
                expect(document.querySelector(".helloworld").innerText).to.equal("all");
            });
            
            it("hides the div", function() {
                myplugin.hide();
                expect(document.querySelector(".helloworld").offsetHeight).to.not.ok;
            });
        });
        
        register(null, {});
    }
});