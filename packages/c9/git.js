"use strict";

var Fs = require("fs");
var Path = require("path");
var exec = require("child_process").exec;
exports.parse = require("./scm_url_parse");

exports.isValidUrl = function(url) {
    return !!exports.parse(url);
};


exports.getHeadRevision = function(path, callback) {
    exec("git rev-parse HEAD", {
        cwd: path
    }, function(code, stdout, stderr) {
        if (code)
            return callback(stderr.toString());

        return callback(null, stdout.toString().split("\n")[0]);
    });
};

exports.getHeadRevisionSync = function(path) {
    var ref = Fs.readFileSync(Path.join(path, ".git/HEAD"), "ascii");

    ref = ref.replace(/^ref\:\s+/, "").trim();

    // if it already is a commit id
    if (ref.match(/^[a-z0-9]{40}$/)) {
        return ref;
    }

    var revision;
    try {
        revision = Fs.readFileSync(Path.join(path, ".git", ref), "ascii");
    }
    catch (ex) {
        // the link may be pruned by git, try the info/refs file
        var info = Fs.readFileSync(Path.join(path, ".git/info/refs"), "ascii");
        var lines = info.split(/[\r\n]+/);
        for (var parts, i = 0, l = lines.length; i < l; ++i) {
            parts = lines[i].split(/[\s\t]+/);
            if (parts[1] == ref) {
                revision = parts[0];
                break;
            }
        }
    }

    // trim new lines
    revision = revision.trim();

    return revision;
};

exports.getHeadBranch = function(path, callback) {
    exec("git rev-parse --abbrev-ref HEAD", {
        cwd: path
    }, function(code, stdout, stderr) {
        if (code)
            return callback(stderr.toString());

        return callback(null, stdout.toString().split("\n")[0]);
    });
};
