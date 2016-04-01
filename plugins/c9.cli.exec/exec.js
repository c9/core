define(function(require, exports, module) {
    main.consumes = ["Plugin", "cli_commands", "bridge.client"];
    main.provides = ["exec"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var cmd = imports.cli_commands;
        var bridge = imports["bridge.client"];

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();

        var loaded;
        function load(){
            if (loaded) return;
            loaded = true;
            
            cmd.addCommand({
                name: "exec", 
                info: "     Executes remote c9 commands.",
                usage: "<command> [argument 1] [argument 2] ... [argument n]",
                check: function(argv) {
                    if (argv._.length < 2)
                        throw new Error("Missing command");
                },
                options: {},
                exec: function(argv) {
                    exec(
                        argv._[1],
                        argv._.slice(2),
                        function(){});
                }
            });
        }

        /***** Methods *****/

        function exec(command, args, callback) {
            args.unshift(process.cwd());
            var message = {
                type: "exec",
                command: command,
                args: args
            };
            
            bridge.send(message, function cb(err, response) {
                if (err) {
                    console.log(err.message);
                }
                
                if (response !== true)
                    console.log("Could not execute", command);
                
                process.exit(); // I don't get why this is needed
            });
        }

        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            load();
        });
        plugin.on("enable", function(){
            
        });
        plugin.on("disable", function(){
            
        });
        plugin.on("unload", function(){
            loaded = false;
        });
        
        /***** Register and define API *****/

        /**
         * Finds or lists files and/or lines based on their filename or contents
         **/
        plugin.freezePublicAPI({
            /**
             *
             */
            exec: exec
        });
        
        register(null, {
            exec: plugin
        });
    }
});