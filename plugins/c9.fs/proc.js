define(function(require, exports, module) {
    main.consumes = ["vfs", "Plugin"];
    main.provides = ["proc"];
    return main;

    function main(options, imports, register) {
        var vfs = imports.vfs;
        var Plugin = imports.Plugin;
        
        var ProcessToPty = require("./proc2pty");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var installMode;
        var tmuxName = options.tmuxName;
        
        /***** Register and define API *****/
        
        /**
         * This is a proxy for a running process in the workspace. This object exposes
         * the stdin, stdout and stderr streams, which you can interact with to 
         * control the running process.
         * 
         * See {@link proc#spawn}
         * 
         * @class proc.Process
         * @extends Object
         */
        /** 
         * the process ID of the running process.
         * @property {Number} pid
         */
        /** 
         * the stdin (Standard Input) stream of this process.
         * @property {proc.Stream} stdin
         */
        /**
         * the stdout (Standard Output) stream of this process.
         * @property {proc.Stream} stdout
         */
        /** 
         * the stderr (Standard Error) stream of this process.
         * @property {proc.Stream} stderr
         */
        /** 
         * Fires after the process ends. If the process terminated normally, 
         * code is the final exit code of the process; otherwise, it's null. 
         * If the process terminated due to receipt of a signal, signal is the string 
         * name of the signal; otherwise, it's null.
         * 
         * Note that the child process stdio streams might still be open.
         * 
         * @event exit
         * @param {Number} code
         * @param {String} signal
         */
        /** 
         * Sends a signal to the child process. See [signal(7)](http://www.kernel.org/doc/man-pages/online/pages/man7/signal.7.html)
         * for a list of available signals.
         * 
         * Note that while the function is called kill, the signal delivered to the 
         * child process may not actually kill it. kill really just sends a signal to 
         * a process.
         * 
         * @method kill
         * @param {String} signal
         */
        /**
         * Detaches the given child process.
         * 
         * @method unref
         */
        /** 
         * A stream is an abstract interface implemented by various objects in 
         * Cloud9. Streams are readable, writable, or both.
         * @class proc.Stream
         * @extends Object
         */
        /** 
         * A boolean that is true for writable streams, but turns false after an error 
         * event occurs, the stream comes to an 'end', or if destroy() was called.
         * @property {Boolean} writable
         */
        /**
         * Fires when data is received on the stream.
         * @event data
         * @param {String} chunk
         */
        /** 
         * Fires when the stream has received an EOF. Indicates that no more data 
         * events will happen. If the stream is also writable, it may be possible to 
         * continue writing.
         * @event end
         */
        /** 
         * Fires if there was an error receiving data.
         * @event error
         */
        /** 
         * Emitted when the underlying resource (for example, the backing file 
         * descriptor) has been closed. Not all streams emit this.
         * @event close
         */
        /** 
         * Writes string with to the stream. 
         * @method write
         * @param {String} data
         */
        /** 
         * Terminates the stream with EOF or FIN. This call send queued write data 
         * before closing the stream.
         * @method end
         * @param {String} data
         */
        /** 
         * Closes the underlying file descriptor.
         * @method destroy
         */
        /** 
         * This is the Stream.prototype() method available on all Stream objects. 
         * It connects this read stream to a destination. Incoming data on this stream 
         * is then written to destination. The destination and source streams are kept 
         * in sync by Cloud9.
         * @method pipe
         * @param destination
         * @param [options]
         */
        /**
         * Interface for the special stream object, passed by {@link proc#pty}. This
         * object acts both like a stream and like a process at the same time.
         * @class proc.PtyStream
         * @extends Object
         */
        /**
         * Fires when data is received on the stream.
         * @event data
         * @param {String} chunk
         */
        /** 
         * Fires after the process ends. If the process terminated normally, 
         * code is the final exit code of the process; otherwise, it's null. 
         * If the process terminated due to receipt of a signal, signal is the string 
         * name of the signal; otherwise, it's null.
         * 
         * Note that the child process stdio streams might still be open.
         * 
         * @event exit
         */
        /** 
         * Writes string with to the stream. 
         * @method write
         * @param {String} data
         */
        /** 
         * Terminates the stream with EOF or FIN. This call send queued write data 
         * before closing the stream.
         * @method end
         * @param {String} data
         */
        /** 
         * Terminates the PTY
         * @method destroy
         */
        /** 
         * @method pipe
         * @param destination
         * @param [options]
         */
        /**
         * Provides access to process control in the workspace
         * @singleton
         **/
        plugin.freezePublicAPI({
            /**
             * @ignore
             */
            get installMode() { return installMode; },
            set installMode(_vfs) {
                vfs = _vfs || imports.vfs;
                installMode = _vfs ? true : false;
            },
            
            _events: [
                /**
                 * @event beforeSpawn Fires right before a file is executed
                 * @cancellable
                 * @param {Object} e
                 * @param {String} e.path     the path to the file to execute
                 * @param {Object} e.options  the options passed to the spawn function
                 */
                "beforeSpawn",
                /** 
                 * @event afterSpawn Fires right after a file is executed
                 * @param {Object}  e
                 * @param {String}  e.path     the path to the file to execute
                 * @param {proc.Process} e.process  the process object returned by spawn
                 */
                "afterSpawn",
                /**
                 * @event beforePty Fires right before a process is spawned
                 * @cancellable
                 * @param {Object} e
                 * @param {String} e.path     the path to the file to execute
                 * @param {Object} e.options  the options passed to the spawn function
                 */
                "beforePty",
                /** @event afterPty Fires right after a process is spawned
                 * @param {Object}  e
                 * @param {String}  e.path     the path to the file to execute
                 * @param {proc.Process} e.process  the process object returned by spawn
                 */
                "afterPty",
                /**
                 * @event beforeTmux Fires right before a process is spawned
                 * @cancellable
                 * @param {Object} e
                 * @param {String} e.path     the path to the file to execute
                 * @param {Object} e.options  the options passed to the spawn function
                 */
                "beforeTmux",
                /** @event afterTmux Fires right after a process is spawned
                 * @param {Object}  e
                 * @param {String}  e.path     the path to the file to execute
                 * @param {proc.Process} e.process  the process object returned by spawn
                 */
                "afterTmux",
                /** @event beforeExecFile Fires right before a file is executed
                 * @cancellable
                 * @param {Object} e
                 * @param {String} e.path     the path to the file to execute
                 * @param {Object} e.options  the options passed to the spawn function
                 */
                "beforeExecFile",
                /** @event afterExecFile Fires right after a file is executed
                 * @param {Object} e
                 * @param {String} e.path    the path to the file to execute
                 * @param {proc.Stream} e.stdout  The stdout stream
                 * @param {proc.Stream} e.stderr  The stderr stream
                 * @param {Error}  e.error   the error if any
                 */
                "afterExecFile"
            ],
            
            /**
             * Spawns a child process and returns a process object complete 
             * with three stdio streams.
             * 
             * Example:
             * 
             *     proc.spawn("ls", function(err, process) {
             *         if (err) throw err;
             * 
             *         process.stdout.on("data", function(chunk) {
             *             console.log(chunk); 
             *         });
             *     });
             * 
             * @param {String}   path                             the path to the file to execute
             * @param {Object}   [options]
             * @param {Array}    [options.args]                   An array of args to pass to the executable.
             * @param {String}   [options.stdoutEncoding="utf8"]  The encoding to use on the stdout stream.
             * @param {String}   [options.stderrEncoding="utf8"]  The encoding to use on the stderr stream.
             * @param {String}   [options.cwd]                    Current working directory of the child process
             * @param {Object}   [options.stdio]                  Child's stdio configuration. 
             * @param {Object}   [options.env]                    Environment key-value pairs
             * @param {Boolean}  [options.detached]               The child will be a process group leader. (See below)
             * @param {Number}   [options.uid]                    Sets the user identity of the process. (See setuid(2).)
             * @param {Number}   [options.gid]                    Sets the group identity of the process. (See setgid(2).)
             * @param {Boolean}  [options.resumeStdin]            Start reading from stdin, so the process doesn't exit
             * @param {Boolean}  [options.resolve]                Resolve the path to the VFS root before spawning process
             * @param {Function} callback
             * @param {Error}    callback.err                     The error object if one has occured.
             * @param {proc.Process}  callback.process                 The child process
             * @fires beforeSpawn
             * @fires afterSpawn
             */
            spawn: function(path, options, callback) {
                emit("beforeSpawn", { path: path, options: options });
                
                if (!callback) { // Handle optional argument
                    callback = options;
                    options = {};
                }
                
                !options.stdoutEncoding && (options.stdoutEncoding = "utf8");
                !options.stderrEncoding && (options.stderrEncoding = "utf8");
                !options.stdinEncoding && (options.stdinEncoding = "utf8");
                
                //@todo this can be optimized to resolve locally
                if (options.resolve)
                    vfs.resolve(path, {}, exec);
                else
                    exec(null, { path: path });
                    
                function exec(err, data) {
                    vfs.spawn(data.path, options, function(err, meta) {
                        callback(err, meta && meta.process);
                        
                        emit("afterSpawn", {
                            path: path, 
                            process: meta && meta.process
                        });
                    });
                }
            },
            
            /**
             * Spawns a child process in a PTY and returns a stream object.
             * Use this method if the process you wish to start requires a 
             * terminal (for instance VI).
             * 
             * Note that, unless you know what you are doing, you generally
             * want to use spawn, instead of pty. If you are looking for a way
             * to run a process in an output window in Cloud9, then see 
             * {@link run#run}.
             * 
             * Example:
             * 
             *     proc.pty("bash", {
             *         args: ["-c", "vi", "helloworld"]
             *     }, function(err, pty) {
             *         if (err) throw err;
             * 
             *         pty.on("data", function(chunk) {
             *             console.log(chunk); 
             *         });
             *         pty.write("ihello world\x27:wq");
             *     });
             * 
             * @param {String}    path                            the path to the file to execute
             * @param {Object}    [options]
             * @param {Array}     [options.args]                  An array of args to pass to the executable.
             * @param {String}    [options.name="xterm-color"]    The terminal emulator name.
             * @param {Number}    [options.cols="80"]             Number of cols in characters
             * @param {Number}    [options.rows="24"]             Number of rows in characters
             * @param {String}    [options.cwd]                   Current working directory of the child process
             * @param {Object}    [options.env]                   Environment key-value pairs
             * @param {Boolean}   [options.resolve]               Resolve the path to the VFS root before executing file
             * @param {Function}  callback
             * @param {Error}     callback.err                    The error object, if any
             * @param {proc.PtyStream} callback.pty                    The stdout stream
             * @fires beforePty
             * @fires afterPty
             */
            pty: function(path, options, callback) {
                if (installMode || options.fakePty) {
                    plugin.spawn(path, options, function(err, process) {
                        if (err) return callback(err);
                        callback(null, new ProcessToPty(process));
                    });
                    return;
                }
                
                emit("beforePty", { path: path, options: options });
                
                if (!options.encoding)
                    options.encoding = "utf8";
                if (!options.name)
                    options.name = "xterm-color";
                
                //@todo this can be optimized to resolve locally
                if (options.resolve)
                    vfs.resolve(path, {}, exec);
                else
                    exec(null, { path: path });
                    
                function exec(err, data) {
                    vfs.pty(data.path, options, function(err, meta) {
                        callback(err, meta && meta.pty);
                        
                        emit("afterPty", { path: path, pty: meta && meta.pty });
                    });
                }
            },
            
            /**
             * Spawns a child process in a TMUX session and returns a stream object.
             * Use this method if the process you wish to start requires a 
             * terminal (for instance VI).
             * 
             * Note that, unless you know what you are doing, you generally
             * want to use spawn, instead of tmux. If you are looking for a way
             * to run a process in an output window in Cloud9, then see 
             * {@link run#run}.
             * 
             * Example:
             * 
             *     proc.tmux("bash", {
             *         args: ["-c", "vi", "helloworld"]
             *     }, function(err, tmux) {
             *         if (err) throw err;
             * 
             *         tmux.on("data", function(chunk) {
             *             console.log(chunk); 
             *         });
             *         tmux.write("ihello world\x27:wq");
             *     });
             * 
             * @param {String}    command                         The command to execute in the tmux session. Pass empty string to start the default shell and make sure kill is not set.
             * @param {Object}    [options]
             * @param {String}    [options.session]               The name of the tmux session
             * @param {Boolean}   [options.kill]                  First kill an existing session
             * @param {Boolean}   [options.attach]                Attach if the session exists
             * @param {Boolean}   [options.detach]                Detach immediately after starting the process
             * @param {Boolean}   [options.detachOthers]          Detach other clients immediately after starting the process
             * @param {Boolean}   [options.output]                Act like an output pane
             * @param {Boolean}   [options.base]                  The base path to store the watch files
             * @param {String}    [options.name="xterm-color"]    The terminal emulator name.
             * @param {Number}    [options.cols="80"]             Number of cols in characters
             * @param {Number}    [options.rows="24"]             Number of rows in characters
             * @param {String}    [options.cwd]                   Current working directory of the child process
             * @param {Object}    [options.env]                   Environment key-value pairs
             * @param {Function}  callback
             * @param {Error}     callback.err                    The error object, if any
             * @param {proc.PtyStream} callback.pty               The stdout stream
             * @fires beforeTmux
             * @fires afterTmux
             */
            tmux: function(command, options, callback) {
                emit("beforeTmux", { command: command, options: options });
                
                if (!options.encoding)
                    options.encoding = "utf8";
                if (!options.name)
                    options.name = "xterm-color";
                if (tmuxName)
                    options.tmuxName = tmuxName;
                
                options.command = command || "";
                
                vfs.tmux("", options, function(err, meta) {
                    callback(err, meta && meta.pty, meta && meta.pid, meta || {});
                    
                    emit("afterTmux", {
                        command: command, 
                        pty: meta && meta.pty,
                        pid: meta && meta.pid
                    });
                });
            },
            
            /**
             * Executes an executable file in the workspace and buffers the 
             * stdout and stderr until the process is complete. 
             * 
             * Note: The buffer can grow big and slow down the general IDE
             * operations. Unless you know for certain that the output will be
             * minimal (10kb or less), use {@link proc#spawn}.
             * 
             * Example:
             * 
             *     proc.execFile("find", { 
             *         args: ["."] 
             *     }, function(err, stdout, stderr) {
             *         console.log(stderr, stdout);
             *     });
             * 
             * @param {String}   path                             the path to the file to execute
             * @param {Object}   [options]
             * @param {Array}    [options.args]                   An array of args to pass to the executable.
             * @param {String}   [options.stdoutEncoding="utf8"]  The encoding to use on the stdout stream. Defaults to .
             * @param {String}   [options.stderrEncoding="utf8"]  The encoding to use on the stderr stream. Defaults to "utf8".
             * @param {String}   [options.cwd]                    Current working directory of the child process
             * @param {Array}    [options.stdio]                  Child's stdio configuration. (See above)
             * @param {Object}   [options.env]                    Environment key-value pairs
             * @param {String}   [options.encoding="utf8"]        
             * @param {Number}   [options.timeout=0]         
             * @param {Number}   [options.maxBuffer=200*1024]
             * @param {String}   [options.killSignal="SIGTERM"]
             * @param {Boolean}  [options.resumeStdin]            Start reading from stdin, so the process doesn't exit
             * @param {Boolean}  [options.resolve]                Resolve the path to the VFS root before executing file
             * @param {Function} callback 
             * @param {Error}    callback.error                   The error object if an error occurred.
             * @param {String}   callback.stdout                  The stdout buffer
             * @param {String}   callback.stderr                  The stderr buffer
             * @fires beforeExecFile
             * @fires afterExecFile
             */
            execFile: function(path, options, callback) {
                if (!callback)
                    return this.execFile(path, {}, arguments[1]);

                emit("beforeExecFile", { path: path, options: options });
                
                if (!options.encoding)
                    options.encoding = "utf8";
                
                //@todo this can be optimized to resolve locally
                if (options.resolve)
                    vfs.resolve(path, {}, exec);
                else
                    exec(null, { path: path });
                    
                function exec(err, data) {
                    vfs.execFile(data.path, options, function(err, e) {
                        var stdout = (err || e).stdout;
                        var stderr = (err || e).stderr;
                        
                        callback(err, stdout, stderr);
                        
                        emit("afterExecFile", {
                            path: path, 
                            stdout: stdout, 
                            stderr: stderr,
                            error: err
                        });
                    });
                }
            },
            /**
             * @ignore
             */
            killtree: function(pid, options, callback) {
                vfs.killtree(pid, options, callback);
            }
        });
        
        register(null, {
            proc: plugin
        });
    }
});