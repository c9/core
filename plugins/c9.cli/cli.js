define(function(require, exports, module) {
    main.consumes = ["Plugin", "cli_commands", "workspace"];
    main.provides = ["cli"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var cmd = imports.cli_commands;

        var fs = require("fs");
        var resolve = require("path").resolve;

        var optimist;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();

        /***** Methods *****/

        function start(){
            var commands = cmd.commands;
            var module;
            var argv;
            
            process.argv.slice(2).some(function(n) {
                if (!n.match(/^[-\/]/) && n != "node") {
                    module = n;
                    return true;
                }
                return false;
            });
            
            if (!commands[module] && process.argv.length > 2) {
                for (var i = 2; i < process.argv.length; i++) {
                    if (process.argv[i].charAt(0) == "-") continue;
                    var path = resolve(process.argv[i]);
                    if (fs.existsSync(path)) {
                        process.argv.splice(2, 0, "open");
                        module = "open";
                    }
                    break;
                }
            }
            
            optimist = require('optimist');
            
            if (!module || !commands[module]) {
                if (process.argv.indexOf("--version") != -1) {
                    console.log(require("../../package.json").version);
                    process.exit(0);
                }
                
                argv = optimist
                    .usage("The Cloud9 CLI.\nUsage: c9 [--verbose] <command> [<args>]\n\n"
                            + "The most commonly used c9 commands are:\n" 
                            + Object.keys(commands).map(function(name) {
                                var cmd = commands[name];
                                return "    " + cmd.name + "   " + cmd.info;
                            }).join("\n")
                        )
                    .options({
                        verbose: {
                            alias: "v",
                            description: "Output more information",
                            default: false
                        }
                    })
                    .check(function(){
                        throw new Error("See 'c9 <command> --help' for more information on a specific command.");
                    })
                    .argv;
            }

            var def = commands[module];
            def.options.help = {
                alias: "h",
                description: "Output help information"
            };

            argv = optimist
                .usage("The Cloud9 CLI.\nUsage: c9 " + module + " [--help] " + def.usage)
                .options(def.options);
            
            if (argv.argv.help)
                argv = argv.check(function(){
                    if (argv.help)
                        throw new Error("Help Requested");
                });
            if (def.check) 
                argv = argv.check(def.check);
            argv = argv.argv;

            cmd.exec(module, argv);
        }

        /***** Lifecycle *****/
        
        plugin.on("load", function(){
        });
        plugin.on("unload", function(){
        });
        
        /***** Register and define API *****/

        /**
         * Finds or lists files and/or lines based on their filename or contents
         **/
        plugin.freezePublicAPI({
            /**
             *
             */
            start: start
        });
        
        register(null, {
            cli: plugin
        });
    }
});


//require("node-optimist");