/**
 * Cloud9 assertion support.
 *
 * @copyright 2011, Ajax.org B.V.
 * @license Apache2 <http://www.apache.org/licenses/LICENSE-2.0>
 */
define(function(require, exports, module) {
        
    var assert = function(value, message) {
        if (!value)
            throw new Error("Assertion failed: " + (message || value));
    };
    
    var assertEqual = function(value1, value2, message) {
        if (value1 != value2)
            throw new Error("Assertion failed. " + (message || "") + " got\n  " + value1 + "expected\n  " + value2);
    };
    
    module.exports = function(value, message) {
        assert(value, message);
    };
    
    module.exports.equal = function(value1, value2, message) {
        assertEqual(value1, value2, message);
    };
    
    if (typeof process === "undefined")
        return;
        
    if (process.versions && process.versions['node-webkit'])
        return;
    
    // Use node's assert module
    require(["assert"], function(nodeAssert) {
        assert = nodeAssert;
        assertEqual = nodeAssert.equal;
    });
    
    // Use v8 assert if possible
    if (Error.captureStackTrace) {
        assert = require("assert");
        assertEqual = assert.equal;
    }
});
