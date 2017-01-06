// TODO docs, see data/breakpoint.js
define(function(require, exports, module) {
    
    var Data = require("./data");
    
    function TestSet(options) {
        this.data = options || {};
        if (!this.data.items)
            this.data.items = [];
        this.type = "testset";
        this.keepChildren = true;
    }
    
    TestSet.prototype = new Data(
        ["passed"], 
        ["items"],
        ["pos", "selpos"]
    );
    
    TestSet.prototype.equals = function(frame) {
        return this.data.label == frame.label;
    };
    
    module.exports = TestSet;
});