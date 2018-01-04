/*global describe, it */

"use client";

require(["lib/architect/architect", "lib/chai/chai"], function (architect, chai) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        "plugins/c9.core/ext",
        "plugins/c9.core/http-xhr",
        {
            consumes: ["http"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var http = imports.http;
        
        describe('http', function() {
            it('should request a url via XHR', function(done) {
                http.request("plugins/c9.core/http-xhr.js", function(err, data, res) {
                    if (err) throw (err.message || err);
                    
                    expect(res.status).to.equal(200);
                    expect(data.indexOf("define(function(require, module, exports) {"))
                        .to.equal(0);
                    done();
                });
            });
        });
        
        register();
    }
});