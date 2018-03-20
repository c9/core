var async = require("async");
var fs = require("fs");
var mkdirp = require("mkdirp");
var moduleDeps = require("./module-deps");
var path = require("path");

function build(config, opts, callback) {
    if (opts.compileLess && opts.sources)
        return compileLess(opts, opts.sources, callback);
            
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
    
    // Add RequireJS
    if (opts.withRequire) {
        mains.unshift({
            id: null,
            path: path.resolve(__dirname + "/build_support/" + (opts.node ? "node" : "mini") + "_require.js"),
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
            if (pkg.source == null)
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
            
        
        var afterRead = typeof opts.afterRead == "function"
            ? [opts.afterRead]
            : opts.afterRead || [];
        afterRead.push(rewriteDefines);
            
        afterRead.forEach(function(f) {
            sources = f(sources, opts) || sources;
        });
        
        // Include the architect config at the end in the same way as the tests
        if (opts.autoload)
            includeAutoload(opts, sources);
        else if (!opts.noArchitect)
            includeArchitect(opts, sources);
        
        opts.quiet || console.log("Processing " + sources.length + " files.");
        opts.quiet || console.log("Compressing: ", opts.compress);
        
        // Concatenate all files using uglify2 with source maps
        var result;
        if (opts.compress)
            result = require("./compress").withCache(sources, opts);
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
    var libs = opts.lessLibs;
    var less = stripLess(sources);
    var cssCode = [];
    var code = [];
    var cache = opts.cache;
    if (cache && !cache.less)
        cache.less = Object.create(null);
    if (cache && !cache.images)
        cache.images = Object.create(null);
        
    function readLibs(cb) {
        async.forEach(Object.keys(libs), function(key, next) {
            var lib = libs[key];
            if (typeof lib !== "string")
                return next();
            var path = moduleDeps.resolveModulePath(lib, opts.pathConfig.pathMap);
            fs.readFile(path, "utf8", function(e, code) {
                libs[key] = { code: code || "", id: lib };
                next();
            });
        }, function() {
            cb();
        });
    }
    
    function expandVariables(code, variables, plugin) {
        variables["base-path"] = (plugin && plugin.staticPrefix || opts.staticPrefix);
        variables["icon-path"] = variables["base-path"] + "/icons";
        variables["image-path"] = variables["base-path"] + "/images";
        variables["plugin-path"] = plugin
            ? "/static/" + path.dirname(plugin.packagePath)
            : "plugin-path";
        
        return code.replace(/@({([\w-]+)}|[\w-]+)/g, function(_, m, m1) {
            var name = m1 || m;
            return variables[name] || _;
        });
    }
    
    function preprocess() {
        less.forEach(function(file) {
            var plugin = file.pkg.parent.plugin;
            
            var id = file.pkg.id.replace(/^[^!]+!/, "");
            code.push(
                "/* @file " + id + " */\nß{"
                + expandVariables(file.code, Object.create(null), plugin)
                + "}"
            );
        });
        code = code.join("\n")
            + expandVariables(libs.map(function(l) {
                return l.code ? "/* @file " + l.id + " */\n" + l.code : "";
            }).join("\n"), Object.create(null));
    }
    
    function compile() {
        var ctx = {
            paths: ["/"],
            filename: opts.basepath + '/unknown.less',
            compress: !!opts.compress
        };
        var lessParser = require("less");
        return lessParser.parse(code, ctx, function(err, tree, imports, options) {
            if (err) return callback(err);
            
            toCss(tree, imports, options, function(err, css) {
                if (err) return callback(err);
                css = css.replace(/ß /g, "").replace(/^ +/gm, "\t");
                css = checkImages(css, opts, cache);
                css = addCssPrefixes(css);
                callback(null, { code: css });
            });
        });
    }
    
    
    readLibs(function() {
        preprocess();
        compile();
    });
}

function checkImages(css, opts, cache) {
    var images = cache && cache.images || Object.create(null);
    var t = Date.now();
    var file;
    var count = 0;
    var missingCount = 0;
    css = css.replace(/(url\(['"]?)(?!https?:)(?:\/static\/)?([^"')]+)|@file (\S+)/g, function(_, prefix, imagePath, fileId) {
        if (fileId) {
            file = fileId;
            return _;
        }
        if (/^data:|^#/.test(imagePath))
            return _;
        count++;
        
        if (/^(images|icons)/.test(imagePath))
            imagePath = opts.staticPrefix + "/" + imagePath;
        
        var dir = path.dirname(imagePath);
        var name = path.basename(imagePath);
        try {
            if (!images[dir]) {
                var absPath = moduleDeps.resolveModulePath(dir, opts.pathConfig.pathMap);
                images[dir] = fs.readdirSync(absPath);
            }
        } catch (e) {
            images[dir] = [];
        }
        var nameNx = name.replace("@1x", "");
        var name1x = nameNx.replace(/\.\w+$/, "@1x$&"); 
        var name2x = nameNx.replace(/\.\w+$/, "@2x$&"); 
        
        var hasNx = images[dir].indexOf(nameNx) != -1;
        var has1x = images[dir].indexOf(name1x) != -1;
        var has2x = images[dir].indexOf(name2x) != -1;
        
        if (hasNx) {
            name = nameNx;
        } else if (has1x) {
            name = name1x;
            if (!has2x)
                reportError(imagePath + " 2x");
        }
        else {
            reportError(imagePath);
        }
        
        // todo check image sizes
        return prefix + "/static/" + dir + "/" + name;
    });
    
    function reportError(imagePath) {
        missingCount++;
        console.log("" + missingCount + " missing image: " + imagePath, "from /" + file);
    }
    console.log("checked " + count + " images in " + (t - Date.now()) + "ms");
    return css;
}

function addCssPrefixes(css) {
    return css.replace(/\b(user-select|font-smoothing)\b([^;}\n]+);?/g, function(_, prop, value, index, string) {
        if (prop[0] == "u" && string[index - 1] != "-") {
            return "-webkit-" + prop + value + "; -moz-" + prop + value + "; -ms-" + prop + value + "; " + _;
        }
        else if (prop[0] == "f") {
            if (/true/.test(value))
                return "-webkit-font-smoothing: antialiased;-moz-osx-font-smoothing: grayscale;";
            if (/false/.test(value))
                return "-webkit-font-smoothing: auto;-moz-osx-font-smoothing: auto;";
            return _;
        }
        return _;
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

function stripLess(sources) {
    var less = [];

    function addLessFile(pkg, code, file) {
        pkg.cssSource = code;
        less.push({
            pkg: pkg,
            code: code,
            path: file
        });
    }
    
    sources.forEach(function(pkg) {
        if (pkg.cssSource != null) {
            addLessFile(pkg, pkg.cssSource);
        }
        else if (pkg.id && (pkg.id.indexOf("text!") > -1) && pkg.id.match(/text\!.*\.(less|css)$/)) {
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
            var source = pkg.source.replace(/\\/g, '\\\\').replace(/\r?\n/g, "\\n").replace(/"/g, '\\"');
            pkg.source = 'define("' + pkg.id + '",[],"'
                + source
                + '");';
        }
        else if (pkg.id.indexOf("vfs!") > -1) {
            pkg.source = 'define("' + pkg.id + '",[],' + function(require, exports, module) {
                var path = module.id.slice(4);
                return {
                   srcUrl: requirejs.MODULE_LOAD_URL + "/~node/" + path,
                   path: path,
                };
            } + ');';
            pkg.submodules = ["~node/" + pkg.id.slice(4).replace(/\.js$/, "")];
            console.log(pkg.submodules)
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
    }
    
    sources.push({
        id: "bootstrap",
        file: "bootstrap",
        source: source
    });

}

function includeAutoload(opts, sources) {
    var source = 'require("' + opts.autoload + '");\n';
    
    sources.push({
        id: "bootstrap",
        file: "bootstrap",
        source: source
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
