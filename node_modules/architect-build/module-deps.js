var fs = require('fs');
var pathLib = require('path');

var through = require('through');

var nativeNodeModules = ["fs", "path", "require", "exports", "module"];

module.exports = function(mains, opts) {
    if (!Array.isArray(mains)) mains = [mains].filter(Boolean);
    
    opts = opts || Object.create(null);
    opts.modules = Object.create(null); // {id, path, contents, deps}
    
    var cache = opts.cache;
    if (cache)
        cache.files = cache.files || Object.create(null);
    
    if (!opts.ignore)
        opts.ignore = [];
    else
        opts.ignore = opts.ignore.reduce(function(map, ignore) {
            map[ignore] = true;
            return map;
        }, {});
        
    if (opts.debug)
        opts.transforms = [wrapUMD, debugSrc];

    if (!opts.transforms)
        opts.transforms = [];
    
    opts.transforms.push(removeLicenceComments, wrapUMD);
    
    if (opts.pathConfig) {
        opts.paths = opts.paths || opts.pathConfig.paths;
        opts.root = opts.root || opts.pathConfig.root;
        opts.packages = opts.packages || opts.pathConfig.packages;
        opts.pathMap = opts.pathMap || opts.pathConfig.pathMap;
    }
    
    var root = opts.root || "";
    var paths = opts.paths || {};
    var pathMap = opts.pathMap;
    opts.packages && opts.packages.forEach(function(pkg) {
        paths[pkg.name] = pkg;
    });
    
    function idToPath(mod, cb) {
        if (!mod.id && mod.path)
            return cb(null, mod.path);
        var id = mod.id;
        
        if (id.indexOf("!") != -1) {
            var chunks = id.split("!");
            id = chunks[1];
            mod.loaderModule = chunks[0];
        }
        
        id = resolveModuleId(id, paths);
        if (pathMap)
            id = resolveModulePath(id, pathMap);
        if (!mod.loaderModule && !/\.js$/.test(id))
            id += ".js";
        cb(null, id);
    }

    function readModule(mod, cb) {
        if (typeof mod == "string") 
            mod = {id: mod};
        
        var id = mod.id;
        if (opts.modules[id]) {
            return cb(null, null);
        }
        
        if (opts.ignore[id]) {
            ignoreDep(mod);
            return cb();
        }
        
        opts.modules[id] = mod;
        
        if (mod.source && mod.literal) {
            return cb(null, mod);
        }
        
        idToPath(mod, function(err, path) {
            var filepath = absolutePath(root, path);
            mod.path = path;
            mod.file = filepath;
            
            if (cache && cache.files[mod.file] != undefined) {
                return setModuleSource(mod, cache.files[mod.file], cb);
            }
            
            fs.readFile(filepath, 'utf8', function (err, src) {
                if (err)  {
                    if (err.code == 'ENOENT' || err.code == "ENOTDIR") {
                        ignoreDep(mod);
                        cb();
                        return;
                    }
                    if (err.code == 'EMFILE') {
                        opts.modules[id] = null;
                        wait(err, mod, cb);
                        return;
                    }
                    return output.emit('error', err);
                }
                setModuleSource(mod, src, cb);
            });
        });
    }
    
    function setModuleSource(mod, src, cb) {
        if (cache)
            cache.files[mod.file] = src;
        mod.source = src;
        // todo: support loaders other than text?
        if (!mod.noRequire && !mod.literal && !mod.loaderModule && !mod.noDeps) {
            mod.deps = getDeps(src, mod.id);
            // console.log(mod.id, mod.deps)
            mod.deps.forEach(function(dep) {
                addToQueue(dep, mod);
            });
        }
        cb(null, mod);
    }
    
    function ignoreDep(mod) {
        var parent = mod.parent || {};
        if (nativeNodeModules[mod.id] === -1) {
            console.log("file '" + mod.file + "' doesn't exisit");
            console.log("ignoring dependency '" + mod.id + "' of '" + parent.id + "'");
        }
        if (!parent.ignoredDeps)
            parent.ignoredDeps = [];
        parent.ignoredDeps.push(mod);
    }
    
    var output = through();
    
    var pending = [];
    var active = 0;
    var maxActive = 100;
    var waitT = 0, timer;
    
    function addToQueue(id, parent) {
        var mod = typeof id == "string"
            ? {id: id, parent: parent}
            : id;
        pending.push(mod);
    }
    
    function wait(err, mod) {
        active--;
        pending.push(mod);
        if (active > 0) {
            if (active > 2 && active < maxActive)
                maxActive = active;
        } else if (waitT < 5000) {
            if (!timer) {
                waitT = 1.5 * waitT + 1 +0.001 * waitT * waitT;
                timer = setTimeout(function() {
                    timer = null;
                    takeFromQueue();
                    if (active)
                        waitT = 0;
                }, waitT);
            }
        } else {
            output.emit('error', err);
        }
    }
    
    function takeFromQueue() {
        while (active < maxActive) {
            var mod = pending.pop();
            if (!mod)
                break;
            active++;
            readModule(mod, onModuleReady);
        }
    }
    
    function onModuleReady(err, module) {
        active--;
        // console.log("pending", pending)
        if (module && module.source != undefined) {
            applyTransforms(module);
            output.queue(module);
        } else if (module) {
            module.parent = null;
            console.dir(module);
        }
        
        if (pending.length || active)
            takeFromQueue();
        else
            end();
    }
    
    function end() {
        opts._createDepMap && fs.writeFileSync("dep_map.js", JSON.stringify(opts.modules, function(key, val) {
            if (key == "source")
                return val && val[0];
            if (key == "parent")
                return val && val.id;
            return val;
        }, 4));
        process.nextTick(function() {
            output.emit("end");
        });
    }
    
    function applyTransforms(module) {
        if (!module.source || module.literal)
            return; // console.log(module)
        var transforms = module.transforms || opts.transforms;
        transforms.forEach(function(transform) {
            transform(module);
        });
    }
    
    
    mains.forEach(function(dep) {
        addToQueue(dep, {id: "#root"});
    });
    takeFromQueue();
    
    return output;
};


function normalizeModule(parentId, moduleName) {
    // normalize plugin requires
    if (moduleName.indexOf("!") !== -1) {
        var chunks = moduleName.split("!");
        return normalizeModule(parentId, chunks[0]) + "!" + normalizeModule(parentId, chunks[1]);
    }
    // normalize relative requires
    if (moduleName.charAt(0) == ".") {
        var base = parentId.split("/").slice(0, -1).join("/");
        moduleName = (base || parentId) + "/" + moduleName;
        
        while (moduleName.indexOf(".") !== -1 && previous != moduleName) {
            var previous = moduleName;
            moduleName = moduleName.replace(/\/\.\//, "/").replace(/[^\/]+\/\.\.\//, "");
        }
    }    
    return moduleName;
}
function getSubmodules(src, name) {
    var m = src.replace(/^\s*\/\/.+|^\s*\/\*[\s\S]*?\*\//gm, "")
        .match(/require\(\[([^\]]+)\]/gm);
    if (!m)
        return [];
    var deps = [];
    m.forEach(function(dep) {
        var re = /["']([^"']+?)["']/g;
        var m;
        while ((m = re.exec(dep))) {
            deps.push(normalizeModule(name, m[1]));
        }
    });
    // console.log(deps);
    return deps;
}
function getReqDeps(src, name) {
    var m = src.replace(/^\s*\/\/.+|^\s*\/\*[\s\S]*?\*\//gm, "")
        .match(/require\s*\(\s*(["'][^"'\n\r]+["'])\s*\)/gm);
    if (!m)
        return [];
    
    return m.map(function(r) {
        r = r.match(/["']([^"']+?)["']/)[1];
        r = normalizeModule(name, r);
        return r;
    });
}
function getAmdDeps(src, name) {
    var m = src.match(/define\(\[[^\]]+\]/gm);
    if (!m)
        return [];
     
    var deps = [];
    m.forEach(function(dep) {
        var re = /["']([^"']+?)["']/g;
        var m;
        while ((m = re.exec(dep))) {
            deps.push(normalizeModule(name, m[1]));
        }
    });
    // console.log(deps);
    return deps;
}
function getDeps(src, name) {
    return getReqDeps(src, name).concat(getAmdDeps(src, name));
}
function resolveModuleId(id, paths) {
    var testPath = id, tail = "";
    while (testPath) {
        var alias = paths[testPath];
        if (typeof alias == "string") {
            return alias + tail;
        } else if (alias) {
            return  alias.location.replace(/\/*$/, "/") + (tail || alias.main || alias.name);
        } else if (alias === false) {
            return "";
        }
        var i = testPath.lastIndexOf("/");
        if (i === -1) break;
        tail = testPath.substr(i) + tail;
        testPath = testPath.slice(0, i);
    }
    return id;
}
function resolveModulePath(id, pathMap) {
    var testPath = id, tail = "";
    if (testPath[0] != "/")
        testPath = "/" + testPath;
    while (testPath) {
        if (pathMap[testPath]) {
            return pathMap[testPath] + tail;
        }
        var i = testPath.lastIndexOf("/");
        if (i === -1) break;
        tail = testPath.substr(i) + tail;
        testPath = testPath.slice(0, i);
    }
    return id;
}


function absolutePath(root, relative) {
    // console.log(root, relative)
    if (relative[0] == "/" || relative[1] == ":")
        return relative;
    return pathLib.join(root, relative);
}


// src transformations
function removeUseStrict(module) {
    module.source = module.source.replace(/['"]use strict['"];/g, "");
}

function removeLicenceComments(module) {
    if (/\.(js|jsx|css|less)/.test(module.path))
        module.source = module.source.replace(/(?:(;)|\n|^)\s*\/\*[\d\D]*?\*\/|(\n|^)\s*\/\/.*/g, "$1");
}
function removeLicenceCommentsKeepLines(module) {
    if (/\.(js|jsx|css|less)/.test(module.path)) {
        module.source = module.source.replace(/(?:(;)|\n|^)\s*\/\*[\d\D]*?\*\/|\n\s*\/\/.*/g, function(cm, start) {
            return (start||"") + cm.replace(/.+/g, "");
        });
    }
}

function wrapUMD(module) {
    if (module.loaderModule || module.noRequire)
        return;
    var firstDefineCall = module.source.match(/define\([^)]*/);
    if (firstDefineCall) {
        // check if it is a normal define or some crazy umd trick
        if (/define\(function\s*\(/.test(firstDefineCall[0]))
            return;
        if (/define\(\[[^\]]*\],\s*function\(/.test(firstDefineCall[0]))
            return;
    }
    console.log("wrapping module " + module.id);
    
    
    module.source = 'define(function(require, exports, module) {\n' 
        + 'var $build_deps$ = {require: require, exports: exports, module: module};\n'
        + 'exports = undefined; module = undefined;\n'
        + 'function define(name, deps, m) {\n'
        + '    if (typeof name == "function") {\n'
        + '        m = name; deps = ["require", "exports", "module"]; name = $build_deps$.module.id\n'
        + '    }\n'
        + '    if (typeof name !== "string") {\n'
        + '        m = deps; deps = name; name = $build_deps$.module.id\n'
        + '    }\n'
        + '    if (!m) {\n'
        + '        m = deps; deps = [];\n'
        + '    }\n'
        + '   var ret = typeof m == "function" ?\n'
        + '       m.apply($build_deps$.module, deps.map(function(n){return $build_deps$[n] || require(n)})) : m\n'
        + '   if (ret != undefined) $build_deps$.module.exports = ret;\n'
        + '}\n'
        + 'define.amd = true;'
        +  module.source
    + '});';
}

function debugSrc(module) {
    if (module.loaderModule) 
        return;
    var url = "http://localhost:8181/" + module.id;
    module.source = "try{eval(" + quote(module.source + "\n//@ sourceURL=" + url) + ");}catch(e){throw e.message + url}";
}

function quote(str) { 
    return "'"
        + str.replace(/[\\']/g, "\\$&").replace(/\n/g, "\\n")
        + "'";
}


module.exports.resolveModulePath = resolveModulePath;