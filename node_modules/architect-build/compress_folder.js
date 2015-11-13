var compress = require("./compress");
var fs = require("fs");

function compressDir(dir, opts) {
    if (process.platform == "win32" && dir[0] == "/")
        dir = dir.replace(/(?:\/cygdrive)?\/(\w)\//, "$1:/");
    if (!opts) 
        opts = {};
    console.log("compressing", dir);
    // var t = Date.now()
    var files = fs.readdirSync(dir);
    files.forEach(function(x) {
        var path = dir + "/" + x;
        if (opts.exclude && opts.exclude.test(x))
            return;
        try {
            var stat = fs.statSync(path);
        } catch(e) {
            return console.error(e);
        }
        if (stat.isDirectory()) {
            compressDir(path, opts);
        } else if (/\.js$/.test(x)) {
            var source = fs.readFileSync(path, "utf8");
            if (source[0] != "#") {
                try {
                    // ignore already minified files
                    if (isLikelyCompressed(source))
                        return;
                    source = compress(source, opts).code;
                    fs.writeFileSync(path, source, "utf8");
                } catch(e) {
                    console.error(e);
                }
            }
        }
        // console.log("compressed", dir, t - Date.now());
    });
}

function isLikelyCompressed(source) {
    var i = source.indexOf("\n");
    if (i == -1 || i > 200) // no newlines or far apart
        return true;
}

module.exports = compressDir;
