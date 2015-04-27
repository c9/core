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
                    
                    list(argv.json);
                }
            });
        }

        /***** Methods *****/
        
        function stringifyError(err){
            return (verbose ? JSON.stringify(err, 4, "    ") : (typeof err == "string" ? err : err.message));
        }
        
        function list(asJson, callback){
            callback = callback || function(){};
            api.packages.get("", function(err, list){
                if (err) {
                    console.error("ERROR: Could not get list: ", stringifyError(err));
                    return callback(err);
                }
                
                if (asJson) {
                    console.log(JSON.stringify(list, 4, "   "));
                    return callback(null, list);
                }
                else {
                    list.forEach(function(item){
                        console.log(item.name, "https://c9.io/packages/" + item.name);
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
