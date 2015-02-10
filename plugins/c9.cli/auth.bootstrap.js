define(function(require, exports, module) {
    main.consumes = ["Plugin", "http"];
    main.provides = ["auth.bootstrap"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var http = imports.http;
        
        var fs = require("fs");
        var read = require("read");

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        // TODO read from options
        var AUTHURL = options.authUrl;
        var AUTHPATH = process.env.HOME + "/.c9/.auth";
        var lastToken;

        /***** Methods *****/
        
        function readCredentials(callback){
            read({
                prompt: "Cloud9 Username:"
            }, function(error, username) {
                if (error) return callback(error);
                
                read({
                    prompt: "Password:",
                    silent: true
                }, function(error, password) {
                    if (error) return callback(error);
                    
                    callback(null, { username: username, password: password });
                });
            });
        }

        function login(callback){
            fs.readFile(AUTHPATH, { encoding: "utf8" }, function(err, data){
                if (err || !data || lastToken == data) {
                    _login(callback);
                }
                else {
                    lastToken = data;
                    callback(null, data);
                }
            });
        }
        
        function _login(callback){
            readCredentials(function(err, credentials){
                if (err) return callback(err);
                
                // Retrieve token
                http.request(AUTHURL + "/api/nc/auth", {
                    method: "POST",
                    contentType: "application/json",
                    body: {
                        username: credentials.username,
                        password: credentials.password,
                        client_id: "cli"
                    }
                }, function(err, token) {
                    if (err) return callback(err);
                    
                    
                    fs.writeFile(AUTHPATH, token, function(err){
                        if (err) return callback(err);
                        callback(null, lastToken = token);
                    });
                });
            });
        }

        /***** Register and define API *****/

        /**
         * Finds or lists files and/or lines based on their filename or contents
         **/
        plugin.freezePublicAPI({
            /**
             *
             */
            login: login
        });
        
        register(null, {
            "auth.bootstrap": plugin
        });
    }
});


//require("node-optimist");