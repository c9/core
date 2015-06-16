define(function(require, exports, module) {
    main.consumes = ["Plugin", "cli_commands", "api"];
    main.provides = ["cli.list"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var cmd = imports.cli_commands;
        var api = imports.api;
        
        var BASICAUTH = process.env.C9_TEST_AUTH;
        var verbose = false;
        
        var LIGHTBlUE = "\x1b[01;94m";
        var RESETCOLOR = "\x1b[0m";
        var PADDING = 2;
        
        // Set up basic auth for api if needed
        if (BASICAUTH) api.basicAuth = BASICAUTH;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();

        var loaded;
        function load(){
            if (loaded) return;
            loaded = true;
            
            cmd.addCommand({
                name: "list", 
                info: "     Lists all available packages.",
                usage: "[--json]",
                options: {
                    "json": {
                        description: "",
                        "default": false,
                        "boolean": true
                    },
                },
                check: function(argv) {},
                exec: function(argv) {
                    verbose = argv["verbose"];
                    
                    list(argv.json, function(err){
                        if (err)
                            console.error(err.message || err);
                        process.exit(err ? 1 : 0);
                    });
                }
            });
        }

        /***** Methods *****/
        
        function stringifyError(err){
            return (verbose ? JSON.stringify(err, 4, "    ") : (typeof err == "string" ? err : err.message));
        }
        
        function pad(str, nr){
            return str + Array(Math.max(0, nr - str.length)).join(" ");
        }
        
        function list(asJson, callback){
            callback = callback || function(){};
            api.packages.get("", function(err, list){
                if (err) {
                    console.error("ERROR: Could not get list: ", stringifyError(err));
                    return callback(err);
                }
                // TODO if tty.isatty(process.stdout) use process.stdout.columns process.stdout.rows 
                // to give nicely wrapped output
                if (asJson) {
                    console.log(JSON.stringify(list, 4, "   "));
                    return callback(null, list);
                }
                else {
                    var max = [0, 0, 0, 0];
                    list.forEach(function(item){
                        max[0] = Math.max(max[0], item.name.length);
                        max[1] = Math.max(max[1], Math.min(50, item.description.split(".")[0].length));
                        max[2] = Math.max(max[2], item.name.length + 33);
                        max[3] = Math.max(max[3], (item.website || item.repository.url).length);
                    });
                    list.forEach(function(item){
                        console.log(
                            pad(item.name, max[0] + PADDING), 
                            pad(item.description.split(".")[0], max[1] + PADDING), 
                            LIGHTBlUE + pad("https://c9.io/profile/packages/" + item.name, max[2] + PADDING) + RESETCOLOR, 
                            item.website || item.repository.url); // do not pad last item
                    });
                    return callback(null, list);
                }
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
            verbose = false;
        });
        
        /***** Register and definfe API *****/

        /**
         * 
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            list: list
        });
        
        register(null, {
            "cli.list": plugin
        });
    }
    
});
