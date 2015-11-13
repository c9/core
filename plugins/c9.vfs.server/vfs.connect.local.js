define(function(require, exports, module) {
    "use strict";
    
    main.consumes = ["Plugin"];
    main.provides = ["vfs.connect"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
    
        var Vfs = require("./vfs");
        var localFs = require("vfs-local");
        
        var join = require("path").join;

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        /***** Methods *****/
        
        function connect(user, pid, callback) {
            var vfsOptions = {
                root: "/",
                metapath: join(options.settingDir, "/metadata"),
                wsmetapath: join(options.settingDir, "/metadata/workspace"),
                local: false,
                readOnly: false,
                debug: options.debug,
                homeDir: process.env.HOME,
                projectDir: options.workspaceDir,
                nakBin: options.nakBin || join(options.installPath, "/node_modules/.bin/nak"),
                nodeBin: options.nodeBin,
                tmuxBin: options.tmuxBin
            };
            for (var key in options.vfs)
                vfsOptions[key] = options.vfs[key];
                
            var master = {
                destroy: function() {},
                disconnect: function() {},
                on: function() {},
                removeListener: function() {}
            };

            callback(null, new Vfs(localFs(vfsOptions), master, {
                debug: options.debug || false,
                homeDir: vfsOptions.homeDir,
                projectDir: vfsOptions.projectDir,
                extendDirectory: options.extendDirectory,
                extendOptions: options.extendOptions,
                vfsOptions: vfsOptions,
                public: true
            }));

            return function cancel() {};
        }
        
        /***** Register and define API *****/
        
        plugin.freezePublicAPI({
            connect: connect
        });
        
        register(null, {
            "vfs.connect": plugin
        });
    }
});