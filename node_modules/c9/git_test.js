"use strict";

"use server";

var assert = require("assert");
var git = require("./git");

module.exports = {
    
    "test validate urls" : function() {
        assert.equal(git.isValidUrl("git@github.com:fjakobs/lispjs.git"), true);
        assert.equal(git.isValidUrl("https://fjakobs@github.com/fjakobs/lispjs.git"), true);
        assert.equal(git.isValidUrl("fjakobs@github.com/fjakobs/lispjs.git"), false);
        assert.equal(git.isValidUrl("ftp://fjakobs@github.com/fjakobs/lispjs.git"), false);
        assert.equal(git.isValidUrl("git://github.com/fjakobs/lispjs.git"), true);
        assert.equal(git.isValidUrl("github.com:fjakobs/lispjs.git"), false);
        assert.equal(git.isValidUrl("134"), false);
        assert.equal(git.isValidUrl("god"), false);
    },
    
    "test get head revision": function(next) {
        git.getHeadRevision(__dirname, function(err, rev) {
            assert.equal(err, null);
            assert.equal(rev.length, 40);
            next();
        });
    },
    
    "test get head revision sync": function(next) {
        var rev = git.getHeadRevisionSync(__dirname + "/../../");
        assert.equal(rev.length, 40);
        
        next();
    },
    
    "test get head branch": function(next) {
        git.getHeadBranch(__dirname, function(err, rev) {
            assert.equal(err, null);
            next();
        });
    }
};

!module.parent && require("asyncjs").test.testcase(module.exports).exec();
