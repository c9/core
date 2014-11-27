define(function(require, exports, module) {
    var assert = require("c9/assert");

    main.consumes = ["Plugin"];
    main.provides = ["info"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        assert(options.user && options.project, 
            "Both options.user and options.project need to be set for 'info' to work");
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;
        }
        
        /***** Methods *****/
        
        function getUser(callback) {
            return callback ? callback(null, options.user) : options.user;
        }
        
        function getWorkspace(callback) {
            return callback ? callback(null, options.project) : options.project;
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
         * @event afterfilesave Fires after a file is saved
         * @param {Object} e
         *     node     {XMLNode} description
         *     oldpath  {String} description
         **/
        plugin.freezePublicAPI({
            /**
             * Returns the logged in user.
             * @return {Object} The currently user
             */
            getUser: getUser,
            
            /**
             * Return the active workspace.
             * @return {Object} The currently active workspace
             */
            getWorkspace: getWorkspace
        });
        
        register(null, {
            info: plugin
        });
    }
});