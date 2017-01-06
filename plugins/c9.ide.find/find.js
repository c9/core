define(function(require, exports, module) {
    main.consumes = ["Plugin", "finder", "util"];
    main.provides = ["find"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var finder = imports.finder;
        var util = imports.util;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var basePath = options.basePath;
        var state = {};
        
        /***** Methods *****/
        
        function getFileList(options, callback) {
            if (!options.base)
                options.base = basePath;
            
            var index = (options.base ? options.base + "/" : "") + options.path;
            if (!state[index]) {
                state[index] = { 
                    queue: [], 
                    cached: "", 
                    cacheTime: null, 
                    retrieving: false 
                };
            }
            var _ = state[index];
            
            if (_.cached && !options.nocache 
              && new Date() - _.cacheTime < 60 * 60 * 1000)
                return callback(null, _.cached);
            
            _.queue.push([options, callback]);
            
            if (_.retrieving)
                return;

            if (emit("fileList", options) === false)
                return callback(new Error("Cancelled"));

            _.cached = "";
            _.retrieving = true;
            
            finder.list(options, function(err, stdout, stderr, process) {
                if (!err) {
                    _.cacheTime = new Date();
                }

                var needsBuffer = [];
                _.queue.forEach(function(iter) {
                    if (err || !iter[0].buffer)
                        iter[1](err, stderr);
                    else
                        needsBuffer.push(iter[1]);
                });
                _.queue = [];
                
                // We got the results pre-buffered
                if (typeof stdout == "string") {
                    done(err, stdout);
                    return;
                }
                
                if (err || !needsBuffer) return;
                
                _.cached = "";
                stdout.on("data", function(lines) {
                    _.cached += lines;
                });
                var errCached = "";
                stderr.on("data", function(lines) {
                    errCached += lines;
                });
                
                process.on("exit", function(code) {
                    done(
                        code ? "Error " + code + "\n" + errCached : null, 
                        _.cached
                    );
                });
                
                function done(err, data) {
                    _.retrieving = false;
                    _.cached = data;
                    if (options.base && options.base != "/") {
                        var rgx = new RegExp("^" + util.escapeRegExp(options.base), "gm");
                        _.cached = _.cached.replace(rgx, "");
                    } else if (options.base == "/" && _.cached[0] != "/") {
                        _.cached = _.cached.trim().replace(/^\/*/gm, "/");
                    }
                    
                    needsBuffer.forEach(function(cb) { cb(err, _.cached); });
                }
            });
        }
        
        function findFiles(options, callback) {
            if (!options.base)
                options.base = basePath;
            
            finder.find(options, function(err, stdout, stderr, process) {
                if (err || !options.buffer)
                    return callback(err, stdout, process);
                
                var buffer = "";
                stdout.on("data", function(lines) {
                    buffer += lines;
                });
                var stderrBuffer = "";
                stderr.on("data", function(lines) {
                    stderrBuffer += lines;
                });
                
                process.on("exit", function(code) {
                    if (options.base && options.base != "/") {
                        var rgx = new RegExp(util.escapeRegExp(options.base), "g");
                        buffer = buffer.replace(rgx, "").replace(/\\/g, "/");
                    }
                    callback(
                        code ? "Error " + code + "\n" + stderrBuffer : null,
                        buffer
                    );
                });
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {

        });
        plugin.on("unload", function() {
            
        });
        
        /***** Register and define API *****/
        
        /**
         * Finds or lists files and/or lines based on their filename or contents.
         * 
         * Example of getting a list of all the files in folder:
         * 
         *     find.getFileList({
         *         path   : "/",
         *         hidden : false,
         *         buffer : true
         *     }, function(err, result) {
         *         if (err) throw err;
         *         console.log(result);
         *     });
         * 
         * Example of searching for a keyword in all javascript files in a 
         * certain path, excluding _test.js files.
         * 
         *     find.findFiles({
         *         path    : "/",
         *         query   : "var basepath",
         *         hidden  : false,
         *         pattern : "*.js,-*_test.js",
         *         buffer  : true
         *     }, function(err, result) {
         *         if (err) throw err;
         *         console.log(result);
         *     })
         * 
         * @singleton
         */
        plugin.freezePublicAPI({
            
            /**
             * @ignore
             */
            get basePath() { return basePath; },
            
            /**
             * Retrieves a list of files and lines that match a string or pattern
             * This method tries to do intelligent caching by hooking into the
             * fs and watcher.
             * @param {Object}  options 
             * @param {String}  options.path              The path to search in (displayed in the results). Defaults to "".
             * @param {String}  [options.base]            The base path to search in (is not displayed in the results when buffered). Defaults to the fs root.
             * @param {String}  options.query             The text or regexp to match the file contents with
             * @param {Boolean} [options.casesensitive]   Specifies whether to match on case or not. Default is false;
             * @param {Boolean} [options.wholeword]       Specifies whether to match the `pattern` as a whole word.
             * @param {String}  [options.hidden]          Specifies whether to include files starting with a dott. Defaults to false.
             * @param {String}  [options.regexp]          Specifies whether the `pattern` is a regular expression.
             * @param {String}  [options.pattern]         Specify what files/dirs to include 
             *      and exclude. Separate with a "," and prefix the words with minus '-' to exclude.
             * @param {Boolean} [options.replaceAll]      Specifies whether to replace the found matches
             * @param {String}  [options.replacement]     The string to replace the found matches with
             * @param {Boolean} [options.buffer]          Specifies whether to buffer the request. This changes 
             *      what is returned in the callback to a string instead of a stream.
             * @param {Function}        callback          Called when the results come in
             * @param {Error}           callback.err      The error object if an error has occured.
             * @param {proc.Stream/String}   callback.results  The search results 
             *   are a string when `options.buffer` is set to true, otherwise 
             *   it is a stream.
             */
            findFiles: findFiles,
            
            /**
             * Retrieves a list of files under a path
             * @param {Object}  options
             * @param {String}  options.path            The path to search in (displayed in the results). Defaults to "".
             * @param {String}  [options.base]          The base path to search in (is not displayed in the results when buffered). Defaults to the fs root.
             * @param {Boolean} [options.hidden]        Specifies whether to include files starting with a dott. Defaults to false.
             * @param {Number}  [options.maxdepth]      The maximum amount of parents a file can have.
             * @param {Boolean} [options.nocache]       Specifies whether to ignore the cache
             * @param {Boolean} [options.buffer]        Specifies whether to buffer the request. This changes what is returned in the callback to a string instead of a stream.
             * @param {Function}      callback          Called when the results come in
             * @param {Error}         callback.err      The error object if an error has occured.
             * @param {proc.Stream/String} callback.results  The search results 
             *   are a string when `options.buffer` is set to true, otherwise 
             *   it is a stream.
             */
            getFileList: getFileList
        });
        
        register(null, {
            find: plugin
        });
    }
});