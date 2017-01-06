/**
 * GDB Debugger plugin for Cloud9
 *
 * @author Dan Armendariz <danallan AT cs DOT berkeley DOT edu>
 * @author Rob Bowden <rob AT cs DOT harvard DOT edu>
 */

var net = require('net');
var fs = require('fs');
var spawn = require('child_process').spawn;

// process arguments
function printUsage() {
    var p = [process.argv[0], process.argv[1]].join(" ");
    var msg = [
        "Cloud9 GDB Debugger shim",
        "Usage: " + p + " [-b=bp] [-d=depth] [-g=gdb] [-p=proxy] BIN [args]\n",
        "  bp: warn when BPs are sent but none are set (default true)",
        "  depth: maximum stack depth computed (default 50)",
        "  gdb: port that GDB client and server communicate (default 15470)",
        "  proxy: port or socket that this shim listens for connections (default ~/.c9/gdbdebugger.socket)",
        "  BIN: the binary to debug with GDB",
        "  args: optional arguments for BIN\n"
    ];
    console.error(msg.join("\n"));
    process.exit(1);
}

var argc = process.argv.length;
if (argc < 3) printUsage();

// defaults
var PROXY = { sock: process.env.HOME + "/.c9/gdbdebugger.socket" };
var GDB_PORT = 15470;
var MAX_STACK_DEPTH = 50;
var DEBUG = false;
var BIN = "";
var BP_WARN = true;

// parse middle arguments
function parseArg(str, allowNonInt) {
    if (str == null || str === "") printUsage();
    var val = parseInt(str, 10);
    if (!allowNonInt && isNaN(val)) printUsage();
    return val;
}

// attempt to parse shim arguments
var i = 0;
for (i = 2; i < argc && BIN === ""; i++) {
    var arg = process.argv[i];
    var a = arg.split("=");    
    var key = a[0];
    var val = (a.length == 2) ? a[1] : null;

    switch (key) {
        case "-b":
        case "--bp":
            BP_WARN = (val === "true");
            break;
        case "-d":
        case "--depth":
            MAX_STACK_DEPTH = parseArg(val);
            break;
        case "-g":
        case "--gdb":
            GDB_PORT = parseArg(val);
            break;
        case "-p":
        case "--proxy":
            var portNum = parseArg(val, true);

            if (isNaN(portNum))
                PROXY = { sock: val };
            else
                PROXY = { host: "127.0.0.1", port: portNum };
            break;
        case "--debug":
            DEBUG = (val === "true");
            break;
        default:
            BIN = arg;
    }
}

// all executable's arguments exist after executable path
var ARGS = process.argv.slice(i);

var STACK_RANGE = "0 " + MAX_STACK_DEPTH;

// class instances
var client = null;
var gdb = null;
var executable = null;

// store abnormal exit state to relay to user
var exit = null;

var log = function() {};

if (DEBUG) {
    var log_file = fs.createWriteStream("./.gdb_proxy.log");
    log = function(str) {
        var args = Array.prototype.slice.call(arguments);
        log_file.write(args.join(" ") + "\n");
        console.log(str);
    };
}

////////////////////////////////////////////////////////////////////////////////
// Client class to buffer and parse full JSON objects from plugin

function Client(c) {
    this.connection = c;
    this.buffer = [];

    this.reconnect = function(c) {
        // replace old connection
        this.cleanup();
        this.connection = c;
    };

    this.connect = function(callback) {
        var parser = this._parse();

        this.connection.on("data", function(data) {
            log("PLUGIN: " + data.toString());

            // parse commands and begin processing queue
            var commands = parser(data);

            if (commands.length > 0) {
                gdb.command_queue = gdb.command_queue.concat(commands);
                gdb.handleCommands();
            }
        });

        this.connection.on("error", function (e) {
            log(e);
            process.exit(0);
        });

        this.connection.on("end", function() {
            this.connection = null;
        });

        callback();
    };

    // flush response buffer
    this.flush = function() {
        if (!this.connection) return;
        if (this.buffer.length == 0) return;

        this.buffer.forEach(function(msg) {
            this.connection.write(msg);
        });
        this.buffer = [];
    };

    this.cleanup = function() {
        if (this.connection)
            this.connection.end();
    };

    this._parse = function() {
        var data_buffer = "";
        var data_length = false;
        var json_objects = [];
        function parser(data) {
            data = data_buffer + data.toString();

            function abort() {
                var ret = json_objects;
                json_objects = [];
                return ret;
            }

            if (data_length === false) {
                var idx = data.indexOf("\r\n\r\n");
                if (idx === -1) {
                    data_buffer = data;
                    return abort();
                }

                data_length = parseInt(data.substr(15, idx), 10);
                data = data.slice(idx + 4);
            }

            // haven't gotten the full JSON object yet
            if (data.length < data_length) {
                return abort();
            }

            data_buffer = data.slice(data_length);
            data = data.substr(0, data_length);

            try {
                data = JSON.parse(data);
            }
            catch (ex) {
                console.log("There was an error parsing data from the plugin.");
                log("JSON (Parse error): " + data);
                return abort();
            }

            json_objects.push(data);

            data_length = false;
            return parser("");
        }
        return parser;
    };

    this.send = function(args) {
        args = JSON.stringify(args);
        var msg = ["Content-Length:", args.length, "\r\n\r\n", args].join("");
        log("SENDING: " + msg);
        if (this.connection)
            this.connection.write(msg);
        else
            this.buffer.push(msg);
    };
}

// End of Client class
////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
// Process class; initiating gdbserver, which in turn begins the executable

function Executable() {
    this.proc = null;
    this.running = false;

    /**
     * Spawn GDB server which will in turn run executable, sharing
     * stdio with the shim.
     * 
     * @param {Function} callback  Called when gdbserver is listening
     */
    this.spawn = function(callback) {
        var args = ["--once", ":" + GDB_PORT, BIN].concat(ARGS);
        this.proc = spawn("gdbserver", args, {
            cwd: process.cwd(),
            // stdio: "inherit",
            stdio: ['pipe', process.stdout, 'pipe'],
        });

        var errqueue = [];
        this.proc.on("exit", function(code, signal) {
            log("GDB server terminated with code " + code + " and signal " + signal);
            client && client.send({ err: "killed", code: code, signal: signal });
            exit = { proc: "GDB server", code: code, signal: signal };

            // only quit if stderr has finished buffering data
            if (errqueue === null)
                process.exit(code);
        }.bind(this));
        
        this.proc.on("error", function(e) {
            console.error("ERROR while launching the debugger:");
            if (e.code == "ENOENT") {
                console.log("\t\"gdbserver\" is not installed");
            } else {
                console.error(e);
            }
            process.exit(1);
        });
 
        this.proc.stderr.on("end", function() {
            // dump queued stderr data, if it exists
            if (errqueue !== null) {
                log(errqueue.join(""));
                errqueue = null;
            }

            // quit now if gdbserver ended before stderr buffer flushed
            if (exit !== null)
                process.exit(exit.code);
        });

        // wait for gdbserver to listen before executing callback
        function handleStderr(data) {
            // once listening, forward stderr to process
            if (this.running)
                return log(data.toString());

            // consume and store stderr until gdbserver is listening
            var str = data.toString();
            errqueue.push(str);

            if (str.indexOf("Listening") > -1) {
                // perform callback when gdbserver is ready
                callback();
            }
            if (str.indexOf("127.0.0.1") > -1) {
                // soak up final gdbserver message before sharing i/o stream
                errqueue = null;
                this.running = true;
            }
        }
        this.proc.stderr.on("data", handleStderr.bind(this));

        // necessary to redirect stdin this way or child receives SIGTTIN
        process.stdin.pipe(this.proc.stdin);
    };
    
    /**
     * Dismantle the GDB server process.
     */
    this.cleanup = function() {
        if (this.proc) {
            this.proc.kill("SIGHUP");
            this.proc = null;
        }
    };
}

// End of Client class
////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
// GDB class; connecting, parsing, issuing commands to the debugger

function GDB() {
    this.sequence_id = 0;
    this.bp_set = null;
    this.callbacks = {};
    this.state = {};
    this.framecache = {};
    this.varcache = {};
    this.running = false;
    this.started = false;
    this.clientReconnect = false;
    this.memoized_files = [];
    this.command_queue = [];
    this.proc = null;

    /////
    // Private methods

    // Create a buffer function that sends full lines to a callback
    function buffers() {
        var last_buffer = "";

        return function(data, callback) {
            var full_output = last_buffer + data;
            var lines = full_output.split("\n");

            // populate the stream's last buffer if the last line is incomplete
            last_buffer = (full_output.slice(-1) == "\n") ? "" : lines.pop;

            for (var i = 0; i < lines.length; i++) {
                if (lines[i].length === 0) continue;
                callback(lines[i]);
            }
        };
    }


    ////
    // Public Methods

    // spawn the GDB client process
    this.spawn = function() {
        this.proc = spawn('gdb', ['-q', '--interpreter=mi2', BIN], {
            detached: false,
            cwd: process.cwd()
        });
        
        this.proc.on("error", function(e) {
            console.error("ERROR while launching the debugger:");
            if (e.code == "ENOENT") {
                console.log("\t\"gdbserver\" is not installed");
            } else {
                console.error(e);
            }
        });

        var self = this;

        // handle gdb output
        var stdout_buff = buffers();
        this.proc.stdout.on("data", function(stdout_data) {
            stdout_buff(stdout_data, self._handleLine.bind(self));
        });

        // handle gdb stderr
        var stderr_buff = buffers();
        this.proc.stderr.on("data", function(stderr_data) {
            stderr_buff(stderr_data, function(line) {
                log("GDB STDERR: " + line);
            });
        });

        this.proc.on("exit", function(code, signal) {
            log("GDB terminated with code " + code + " and signal " + signal);
            client && client.send({ err: "killed", code: code, signal: signal });
            exit = { proc: "GDB", code: code, signal: signal };
            process.exit(code);
        });
    };

    this.connect = function(callback) {
        this.issue("-target-select", "remote localhost:" + GDB_PORT, function(reply) {
            if (reply.state != "connected")
                return callback(reply, "Cannot connect to gdbserver");

            // connected! set eval of conditional breakpoints on server
            this.issue("set breakpoint", "condition-evaluation host", callback);

        }.bind(this));
    };

    // Suspend program operation by sending sigint and prepare for state update
    this.suspend = function() {
        this.proc.kill('SIGINT');
    };

    this.cleanup = function() {
        if (this.proc) {
            this.proc.kill("SIGHUP");
            this.proc = null;
        }
    };

    // issue a command to GDB
    this.issue = function(cmd, args, callback) {
        var seq = "";
        if (!args) args = "";

        if (typeof callback === "function") {
            seq = ++this.sequence_id;
            this.callbacks[seq] = callback;
        }

        var msg = [seq, cmd, " ", args, "\n"].join("");
        log(msg);
        this.proc.stdin.write(msg);
    };

    this.post = function(client_seq, command, args) {
        this.issue(command, args, function(output) {
            output._id = client_seq;
            client.send(output);
        });
    };


    //////
    // Parsing via:
    // https://github.com/besnardjb/ngdbmi/blob/master/ngdbmi.js#L1025

    String.prototype.setCharAt = function(idx, chr) {
        if (idx > this.length - 1) {
            return this.toString();
        }
        else {
            return this.substr(0, idx) + chr + this.substr(idx + 1);
        }
    };

    this._removeArrayLabels = function(args) {
        /* We now have to handle labels inside arrays */

        var t_in_array = [];
        var in_array = 0;
        for (var i = 0; i < args.length; i++) {
            /* This is a small state handling
             * in order to see if we are in an array
             * and therefore if we have to remove labels */
            if (args[i] == "[")
                t_in_array.push(1);

            if (args[i] == "{")
                t_in_array.push(0);

            if (args[i] == "]" || args[i] == "}")
                t_in_array.pop();

            /* in_array == 1 if we are in an array =) */
            in_array = t_in_array[t_in_array.length - 1];

            /* If we encounter ',"' inside an array delete until '":' or '"=' */
            if (in_array
                && (args[i] == "," || args[i] == "[")
                && args[i + 1] == "\"") {
                var k = i;

                /* Walk the label */
                while ((k < args.length)
                       && (args[k] != ":")
                       && (args[k] != "=")
                       && (args[k] != "]")) {
                    k++;
                }

                /* if we end on a label end (= or :) then clear it up */
                if (args[k] == ":" || args[k] == "=") {
                    for (var l = (i + 1); l <= k; l++) {
                        args = args.setCharAt(l, ' ');
                    }
                }
            }
        }
        return args;
    };

    this._parseStateArgs = function(args) {
        /* This is crazy but GDB almost provides a JSON output */
        args = args.replace(/\\n\s*$/, "");
        args = args.replace(/=(?=["|{|\[])/g, '!:');
        args = args.replace(/([a-zA-Z0-9-_]*)!:/g, "\"$1\":");

        /* Remove array labels */
        args = this._removeArrayLabels(args);

        /* And wrap in an object */
        args = "{" + args + "}";

        var ret = {};

        try {
            ret = JSON.parse(args);
        }
        catch (e) {
            /* We lamentably failed =( */
            log("JSON ERROR: " + e + "\nJSON: " + args);
        }

        return ret;
    };

    this._getState = function(line) {
        var m = line.match("^([a-z-]*),");

        if (m && m.length == 2)
            return m[1].trim();

        /* Couldn't we merge this with the previous one ? */
        m = line.match("^([a-z-]*)$");

        if (m && m.length == 2)
            return m[1].trim();

        return undefined;
    };

    this._parseState = function(line) {
        line = line.trim();

        var gdb_state = {};

        /* Handle state */
        var state = this._getState(line);

        if (state)
            gdb_state.state = state;

        /* Handle args if present */
        var m = line.match("^[a-z-]*,(.*)");
        if (m && m.length == 2)
            gdb_state.status = this._parseStateArgs(m[1]);

        return gdb_state;
    };

    ////
    // GDB Output handling
    ////

    // stack frame cache getter function
    this._cachedFrame = function(frame, frameNum, create) {
        // the uniqueness of a frame is determined by the function and its depth
        var depth = this.state.frames.length - 1 - frameNum;
        var key = frame.file + frame.line + frame.func + depth;
        if (!this.framecache.hasOwnProperty(key)) {
            if (create)
                this.framecache[key] = create;
            else
                return false;
        }
        return this.framecache[key];
    };

    // Stack State Step 0; initiate request
    this._updateState = function(signal, thread) {
        // don't send state updates on reconnect, wait for plugin to request
        if (this.clientReconnect) return;

        if (signal) {
            this.state.err = "signal";
            this.state.signal = signal;
        }
        this.state.thread = (thread) ? thread : null;

        if (signal && signal.name === "SIGSEGV")
            // dump the varobj cache in segfault so var-updates don't crash GDB
            this._flushVarCache();
        else
            this._updateThreadId();
    };

    // Stack State Step 0a; flush var objects in event of a segfault
    this._flushVarCache = function() {
        // determine all the varobj names by pulling keys from the cache
        var keys = [];
        for (var key in this.varcache) {
            if (this.varcache.hasOwnProperty(key))
                keys.push(key);
        }
        this.varcache = {};

        function __flush(varobjs) {
            // once we've run out of keys, resume state compilation
            if (varobjs.length == 0)
                return this._updateThreadId();

            // pop a key from the varobjs stack and delete it
            var v = varobjs.pop();
            this.issue("-var-delete", v, __flush.bind(this, varobjs));
        }

        // begin flushing the keys
        __flush.call(this, keys);
    };

    // Stack State Step 1; find the thread ID
    this._updateThreadId = function() {
        if (this.state.thread !== null)
            return this._updateStack();

        this.issue("-thread-info", null, function(state) {
            this.state.thread = state.status["current-thread-id"];
            this._updateStack();
        }.bind(this));
    };

    // Stack State Step 2; process stack frames and request arguments
    this._updateStack = function() {
        this.issue("-stack-list-frames", STACK_RANGE, function(state) {
            this.state.frames = state.status.stack;

            // provide relative path of script to IDE
            for (var i = 0, j = this.state.frames.length; i < j; i++) {
                // if file name is not here a stack overflow has probably occurred
                if (this.state.frames[i].func == "??" ||
                    !this.state.frames[i].hasOwnProperty("fullname"))
                {
                    // go code often has "??" at the top of the stack, ignore that
                    this.state.frames[i].exists = false;
                    continue;
                }

                var file = this.state.frames[i].fullname;

                if (!file) {
                    continue;
                }
                // remember if we can view the source for this frame
                if (!(file in this.memoized_files)) {
                    this.memoized_files[file] = {
                        exists: fs.existsSync(file)
                    };
                }
                // we must abort step if we cannot show source for top function
                if (!this.memoized_files[file] || !this.memoized_files[file].exists && !this.state.err) {
                    if (i != 0) continue;
                    this.state = {};
                    this.issue("-exec-finish");
                    return;
                }

                // notify IDE if file exists
                this.state.frames[i].exists = this.memoized_files[file].exists;
            }
            this._updateStackArgs();
        }.bind(this));
    };

    // Stack State Step 3; append stack args to frames; request top frame locals
    this._updateStackArgs = function() {
        this.issue("-stack-list-arguments", "--simple-values " + STACK_RANGE,
        function(state) {
            var args = state.status['stack-args'];
            for (var i = 0; i < args.length; i++) {
                if (this.state.frames[i])
                    this.state.frames[i].args = args[i].args;
            }
            this._updateLocals();
        }.bind(this));
    };

    // Stack State Step 4: fetch each frame's locals & send all to proxy
    this._updateLocals = function() {
        function requestLocals(frame) {
            // skip this frame if we have its variables cached
            if (this._cachedFrame(this.state.frames[frame], frame))
                return frameLocals.call(this, frame, null, true);

            var args = [
                "--thread",
                this.state.thread,
                "--frame",
                frame,
                "--simple-values"
            ].join(" ");
            this.issue("-stack-list-locals", args, frameLocals.bind(this, frame));
        }
        function frameLocals(i, state, cache) {
            var f = this.state.frames[i];
            if (cache)
                f.locals = this._cachedFrame(f, i).locals;
            else
                f.locals = state.status.locals;

            if (--i >= 0)
                requestLocals.call(this, i);
            else
                // update vars and fetch remaining
                this._updateCachedVars();
        }
        // work from bottom of stack; upon completion, active frame should be 0
        requestLocals.call(this, this.state.frames.length - 1);
    };

    // Stack State Step 5: update cached vars
    this._updateCachedVars = function() {
        this.issue("-var-update", "--all-values *", function(reply) {
            //update cache
            for (var i = 0; i < reply.status.changelist.length; i++) {
                var obj = reply.status.changelist[i];

                // updates to out-of-scope vars are irrelevant
                if (obj.in_scope != "true") {
                    if (obj.in_scope == "invalid")
                        this.issue("-var-delete", obj.name);
                    continue;
                }

                if (!this.varcache[obj.name]) {
                    console.log("FATAL: varcache miss for varobj " + obj.name);
                    process.exit(1);
                }

                this.varcache[obj.name].value = obj.value;

                if (obj.type_changed == "true")
                    this.varcache[obj.name].type = obj.new_type;
            }

            // stitch cache together in state
            for (var i = 0; i < this.state.frames.length; i++) {
                var frame = this.state.frames[i];
                var cache = this._cachedFrame(frame, i);

                // cache miss
                if (cache === false) continue;

                // rebuild from cache
                frame.args = [];
                for (var j = 0; j < cache.args.length; j++)
                    frame.args.push(this.varcache[cache.args[j]]);

                frame.locals = [];
                for (var j = 0; j < cache.locals.length; j++)
                    frame.locals.push(this.varcache[cache.locals[j]]);
            }

            this._fetchVars();
        }.bind(this));
    };

    // Stack State Step 6 (final): fetch information for all non-trivial vars
    this._fetchVars = function() {
        var newvars = [];

        function __iterVars(vars, varstack, f) {
            if (!vars) return;
            for (var i = 0; i < vars.length; i++) {
                var vari = vars[i];
                if (!vari.type)
                    continue; // TODO how to properly display this?
                if (vari.type.slice(-1) === '*') {
                    // variable is a pointer, store its address
                    vari.address = parseInt(vari.value, 16);

                    if (!vari.address) {
                        // don't allow null pointers' children to be evaluated
                        vari.address = 0;
                        vari.value = "NULL";
                        continue;
                    }
                }
                varstack.push({ frame: f, item: vari });
            }
        }

        function __createVars(varstack) {
            if (varstack.length == 0) {
                // DONE: set stack frame to topmost; send & flush compiled data
                this.issue("-stack-select-frame", "0");
                client.send(this.state);
                this.state = {};
                return;
            }

            var obj = varstack.pop();

            var item = obj.item;
            var frame = obj.frame;

            // if this variable already has a corresponding varobj, advance
            if (item.objname)
                return __createVars.call(this, varstack);

            // no corresponding varobj for this variable, create one
            var args = ["-", "*", item.name].join(" ");
            this.issue("-var-create", args, function(item, state) {
                // allow the item to remember the varobj's ID
                item.objname = state.status.name;
                item.numchild = state.status.numchild;

                // store this varobj in caches
                this.varcache[item.objname] = item;

                // notify the frame of this variable
                frame.push(item.objname);

                __createVars.call(this, varstack);
            }.bind(this, item));
        }

        // iterate over all locals and args and push complex vars onto stack
        for (var i = 0; i < this.state.frames.length; i++) {
            var frame = this.state.frames[i];

            // skip the frame if it's already cached
            if (this._cachedFrame(frame, i) !== false) continue;

            var cache = this._cachedFrame(frame, i, { args: [], locals: []});
            __iterVars(frame.args, newvars, cache.args);
            __iterVars(frame.locals, newvars, cache.locals);
        }
        __createVars.call(this, newvars);
    };

    // Received a result set from GDB; initiate callback on that request
    this._handleRecordsResult = function(state) {
        if (typeof state._seq === "undefined")
            return;

        // command is awaiting result, issue callback and remove from queue
        if (this.callbacks[state._seq]) {
            this.callbacks[state._seq](state);
            delete this.callbacks[state._seq];
        }
        this.handleCommands();
    };

    // Handle program status update
    this._handleRecordsAsync = function(state) {
        if (typeof state.status === "undefined")
            return;

        if (state.state === "stopped")
            this.running = false;

        var cause = state.status.reason;
        var thread = state.status['thread-id'];

        if (cause == "signal-received") {
            var signal = {
                name: state.status['signal-name'],
                text: state.status['signal-meaning']
            };
            this._updateState(signal, thread);
        }
        else if (cause === "breakpoint-hit" || cause === "end-stepping-range" ||
                 cause === "function-finished")
            // update GUI state at breakpoint or after a step in/out
            this._updateState(false, thread);
        else if (cause === "exited-normally")
            // program has quit
            process.exit();
    };

    // handle a line of stdout from gdb
    this._handleLine = function(line) {
        if (line.trim() === "(gdb)")
            return;

        // status line: ^status or id^status
        var line_split = line.match(/^([0-9]*)\^(.*)$/);

        var state = null;
        var token = "^";

        // line split will be true if it's a status line
        if (line_split) {
            state = this._parseState(line_split[2]);

            // line_id is present if the initiating command had a _seq
            if (line_split[1])
                state._seq = line_split[1];
        }
        else {
            token = line[0];
            state = this._parseState(line.slice(1));
        }

        log("GDB: " + line);

        // first character of output determines line meaning
        switch (token) {
            case '^': this._handleRecordsResult(state);
                      break;
            case '*': this._handleRecordsAsync(state);
                      break;
            case '+': break; // Ongoing status information about slow operation
            case '=': break; // Notify async output
            case '&': break; // Log stream; gdb internal debug messages
            case '~': break; // Console output stream
            case '@': break; // Remote target output stream
            default:
        }
    };

    /////
    // Incoming command handling
    /////

    this.handleCommands = function() {
        // command queue is empty
        if (this.command_queue.length < 1)
            return;

        // get the next command in the queue
        var command = this.command_queue.shift();

        if (typeof command.command === "undefined") {
            log("ERROR: Received an empty request, ignoring.");
        }

        if (typeof command._id !== "number")
            command._id = "";

        var id = command._id;

        // fix some condition syntax
        if (command.condition)
            command.condition = command.condition.replace(/=(["|{|\[])/g, "= $1");

        switch (command.command) {
            case 'run':
            case 'continue':
            case 'step':
            case 'next':
            case 'finish':
                if (this.started === false) {
                    this.started = true;

                    // provide a warning if BPs sent but not set
                    if (this.bp_set === false && BP_WARN)
                        console.error("\nWARNING: Could not set any",
                            "breakpoints. Try deleting", BIN, "and",
                            "re-compiling\nyour code. Be sure to compile with",
                            "-ggdb3.\n");
                }
                this.clientReconnect = false;
                this.running = true;
                this.post(id, "-exec-" + command.command);
                break;

            case "var-set":
                this.post(id, "-var-assign", command.name + " " + command.val);
                break;

            case "var-children":
                // if passed a single var name, we want to fetch its children
                var largs = ["--simple-values", command.name].join(" ");
                this.issue("-var-list-children", largs, function(state) {
                    var children = [];
                    if (parseInt(state.status.numchild, 10) > 0)
                        state.status.children.forEach(function(child) {
                            child.objname = child.name;
                            this.varcache[child.name] = child;
                            children.push(child);
                        }.bind(this));
                    client.send({ _id: id, children: children, state: "done" });
                }.bind(this));
                break;

            case "bp-change":
                if (command.enabled === false)
                    this.post(id, "-break-disable", command.id);
                else if (command.condition)
                    this.post(id, "-break-condition", command.id + " " + command.condition);
                else
                    this.post(id, "-break-enable", command.id);
                break;

            case "bp-clear":
                // include filename for multiple files
                this.post(id, "-break-delete", command.id);
                break;

            case "bp-set":
                var args = [];

                // create a disabled breakpoint if requested
                if (command.enabled === false)
                    args.push("-d");

                if (command.condition) {
                    command.condition = command.condition.replace(/"/g, '\\"');
                    args.push("-c");
                    args.push('"' + command.condition + '"');
                }

                args.push('"' + command.fullpath + ':' + (command.line + 1) + '"');

                this.issue("-break-insert", args.join(" "), function(output) {
                    // record whether we've successfully set any BPs
                    this.bp_set = this.bp_set || (output.state === "done");

                    output._id = id;
                    client.send(output);
                }.bind(this));
                break;

            case "bp-list":
                this.post(id, "-break-list");
                break;

            case "eval":
                var eargs = ["--thread", command.t, "--frame", command.f];
                // replace quotes with escaped quotes
                eargs.push('"' + command.exp.replace(/"/g, '\\"') + '"');
                this.post(id, "-data-evaluate-expression", eargs.join(" "));
                break;

            case "reconnect":
                if (this.running) {
                    this.clientReconnect = true;
                    this.suspend();
                    client.send({ _id: id, state: "running" });
                }
                else
                    client.send({ _id: id, state: "stopped" });
                break;

            case "suspend":
                this.suspend();
                client.send({ _id: id, state: "stopped" });
                break;

            case "status":
                if (this.running) {
                    client.send({ _id: id, state: "running" });
                }
                else {
                    client.send({ _id: id, state: "stopped" });
                    this._updateState();
                }
                break;

            case "detach":
                client.cleanup();
                this.issue("monitor", "exit", function() {
                    log("shutdown requested");
                    process.exit();
                });
                break;

            default:
                log("PROXY: received unknown request: " + command.command);
        }
    };
}

// End GDB class
////////////////////////////////////////////////////////////////////////////////
// Proxy initialization

gdb = new GDB();
executable = new Executable(); 

// handle process events
// catch SIGINT, allowing GDB to pause if running, quit otherwise
process.on("SIGINT", function() {
    log("SIGINT");
    if (!gdb || !gdb.running)
        process.exit();
});

process.on("SIGHUP", function() {
    log("Received SIGHUP");
    process.exit();
});

process.on("exit", function() {
    log("quitting!");
    // provide context for exit if child process died
    if (exit) {
        if (exit.code !== null && exit.code > 0)
           console.error(exit.proc, "terminated with code", exit.code);
        else if (exit.signal !== null)
            console.error(exit.proc, "killed with signal", exit.signal);
    }
    // cleanup
    if (gdb) gdb.cleanup();
    if (client) client.cleanup();
    if (executable) executable.cleanup();
    if (server && server.listening) server.close();
    if (DEBUG) log_file.end();
});

process.on("uncaughtException", function(e) {
    log("uncaught exception (" + e + ")" + "\n" + e.stack);
    process.exit(1);
});

// create the proxy server
var server = net.createServer(function(c) {
    if (client)
        client.reconnect(c);
    else
        client = new Client(c);

    client.connect(function(err) {
        if (err) {
            log("PROXY: Could not connect to client; " + err);
        }
        else {
            log("PROXY: server connected");
            client.send("connect");

            // flush buffer of pending requests
            client.flush();
        }
    });

});

// handle server events
server.on("error", function(err) {
    if (err.errno == "EADDRINUSE") {
        console.log("It looks like the debugger is already in use!");
        console.log("Try stopping the existing instance first.");
    }
    else {
        console.log("server error");
        console.log(err);
    }
    process.exit(1);
});

// begin debug process
executable.spawn(function() {
    gdb.spawn();
    gdb.connect(function (reply, err) {
        if (err) {
            log(err);
            process.exit();
        }
        // Finally ready: start listening for browser clients on port or sock
        if (PROXY.sock) {
            fs.unlink(PROXY.sock, function(err) {
                if (err && err.code != "ENOENT") console.error(err);
                server.listen(PROXY.sock);
            });
        }
        else
            server.listen(PROXY.port, PROXY.host);
    });
});