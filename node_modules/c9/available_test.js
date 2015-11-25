#!/usr/bin/env node

"use strict";
"use server";

require("c9/setup_paths");
require("c9/inline-mocha")(module);

var assert = require("assert-diff");
var available = require("./available");

describe(__filename, function() {
    it("Should do basic math for shared keys in the input", function() {
        var cases = [{
            label: "When total < used",
            total: {
                ram: 10,
                disk: 5,
            },
            used: {
                ram: 20,
                disk: 5,
            },
            avail: {
                ram: -10,
                disk: 0
            }
        }, {
            label: "When keys in total not in used",
            total: {
                ram: 10,
                disk: 5,
                foo: 10,
            },
            used: {
                ram: 10,
                disk: 5,
            },
            avail: {
                ram: 0,
                disk: 0,
                foo: 10
            }
        }, {
            label: "When keys in used not in total",
            total: {
                ram: 10,
                disk: 5,
            },
            used: {
                foo: 10,
                ram: 10,
                disk: 5,
            },
            avail: {
                ram: 0,
                disk: 0,
                foo: -10
            }
        }, {
            label: "When all looks normal",
            total: {
                ram: 10,
                disk: 5,
            },
            used: {
                ram: 5,
                disk: 2,
            },
            avail: {
                ram: 5,
                disk: 3,
            }
        }, {
            label: "With a little extra",
            total: {
                ram: 10,
                disk: 6,
            },
            used: {
                ram: 10,
                disk: 5,
            },
            extra: {
                ram: 3,
                disk: 3
            },
            avail: {
                ram: 3,
                disk: 4,
            }
        }, {
            label: "But extra is not more",
            total: {
                ram: 10,
                disk: 10,
            },
            used: {
                ram: 5,
                disk: 5,
            },
            extra: {
                ram: 5,
                disk: 3
            },
            avail: {
                ram: 10,
                disk: 8,
            }
        }];

        cases.forEach(function(testCase) {
            var avail = available(testCase.total, testCase.used, testCase.extra);
            assert.deepEqual(avail, testCase.avail, testCase.label);
        });
    });
});