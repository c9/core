define(function(require, exports, module) {
    
    exports.B = require("./b").B;
    exports.D = require("d").D;
    exports.A = "A";
    
    exports.text = require("text!./c.txt");
});