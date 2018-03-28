var fs = require("fs");
var tmp = require("tmp");
var async = require("async");
var dirname = require("path").dirname;

exports.writeFile = function(path, data, options, callback) {
    if (typeof options == "function")
        return exports.writeFile(path, data, null, options);
 
    async.waterfall([
        tmp.file.bind(null, {dir: dirname(path)}),
        function(tmpFile, fd, nextOrRemoveCallback, next) {
            if (!next) next = nextOrRemoveCallback; // api changed between tmp 0.23 and 0.24
            fs.close(fd, function(err) {
                next(err, tmpFile);
            });
        },
        function(tmpFile, next) {
            fs.writeFile(tmpFile, data, options, function(err) {
                next(err, tmpFile);
            });
        },
        function(tmpFile, next) {
            fs.rename(tmpFile, path, next);
        }
    ], callback);
};