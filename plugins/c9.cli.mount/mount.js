define(function(require, exports, module) {
    main.consumes = ["Plugin", "cli_commands", "workspace", "proc"];
    main.provides = ["mount"];
    return main;

    /**
     * This is a MAC/Linux mounter based on
     * - http://osxfuse.github.com/
     * - https://github.com/osxfuse/osxfuse/wiki/SSHFS
     * @todo windows support
     * - http://www.damtp.cam.ac.uk/user/jp107/xp-remote/ssh-map/
     * - http://sourceforge.net/projects/dotnetssh/?source=navbar
     * - http://dokan-dev.net/en/
     * - http://www.novell.com/coolsolutions/qna/999.html
     * 
     */
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var cmd = imports.cli_commands;
        var workspace = imports.workspace;
        var proc = imports.proc;

        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        var loaded = false;
        function load() {
            if (loaded) return;
            loaded = true;
            
            cmd.addCommand({
                name: "mount", 
                info: "Mount a cloud9 workspace",
                usage: "[--ssh] [--webdav] <workspace>:<path> <target_dir>",
                options: {
                    ssh: {
                        description: "Use SSH as protocol for the mount",
                        default: true
                    },
                    webdav: {
                        description: "Use WebDav as protocol for the mount",
                        default: false
                    }
                },
                check: function(argv) {
                    if (argv._.length < 2)
                        throw new Error("Missing target directory");
                },
                exec: function(argv) {
                    mount(argv.ssh, argv.webdav, argv._[1], argv._[2], function() {});
                }
            });
            
            cmd.addCommand({
                name: "umount", 
                info: "Unmount a cloud9 workspace that has previously been mounted",
                usage: "<mounted_dir>",
                options: {},
                check: function(argv) {
                    if (!argv._.length)
                        throw new Error("Missing target directory");
                },
                exec: function(argv) {
                    umount(argv._[1], function() {});
                }
            });
        }

        /***** Methods *****/

        function mount(ssh, webdav, wspath, path, callback) {
            // WEBDAV
            if (webdav) {

            }
            // SSH
            else {
                var wsname = wspath.split(":")[0];
                workspace.connect(wsname, function(err, ws) {
                    ws.setupSshConnection(function(err) {
                        if (err)
                            return callback(err);
                    
                        // Get the right path
                        var hostname = ws.hostname;
                        if (wspath.indexOf(":") == -1)
                            wspath = hostname + ":" + ws.rootPath;
                        else
                            wspath = wspath.replace(/^.*\:/, hostname + ":"); 
                        
                        // Execute sshfs locally
                        proc.spawn("sshfs", {
                            args: [
                                ws.username + "@" + wspath,
                                path,
                                "-o",
                                "auto_cache"
                            ]
                        }, function(err, process) {
                            if (err)
                                return callback(err);

                            process.stderr.on("data", function(data) {
                                console.log(data);
                                callback(null, data);
                            });

                            callback();
                        });
                    });
                });
            }
        }
        
        function umount(path, callback) {
            // Execute sshfs locally
            proc.spawn("umount", {
                args: [ path ]
            }, function(err, process) {
                if (err)
                    return callback(err);
                callback();
            });
        }

        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
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
            mount: mount
        });
        
        register(null, {
            mount: plugin
        });
    }
});