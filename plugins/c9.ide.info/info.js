define(function(require, exports, module) {
    var assert = require("c9/assert");

    main.consumes = ["Plugin", "api"];
    main.provides = ["info"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var api = imports.api;
        assert(options.user && options.project, 
            "Both options.user and options.project need to be set for 'info' to work");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var user = options.user;
        var project = options.project;
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
        }
        
        /***** Methods *****/
        
        function getUser(callback, noCache) {
            if (noCache) {
                return api.user.get("", function(err, data){
                    if (err) return callback(err);
                    user = data;
                    callback(err, data);
                });
            }
            
            return callback ? callback(null, user) : user;
        }
        
        function getWorkspace(callback, noCache) {
            if (noCache) {
                return api.project.get("", function(err, data){
                    if (err) return callback(err);
                    project = data;
                    callback(err, data);
                });
            }
            
            return callback ? callback(null, project) : project;
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
         * Provides information about the loggedin user and workspace
         **/
        plugin.freezePublicAPI({
            /**
             * Returns the logged in user.
             *
             * @param [callback]
             * @return {Object} The currently user
             */
            getUser: getUser,
            
            /**
             * Return the active workspace.
             * 
             * @return {Object} The currently active workspace
             */
            getWorkspace: getWorkspace,

            _events: [
                /**
                 * @event afterfilesave Fires after a file is saved
                 * @param {Object} e
                 * @param node     {XMLNode} description
                 * @param oldpath  {String} description
                 */
                 "afterfilesave"
             ]
        });
        
        register(null, {
            info: plugin
        });
    }
});