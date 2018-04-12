/*global describe it before after beforeEach afterEach define*/
"use strict";
"use server";
"use mocha";

require("c9/inline-mocha")(module);

var assert = require("assert-diff");
var reJSON = require("./json-with-re");

describe(__filename, function(){
    it("should encode regular expressions", function() {
        assert.deepEqual(reJSON.stringify({ foo: /foo/ }), '{"foo":"__REGEXP /foo/"}');
        assert.deepEqual(reJSON.stringify({ foo: /foo\//gi }), "{\"foo\":\"__REGEXP /foo\\\\//gi\"}");
    });
    it("should decode regular expressions", function() {
        assert.deepEqual(reJSON.parse('{"foo":"__REGEXP /foo/"}'), { foo: /foo/ });
        assert.deepEqual(reJSON.parse("{\"foo\":\"__REGEXP /foo\\\\//gi\"}"), { foo: /foo\//gi });
    });
    it("should deal with null values", function() {
         var o = {
             foo: null,
             bar: /dd/
         };
         assert.deepEqual(reJSON.parse(reJSON.stringify(o)), o);
    });
});
