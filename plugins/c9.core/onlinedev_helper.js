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
    var async = require("async");
    var https = require("https");
    var os = require("os");
    
    function initHosts(callback) {
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
    
    function checkPublic(callback) {
        https.request({ host: options.host, path: "/" }, function(res) {
            res.on("data", function() {
                // Required handler
            }).on("end", function() {
                if (res.statusCode === 302)
                    return done(new Error("Please make sure your hosted Cloud9 workspace is public"));
                done();
            });
        }).on("error", function(err) {
            done(new Error("Error connecting to your hosted workspace: " + err.message));
        }).on("timeout", function(err) {
            done(new Error("Error connecting to your hosted workspace: " + err.message));
        }).end();
        
        function done(err) {
            if (!callback)
                return;
            callback(err);
            callback = null;
        }
    }

    async.series([
        initHosts,
        checkPublic,
    ], function(err) {
        register(err, {
            "onlinedev_helper": {}
        });
    });
}
