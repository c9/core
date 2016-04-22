"use struct";
"use server";

require("c9/inline-mocha")(module);

var blockDotFiles = require("./block-dot-files");
var async = require("async");
var format = require("util").format;
var assert = require("assert-diff");

var HttpError = require("http-error");

describe(__filename, function() {
    it("should block acess to files starting with a dot", function(done) {

        var err404 = new HttpError.NotFound("File does not exist");

        var cases = [
            {
                label: "Block ../",
                path: "../../../../etc/password",
                err: err404
            }, 
            {
                label: "Block anything starting with a .",
                path: ".ssh/id_rsa",
                err: err404
            }, 
            {
                label: "Block anything starting with a .",
                path: ".git/config",
                err: err404
            }, 
            {
                label: "Block anything with a . in the start of a pathpart",
                path: "deep/.git/config",
                err: err404
            }, 
            {
                label: "Don't block normal paths",
                path: "one/two/three.txt",
            }, 
            {
                label: "Don't block empty paths",
                path: "",
            }, 
            {
                label: "Don't choke on undefineds",
            }, 
        
        ];


        async.each(cases, function(testCase, next) {
            var mockReq = {
                params: {
                    path: testCase.path
                }
            };

            blockDotFiles(mockReq, null, function(err) {
                assert.deepEqual(err, testCase.err, testCase.label);
                next();
            });
        }, done);
    });
});
