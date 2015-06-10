"use strict";

plugin.consumes = [
    "db"
];
plugin.provides = [
    "onlinedev_helper"
];

module.exports = plugin;

function plugin(options, imports, register) {
    var db = imports.db;
    var fs = require("fs");
    var child_process = require("child_process");
    
    function init(callback) {
        db.DockerHost.findAll(function(err, servers) {
            if (err) return callback(err);
            
            var hosts = [];
            for (var hostname in servers) {
                if (servers[hostname].internalIP)
                    hosts.push(servers[hostname].internalIP + " " + hostname);
            }
            fs.readFile("/etc/hosts", "utf-8", function(err, file) {
                if (err) return callback(err);
                
                hosts = hosts.filter(function(h) {
                    return true || file.indexOf(h) === -1;
                });
                if (!hosts.length)
                    return;
                child_process.execFile("sudo", ["sh", "-c", "echo '" + hosts.join("\n") + "' >> /etc/hosts"], function(err) {
                    callback(err);
                });
            });
        });
    }

    init(function(err) {
        register(err, {
            "onlinedev_helper": {}
        });
    });
}
