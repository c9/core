var moduleDeps = require("./module-deps");
var fs = require("fs");
var send = require("send");

exports.transform = function(code, options) {
    if (/^"disable compress"/.test(code))
        return code;
        
    if (options.mode == "babel") {
        var babel = require("babel");
        return babel.transform(code, {
            "presets": [
                ["env", {
                    "targets": {
                        "browsers": ["last 2 versions", "ie >= 11"]
                    }
                }]
            ]
        }).code;
    }
    else if (options.mode == "ts") {
        var ts = require("typescript");
        return ts.transpileModule(code, {
            compilerOptions: {
                downlevelIteration: true,
                suppressExcessPropertyErrors: true,
                removeComments: true,
                module: ts.ModuleKind.CommonJS
            }
        }).outputText;
    }
    else if (options.mode == "buble") {
        return require("buble").transform(code).code;
    }
    else {
        if (moduleDeps.isCJS(code)) {
            code = "define(function(require, exports, module) {" + code + "\n})";
        }
        return code;
    }
};


var cache = Object.create(null);
exports.sendFile = function(req, res, next) {
    var path = req.params.path;
    var filePath = moduleDeps.resolveModulePath(path, req.pathConfig.pathMap);
    
    if (!/\.js$/.test(filePath) || /(browserified|\.min|test\d)\.js$/.test(filePath)) {
        return send(req, filePath.substr(req.pathConfig.root.length))
            .root(req.pathConfig.root)
            .on('error', next)
            .pipe(res);
    }
    
    fs.stat(filePath, function(err, stat) {
        if (err) return next(err);
        var mtime = stat.mtime.valueOf();
        var etag = 'W/"' + stat.size.toString(16) + "-" + mtime.toString(16) + '"';
        
        var noneMatch = req.headers && req.headers['if-none-match'];
        
        if (noneMatch && noneMatch == etag) {
            res.statusCode = 304;
            res.end();
            return;
        }
        
        if (cache[path] && cache[path].etag == etag)
            return sendResponce(cache[path].value);
        res.setHeader("ETag", etag);
        cache[path] = null;
        fs.readFile(filePath, "utf8", function(err, value) {
            if (err)
                return next(err);
            var t = Date.now();
            try {
                value = exports.transform(value, { path: filePath });
            } catch (e) {
                return next(e);
            }
            cache[path] = { value: value, etag: etag };
            var delta = Date.now() - t;
            res.setHeader('Server-Timing', 'transform=' + delta);
            sendResponce(value);
        });
        
        function sendResponce(value) {
            res.setHeader('Content-Type', 'application/javascript');
            
            res.setHeader('Cache-Control', 'public, max-age=0');
            res.setHeader('Last-Modified', stat.mtime.toUTCString());
            res.end(value);
        }
    });
};

