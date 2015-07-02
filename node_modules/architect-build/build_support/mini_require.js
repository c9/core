(function() {

var MODULE_LOAD_URL = "/load/module";

var global = (function() { return this; })();
if (!global && typeof window != "undefined") global = window; // can happen in strict mode

var commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg;
var cjsRequireRegExp = /require\s*\(\s*["']([^'"\s]+)["']\s*\)/g;

function getInlineDeps(fn) {
    var deps = [];
    if (fn.length) {
        fn.toString().replace(commentRegExp, "")
            .replace(cjsRequireRegExp, function (match, dep, index, str) {
                var i = index; 
                while (str.charCodeAt(i-=1) <= 32) {}
                if (str.charAt(i) !== ".")
                    deps.push(dep);
            });
        deps = ["require", "exports", "module"].concat(deps);
    }
    return deps;
}

var define = function(name, deps, callback) {
    // Allow for anonymous modules
    if (typeof name !== "string") {
        callback = deps;
        deps = name;
        name = null;
    }
    // This module may not have dependencies
    if (deps && !Array.isArray(deps)) {
        callback = deps;
        deps = null;
    }
    
    if (!name)
        return defQueue.push([deps, callback]);
    
    if (define.loaded[name])
        return;
    
    if (!deps && typeof callback == "function")
        deps = getInlineDeps(callback);
    
    define.loaded[name] = {
        id: name,
        deps: normalizeNames(name, deps || []),
        factory: callback,
        exports: {},
        packaged: true
    };
    if (define.loading[name])
        delete define.loading[name];
    if (define.lastModule)
        define.pending.push(name);
    else
        define.lastModule = name;
};
var defQueue = [];
var addToLoadQueue = function(missing, deps, callback, errback) {
    var toLoad = missing.length;
    var map = {};
    define.queue.push({
        deps: deps,
        map: map,
        toLoad: toLoad,
        callback: callback,
        errback: errback
    });
    
    for (var i = 0; i < missing.length; ++i) {
        var p = missing[i];
        map[p] = 1;
        if (!define.loading[p]) {
            require.load(p);
            define.loading[p] = 1;
        }
    }
};

var processLoadQueue = function(err, id) {
    var changed = false;
    if (err) {
        define.errors[err.id] = err;
        define.queue.forEach(function(r) {
            if (r.map[err.id]) {
                r.toLoad = -1;
                if (r.errback) r.errback(err);
            }
        });
        if (define.lastModule == err.id)
            define.lastModule = null;
        define.pending = define.pending.filter(function(p) {
            return p != err.id;
        });
        changed = true;
    } else if (id && !defQueue.length && !define.loaded[id]) {
        // the script didn't call define
        defQueue = [config.shim && config.shim[id] || [[], null]];
    }
    
    if (defQueue.length) {
        if (defQueue.length > 1)
            throw new Error("more than one module in defqueue");
        define(id, defQueue[0][0], defQueue[0][1]);
        defQueue.length = 0;
    }
    
    var pending = define.pending;
    define.queue.forEach(function(r) {
        pending.forEach(function(id) {
            if (r.map[id])
                r.toLoad--;
        });
        if (r.map[define.lastModule])
            r.toLoad--;
        if (!r.toLoad) {
            changed = true;
            _require("", r.deps, r.callback, r.errback);
        }
    });
    
    define.lastModule = null;
    if (pending.length)
        define.pending = [];
    
    if (changed) {
        define.queue = define.queue.filter(function(r) {
            return r.toLoad > 0;
        });
    }
};

define.amd = true;
define.queue = [];
define.loaded = {};
define.errors = {};
define.loading = {};
define.pending = [];
define.modules = { require: 1, exports: 1, module: 1 };
define.fetchedUrls = {};

var activateModule = function(name) {
    var module = define.loaded[name];
    var exports = module.exports;
    if (typeof module.factory !== "function") {
        exports = module.factory;
    } else {
        var req = function(path, callback) {
            return _require(name, path, callback);
        };
        req.toUrl = function(namePlusExt) {
            return require.toUrl(normalizeName(name, namePlusExt));
        };
        req.config = require.config;
        
        var modules = define.modules;
        var missing = checkMissing(module.deps);
        if (missing.length)
            return missing;
        
        modules.require = req;
        modules.exports = exports;
        modules.module = module;
        
        define.modules[name] = exports;
        var args = module.deps.slice(0, module.factory.length);
        var returnValue = args.length
            ? module.factory.apply(module, args.map(lookup))
            : module.factory(req, exports, module);
        
        exports = returnValue == undefined ? module.exports : returnValue;
    }
    delete define.loaded[name];
    define.modules[name] = exports;
};

var checkMissing = function(deps, seen, missing) {
    missing = missing || {};
    seen = seen || {};
    for (var i = 0; i < deps.length; ++i) {
        var depName = deps[i];
        if (!define.modules[depName]) {
            var dep = define.loaded[depName];
            if (!dep)
                missing[depName] = 1;
            else if (!missing[depName] && !seen[depName]) {
                seen[depName] = 1;
                checkMissing(dep.deps, seen, missing);
            }
        }
    }
    return Object.keys(missing);
};

var lookup = function(moduleName) {
    var mod = define.modules[moduleName];
    if (mod === undefined && define.loaded[moduleName]) {
        activateModule(moduleName);
        mod = define.modules[moduleName];
    }
    return mod;
};

var _require = function(parentId, moduleName, callback, errback) {
    if (typeof moduleName === "string") {
        var depName = normalizeName(parentId, moduleName);
        var module = lookup(depName);
        if (module !== undefined) {
            if (typeof callback == "function")
                callback(module);
            return module;
        }
    } else if (Array.isArray(moduleName)) {
        var deps = normalizeNames(parentId, moduleName);
        var missing = checkMissing(deps);
        if (!missing.length) {
            var args = deps.map(lookup);
            return callback && callback.apply(null, args);
        } else {
            return addToLoadQueue(missing, deps, callback, errback);
        }
    }
    if (_require.original)
        return _require.original.call(this, moduleName, callback);
};

var normalizeName = function(parentId, moduleName) {
    // normalize plugin requires
    if (moduleName.indexOf("!") !== -1) {
        var chunks = moduleName.split("!");
        return normalizeName(parentId, chunks[0]) + "!" + normalizeName(parentId, chunks[1]);
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
};

var normalizeNames = function(parentId, moduleNames) {
    return moduleNames.map(function(name) {
        return normalizeName(parentId, name);
    });
};

var require = function(module, callback) {
    return _require("", module, callback);
};

var config = require.config = function(cfg) {
    if (cfg.baseUrl)
        config.baseUrl = cfg.baseUrl.replace(/\/*$/, "/");

    cfg.packages && cfg.packages.forEach(function(pkg) {
        if (typeof pkg === "string") pkg = { name: pkg };
        config.packages[pkg.name] = {
            name: pkg.name,
            location: (pkg.location || pkg.name).replace(/\/*$/, "/"),
            main: (pkg.main || "main").replace(/\.js$/, "").replace(/^\.\//, "")
        };
    });
    
    cfg.paths && Object.keys(cfg.paths).forEach(function(p) {
        config.paths[p] = cfg.paths[p];
    });
    
    if (cfg.baseUrlLoadBalancers)
        config.baseUrlLoadBalancers = cfg.baseUrlLoadBalancers;
};
config.packages = Object.create(null);
config.paths = Object.create(null);
config.baseUrl = "";

require.undef = function(module, callback) {
    module = normalizeName("", module);
    var path = require.toUrl(module, ".js");
    delete define.errors[module];
    delete define.loaded[module];
    delete define.modules[module];
    delete define.fetchedUrls[path];
};

require.MODULE_LOAD_URL = MODULE_LOAD_URL;

require.toUrl = function(moduleName, ext, skipExt) {
    var absRe = /^([\w\+\.\-]+:|\/)/;
    var index = moduleName.indexOf("!");
    if (index !== -1 || !ext)
        ext = "";
        
    var paths = config.paths;
    var pkgs = config.packages;
    
    var testPath = moduleName, tail = "";
    while (testPath) {
        if (paths[testPath]) {
            moduleName = paths[testPath] + tail;
            break;
        }
        if (pkgs[testPath]) {
            moduleName = pkgs[testPath].location + (tail || pkgs[testPath].main);
            break;
        }
        var i = testPath.lastIndexOf("/");
        if (i === -1) break;
        tail = testPath.substr(i) + tail;
        testPath = testPath.slice(0, i);
    }
    
    if (skipExt)
        return testPath; 
    
    var url = moduleName + ext;
    if (!absRe.test(url)) {
        url = (config.baseUrl || require.MODULE_LOAD_URL + "/") +  url;
    }
    if (url[0] === "/" && config.baseUrlLoadBalancers) {
        var n = Math.abs(hashCode(url)) % config.baseUrlLoadBalancers.length;
        url =  config.baseUrlLoadBalancers[n] + url;
    }
    return url;
};

function hashCode(string) {
    var result = 0, i, chr, len;
    if (string.length == 0) return result;
    for (i = 0, len = string.length; i < len; i++) {
        chr = string.charCodeAt(i);
        result = ((result << 5) - result) + chr;
        result |= 0; // Convert to 32bit integer
    }
    return result;
}

var loadScript = function(path, id, callback) {
    // TODO use importScripts for webworkers
    var head = document.head || document.documentElement;
    var s = document.createElement("script");
    s.src = path;
    s.charset = "utf-8";
    s.async = true;
    
    if (path.lastIndexOf(require.MODULE_LOAD_URL, 0) == 0)
        s.crossOrigin = true;
    
    head.appendChild(s);

    s.onload = s.onreadystatechange = function(_, isAbort) {
        if (isAbort || !s.readyState || s.readyState == "loaded" || s.readyState == "complete") {
            s = s.onload = s.onreadystatechange = null;
            if (!isAbort)
                callback(null, id);
        }
    };
    s.onerror = function(e) {
        processLoadQueue({
            id: id,
            path: path
        });
    };
};

require.load = function(module) {
    var i = module.indexOf("!") + 1;
    if (i) {
        var plugin = module.substring(0, i);
        module = module.substr(i);
        if (typeof require[plugin] == "function") {
            require[plugin](module, processLoadQueue);
        } else if (config.baseUrl) {
            if (require[plugin])
                return require[plugin][plugin + module] = 1;
            require[plugin] = Object.create(null);
            require[plugin][plugin + module] = 1;
            require([plugin.slice(0, -1)], function(p) {
                var pending = require[plugin];
                definePlugin(plugin, p);
                Object.keys(pending).forEach(function(p) {
                    delete define.loading[p];
                });
                require(Object.keys(pending));
            });
        } else {
            console.error("require plugin " + plugin + "missing");
        }
    } else {
        var url = require.toUrl(module, ".js");
        if (define.fetchedUrls[url] & 1)
            return false;
        define.fetchedUrls[url] |= 1;
        loadScript(url, module, processLoadQueue);
    }
};

function definePlugin(plugin, p) {
    require[plugin] = function(moduleName, processLoadQueue) {
        p.load(moduleName, require, function(value) {
            define(plugin + moduleName, [], function() {
                return value;
            });
            processLoadQueue();
        });
    };
}

/*** plugins ***/
require["text!"] = function(module, callback) {
    var url = require.toUrl(module);
    if (define.fetchedUrls[url] & 2)
        return false;
    define.fetchedUrls[url] |= 2;
    var cb = function(e, val) {
        if (e) console.error("Couldn't load module " + module, e);
        define("text!" + module, [], val);
        callback();
    };
    var xhr = new window.XMLHttpRequest();
    xhr.open("GET", url + "?access_token=fake_token", true);
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
    xhr.onload = function(e) { cb(null, xhr.responseText); };
    xhr.onabort = xhr.onerror = function(e) { cb(e); };
    xhr.send("");
};

/*** add global define ***/
if (!global.define || !global.define.packaged) {
    define.original = global.define;
    global.define = define;
    global.define.packaged = true;
}

if (!global.require || !global.require.packaged) {
    global.require = require;
    global.require.packaged = true;
}

if (!global.requirejs) global.requirejs = require;

global.miniRequire = require;


})();
