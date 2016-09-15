"use strict";

"use server";

var assert = require("assert");
var ssh = require("./ssh");
function arrayEqual(a, b) {
    assert.equal(a.length, b.length);
    for (var i = 0; i < a.length; i++)
        assert.equal(a[i], b[i]);
}

module.exports = {
    
    "test quote" : function() {
        assert.equal(ssh.quote("a'b'c"), "'a'\\''b'\\''c'");
        assert.equal(ssh.quote("abc"), "'abc'");
    },
    
    "test buildArgs": function() {
        var expectedArgs = [
            "-o","PasswordAuthentication=no",
            "-o","IdentityFile=/key",
            "-o","UserKnownHostsFile=/dev/null",
            "-o","StrictHostKeyChecking=no",
            "-o","IdentitiesOnly=yes",
            "-F","/dev/null","-t","-t",
            "-o","BatchMode=yes",
            "-o","ConnectTimeout=10",
            "-p",22,"foo12@124.255.121.12"
        ];
        var proxyCmd = 'ProxyCommand=ssh -W %h:%p \'-o\' \'PasswordAuthentication=no\' \'-o\' \'IdentityFile=/key\' \'-o\' \'UserKnownHostsFile=/dev/null\' \'-o\' \'StrictHostKeyChecking=no\' \'-o\' \'IdentitiesOnly=yes\' \'-F\' \'/dev/null\' \'-t\' \'-t\' \'-o\' \'BatchMode=yes\' \'-o\' \'ConnectTimeout=10\' -p 22 \'24@100.20.12.12\'';
        var args = ssh.buildArgs('/key', "foo12@124.255.121.12");
        arrayEqual(args, expectedArgs);
        
        args = ssh.buildArgs('/key', "foo12@124.255.121.12", "24@100.20.12.12");
        expectedArgs.splice(expectedArgs.length - 3, 0, "-o", proxyCmd);
        arrayEqual(args, expectedArgs);
        
        args = ssh.buildArgs('/key', "foo12@124.255.121.12:1888", "24@100.20.12.12:88788");
        expectedArgs[expectedArgs.length - 2] = 1888;
        expectedArgs[expectedArgs.length - 4] = expectedArgs[expectedArgs.length - 4].replace(22, 88788);
        arrayEqual(args, expectedArgs);
    },
};

!module.parent && require("asyncjs").test.testcase(module.exports).exec();
