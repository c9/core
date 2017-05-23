/**
 * jsonalyzer invocation helper used by {@link language.worker_util#execAnalysis}
 *
 * @copyright 2015, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var PluginBase = require("plugins/c9.ide.language.jsonalyzer/worker/jsonalyzer_base_handler");
var paths = require("path");
var fs = require("fs");
var crypto = require("crypto");
var pathSep = require("path").sep;
var TEMPDIR = process.env.TMP || process.env.TMPDIR || process.env.TEMP || '/tmp';

var handler = module.exports = Object.create(PluginBase);
var workspaceDir;
var homeDir;
 
handler.extensions = [];

handler.languages = [];

handler.maxCallInterval = handler.CALL_INTERVAL_MIN;

handler.init = function(options, callback) {
    workspaceDir = options.workspaceDir;
    homeDir = options.homeDir;
    callback();
};

handler.invoke = function(path, doc, ast, options, callback) {
    options.mode = options.mode || "stdin";
    if (options.overrideLine != null) {
        var lines = doc.toString().split(/\r\n|\n|\r/);
        if (lines[options.overrideLineRow] !== options.overrideLine) {
            lines[options.overrideLineRow] = options.overrideLine;
            doc = lines.join("\n");
        }
    }
    if (options.cwd)
        options.cwd = makeAbsolute(options.cwd);
    path = makeAbsolute(path);
    
    if (options.mode === "stdin")
        return this.$doInvoke(path, doc, options, callback);

    var tempdir = options.mode === "tempfile"
        ? TEMPDIR
        : options.cwd || workspaceDir;
    var tempFile = getTempFile(tempdir) + paths.extname(path);
    var that = this;
    fs.writeFile(tempFile, doc, "utf8", function(err) {
        if (err) {
            err.code = "EFATAL";
            return done(err);
        }
        that.$doInvoke(tempFile, doc, options, done);
        
        function done(err, stdout, stderr, meta) {
            callback(err, stdout, stderr, meta);
            
            fs.unlink(tempFile, function(err2) {
                if (err2) console.error("Error during cleanup:", err2);
            });
        }
    });
};

handler.$doInvoke = function(path, doc, options, callback) {
    var start = Date.now();
    this.$lint(
        options.command,
        (options.args || []).map(function(arg) {
            return String(arg).replace(/\$FILE\b/, path);
        }),
        options.mode === "stdin" && doc,
        options,
        function(err, stdout, stderr, originalErr) {
            callback(err || originalErr, stdout, stderr, Date.now() - start);
        }
    );
};
        
function getTempFile(path) {
    return path + pathSep + ".~c9_invoke_" + crypto
        .randomBytes(6)
        .toString("base64")
        .slice(0, 6)
        .replace(/[+\/]+/g, "");
}

function makeAbsolute(path) {
    if (path[0] === "~")
        return homeDir + path.substr(1);
    if (path[0] === "/")
        return path;
    return workspaceDir + "/" + path;
}

});
