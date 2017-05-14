var fs = require('fs');

function sanitize(code){
  return code.replace(/require\(.+\/?isbinaryfile[\"\']\)/g, "isbinaryfile")
             .replace("module.exports = function(bytes, size) {", "isbinaryfile = function(bytes, size) {")
             
             .replace(/require\(.+\/?minimatch[\"\']\)/g, "minimatch")
             .replace(/require\(.+\/?ignorer[\"\']\)/g, "Ignorer")
             .replace(/require\(.+\/?mergesort[\"\']\)/g, "mergesort")
             .replace(/require\(.+\/?options[\"\']\)/g, "parser")
             .replace(/require\(.+\/?walkdir[\"\']\)/g, "walker")
             .replace(/require\(.+\/?finalizer[\"\']\)/g, "Finalizer")
             
             .replace("#!/usr/bin/env node", "");
}

function concat(opts) {
    var fileList = opts.src;
    var destPath = opts.dest;
    var vfsDestPath = opts.vfsDest;

    var src = fileList.map(function(filePath){
        return fs.readFileSync(filePath, "utf-8");
    });

    src = src.join("\n");

    // resolve requires inline
    src = "var isbinaryfile, lrucache;\n" + sanitize(src);

    fs.writeFileSync(destPath, src, "utf-8");

    // do some magic to turn this into a vfs extension
    var vfsPrefix = "module.exports = function (vfs, register) { \n" +
                    "\tregister(null, { \n" + 
                    "\texecute: function (passedArgs, callback) { \n";

    var vfsSuffix = "\t}\n" +
                    "  \t}); \n" +
                    "};";

    var vfsSrc = vfsPrefix 
                     + src.replace("parser.parseArgs()", "parser.parseArgs(passedArgs)")
                     + vfsSuffix;

    fs.writeFileSync(vfsDestPath, vfsSrc, "utf-8");

    return { src: src, vfsSrc: vfsSrc };
}

function uglify(src, destPath) {
     var uglify = require("uglify-js");
     
     fs.writeFileSync(destPath, uglify.minify(src, {fromString: true}).code, "utf-8");
     console.log(destPath +' built.');
}


try {
    fs.mkdirSync("build");
}
catch (e) { }

var concatedFiles = concat({
    src : ["node_modules/isbinaryfile/index.js", 
           "node_modules/sigmund/sigmund.js", 
           "node_modules/minimatch/minimatch.js",
           "node_modules/lru-cache/lib/lru-cache.js", 
           "lib/mergesort.js", 
           "lib/ignorer.js", 
           "lib/options.js", 
           "lib/finalizer.js", 
           "lib/walkdir.js",
           "bin/nak"],
    dest : 'build/nak.concat.js',
    vfsDest : 'build/nak.vfs.concat.js'
});

uglify(concatedFiles.src, 'build/nak.min.js');
uglify(concatedFiles.vfsSrc, 'build/nak.vfs.min.js');

console.log("and we're done");