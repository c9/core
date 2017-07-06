/**
 * jsonalyzer server-side analysis component
 */
var vm = require("vm");
var Module = require("module");
var dirname = require("path").dirname;
var assert = require("assert");
var collabServer;

var plugins = {
    "c9/assert": assert
};
var vfs;
var workspaceDir;
var homeDir;
var server;
var packer;
var handlers = {};

module.exports = function(_vfs, options, register) {
    vfs = _vfs;
    
    server = {
        init: init,
        
        registerHandler: registerHandler,
        
        registerHandlers: registerHandlers,
        
        callHandler: callHandler,
        
        getHandlerList: getHandlerList
    };
    register(null, server);
};

function init(options, callback) {
    if (!options.useCollab)
        return callback();
    
    workspaceDir = options.workspaceDir;
    homeDir = options.homeDir;

    vfs.use("collab", {}, function(err, collab) {
        if (err)
            return callback(err);
        collabServer = collab.api;
        callback();
    });
}

function getClientDoc(path, options, callback) {
    if (options.value)
        return done(null, { contents: options.value });
    
    if (!collabServer)
        return done(new Error("No collab server found and cannot use local value"));

    var timeout = setTimeout(function() {
        var timeoutError = new Error("Collab server failed to provide document contents in time");
        timeoutError.code = "ECOLLAB";
        timeoutError.customData = {
            path: path,
            revNum: options.revNum
        };
        done(timeoutError);
    }, 15000);

    var docId = path.replace(/^\//, "");
    collabServer.getDocument(
        docId,
        function(err, result) {
            if (err) return done(err);
            
            if (!result) {
                var noResultError = new Error("Unable to open document or document not found");
                noResultError.customData = {
                    path: path,
                    revNum: options.revNum
                };
                return done(noResultError);
            }
            
            if (options.revNum <= result.revNum) {
                if (!result.contents)
                    return done(new Error("Collab server failed to provide document contents"));
                return done(null, result);
            }
            
            collabServer.emitter.on("afterEditUpdate", function wait(e) {
                if (e.docId !== docId || e.doc.revNum < options.revNum)
                    return;
                collabServer.emitter.removeListener("afterEditUpdate", wait);
                done(null, e.doc);
            });
        }
    );
    
    function done(err, doc) {
        clearTimeout(timeout);
        callback(err, doc);
    }
}

function registerHandlers(list, options, callback) {
    var results = [];
    async.forEachSeries(
        list,
        function(plugin, next) {
            registerHandler(
                plugin.path,
                plugin.contents,
                plugin.options || options,
                function(err, result) {
                    results.push(result);
                    next(err);
                }
            );
        },
        function(err) {
            return callback(err, { summaries: results });
        }
    );
}

function registerHandler(handlerPath, contents, options, callback) {
    options = options || {};
    options.server = server;
    options.vfs = vfs;
    options.workspaceDir = workspaceDir || vfs.fsOptions.projectDir;
    options.homeDir = homeDir;
    options.defaultEnv = vfs.fsOptions.defaultEnv || {};

    loadPlugin(handlerPath, contents, function(err, result) {
        if (err) return callback(err);
        
        handlers[handlerPath] = result;
        result.defaultEnv = options.defaultEnv;
        if (handlerPath === "jsonm/build/packer")
            packer = new result.Packer();

        if (!result.init)
            return done();
        
        result.init(options, done);
        
        function done(err) {
            if (err) return callback(err);
            
            callback(null, getHandlerSummary(handlerPath, result));
        }
    });
}

function getHandlerSummary(path, handler) {
    var properties = {};
    var functions = {};
    for (var p in handler) {
        if (!handler.hasOwnProperty(p))
            continue;
        // We don't send functions over vfs, but use callHandler() instead
        if (typeof handler[p] === "function")
            functions[p] = true;
        else
            properties[p] = handler[p];
    }
    
    return {
        path: path,
        properties: properties,
        functions: functions
    };
}

function getHandlerList(callback) {
    callback(null, { handlers: Object.keys(handlers) });
}

function callHandler(handlerPath, method, args, options, callback) {
    var handler = handlers[handlerPath];
    if (!handler)
        return callback(new Error("No such handler: " + handlerPath));
    if (!handler[method])
        return callback(new Error("No such method on " + handlerPath + ": " + method));

    var revNum;
    var isDone;

    // Be extra defensive about collab errors
    try {
        setupCall();
    } catch (e) {
        if (isDone)
            throw e;
        done(e);
    }
    
    function setupCall() {
        switch (method) {
            case "analyzeCurrent":
            case "findImports":
            case "invoke":
                var clientPath = args[0];
                var osPath = options.filePath;
                
                getClientDoc(clientPath, options, function(err, doc) {
                    if (err) return done(err);
                    if (!doc) {
                        // Document doesn't appear to exist in collab;
                        // we'll pass null instead and wait for the
                        // plugin to decide what to do.
                        revNum = -1;
                        return doCall();
                    }
                    
                    args[0] = osPath;
                    args[1] = doc.contents;
                    args[3] = args[3] || {}; // options
                    args[3].clientPath = clientPath;
                    revNum = doc.revNum;
                    doCall();
                });
                break;
            default:
                doCall();
        }
    }
    
    function doCall() {
        // Be extra defensive about handler errors
        try {
            handler[method].apply(handler, args.concat(done));
        } catch (e) {
            if (isDone)
                throw e;
            done(e);
        }
    }
    
    function done(err/*, arg... */) {
        isDone = true;
        
        var args = [].slice.apply(arguments);
        callback(
            err,
            {
                result: packer.pack(args, { packStringDepth: 1 }),
                revNum: revNum
            }
        );
    }
}

function loadPlugin(path, contents, callback) {
    if (!path || path.match(/^\.|\.js$/))
        return callback(new Error("Illegal module name: " + path));
    if (!contents)
        return callback(new Error("No contents provided: " + path));

    
    var exports = {};
    var module = { exports: exports };
    var require = createRequire(path, plugins);

    try {
        var pathJS = path.replace(/(\.js)?$/, ".js");
        var script = "(function(require, exports, module) {"
            + "var define = function(def) { def(require, exports, module) };"
            + contents.replace(/^\#\!.*/, '')
            + "})";
        // using pathJS instead of {filename: pathJS} for compatibility with node 0.10
        vm.runInThisContext(script, pathJS)(require, exports, module);
    } catch (e) {
        console.error("Error loading " + path + ":", e.stack);
        e.message = ("Error loading " + path + ": " + e.message);
        return callback(e);
    }

    plugins[path] = module.exports;
    callback(null, module.exports);
}

function createRequire(path, localDefs) {
    var parentModule = new Module(path);
    parentModule.path = path;
    parentModule.paths = Module._nodeModulePaths(dirname(path));

    function createRequire(file) {
        var normalized = normalizeModule(path, file);
        if (normalized in localDefs)
            return localDefs[normalized];
        // TODO: fix relative path requires
        try {
            var exports = Module._load(file, parentModule);
            return exports;
        } catch (e) {
            e.message = path + ": " + e.message;
            throw e;
        }
    }

    createRequire.resolve = function(request) {
        var resolved = Module._resolveFilename(request, parentModule);
        return (resolved instanceof Array) ? resolved[1] : resolved;
    };

    createRequire.main = process.mainModule;
    createRequire.extensions = require.extensions;
    createRequire.cache = require.cache;

    return createRequire;
}

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

var async = {
    forEachSeries: function(arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed === arr.length) {
                        callback(null);
                    }
                    else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    }
};
