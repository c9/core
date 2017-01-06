define(function(require, exports, module) {
var acornHelper = require("./acorn_helper");
var tern = require("tern/lib/tern");
var baseLanguageHandler = require('plugins/c9.ide.language/base_handler');
var handler = module.exports = Object.create(baseLanguageHandler);
var tree = require("treehugger/tree");
var util = require("plugins/c9.ide.language/worker_util");
var completeUtil = require("plugins/c9.ide.language/complete_util");
var filterDocumentation = require("plugins/c9.ide.language.jsonalyzer/worker/ctags/ctags_util").filterDocumentation;
var getParameterDocs = require("plugins/c9.ide.language.jsonalyzer/worker/ctags/ctags_util").getParameterDocs;
var architectResolver = null;
var inferCompleter = require("plugins/c9.ide.language.javascript.infer/infer_completer");

var TERN_DEFS = [];

// TODO: only include meteor completions if project has a .meteor folder,
//       or if we find 1 or more meteor globals anywhere
// TODO: maybe enable this meteor plugin again?
// meteor: require("./lib/tern-meteor/meteor") && true,
// TODO: use https://github.com/borisyankov/DefinitelyTyped

// Listing these plugins here makes sure they're part of the build process
var BUILTIN_PLUGINS = {
    // angular: require("tern/plugin/angular"), // crashes the browser see https://github.com/ternjs/tern/issues/725
    // commonjs: require("tern/plugin/commonjs"), // doesn't work in client
    // complete_strings: require("tern/plugin/complete_strings"), // not useful to us
    doc_comment: require("tern/plugin/doc_comment"),
    es_modules: require("tern/plugin/es_modules"),
    modules: require("tern/plugin/modules"),
    node: require("tern/plugin/node"),
    node_resolve: require("tern/plugin/node_resolve"),
    requirejs: require("tern/plugin/requirejs"),
    // webpack: require("tern/plugin/webpack"), // doesn't work in client
    architect_resolver: architectResolver,
};

var ternWorker;
var ternServerOptions = {};
var ternRequestOptions = {};
var fileCache = {};
var dirCache = {};
var firstClassDefs = [];
var lastAddPath;
var lastAddValue;
var lastCacheRead = 0;
var MAX_CACHE_AGE = 60 * 1000 * 10;
var MAX_FILE_SIZE = 200 * 1024;
var PRIORITY_DEFAULT = 5;
var PRIORITY_LIBRARY_GLOBAL = 0;

/* function to perfom mixin
 */
function mix() {
    var arg, prop, child = {};
    for (arg = 0; arg < arguments.length; arg += 1) {
        if (!arguments[arg]) {
            continue;
        }
        for (prop in arguments[arg]) {
            if (arguments[arg].hasOwnProperty(prop)) {
                child[prop] = arguments[arg][prop];
            }
        }
    }
    return child;
}


handler.handlesLanguage = function(language) {
    // Note that we don't really support jsx here,
    // but rather tolerate it using error recovery...
    return language === "javascript" || language === "jsx";
};

handler.getCompletionRegex = function() {
    return (/^[\.]$/);
};

handler.getMaxFileSizeSupported = function() {
    // .25 of current base_handler default
    return .25 * 10 * 1000 * 80;
};

handler.$recacheCompletionLength = 3;

handler.init = function(callback) {
    initTern();
    inferCompleter.setExtraModules(ternWorker.cx.definitions.node);

    ternWorker.on("beforeLoad", function(e) {
        var file = e.name;
        var dir = dirname(e.name);

        if (dir[0] != "/")
            return;

        if (!dirCache[dir])
            util.$watchDir(dir, handler);

        fileCache[file] = fileCache[file] || {};
        dirCache[dir] = dirCache[dir] || {};
        dirCache[dir].used = Date.now();
        dirCache[dir][file] = true;
        lastCacheRead = Date.now();
    });

    handler.sender.on("tern_set_def_enabled", function(e) {
        setDefEnabled(e.data.name, e.data.def, e.data.enabled, e.data.options);
    });

    handler.sender.on("tern_set_server_options", function(e) {
        setOptions(e.data);
    });

    handler.sender.on("tern_set_request_options", function(e) {
        if (e.data) {
            ternRequestOptions = e.data;
        }
    });

    handler.sender.on("tern_get_plugins", function(e) {
        var pluginName;
        var plugins = [];
        var pluginToList;
        for (pluginName in ternWorker.options.plugins) {
            pluginToList = {
                name: pluginName,
                enabled: ternWorker.options.plugins[pluginName]
            };
            plugins.push(pluginToList);
        }
        handler.sender.emit("tern_read_plugins", plugins);
    });

    handler.sender.on("tern_update_plugins", function(e) {
        updatePlugins(e.data);
    });

    util.$onWatchDirChange(onWatchDirChange);
    setInterval(garbageCollect, 60000);
    callback();
};

function initTern() {
    ternWorker = new tern.Server({
        async: ternServerOptions.async !== undefined ? ternServerOptions.async : true,
        defs: ternServerOptions.defs !== undefined ? ternServerOptions.defs : TERN_DEFS,
        plugins: ternServerOptions.plugins !== undefined ? ternServerOptions.plugins : {},
        dependencyBudget: ternServerOptions.dependencyBudget !== undefined ? ternServerOptions.dependencyBudget : MAX_FILE_SIZE,
        reuseInstances: ternServerOptions.reuseInstances !== undefined ? ternServerOptions.reuseInstances : true,
        normalizeFilename: function(file) {
            if (file[0] != "/")
                file = "/" + file;
            if (!file.match(/[\/\\][^/\\]*\.[^/\\]*$/))
                file += ".js";
            return file;
        },
        getFile: ternServerOptions.getFile !== undefined ? ternServerOptions.getFile : function(file, callback) {
            // TODO we can use file cache in navigate to find a folder for unresolved modules
            
            if (file == handler.path)
                return done(null, handler.doc.getValue());

            util.stat(file, function(err, stat) {
                if (stat && stat.size > MAX_FILE_SIZE) {
                    err = new Error("File is too large to include");
                    err.code = "ESIZE";
                }

                if (err)
                    return done(err);

                fileCache[file] = fileCache[file] || {};
                fileCache[file].mtime = stat.mtime;

                util.readFile(file, { allowUnsaved: true }, function(err, data) {
                    if (err) return done(err);

                    lastAddPath = null; // invalidate cache
                    done(null, data);
                });
            });

            function done(err, result) {
                try {
                    callback(err, result);
                }
                catch (err) {
                    console.error(err.stack);
                }
            }
        }
    });
}

var setOptions = module.exports.setOptions = function(options) {
    for (var o in options) {
        ternWorker.options[o] = ternServerOptions[o] = options[o];
    }
};

/**
 * Example:
 * 
 * ```
 * updatePlugins({
 *      lightning: {
 *          name: "lightning",
 *          enabled: true
 *      }
 * });
 * ```
 */
var updatePlugins = module.exports.updatePlugins = function(plugins) {
    var requiresReset = false;
    for (var p in plugins) {
        var targetPlugin = plugins[p];
        var plugin = ternWorker.options.plugins[targetPlugin.name];
        if (targetPlugin.name == "angular")
            continue;
        if (targetPlugin.firstClass)
            firstClassDefs.push(targetPlugin.name);
        if (typeof plugin === "undefined" && typeof targetPlugin.path === "string") {
            // Register new plugin
            var loaded = require(targetPlugin.path);
            if (!loaded) {
                console.error("Could not load", targetPlugin.path);
                continue;
            }
            
            ternServerOptions.plugins = ternServerOptions.plugins || {};
            ternServerOptions.plugins[targetPlugin.name] = targetPlugin.enabled;

            if (targetPlugin.name === "architect_resolver")
                architectResolver = loaded;

            requiresReset = true;
        }
        else {
            if (plugin !== targetPlugin.enabled) {
                ternServerOptions.plugins = ternServerOptions.plugins || {};
                ternServerOptions.plugins[targetPlugin.name] = targetPlugin.enabled;
                requiresReset = true;
            }
        }
    }
    if (requiresReset)
        initTern();
    
    // Delete identifier also declared by "browser"
    ternWorker.defs.forEach(function(d) {
        if (d["!name"] === "node")
            delete d.console;
    });
};

function onWatchDirChange(e) {
    var dir = e.data.path.replace(/\/?$/, "/");
    e.data.files.forEach(function(stat) {
        var file = dir + stat.name;
        if (!fileCache[file] || fileCache[file].mtime >= stat.mtime)
            return;
        ternWorker.delFile(file);
        delete fileCache[file];
        lastAddPath = null; // invalidate local file cache
    });
}

function garbageCollect() {
    var minAge = lastCacheRead - MAX_CACHE_AGE;

    for (var file in fileCache) {
        if (fileCache[file].used < minAge) {
            ternWorker.delFile(file);
            delete fileCache[file];
            if (lastAddPath === file)
                lastAddPath = null;
        }
    }

    for (var dir in dirCache) {
        if (dirCache[dir].used < minAge) {
            handler.sender.emit("unwatchDir", { path: dir });
            delete dirCache[file];
        }
    }
}

handler.onDocumentOpen = function(path, doc, oldPath, callback) {
    setJSXMode(path);
    callback();
};

handler.analyze = function(value, ast, options, callback) {
    if (fileCache[this.path])
        return callback();

    // Pre-analyze  the first time we see a file, loading any imports
    fileCache[this.path] = {
        mtime: 0, // prefer reloading since we may be unsaved
        used: Date.now()
    };
    addTernFile(this.path, value);

    if (!architectResolver)
        return callback();

    architectResolver.onceReady(function() {
        handler.$flush(function(err) {
            if (err) console.error(err.stack || err);
            callback();
        });
    });
};

handler.complete = function(doc, fullAst, pos, options, callback) {
    // Don't show completions for definitions
    var node = options.node;
    if (!node ||
        ["FArg", "Function", "Arrow", "VarDecl", "VarDeclInit", "ConstDecl", "ConstDeclInit",
        "LetDecl", "LetDeclInit", "PropertyInit", "Label", "String"].indexOf(node.cons) > -1)
        return callback();

    addTernFile(this.path, doc.getValue());

    var line = doc.getLine(pos.row);
    var prefix = util.getPrecedingIdentifier(line, pos.column);
    var defaultOptions = {
        type: "completions",
        pos: pos,
        types: true,
        origins: true,
        docs: true,
        urls: true,
        guess: true,
        caseInsensitive: false,
    };
    var ternOptions = mix(defaultOptions, ternRequestOptions[defaultOptions.type]);
    handler.$request(ternOptions, function(err, result) {
        if (err) {
            console.error(err.stack || err);
            return callback();
        }

        callback(result.completions.map(function(match) {
            // Avoid random suggestions like angular.js properties on any object
            if (match.guess && match.type && match.type !== "fn()?)")
               return;
            if (match.type === "?")
                delete match.type;

            var isContextual = node.cons === "PropAccess" && !match.guess;

            if (!isContextual && match.origin === "browser" && prefix.length < 3)
                return; // skip completions like onchange (from window.onchange)

            var isFromLibrary = match.origin && match.origin[0] !== "/" && firstClassDefs.indexOf(match.origin) === -1;
            var priority = PRIORITY_DEFAULT;
            var icon = getIcon(match, priority);

            // Clean up messy node completions
            if (match.name[0] === '"') {
                if (match.origin !== "node")
                    return;
                match.name = match.name.replace(/"(.*)"/, "$1");
                icon = "package";
            }

            var isFunction = match.type && match.type.match(/^fn\(/);
            var isAnonymous = match.type && match.type.match(/^{/);
            var fullName;
            var fullNameTyped;
            if (isFunction) {
                var sig = getSignature(match);
                var parameters = sig.parameters;
                fullName = match.name + "(" + parameters.map(function(p) {
                    return p.name;
                }).join(", ") + ")";
                fullNameTyped = match.name + "(" + parameters.map(function(p) {
                    return p.name + (p.type ? " : " + p.type : "");
                }).join(", ") + ")";
                if (sig.returnType)
                    fullNameTyped = fullNameTyped + " : " + sig.returnType;
            }
            else {
                fullName = fullNameTyped = match.name;
                if (match.type)
                    fullNameTyped = fullNameTyped + " : " + match.type;
            }

            var doc = (match.type && !isFunction && !isAnonymous ? "Type: " + match.type + "<p>" : "")
                    + (match.doc ? filterDocumentation(match.doc) : "");
            if (match.doc === "Every function in JavaScript is actually a Function object.")
                doc = "";
            return {
                id: match.name,
                name: fullName,
                replaceText: match.name + (isFunction ? "(^^)" : ""),
                icon: icon,
                priority: priority,
                isContextual: isContextual,
                docHead: fullNameTyped,
                doc: (match.origin && isFromLibrary ? "Origin: " + match.origin + "<p>" : "") + doc,
                docUrl: match.url,
                isFunction: isFunction,
                url: match.url
            };
        }).filter(function(c) {
            return c;
        }));
    });
};

handler.jumpToDefinition = function(doc, fullAst, pos, options, callback) {
    addTernFile(this.path, doc.getValue());
    var defaultOptions = {
        type: "definition",
        pos: pos,
        types: true,
        origins: true,
        docs: true,
        urls: true,
        caseInsensitive: false,
    };
    var ternOptions = mix(defaultOptions, ternRequestOptions[defaultOptions.type]);
    this.$request(ternOptions, function(err, result) {
        if (err) {
            console.error(err.stack || err);
            return callback();
        }
        if (!result.file)
            return callback();
        if (!result.file.match(/[\/\\][^/\\]*\.[^/\\]*$/))
            result.file += ".js";
        callback({
            path: result.file,
            row: result.start.line,
            column: result.start.ch,
            icon: getIcon(result, PRIORITY_DEFAULT)
        });
    });
};

/* UNDONE: getRenamePositions(); doesn't appear to properly handle local references
   e.g. var foo = child_process.exec(); foo(); -> foo can't be renamed
handler.getRenamePositions = function(doc, fullAst, pos, options, callback) {
    var defaultOptions = addTernFile(this.path, doc.getValue());
    {
        type: "definition",
        pos: pos,
        types: true,
        origins: true,
        docs: true,
        urls: true,
        caseInsensitive: false,
    };
    var ternOptions = mix(defaultOptions, ternRequestOptions[defaultOptions.type]);
    this.$request(ternOptions, function(err, def) {
        if (err) {
            console.error(err.stack || err);
            return callback();
        }
        if (handler.path !== def.file) {
            console.error("Multi-file rename not supported");
            return callback();
        }
        var defaultOptions = {
            type: "refs",
            pos: pos,
            types: true,
            origins: true,
            docs: true,
            urls: true,
            caseInsensitive: false,
        };
        var options = mix(defaultOptions, ternRequestOptions[defaultOptions.type]);
        handler.$request(options, function(err, refs) {
            if (err) {
                console.error(err.stack || err);
                return callback();
            }

            var allIds = [def].concat(refs.refs);
            var selected = allIds.filter(function(id) {
                return pos.row === id.start.line
                    && id.start.ch <= pos.column && pos.column < id.end.ch;
            });
            if (!selected.length) {
                console.error("Could not find selected identifier");
                return callback();
            }

            callback({
                length: def.end.ch - def.start.ch,
                pos: { row: selected[0].start.line, column: selected[0].start.ch },
                others: allIds.filter(function(ref) {
                    return ref.file === handler.path;
                }).map(function(ref) {
                    return { row: ref.start.line, column: ref.start.ch };
                }),
            });
        });
    });
};
*/

handler.tooltip = function(doc, fullAst, cursorPos, options, callback) {
    var node = options.node;
    if (!node)
        return callback();
    var argIndex = -1;

    var callNode = getCallNode(node, cursorPos);
    var displayPos;

    if (callNode) {
        var argPos = { row: callNode[1].getPos().sl, column: callNode[1].getPos().sc };
        if (argPos.row >= 9999999999)
            argPos = cursorPos;

        var endLine = callNode.getPos().el;
        if (callNode[1].length && callNode[1].getPos().el !== callNode.getPos().el)
            endLine--; // put tooltip near end of arguments, not end of call
        displayPos = { row: endLine, column: callNode[1].getPos().sc };
        argIndex = this.getArgIndex(callNode, doc, cursorPos);
    }
    else if (node.isMatch('Var(_)')) {
        displayPos = { row: node.getPos().sl, column: node.getPos().sc };
        argIndex = -1;
        // Don't display tooltip at end of identifier (may just have been typed in)
        if (cursorPos.column === node.getPos().ec)
            return callback();
    }
    else {
        return callback();
    }

    if (argIndex === -1 && callNode)
        return callback();

    if (!callNode)
        return callback(); // TODO: support this case??

    addTernFile(this.path, doc.getValue());
    var defaultOptions = {
        type: "type",
        pos: { row: callNode[0].getPos().el, column: callNode[0].getPos().ec },
        types: true,
        origins: true,
        docs: true,
        urls: true,
        caseInsensitive: false,
        preferFunction: true,
    };
    var ternOptions = mix(defaultOptions, ternRequestOptions[defaultOptions.type]);
    this.$request(ternOptions, function(err, result) {
        if (err) {
            console.error(err.stack || err);
            return callback();
        }
        if (!result.type || !result.name || !result.type.match(/^fn\(/))
            return callback();

        var rangeNode = callNode && callNode.getPos().sc < 99999 ? callNode : node;
        var sig = getSignature(result);
        if (sig.parameters[argIndex])
            sig.parameters[argIndex].active = true;

        var parameterDocs = getParameterDocs(result.doc);
        sig.parameters.forEach(function(p) {
            if (p.type === "?")
                delete p.type;
            if (parameterDocs["_" + p.name])
                p.docHtml = parameterDocs["_" + p.name];
        });
        if (sig.returnType === "?")
            delete sig.returnType;
        if (sig.returnType === "[]")
            sig.returnType = "Array";

        callback({
            hint: {
                signatures: [{
                    name: result.name.replace(/.*\./, ""),
                    docHtml: result.doc && result.doc.replace(/^\* /g, ""),
                    parameters: sig.parameters,
                    returnType: sig.returnType
                }],
            },
            displayPos: displayPos,
            pos: rangeNode.getPos()
        });
    });
};

/**
 * Gets the index of the selected function argument, or returns -1 if N/A.
 */
handler.getArgIndex = function(node, doc, cursorPos) {
    var cursorTreePos = { line: cursorPos.row, col: cursorPos.column };
    var result = -1;
    node.rewrite(
        'Call(e, args)', "New(e, args)", function(b) {
            // Try to determine at which argument the cursor is located in order
            // to be able to show a label
            result = -1;
            var line = doc.getLine(cursorPos.row);
            if (line[b.args.getPos().ec + 1] && line[b.args.getPos().ec + 1].match(/[ ,]/))
                b.args.getPos().ec++;

            if (b.args.length === 0 && this.getPos().ec - 1 === cursorPos.column) {
                result = 0;
            }
            else if (b.args.length === 0 && line.substr(cursorPos.column).match(/^\s*\)/)) {
                result = 0;
            }
            else if (!tree.inRange(this.getPos(), cursorTreePos, true)) {
                return this;
            }
            else if (cursorPos.row === this.getPos().sl && line.substr(0, cursorPos.column + 1).match(/,\s*\)$/)) {
                result = b.args.length;
                return this;
            }
            for (var i = 0; i < b.args.length; i++) {
                if (b.args[i].cons === "ERROR" && result === -1) {
                    result = i;
                    break;
                }
                b.args[i].traverseTopDown(function() {
                    var pos = this.getPos();
                    if (this === node) {
                        result = i;
                        return this;
                    }
                    else if (pos && pos.sl <= cursorPos.row && pos.sc <= cursorPos.column) {
                        if (pos.sl === cursorPos.row && pos.ec === cursorPos.column - 1 && line[pos.ec] === ")")
                            return result = -1;
                        result = i;
                    }
                });
            }
            return this;
        }
    );
    return result;
};

function getCallNode(currentNode, cursorPos) {
    var result;
    var previous;
    currentNode.traverseUp(
        'Call(e, args)', 'New(e, args)', function(b, node) {
            if (b.e === previous)
                return;
            result = node;
            return node;
        },
        'Function(x, args, body)', 'Arrow(args, body)', function(b, node) {
            // Bail for anything inside a function. The function itself is ok.
            if (node !== currentNode)
                return node;
            previous = node;
        },
        'PropertyInit(x, _)', 'Method(x, body)', function(b, node) {
            // Bail
            return node;
        },
        function(node) {
            previous = node;
        }
    );
    return result;
}

function getIcon(property, priority) {
    if (property.guess || !property.type || property.type === "fn()?") {
        // These were found in calls or property accesses and are uncertain
        return property.type ? "method2" : "property2";
    }
    else if (property.type.match(/^fn\(/)) {
        return priority ? "method" : "method2";
    }
    else {
        return priority ? "property" : "property2";
    }
}

function addTernFile(path, value) {
    if (lastAddPath === path && lastAddValue === value)
        return;
    lastAddPath = path;
    lastAddValue = value;
    setJSXMode(path);
    ternWorker.addFile(path, value);
}

function dirname(path) {
    return path.replace(/[\/\\][^\/\\]*$/, "");
}

/**
 * Parse tern type strings.
 * (Would have been useful if tern exposed type objects, but this works.)
 */
function getSignature(property) {
    if (!property.type || !property.type.match(/^fn\(/))
        return { parameters: []};
    var sig = property.type;
    var parameters = [{ name: "", type: "" }];
    var parameterIndex = 0;
    var returnType = "";
    var depth = 0;
    var inType = false;
    var inReturn = false;
    for (var i = "fn(".length; i < sig.length; i++) {
        switch (sig[i]) {
            case "(": case "{":
                depth++; break;
            case ")": case "}":
                depth--; break;
            case ":":
                inType = true; break;
            case ",":
                if (depth)
                    break;
                inType = false;
                parameters.push({ name: "", type: "" });
                parameterIndex++;
                break;
            case " ":
                break;
            case "-": // ->
                if (depth >= 0)
                    break;
                i++;
                depth++;
                inType = false;
                inReturn = true;
                break;
            case "?":
                if (!depth && inType && parameters[parameterIndex].type)
                    parameters[parameterIndex].name = "[" + parameters[parameterIndex].name + "]";
                break;
            default:
                if (sig[i] === "]")
                    depth--;
                if (!depth && inReturn)
                    returnType += sig[i];
                else if (!depth && !inType)
                    parameters[parameterIndex].name += sig[i];
                else if (!depth && inType)
                    parameters[parameterIndex].type += sig[i];
                if (sig[i] === "[")
                    depth++;
        }
    }

    parameters.forEach(function(p) {
        if (p.type === "?")
            delete p.type;
        if (p.type === "[]")
            p.type = "Array";
        if (p.type)
            p.type = p.type.replace(/\.prototype$/, "").replace(/.*\./, "");
    });


    if (parameters[0].name === "")
        parameters.shift();

    return {
        parameters: parameters,
        returnType: returnType && returnType.replace(/\.prototype$/, "").replace(/.*\./, "")
    };
}

handler.$request = function(query, callback) {
    query.file = this.path;
    setJSXMode(this.path);

    if (query.pos)
        query.end = query.start = {
            line: query.pos.row || query.pos.sl || 0,
            ch: query.pos.column || query.pos.sc || 0
        };
    query.lineCharPositions = true;

    try {
        ternWorker.request(
            {
                query: query,
            },
            done
        );
    }
    catch (err) {
        if (isDone) throw err;
        return done(err);
    }

    var isDone;
    function done(err, result) {
        isDone = true;
        callback(err, result);
    }
};

handler.$flush = function(callback) {
    try {
        ternWorker.flush(done);
    }
    catch (err) {
        if (isDone) throw err;
        return done(err);
    }

    var isDone;
    function done(err, result) {
        isDone = true;
        callback(err, result);
    }
};

/**
 * @param {String} name
 * @param {Object} def
 * @param {Boolean} enabled
 * @param {Object} [options]
 * @param {Boolean} [options.firstClass]
 *       Treat as if these were built-in types,
 *       showing nicer icons and hiding the library name.
 */
function setDefEnabled(name, def, enabled, options) {
    if (options && options.firstClass)
        firstClassDefs.push(name);
    
    var i;
    if (!enabled) {
        ternWorker.defs = ternWorker.defs.filter(function(d) {
            return d["!name"] !== name;
        });
        ternWorker.reset();
        ternServerOptions.defs = ternWorker.defs;
        return;
    }

    var defs = def instanceof Array ? def : [def];
    var downloaded = 0;
    defs.forEach(function(def) {
        if (typeof def !== "string") {
            ternWorker.defs.push(def);
            return checkDone();
        }
            
        completeUtil.fetchText(def, function(err, result) {
            if (err) console.error(err);
            try {
                result = JSON.parse(result);
            }
            catch (err) {
                console.error(err);
                result = null;
            }

            ternWorker.defs.push(result);
            checkDone();
        });
    });
    function checkDone() {
        if (++downloaded < defs.length)
            return;
        ternServerOptions.defs = ternWorker.defs;
        ternWorker.reset();
    }
}

function setJSXMode(path) {
    acornHelper.setLanguage(/\.jsx$/.test(path) ? "jsx" : null);
}

});
