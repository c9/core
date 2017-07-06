// TODO docs, see data/breakpoint.js
define(function(require, exports, module) {
    
    var Data = require("./data");
    
    function Test(options) {
        this.data = options || {};
        if (!this.data.type)
            this.data.type = "test";
    }
    
    Test.prototype = new Data(
        ["passed", "type", "output", "kind", "skip"],
        ["annotations"],
        ["pos", "selpos"]
    );
    
    Test.prototype.equals = function(frame) {
        return this.data.label == frame.label;
    };
    
    module.exports = Test;
});