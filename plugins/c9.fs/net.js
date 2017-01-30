define(function(require, exports, module) {
    main.consumes = ["vfs", "Plugin"];
    main.provides = ["net"];
    return main;

    function main(options, imports, register) {
        var vfs = imports.vfs;
        var Plugin = imports.Plugin;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        /***** Register and define API *****/
        
        /**
         * Provides access to opened ports in the connected workspace.
         * 
         * Example:
         * 
         *     net.connect(80, {}, function(err, stream) {
         *         if (err) throw err;
         *     
         *         stream.on("data", function(chunk) {
         *             console.log(chunk);
         *         });
         *         stream.write("GET /");
         *     });
         * @singleton
         **/
        plugin.freezePublicAPI({
            _events: [
                /** 
                 * @event beforeConnect Fires right before a connection is made
                 * @cancellable
                 * @param {Object} e
                 * @param {Number} e.port     the path to the file to execute
                 * @param {Object} e.options  the options passed to the spawn function
                 */
                "beforeConnect",
                /**
                 * @event afterConnect Fires right after a connection is made
                 * @param {Object} e
                 * @param {Number} e.port    the path to the file to execute
                 * @param {proc.Stream} e.stream  the process object returned by spawn
                 * @param {Error}  e.error   the error object if an error occured.
                 */
                "afterConnect"
            ],
            
            /**
             * Connects a regular socket to a port in the workspace.
             * 
             * Example:
             * 
             *     net.connect(80, {}, function(err, stream) {
             *         if (err) throw err;
             *     
             *         stream.on("data", function(chunk) {
             *             console.log(chunk);
             *         });
             *         stream.write("GET /");
             *     });
             * 
             * @param {Number}   port 
             * @param {Object}   [options]
             * @param {Number}   [options.retries="5"]     the number of times 
             *   the connection should be retried to establish before giving up.
             * @param {Number}   [options.retryDelay="50"] the delay in 
             *   milliseconds between each retry
             * @param {String}   [options.encoding="utf8"] the encoding of 
             *   the stream.
             * @param {Function} callback 
             * @param {Error}    callback.err       a connection error.
             * @param {proc.Stream}   callback.stream    the readable and writable 
             *   stream that allows you to interact with the connection.
             * @fires beforeConnect
             * @fires afterConnect
             */
            connect: function(port, options, callback) {
                emit("beforeConnect", { port: port, options: options });
                
                if (!options.encoding)
                    options.encoding = "utf8";
                
                vfs.connect(port, options, function(err, meta) {
                    callback(err, meta && meta.stream);
                    
                    emit("afterConnect", {
                        port: port, 
                        stream: meta && meta.stream,
                        error: err
                    });
                });
            }
        });
        
        register(null, {
            net: plugin
        });
    }
});