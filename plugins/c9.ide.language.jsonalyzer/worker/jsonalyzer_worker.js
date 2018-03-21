/*
 * jsonalyzer worker
 *
 * @copyright 2013, Ajax.org B.V.
 * @author Lennart Kats <lennart add c9.io>
 */
define(function(require, exports, module) {

var baseLanguageHandler = require("plugins/c9.ide.language/base_handler");
var languageWorker = require("plugins/c9.ide.language.core/worker");
var index = require("./semantic_index");
var jumptodef = require("./jumptodef");
var complete = require("./complete");
var outline = require("./outline");
var refactor = require("./refactor");
var highlight = require("./highlight_occurrences");
var scopeAnalyzer = require('plugins/c9.ide.language.javascript/scope_analyzer');
var directoryIndexer = require("./directory_indexer");
var fileIndexer = require("./file_indexer");
var ctagsUtil = require("./ctags/ctags_util");
var ctagsEx = require("./ctags/ctags_ex");
var HandlerRegistry = require("./handler_registry").HandlerRegistry;
var ServerHandlerWrapper = require("./server_handler_wrapper").ServerHandlerWrapper;
require("treehugger/traverse"); // add traversal methods

var worker = module.exports = Object.create(baseLanguageHandler);
var isOnline = false;
var isInWebWorker = typeof window == "undefined" || !window.location || !window.document;
var handlers = new HandlerRegistry();
var handlersServer = new HandlerRegistry();

worker.$isInited = false;
worker.DEBUG = true;
worker.KIND_DEFAULT = scopeAnalyzer.KIND_DEFAULT;
worker.KIND_PACKAGE = scopeAnalyzer.KIND_PACKAGE;

worker.init = function(callback) {
    worker.sender.on("onlinechange", function(event) {
        worker.onOnlineChange(event);
    });
    worker.sender.on("filechange", function(event) {
        worker.onFileChange(event);
    });
    worker.sender.on("dirchange", function(event) {
        worker.onDirChange(event);
    });
    worker.sender.on("jsonalyzerRegister", function(event) {
        worker.loadPlugin(event.data.modulePath, event.data.contents, function(err, plugin) {
            if (err) return console.error(err);
            plugin.$source = event.data.modulePath;
            
            var oldHandler = worker.getHandlerFor(worker.path, worker.language);
            var options = event.data.options || {};
            
            options.sender = worker.sender;
            handlers.registerHandler(plugin, worker, options);
            if (oldHandler !== worker.getHandlerFor(worker.path, worker.language)) {
                // Invalidate cache; reanalyze
                index.markStale(oldHandler);
                languageWorker.$lastWorker.onUpdate();
            }
                
            worker.sender.emit("jsonalyzerRegistered",
                { modulePath: event.data.modulePath, err: err });
        });
    });
    worker.sender.on("jsonalyzerRegisterServer", function(event) {
        var oldHandler = worker.getServerHandlerFor(worker.path, worker.language);
        handlersServer.registerHandler(
            new ServerHandlerWrapper(event.data, worker), worker);
        if (oldHandler !== worker.getServerHandlerFor(worker.path, worker.language)) {
            // Invalidate cache; reanalyze
            index.markStale(oldHandler);
            var clientHandler = worker.getHandlerFor(worker.path, worker.language);
            if (oldHandler !== clientHandler)
                index.markStale(clientHandler);
            languageWorker.$lastWorker.onUpdate();
        }
    });
    worker.sender.on("jsonalyzerUnregister", function(event) {
        if (window.require)
            window.require.modules[event.data.modulePath] = null;
        handlers.unregisterHandler(event.data.modulePath);
        worker.sender.emit("jsonalyzerUnregistered", { modulePath: event.data.modulePath });
    });
    worker.sender.on("jsonalyzerUnregisterServer", function(event) {
        handlersServer.unregisterHandler(event.data.modulePath);
        worker.sender.emit("jsonalyzerUnregisteredServer", { modulePath: event.data.modulePath });
    });
    
    directoryIndexer.init(this);
    fileIndexer.init(this);
    index.init(this);
    jumptodef.init(this);
    complete.init(this);
    outline.init(this);
    refactor.init(this);
    highlight.init(this);
    ctagsUtil.init(ctagsEx, this);
    
    // Calling the callback to register/activate the plugin
    // (calling it late wouldn't delay anything else)
    callback();
};

worker.loadPlugin = function(modulePath, contents, callback) {
    // This follows the same approach as c9.ide.language.core/worker.register();
    // see the comments there for more background.
    if (contents) {
        contents = contents.replace(/^(define\()(function|["'])/m, function(_, def, arg1) {
            if (arg1 == "function")
                return def + "'" + modulePath + "',[]," + arg1;
            return _;
        });
        try {
            eval.call(null, contents + "\n//@ sourceURL=" + modulePath);
        } catch (e) {
            return callback("Could not load language handler " + modulePath + ": " + e);
        }
    }
    
    require([modulePath], function(handler) {
        if (!handler)
            return callback("Could not load language handler " + modulePath);
        callback(null, handler);
    }, function(err) {
        callback(err);
    });
};

worker.handlesLanguage = function(language, part) {
    return (!part || !part.index) && this.getHandlerFor(this.path, language);
};

worker.onDocumentOpen = function(path, doc, oldPath, callback) {
    // Check path validity if inited; otherwise do check later
    if (this.$isInited && !this.getHandlerFor(path, null))
        return callback();
    
    // Analyze any opened document to make completions more rapid
    fileIndexer.analyzeOthers([path]);
    callback();
};

worker.analyze = function(doc, ast, options, callback) {
    if (options.minimalAnalysis && index.get(worker.path) || !worker.path)
        return callback();
    
    // Ignore embedded languages and just use the full document,
    // since we can't handle multiple segments in the index atm
    var fullDoc = this.doc.getValue();
    this.language = this.doc.$language;
        
    fileIndexer.analyzeCurrent(worker.path, fullDoc, ast, options, function(err, result, imports, markers) {
        if (err)
            console.error("[jsonalyzer] Warning: could not analyze " + worker.path + ": " + (err.stack || err));
            
        // Analyze imports without blocking other analyses
        if (imports && imports.length)
            fileIndexer.analyzeOthers(imports, true);
        
        callback(markers);
    });
};

worker.complete = complete.complete.bind(complete);

worker.outline = outline.outline.bind(outline);

worker.jumpToDefinition = jumptodef.jumpToDefinition.bind(jumptodef);

worker.getRefactorings = refactor.getRefactorings.bind(refactor);

worker.getRenamePositions = refactor.getRenamePositions.bind(refactor);

worker.commitRename = refactor.commitRename.bind(refactor);

worker.highlightOccurrences = highlight.highlightOccurrences.bind(highlight);

worker.onOnlineChange = function(event) {
    isOnline = event.data.isOnline;
},

worker.onFileChange = function(event) {
    if (worker.disabled)
        return;
    var path = event.data.path.replace(/^\/((?!workspace)[^\/]+\/[^\/]+\/)?workspace\//, "");
    
    if (!this.getHandlerFor(path, null))
        return;
    
    if (event.data.isSave && path === this.path)
        return fileIndexer.analyzeCurrent(path, event.data.value, null, { isSave: true }, function() {});

    index.removeByPath(path);
    
    // We'll enqueue any files received here, since we can
    // assume they're still open if they're being watched
    fileIndexer.analyzeOthers([path]);
};

worker.onDirChange = function(event) {
    directoryIndexer.enqueue(event.data.path);
};

worker.getHandlerFor = function(path, language) {
    language = language || (worker.path === path && worker.language);
    
    return handlers.getHandlerFor(path, language)
        || this.getServerHandlerFor(path, language);
};

worker.getServerHandlerFor = function(path, language) {
    language = language || (worker.path === path && worker.language);
    
    return handlersServer.getHandlerFor(path, language);
};

worker.getAllHandlers = function() {
    return handlers.getAllHandlers();
};

worker.getHandlerRegistry = function() {
    return handlers;
};

});

