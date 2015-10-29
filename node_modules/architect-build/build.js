var async = require("async");
var fs = require("fs");
var mkdirp = require("mkdirp");
var moduleDeps = require("./module-deps");
var path = require("path");

function build(config, opts, callback){
    if (!opts.configFile) {
        opts.configFile = "\nrequire.plugins = "
            + JSON.stringify(config, null, 4)
            + ";\n";
    }
    
    // Load all architect modules as main files
    var mains = [], options = {};
    config.forEach(function(pkg){
        if (typeof pkg == "string") {
            mains.push(pkg);
        }
        else if (pkg.packagePath) {
            mains.push({
                id: pkg.packagePath,
                parent: {id: "#root"},
                plugin: pkg
            });
            options[pkg.packagePath] = pkg;
        }
    });
    
    // Add additional packages
    (opts.additional || []).forEach(function(relPath, i){
        mains.unshift(typeof relPath === "object" ? relPath : {
            id      : null,
            path    : path.resolve(__dirname + "/" + relPath),
            order   : -i,
            literal : true
        });
    });
    
    if (!mains.length)
        return callback(new Error("Config contains no packages"));
    
    // Add Architect
    if (!opts.noArchitect) {
        mains.push("lib/architect/architect");
    }
    
    // Add RequireJS
    if (opts.withRequire) {
        mains.unshift({
            id: null,
            path: path.resolve(__dirname + "/build_support/mini_require.js"),
            order: -1000,
            noRequire: true,
            mini_require: true
        });
    }
        
    if (opts.moduleLoadUrl) {
        opts.transforms = opts.transforms || [];
        opts.transforms.push(function(module) {
            if (module.mini_require) {
                module.source = module.source.replace(/^\s*var\s+MODULE_LOAD_URL\s*=\s*["'].*["']/m, 'var MODULE_LOAD_URL = "' + opts.moduleLoadUrl + '"');
            }
        });
    }
    
    // Find their deps
    var stream = moduleDeps(mains, opts);
    stream.on("end", function() {
        // sort modules
        var sources = [];
        var modules = opts.modules;
        var added = Object.create(null);
        function addModule(id) {
            var pkg = modules[id] || {};
            if (added[pkg.id])
                return;
            added[pkg.id] = true;
            if (!pkg.source)
                return;
            if (pkg.deps)
                pkg.deps.forEach(addModule);
            sources.push(pkg);
            pkg.pkgIndex = sources.length;
            added[pkg.id] = true;
        }
        Object.keys(modules).forEach(addModule);
        
        // Filter sources
        (opts.filter || []).forEach(function(filter){
            sources = sources.filter(function(pkg){
                return pkg.id.indexOf(filter) !== 0;
            });
        });
        
        sources.sort(function(a, b) {
            return ((a.order|0) - (b.order|0)) || (a.pkgIndex - b.pkgIndex);
        });

        if (opts.compileLess)
            return compileLess(opts, sources, callback);
        
        if (opts.stripLess)
            stripLess(sources);
            
        
        var afterRead =  typeof opts.afterRead == "function"
            ? [opts.afterRead]
            : opts.afterRead || [];
        afterRead.push(rewriteDefines);
            
        afterRead.forEach(function(f) {
            sources = f(sources, opts) || sources;
        });
        
        // Include the architect config at the end in the same way as the tests
        if (!opts.noArchitect)
            includeArchitect(opts, sources);
        
        
        opts.quiet || console.log("Processing " + sources.length + " files.");
        opts.quiet || console.log("Compressing: ", opts.compress);
        
        // Concatenate all files using uglify2 with source maps
        var result;
        if (opts.compress)
            result = require("./compress")(sources, opts);
        else {
            result = {
                code : sources.map(function(src){ return src.source.trim(); }).join("\n\n") + "\n",
                map : ""
            };
        }
        
        result.sources = sources;
        if (opts.beforeWrite) {
            opts.beforeWrite.forEach(function(f) {
                f(result, opts) || sources;
            });
        }

        if (typeof opts.outputFolder == "string") {
            writeToFile(result, opts, callback);
        }
        else {
            callback(null, result);
        }
    });
    stream.on("error", function(e) {
        callback(e);
    });
}

function createOutputFolder(opts, cb) {
    var output = (opts.outputFolder || ".") + "/" + (opts.outputFile || "");
    output = path.dirname(output);
    mkdirp(output, cb);
}

function compileLess(opts, sources, callback) {
    var less = stripLess(sources);
    var code = [];
    var cache = opts.cache;
    if (cache && !cache.less)
        cache.less = Object.create(null);

    async.forEachSeries(less, function(file, next) {
        var plugin = file.pkg.parent.plugin || {};
        
        if (file.pkg.id.match(/(keyframes|font-awesome)\.css$/)) {
            code.push(file.code
                .replace(/@\{image-path\}/g, plugin.staticPrefix + "/images")
                .replace(/@\{icon-path\}/g, plugin.staticPrefix + "/icons")
                .replace(/@\{base-path\}/g,  plugin.staticPrefix)
            );
            
            return next();
        }
        var root = path.join(opts.basepath, (plugin.packagePath ? path.dirname(plugin.packagePath) : "/"));
        
        var cacheKey;
        if (cache && opts.lessLibCacheKey) {
            cacheKey = [opts.lessLibCacheKey, plugin.staticPrefix, file.pkg.id].join("|");
            if (cache.less[cacheKey]) {
                code.push(cache.less[cacheKey]);
                return next();
            }
        }
        
        compileLessFragment(file.code, opts.lessLibs, root, plugin.staticPrefix, file.path, opts.compress, function(err, css) {
            if (err)
                return callback(err);
            
            if (cacheKey)
                cache.less[cacheKey] = css;
            code.push(css);
            next();
        });
    }, function(err) {
        if (opts.lessLibs.css) {
            code.push(opts.lessLibs.css);
        }
        callback(err, {
            code: code.join("\n")
        });
    });
}


function compileLibRules(libs, ctx, next) {
    // Libs is an array of paths; adds property .compiled to keep a state(cache).
    if (libs.compiled)
        return next(null, libs.compiled.rules, libs.compiled.css);

    var src = lessPathLib(libs.staticPrefix) + libs.join("\n");

    var less = require("less");
    less.parse(src, ctx, function(err, root, imports, options) {
        if (err) return next(err);
        
        toCss(root, imports, options, function(err, css) {
            if (err) return next(err);
                
            libs.compiled = {
                rules: root.rules,
                css: css,
            };
    
            next(null, libs.compiled.rules, libs.compiled.css);
        });
    });
}

function compileLessFragment(css, libs, root, staticPrefix, path, compress, callback) {
    var less = require("less");
    var ctx = {
        paths: ["/"],
        filename: root + '/unknown.less',
        compress: !!compress
    };

    compileLibRules( libs, ctx, function(err, libRules, libCss) {
        if (err) return callback(err);
        
        var baseLib = lessPathLib(staticPrefix || libs.staticPrefix);
        var code = baseLib + "\n" + css;
        
        // Complete paths, but not subdirectories like foo/images/bar.png
        code = code.replace(/(["(])(images|icons)\//g, "$1" + staticPrefix + "/$2/");
    
        console.log("[Less] compiling ", path || "skin", root);
        
        less.parse(code, ctx, function (err, tree, imports, options) {
            if (err) return callback(err);
            tree.rules = libRules.concat(tree.rules);
            
            toCss(tree, imports, options, function(err, css) {
                if (err) return callback(err);
                
                if (css.substring(0, libCss.length) == libCss) {
                    css = css.substr(libCss.length);
                } else {
                    console.warn("couldn't strip default less");
                }
                callback(null, css);
                
            });
        });
    });
}

function toCss(tree, imports, options, callback) {
    var less = require("less");
    var parseTree = new less.ParseTree(tree, imports);
    var css;
    try {
        css = parseTree.toCSS(options).css;
    }
    catch (err) {
        return callback(err);
    }
    callback(null, css);
}

function lessPathLib(staticPrefix) {
    if (!staticPrefix) return "";
    return "@base-path : \"" + staticPrefix + "\";\n"
        + "@image-path : \"" + staticPrefix + "/images\";\n"
        + "@icon-path : \"" + staticPrefix + "/icons\";\n";
}

function stripLess(sources) {
    var less = [];

    function addLessFile(pkg, code, file) {
        less.push({
            pkg: pkg,
            code: code,
            path: file
        });
    }
    
    sources.forEach(function(pkg){
        if (pkg.id && (pkg.id.indexOf("text!") > -1) && pkg.id.match(/text\!.*\.(less|css)$/)) {
            var source = pkg.source;
            pkg.source = "";
            
            // ignore certain less files
            if (pkg.id.match(/(default-dark|default-white|lesshat|compile_dark|compile_.*?)\.(less|css)/))
                return;
                
            // console.log("dropping less", pkg.id);
            addLessFile(pkg, source, pkg.file);
        }
        else if (pkg.id && pkg.id.match(/^text\!.*\.xml$/) && pkg.source.match(/<a:skin.*?\s+xmlns:a="http:\/\/ajax.org\/2005\/aml"/m)) {
            var style = "";
            pkg.source = pkg.source.replace(/(<a:style><\!\[CDATA\[)([\s\S]*?)(\]\]>)/g, function(m, open, css, close) {
                style += css + "\n";
                // console.log("dropping css in skin", pkg.id);
                return open + close;
            });
            if (style)
                addLessFile(pkg, style);
        }
    });
    
    return less;
}

// Rewrite all the defines to include the id as first arg
function rewriteDefines(sources, opts){
    var keepDeps = opts && opts.keepDepArrays;
    sources.forEach(function(pkg){
        if (!pkg.source && !pkg.id)
            console.log(pkg);
        if (!pkg.id) {
            // include literal
        }
        else if (pkg.id.indexOf("text!") > -1) {
            var source = pkg.source.replace(/\\/g, '\\\\').replace(/\n/g, "\\n").replace(/"/g, '\\"');
            pkg.source = 'define("' + pkg.id + '",[],"'
                + source
                + '");';
        }
        else {
            var deps = [];
            if (keepDeps) {
                deps.push("require", "exports", "module");
                if (keepDeps == "all")
                    deps = deps.concat(pkg.deps);
            }
            pkg.source = pkg.source.replace(/define\(\s*(?:(\[[^\]]*\]),\s*)?(f)/, function(_, depArray, code) {
                return 'define(\"' + pkg.id + '\",' + (depArray || JSON.stringify(deps)) + ', ' + code;
            });
        }
    });
}

function includeArchitect(opts, sources) {
    var source;
    if (opts.includeConfig) {
        source = opts.configFile + ";";
    }
    else {
        source = 'require(["architect", "./architect-config"], function (architect, plugins) {\n'
            + '    architect.resolveConfig(plugins, function (err, config) {\n'
            + '        if (err) throw err;\n'
            + '        architect.createApp(config);\n'
            + '    });\n'
            + '});\n';
        
        var output = (opts.outputFolder || ".") + "/" + (opts.outputFile || "architect-config.js");
        fs.writeFile(output, opts.configFile, function(err){
            if (!err)
                console.log("Written config file in '" + output + "'.");
        });
    }
    
    sources.push({
        id     : "bootstrap",
        file   : "bootstrap",
        source : source
    });

}


function writeToFile(result, opts, callback) {
    // Write output code
    createOutputFolder(opts, function() {
        var output = (opts.outputFolder || ".") + "/" + (opts.outputFile || "build.js");
        fs.writeFile(output, result.code, function(err){
            if (err) return callback(err);
            if (!opts.quiet)
                console.log("Written output in '" + output + "'");
            callback(err, result);
        });
        
        // Write map file
        if (opts.mapFile && result.map) {
            output = (opts.outputFolder || ".") + "/" + opts.mapFile;
            fs.writeFile(output, result.map, function(err){
                if (err) return callback(err);
                if (!opts.quiet)
                    console.log("Written map file in '" + output + "'");
            });
        }
    });
}

module.exports = build;
build.writeToFile = writeToFile;
