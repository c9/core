define(function(require, exports, module) {
    main.consumes = ["immediate", "settings", "Evaluator", "ui", "proc"];
    main.provides = ["immediate.bash"];
    return main;


    function main(options, imports, register) {
        var Evaluator = imports.Evaluator;
        var settings = imports.settings;
        var immediate = imports.immediate;
        var proc = imports.proc;
        var ui = imports.ui;
        
        /***** Initialization *****/
        
        var plugin = new Evaluator("Ajax.org", main.consumes, {
            caption: "Bash",
            id: "bash",
            mode: "ace/mode/sh",
            message: "# Welcome to the Bash REPL."
        });
        // var emit = plugin.getEmitter();
        
        var bash;
        
        function load() {
        }
        
        /***** Evaluator *****/
        
        function canEvaluate(str) { 
            return true;
        }
        
        function evaluate(expression, cell, cb) {
            if (!expression.trim())
                return cell.remove();
            // cell.setValue("\n");
            cell.setWaiting(true);
            cell.setValue("");
            scroll(cell);
            getBash({}, function(err, bash) {
                if (err) 
                    return done(err);
                if (bash.cell)
                    done(new Error("Stopped"));
                bash.cell = cell;
                cell.tokenizerState = "comment";
                bash.stdout.on("data", bash.onData = function(data) {
                    if (bash.aborted) return;
                    
                    if (data.indexOf("ß") != -1) {
                        data = data.replace(/ß\s*/, "");
                        done();
                    }
                    write(cell, data);
                });
                bash.stderr.on("data", bash.onErr = function(data) {
                    if (bash.aborted) return;
                    
                    write(cell, data);
                });
                bash.on("exit", bash.onExit = function(code) {
                    bash.exited = true;
                    if (bash.aborted)
                        return done(new Error("Process aborted by user"));
                    else if (code)
                        return done(new Error("Process exited with code " + code));
                    done();
                });
                var code = expression.replace(/\r\n/g, "\n");
                code = 'fcn() {\n' + code + '\n}\n'
                    + 'sudo(){ /usr/bin/sudo -S -p "###[sudo] password for %p: " "$@" ; }\n'
                    + 'exit() { if [ "$1" == "0" ]; then echo ß; else echo "exiting with $1"; fi; command exit $1; }\n'
                    + 'fcn "$@" \n echo ß\n';

                bash.stdin.write(code);
                
                function done(err) {
                    var currentCell = bash.cell;
                    if (!currentCell || !currentCell.session)
                        currentCell = cell;
                    bash.stdout.off("data", bash.onData);
                    bash.stderr.off("data", bash.onErr);
                    bash.off("exit", bash.onExit);
                    if (err && err.message)
                        write(currentCell, "\n" + err.message);
                    currentCell.setWaiting(false);
                    bash.cell = null;
                }
            });
        }
        
        function write(cell, data) {
            var range = cell.getRange();
            if (range) {
                cell.insert(range.end, data);
                scroll(cell);
            }
        }
        
        function abort() {
            if (bash && !bash.exited) {
                bash.aborted = true;
                bash.kill();
            }
        }
        
        function scroll(cell) {
            var editor = cell.session.repl.editor;
            if (!editor) // tab isn't active
                return;
            var renderer = editor.renderer;
            // TODO add a better way to scroll ace cursor into view when rendered
            setTimeout(function() {
                renderer.scrollCursorIntoView();
            });
        }
        
        function getBash(opts, callback) {
            if (bash && !bash.exited && !bash.aborted)
                return callback(null, bash);
            proc.spawn("bash", { args: []}, function(err, p) {
                bash = p;
                callback(err, bash);
            });
        }
        
        function getAllProperties(context, callback) {
            callback();
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("canEvaluate", function(e) {
            return canEvaluate(e.expression);
        });
        plugin.on("evaluate", function(e) {
            return evaluate(e.expression, e.cell, e.callback);
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
            if (bash) {
                bash.aborted = true;
                bash.kill();
            }
        });
        
        /***** Register and define API *****/
        
        /**
         * Simple bash evaluator example for testing
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            getAllProperties: getAllProperties,
            
            /**
             * 
             */
            abort: abort
        });
        
        register(null, {
            "immediate.bash": plugin
        });
    }
});