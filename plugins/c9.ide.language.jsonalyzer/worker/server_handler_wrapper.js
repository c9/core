define(function(require, exports, module) {
    
    var lastId = 0;
    
    /**
     * Wraps a server handler into a worker handler.
     */
    module.exports.ServerHandlerWrapper = function(descriptor, worker) {
        var PluginBase = require("./jsonalyzer_base_handler");
        var handler = Object.create(PluginBase);
        handler.$source = descriptor.path;
        handler.languages = descriptor.properties.languages;
        handler.extensions = descriptor.properties.extensions;
        handler.maxCallInterval = descriptor.properties.maxCallInterval;
        
        if (descriptor.functions.analyzeCurrent)
            handler.analyzeCurrent = function(path, value, ast, options, callback) {
                callServer({
                    handlerPath: descriptor.path,
                    maxCallInterval: descriptor.properties.maxCallInterval,
                    semaphore: handler.$source,
                    filePath: path,
                    method: "analyzeCurrent",
                    args: [path, null, null, options]
                }, callback);
            };
        if (descriptor.functions.findImports)
            handler.findImports = function(path, value, ast, options, callback) {
                callServer({
                    handlerPath: descriptor.path,
                    maxCallInterval: descriptor.properties.maxCallInterval,
                    filePath: path,
                    method: "findImports",
                    args: [path, null, null, options]
                }, callback);
            };
        if (descriptor.functions.analyzeOthers)
            handler.analyzeOthers = function(paths, options, callback) {
                callServer({
                    handlerPath: descriptor.path,
                    maxCallInterval: descriptor.properties.maxCallInterval,
                    filePath: null, // we're not using collab for these so we don't care
                    method: "analyzeOthers",
                    args: [paths, options]
                }, callback);
            };
        return handler;
    
        function callServer(options, callback) {
            options.id = ++lastId;
            worker.sender.on("jsonalyzerCallServerResult", function onResult(e) {
                if (e.data.id !== options.id)
                    return;
                
                worker.sender.off("jsonalyzerCallServerResult", onResult);

                var err = e.data.result[0];
                if (err && err.code === "EFATAL") {
                    console.error("Fatal error in " + descriptor.path, err);
                    handler.disabled = err;
                }

                callback.apply(null, e.data.result);
            });
            worker.sender.emit("jsonalyzerCallServer", options);
        }
    };
    
});
