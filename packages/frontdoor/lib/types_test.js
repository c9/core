"use strict";

"use server";

require("amd-loader");

var assert = require("assert");

var types = require("./types");

module.exports = {
    "test string array type": function() {
        var t = new types.Array(new types.String());
        
        assert.ok(t.check(["a", "b", "c"]));
        assert.ok(!t.check([12, "b", "c"]));
    },
    
    "test array type": function() {
        var t = new types.Array();
        
        assert.ok(t.check(["a", "b", "c"]));
        assert.ok(t.check([12, "b", "c"]));
        assert.ok(!t.check({}));
        assert.ok(!t.check(12));
        assert.ok(!t.check("juhu"));
    }
};

!module.parent && require("asyncjs").test.testcase(module.exports).exec();