(function() {

var ACE_NAMESPACE = "";
var MODULE_LOAD_URL = "/load/module";

var global = (function() {
    return this;
})();


if (!ACE_NAMESPACE && typeof requirejs !== "undefined")
    return;


var _define = function(module, deps, payload) {
    if (typeof module !== 'string') {
        if (_define.original)
            _define.original.apply(window, arguments);
        else {
            console.error('dropping module because define wasn\'t a string.');
            console.trace();
        }
        return;
    }

    if (arguments.length == 2)
        payload = deps;

    _define.amd = true;
    if (!_define.modules) {
        _define.modules = {};
        _define.payloads = {};
    }
    if (_define.modules[module])
        return;
    _define.payloads[module] = payload;
    _define.modules[module] = null;
};

/**
 * Get at functionality define()ed using the function above
 */
var _require = function(parentId, module, callback) {
    if (Object.prototype.toString.call(module) === "[object Array]") {
        var params = [];
        for (var i = 0, l = module.length; i < l; ++i) {
            var moduleName = normalizeModule(parentId, module[i]);
            var dep = lookup(parentId, moduleName);
            if (!dep && _require.load) {
                return _require.load(moduleName, function() {
                    if (lookup(parentId, moduleName))
                        _require(parentId, module, callback);
                });
            }
            params.push(dep);
        }
        if (callback) {
            callback.apply(null, params);
        }
    }
    else if (typeof module === 'string') {
        var payload = lookup(parentId, module);
        if (!payload && _require.original)
            return _require.original.apply(this, arguments);

        if (callback) {
            callback();
        }

        return payload;
    }
    else {
        if (_require.original)
            return _require.original.apply(this, arguments);
    }
};

var normalizeModule = function(parentId, moduleName) {
    // normalize plugin requires
    if (moduleName.indexOf("!") !== -1) {
        var chunks = moduleName.split("!");
        return normalizeModule(parentId, chunks[0]) + "!" + normalizeModule(parentId, chunks[1]);
    }
    // normalize relative requires
    if (moduleName.charAt(0) == ".") {
        var base = parentId.split("/").slice(0, -1).join("/");
        moduleName = (base || parentId) + "/" + moduleName;

        while(moduleName.indexOf(".") !== -1 && previous != moduleName) {
            var previous = moduleName;
            moduleName = moduleName.replace(/\/\.\//, "/").replace(/[^\/]+\/\.\.\//, "");
        }
    }

    return moduleName;
};

/**
 * Internal function to lookup moduleNames and resolve them by calling the
 * definition function if needed.
 */
var lookup = function(parentId, moduleName) {
    moduleName = normalizeModule(parentId, moduleName);

    var module = _define.modules[moduleName];
    if (!module) {
        module = _define.payloads[moduleName];
        var exports = {};
        if (typeof module === 'function') {
            var mod = {
                id: moduleName,
                uri: '',
                exports: exports,
                packaged: true
            };

            var req = function(module, callback) {
                return _require(moduleName, module, callback);
            };
            
            req.toUrl = require.toUrl;
            _define.modules[moduleName] = exports;

            var returnValue = module(req, exports, mod);
            exports = returnValue || mod.exports;
            _define.modules[moduleName] = exports;
            delete _define.payloads[moduleName];
        } else {
            exports = module;
        }
        module = _define.modules[moduleName] = exports;
    }
    return module;
};

function exportAce(ns) {
    var root = global;
    if (ns) {
        if (!global[ns])
            global[ns] = {};
        root = global[ns];
    }

    if (!root.define || !root.define.packaged) {
        _define.original = root.define;
        root.define = _define;
        root.define.packaged = true;
    }

    if (!root.require || !root.require.packaged) {
        // _require.original = root.require || _require.original;
        root.require = require;
        root.require.packaged = true;
    }
    root.miniRequire = require;
}
var require = function(module, callback) {
    return _require("", module, callback);
};
require.MODULE_LOAD_URL = MODULE_LOAD_URL;

require.toUrl = function(url) {
    var root = "/static";
    var urlMap = require.urlMap || {};
    var parts = url.split("/");
    var top = parts[0];
    parts.shift();
    return [root, urlMap[top] || top].concat(parts).join("/");
};

var loadScript = function(path, callback) {
    var head = document.head || document.documentElement;
    var s = document.createElement('script');

    s.src = path;
    head.appendChild(s);

    s.onload = s.onreadystatechange = function(_, isAbort) {
        if (isAbort || !s.readyState || s.readyState == "loaded" || s.readyState == "complete") {
            s = s.onload = s.onreadystatechange = null;
            if (!isAbort)
                callback();
        }
    };
};

_require.load = function(module, callback) {
    var i = module.indexOf("!") + 1;
    if (i) {
        var plugin = module.substring(0, i);
        module = module.substr(i);
        if (require[plugin]) {
            require[plugin](module, callback);
        } else {
            console.error("require plugin " + plugin + "missing");
        }
    } else {
        loadScript(require.MODULE_LOAD_URL + "/" + module + ".js", callback);
    }
};

require["text!"] = function(module, callback) {
    var cb = function(e, val) {
        if (e) console.error("Couldn't load module " + module, e);
        _define.modules["text!" + module] = val;
        callback();
    };
    var url = require.MODULE_LOAD_URL + "/" + module;
    var xhr = new window.XMLHttpRequest();
    xhr.open("GET", url + "?access_token=fake_token", true);
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
    xhr.onload = function(e) { cb(null, xhr.responseText); };
    xhr.onabort = xhr.onerror = function(e) { cb(e); };
    xhr.send("");
};

exportAce(ACE_NAMESPACE);

})();
