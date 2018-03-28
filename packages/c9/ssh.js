/**
 * @copyright  Copyright(c) 2011 Ajax.org B.V. <info AT ajax.org>
 * @author Fabian Jakobs <fabian AT ajax DOT org>
 * @author Mike de Boer <mike AT ajax DOT org>
 * @license http://github.com/ajaxorg/node-sftp/blob/master/LICENSE MIT License
 */

"use strict";

var child_process = require("child_process");
var fs = require("fs");
var tmp = require("tmp");
var debug = require("debug")("ssh");

function quote(str) { 
    return "'" + str.replace(/'/g, "'\\''") + "'";
}

exports.quote = quote;
exports.addProxyCommand = function(args, proxy) {
    var m = proxy.split(":");
    var proxyHost = m[0];
    var proxyPort = parseInt(m[1], 10) || 22;
    var proxyCmd = "ProxyCommand=ssh -W %h:%p " + args.map(quote).join(" ");
    proxyCmd += " -p " + proxyPort + " " + quote(proxyHost);
    args.push(
        "-o", proxyCmd
    );
};

exports.buildArgs = function(prvkeyFile, host, proxy) {
    var args = [
        "-o", "PasswordAuthentication=no",
        "-o", "IdentityFile=" + prvkeyFile,
        "-o", "UserKnownHostsFile=/dev/null",
        "-o", "StrictHostKeyChecking=no",
        "-o", "IdentitiesOnly=yes",
        "-F", "/dev/null", // use empty config file to not depend on local settings
        // force pseudo terminal to make sure that the remote process is killed
        // when the local ssh process is killed
        "-t", "-t",
        "-o", "BatchMode=yes",
        "-o", "ConnectTimeout=10" // default timeout is 2 minutes, which is quite long
    ];
    
    if (proxy)
        exports.addProxyCommand(args, proxy);
    
    if (host) {
        host = host.split(":");
        args.push("-p", host[1] || 22);
        args.push(host[0]);
    }
    
    
    return args;
};

exports.spawnWithKeyFile = function(prvkeyFile, host, proxy, command, args) {
    var sshArgs = exports.buildArgs(prvkeyFile, host, proxy);

    args = sshArgs.concat(command ? [command] : []).concat(args || []);
    debug("executing: ssh " + args.join(" "));

    return child_process.spawn("ssh", args);
};

exports.writeKeyFile = function(prvkey, callback) {
    tmp.tmpName(function(err, filename) {
        if (err) return callback(err);
        
        fs.writeFile(filename, prvkey, function(err) {
            if (err) return callback(err);
    
            fs.chmod(filename, "0600", function(err) {
                callback(err, filename);
            });
        });
    });
};

exports.writeKeyFiles = function(prvkey, pubkey, callback) {
    tmp.tmpName(function(err, filename) {
        if (err) return callback(err);
        
        fs.writeFile(filename, prvkey, function(err) {
            if (err) return callback(err);
    
            fs.chmod(filename, "0600", function(err) {
                if (err) return callback(err);
                
                fs.writeFile(filename + ".pub", pubkey, function(err) {
                    if (err) return callback(err);
    
                    fs.chmod(filename + ".pub", "0600", function(err) {
                        callback(err, filename);
                    });
                });
            });
        });
    });
};

exports.spawn = function(prvkey, host, proxy, command, args, callback) {
    exports.writeKeyFile(prvkey, function(err, filename) {
        if (err) return callback(err);
        
        var child = exports.spawnWithKeyFile(filename, host, proxy, command, args);

        child.on("exit", function(code) {
            fs.unlink(filename, function() {});
        });

        callback(null, child);
    });
};

exports.exec = function(prvkey, host, proxy, command, args, callback) {
    exports.spawn(prvkey, host, proxy, command, args, function(err, child) {
        if (err)
            return callback(err);

        var out = err = "";

        child.stdout.on("data", function (data) {
            out += data;
        });

        child.stderr.on("data", function (data) {
            err += data;
        });

        child.on("exit", function(code) {
            callback(code, out, err);
        });
    });
};

exports.generateKeyPair = function(email, callback) {
    tmp.tmpName(function(err, filename) {
        if (err) return callback(err);
        
        var phrase = "";
    
        var command = "ssh-keygen -t rsa " +
            "-b 4096 " +
            "-f \"" + filename + "\" " +
            "-P \"" + phrase   + "\" " +
            "-C \"" + email  + "\" ";
    
        child_process.exec(command, function (err, stdout, stderr) {
            if (err) return callback(err);
    
            fs.readFile(filename + ".pub", function (err, pubkey) {
                if (err) return callback(err);
    
                fs.readFile(filename, function (err, prvkey) {
                    if (err) return callback(err);
    
                    fs.unlink(filename + ".pub", function() {
                        fs.unlink(filename, function() {
                            callback(null, pubkey.toString(), prvkey.toString());
                        });
                    });
                });
            });
        });
    });
};

exports.validateSSHKey = function(prvkey, host, callback) {
    exports.exec(prvkey, host, "", "", [], function(err, stdout, stderr) {
        debug("out >> " + stdout);
        debug("err >> " + stderr);
        debug(err);
        callback(null, !stderr.match(/Permission denied \(.*publickey/));
    });
};
