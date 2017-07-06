define(function(require, exports, module) {
    main.consumes = [
        "TestRunner", "proc", "util", "fs", "test", "language", "c9", "debugger"
    ];
    main.provides = ["test.mocha"];
    return main;

    function main(options, imports, register) {
        var TestRunner = imports.TestRunner;
        var proc = imports.proc;
        var util = imports.util;
        var test = imports.test;
        var fs = imports.fs;
        var c9 = imports.c9;
        var language = imports.language;
        var debug = imports["debugger"];
        
        var Coverage = test.Coverage;
        
        var dirname = require("path").dirname;
        var basename = require("path").basename;
        var join = require("path").join;
        
        /***** Initialization *****/
        
        var plugin = new TestRunner("Ajax.org", main.consumes, {
            caption: "Mocha Javascript Tests",
            query: {
                id: "mocha",
                label: "Mocha Test Runner",
                def: {
                    match: {
                        content: ["^\\s*describe\\s*\\(", "^\\s*suite\\s*\\("],
                        filename: [".js$"]
                    },
                    exclude: {
                        dir: ["node_modules"],
                        file: []
                    },
                    search: "*"
                }
            },
            getName: function(name) {
                return name.substr(1);
            },
            options: [
                {
                    title: "Enable Debugger",
                    type: "checkbox-single",
                    setting: "state/test/mocha/@debug",
                    name: "debug"
                }
            ]
        });
        // var emit = plugin.getEmitter();
        
        var currentPty = [];
        var isWin = c9.platform == "win32";
        var debugging;
        var uniqueId = 0;
        
        function load() {
            if (test.inactive)
                return;
            
        }
        
        /***** Methods *****/
        
        function populate(node, callback) {
            fs.readFile(node.path, function(err, contents) {
                if (err) return callback(err);
                
                updateOutline(node, contents, callback);
            });
        }
        
        var wid = 0;
        function updateOutline(node, contents, callback) {
            language.getWorker(function(err, worker) {
                if (err) return callback && callback(err) || console.error(err);
                
                var currentId = ++wid;
                worker.emit("mocha_outline", { data: { id: currentId, code: contents }});
                worker.on("mocha_outline_result", function onResponse(e) {
                    if (e.data.id !== currentId) return;
                    
                    worker.off("mocha_outline_result", onResponse);
                    
                    node.importItems(e.data.result);
                    
                    callback && callback();
                });
            });
        }
        
        function getTestNode(node, id, name) {
            var count = 0;
            var found = (function recur(items, pname) {
                for (var j, i = 0; i < items.length; i++) {
                    j = items[i];
                    
                    if (j.type == "test") count++;
                    if (id !== undefined ? count == id : pname + j.label == name)
                        return j;
                    
                    if (j.items) {
                        var found = recur(j.items, 
                            pname + (j.type == "testset" ? j.label + " " : ""));
                        if (found) return found;
                    }
                }
            })([node], "");
            
            // TODO optional fallback to using id
            
            return found;
        }
        
        function findTestName(name, node) {
            var nodes = node.findAllNodes("testset");
            for (var i = 0; i < nodes.length; i++) {
                var lbl = nodes[i].label.trim();
                var idx = name.indexOf(lbl);
                if (~idx)
                    return findTestName(name.substr(idx + lbl.length).trim(), nodes[i]);
            }
            return [name, node];
        }
        
        function getFullTestName(node) {
            var name = [];
            
            do {
                name.unshift(node.label);
                node = node.parent;
            } while (node.type != "file");
            
            return name.join(" ");
        }
        
        function run(node, progress, options, callback) {
            if (typeof options == "function")
                callback = options, options = null;
            
            var fileNode;
            var exec = "mocha", args = ["--reporter", "tap"];
            
            var allTests = node.findAllNodes("test");
            var allTestIndex = 0;
            
            if (node.type == "file") {
                fileNode = node;
                progress.start(allTests[allTestIndex] || node);
            }
            else {
                fileNode = node.findFileNode();
                progress.start(node.type == "test" ? node : allTests[allTestIndex]);
                
                args.push("--grep", util.escapeRegExp(getFullTestName(node))  // "^" + 
                    + (node.type == "test" ? "$" : ""));
            }
            
            fileNode.ownPassed = null;
            fileNode.output = "";
            
            var withCodeCoverage = options && options.withCodeCoverage;
            var withDebug = options && options.debug;
            var parallel = options && options.parallel;
            
            if (!withCodeCoverage && !parallel && withDebug) {
                // "${debug?--nocrankshaft}",
                // "${debug?--nolazy}",
                // "${debug?`node --version | grep -vqE \"v0\\..\\.\" && echo --nodead_code_elimination`}",
                // "${debug?--debug-brk=15454}",
                
                args.push("--debug", "--debug-brk"); // TODO extra node options
                
                debugging = true;
                debug.debug({
                    STARTED: 2,
                    runner: {
                        "debugger": "v8",
                        "debugport": 5858,
                        "disabled": {
                            liveUpdate: true
                        }
                    },
                    running: 2,
                    name: plugin.root.label,
                    meta: { $debugger: true }
                }, false, function(err) {
                    if (err)
                        return (debugging = false); // Either the debugger is not found or paused
                });
            }
            
            var path = join(c9.workspaceDir, fileNode.path);
            args.push(path);
            
            var coveragePath = "~/.c9/coverage/run" + (++uniqueId);
            if (withCodeCoverage) {
                exec = "istanbul";
                args.unshift("cover", "--print", "none", "--report", 
                    "lcovonly", "--dir", coveragePath, 
                    isWin ? "node_modules/mocha/bin/_mocha" : "_mocha", "--");
            }
            
            if (isWin) {
                args.unshift("-c", '"$0" "$@"', exec);
                exec = "bash.exe";
            }
            else {
                args.unshift("-l", "-c", '"$0" "$@"', exec); // force a login shell
                exec = "bash";
            }
            
            proc.pty(exec, {
                args: args,
                cwd: dirname(path),
                fakePty: isWin
            }, function(err, pty) {
                if (err) return callback(err);
                
                var buffer = createBuffer(pty, fileNode, node, progress, 
                    allTests, allTestIndex, withCodeCoverage, 
                    coveragePath, callback);
                    
                pty.on("data", function(c) {
                    buffer.read(c);
                });
                pty.on("exit", function(c) {
                    buffer.end(c);
                });
            });
            
            return stop;
        }
        
        function createBuffer(pty, fileNode, node, progress, allTests, 
          allTestIndex, withCodeCoverage, coveragePath, callback) {
            var ptyId = currentPty.push(pty);
            
            var lastResultNode, testCount, bailed;
            var output = "", totalTests = 0;
            
            return {
                buffer: "",
                incomplete: "",
                read: function(c) {
                    // Log to the raw viewer
                    progress.log(fileNode, c);
                    
                    var lines = (this.incomplete + c).split(/[\r\n]+/);
                    this.incomplete = "";
                    
                    for (var line, i = 0, l = lines.length; i < l; i++) {
                        line = lines[i];
                        
                        // The last line is always incomplete
                        if (i == l - 1) {
                            this.incomplete += line;
                        }
                        
                        // Number of tests
                        else if (line.match(/^(\d+)\.\.(\d+)$/m)) {
                            testCount = parseInt(RegExp.$2, 10);
                        }
                        
                        // Final Statements
                        else if (line.match(/^# (?:tests|pass|fail)/)) {
                            continue;
                        }
                        
                        // Bail
                        else if (line.match(/^Bail out!(.*)$/m)) {
                            bailed = 3; // RegExp.$1;
                        }
                        
                        // Update parsed nodes (set, test)
                        else if (line.match(/^(ok|not ok)\s+(\d+)\s+(.*)$/m)) {
                            this.readTest(this.buffer);
                            this.buffer = line;
                        }
                        
                        else {
                            this.buffer += (this.buffer ? "\n" : "") + line;
                        }
                    }
                },
                readTest: function(c) {
                    // Update parsed nodes (set, test)
                    var m = c.match(/^(ok|not ok)\s+(\d+)\s+(.*)$/m);
                    if (m) {
                        var pass = m[1] == "ok" ? 1 : 0;
                        var id = m[2];
                        var name = m[3];
                        
                        if (name.match(/"(before all|before each|after all|after each)" hook/, "$1")) {
                            name = name.replace(/"(before all|before each|after all|after each)" hook .*/, "$1");
                            id = undefined;
                            if (!pass) bailed = 2, pass = 2;
                        }
                        
                        // TODO when having multiple before/after* find out the 
                        // right one based on the line number in the stacktrace
                        
                        // Update Node
                        var resultNode = (node.type == "test"
                            ? node
                            : getTestNode(node, id, name)); 
                        
                        // I suspect this is no longer needed
                        if (!resultNode) {
                            var context = findTestName(name, node);
                            resultNode = fileNode.addTest({
                                label: context[0],
                                type: "test",
                                kind: "it",
                                pos: { sl: 0, el: 0, sc: 0, ec: 0 }
                            }, context[1]);
                        }
                        
                        // if (!resultNode) 
                        //     resultNode = lastResultNode 
                        //         || node.findAllNodes("test")[0];
                        
                        // if (!resultNode)
                        //     return (bailed = 2); // TODO test this
                        
                        lastResultNode = resultNode;
                        
                        // Set Results
                        resultNode.output = output + "\n";
                        resultNode.passed = pass;
                        resultNode.annotations = null;
                    
                        // Reset output
                        output = "";
                        
                        // Count the tests
                        totalTests++;
                        
                        // Update progress
                        progress.end(resultNode);
                        
                        c = c.replace(/^.*([\r\n]+|$)/, "");
                        
                        if (!bailed) {
                            var nextTest = allTests[++allTestIndex]; // findNextTest(resultNode);
                            if (nextTest) progress.start(nextTest);
                        }
                    }
                    
                    // Output
                    var stackTrace;
                    
                    // Detect stack trace or timeout
                    if (c.match(/^\s*Error: timeout/) || c.match(/^\s+at .*:\d+:\d+\)?$/m)) {
                        if (!lastResultNode) {
                            lastResultNode = fileNode; // getTestNode(fileNode, 1);
                            fileNode.ownPassed = 2;
                            fileNode.output = c;
                            return;
                        }
                        
                        if (c.match(/^\s*Error: timeout/)) {
                            lastResultNode.output += c;
                        }
                        else {
                            stackTrace = parseTrace(c);
                            if (stackTrace) {
                                if (!withCodeCoverage) {
                                    if (!lastResultNode.annotations) 
                                        lastResultNode.annotations = [];
                                    
                                    var path = join(c9.workspaceDir, fileNode.path);
                                    var pos = stackTrace.findPath(path);
                                    if (!pos) 
                                        output += c;
                                    else {
                                        lastResultNode.annotations.push({
                                            line: pos.lineNumber,
                                            column: pos.column,
                                            message: c.trim().replace(/^\s+at/mg, "  at") // stackTrace.message
                                        });
                                    }
                                }
                                else 
                                    lastResultNode.output += c;
                            }
                        }
                        return;
                    }
                    
                    output += c;
                },
                end: function(c) {
                    delete currentPty[ptyId];
                    
                    if (this.buffer)
                        this.readTest(this.buffer);
                        
                    if (output) {
                        if (lastResultNode) 
                            lastResultNode.output += output;
                        else
                            fileNode.output = output;
                            
                        output = "";
                    }
                    
                    // Special Case for Syntax Errors
                    if (fileNode.output.indexOf("SyntaxError:") > -1) {
                        var stackTrace = parseTrace(fileNode.output);
                        var filepath = isWin ? fileNode.path.replace(/\//g, "\\") : fileNode.path;
                        var rePath = new RegExp(util.escapeRegExp(filepath) + ":(\\d+)");
                        var m = fileNode.output.match(rePath);
                        if (m[1]) {
                            if (!fileNode.annotations) 
                                fileNode.annotations = [];
                            
                            var lineNumber = parseInt(m[1]);
                            fileNode.annotations.push({
                                line: lineNumber,
                                column: 0,
                                message: "SyntaxError:" + stackTrace.message.split("SyntaxError:")[1]
                            });
                            fileNode.output = stackTrace.message + "\n" 
                                + fileNode.path.substr(1) + ":" + lineNumber;
                            fileNode.ownPassed = 3;
                        }
                    }
                    
                    if (testCount !== totalTests) {
                        if (!pty.isKilled)
                            fileNode.ownPassed = 2;
                    }
                    else if (bailed || pty.isKilled)
                        fileNode.ownPassed = pty.isKilled ? 3 : bailed;
                    
                    if (withCodeCoverage && !bailed) {
                        fs.readFile(coveragePath + "/lcov.info", function(err, lcovString) {
                            if (err) return done(err);
                            
                            node.coverage = Coverage.fromLCOV(lcovString, coveragePath);
                            
                            done();
                        });
                    }
                    else {
                        node.coverage = null;
                        done();
                    }
                    
                    function done(err) {
                        // Cleanup for before/after failure
                        allTests.forEach(function(n) { 
                            if (n.status != "loaded")
                                progress.end(n);
                        });
                        
                        callback(err, node);
                    }
                }
            };
        }
        
        /**
         * This parses the different stack traces and puts them into one format
         * This borrows heavily from TraceKit (https://github.com/occ/TraceKit)
         * From: https://github.com/errwischt/stacktrace-parser/blob/master/lib/stacktrace-parser.js
         */
        var UNKNOWN_FUNCTION = '<unknown>';
        function parseTrace(stackString) {
            var node = /^\s*at (?:((?:\[object object\])?\S+(?: \[as \S+\])?) )?\(?(.*?):(\d+)(?::(\d+))?\)?\s*$/i;
            var lines = stackString.split('\n');
            var stack = [];
            var message = [];
            var parts, started;
        
            for (var i = 0, j = lines.length; i < j; ++i) {
                if ((parts = node.exec(lines[i]))) {
                    stack.push({
                        'file': parts[2],
                        'methodName': parts[1] || UNKNOWN_FUNCTION,
                        'lineNumber': +parts[3],
                        'column': parts[4] ? +parts[4] : null
                    });
                    started = true;
                } 
                else if (!started) {
                    message.push(lines[i]);
                }
            }
            
            stack.message = message.join("\n");
            
            if ((stack.message + stack[0].file).indexOf("mocha/lib/runner.js") > -1)
                return false;
            
            stack.findPath = function(path, isFilename) {
                for (var i = 0; i < stack.length; i++) {
                    if (stack[i].file == path)
                        return stack[i];
                }
                return isFilename ? false : this.findPath(basename(path), true);
            };
        
            return stack;
        }
        
        function stop() {
            currentPty.forEach(function(pty) {
                pty.isKilled = true;
                pty.kill();
            });
            currentPty = [];
            
            if (debugging)
                debug.stop();
        }
        
        var reStack = /([\\\/\w-_\.]+):(\d+)(?::(\d+))?/g;
        function parseLinks(strOutput) {
            return strOutput.replace(reStack, function(m, name, l, c) { 
                name = name.replace(c9.workspaceDir, "");
                if (name.charAt(0) != "/") name = "/" + name;
                
                var link = name + ":" + (l - 1) + (c ? ":" + c : "");
                return "<span class='link' link='" + link + "'>" + m + "</span>";
            });
        }
        
        function findFileByPath(path) {
            var found = false;
            plugin.root.findAllNodes("file").some(function(n) {
                if (n.path == path) {
                    found = n;
                    return true;
                }
            });
            return found;
        }
        
        function fileChange(options) {
            // Update file
            var fileNode = findFileByPath(options.path);
            if (!fileNode)
                fileNode = plugin.createFile(options.path.substr(1));
            if (!fileNode.runner)
                fileNode.runner = plugin;
            
            if (fileNode.items.length || options.runonsave)
                updateOutline(fileNode, options.value, function() {
                    options.refresh();
                    options.run(fileNode); // Run file
                });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("init", function() {
            
        });
        plugin.on("load", function() {
            // Hook into the language worker
            language.registerLanguageHandler("plugins/c9.ide.test.mocha/mocha_outline_worker");
            
            load();
        });
        plugin.on("unload", function() {
            currentPty = null;
            debugging = null;
        });
        
        /***** Register and define API *****/
        
        plugin.freezePublicAPI({
            /**
             * 
             */
            populate: populate,
            
            /**
             * 
             */
            parseLinks: parseLinks,
            
            /**
             * 
             */
            fileChange: fileChange,
            
            /**
             * 
             */
            run: run,
            
            /**
             * 
             */
            stop: stop
        });
        
        register(null, {
            "test.mocha": plugin
        });
    }
});