/*global nativeRequire*/
define(function(require, exports, module) {
    main.consumes = [
        "c9", "Plugin", "fs", "util", "proc", "dialog.alert", "dialog.confirm",
        "http", "layout"
    ];
    main.provides = ["local.update"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var Plugin = imports.Plugin;
        var showConfirm = imports["dialog.confirm"].show;
        var showAlert = imports["dialog.alert"].show;
        var fs = imports.fs;
        var proc = imports.proc;
        var http = imports.http;
        var nodeBin = Array.isArray(options.nodeBin)
            ? options.nodeBin[0]
            : options.nodeBin || "node";
        var layout = imports.layout;
        
        var join = require("path").join;
        var dirname = require("path").dirname;
        var basename = require("path").basename;

        var windowManager = window.server.windowManager;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        // var emit = plugin.getEmitter();
        
        var HOST = options.host || "localhost";
        var PORT = options.port || "8888";
        var PROTOCOL = options.protocol || "https";
        var BASH = options.bashBin || "bash";
        var installPath = options.installPath.replace(/^~/, c9.home);
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            setTimeout(function() {
                // At startup check for updates
                checkForUpdates();
                
                // Then check for updates once every 15 minutes
                setInterval(checkForUpdates, 60 * 15 * 1000);
            }, 5 * 1000);
        }
        
        /***** Methods *****/
        
        function checkForUpdates() {
            if (!windowManager.isPrimaryWindow(window))
                return;
            
            var url = PROTOCOL + "://" + HOST + ":" + PORT + "/update";
            http.request(url, {}, function(err, date, res) {
                isNewer(date, function(err, newer) {
                    if (err) return;
                
                    if (newer)
                        downloadLatest(date);
                });
            });
        }
        
        function isNewer(date, callback) {
            fs.readFile(options.path + "/version", function(err, currentDate) {
                if (!currentDate) currentDate = 0;
                
                var newer = parseInt(currentDate, 10) < parseInt(date, 10);
                callback(null, newer);
            });
        }
        
        function downloadLatest(date) {
            if (!c9.has(c9.NETWORK))
                return;
            
            var updateDir = join(installPath, "updates");
            var updateFile = join(updateDir, date);
            console.log('updateFile: ' + updateFile);
            
            // check if already downloaded
            fs.exists(updateFile, function(exists) {
                var url = PROTOCOL + "://" + HOST + ":" + PORT + "/update/" 
                    + c9.platform + "/" + date;

                if (exists) {
                    return decompress(date, updateFile);
                }
                
                var cmdDlUpdate = "(curl " + url + ".sig -o '" + updateFile + ".sig' --post301 --post302 --create-dirs &&"
                        + "curl " + url + " -o '" + updateFile + "' --post301 --post302 --create-dirs) || "
                        + "(wget " + url + ".sig -P '" + updateDir + "' && "
                        + "wget " + url + " -P '" + updateDir + "')";
                console.log("cmdDlUpdate: " + cmdDlUpdate);
                proc.execFile("bash", {
                    args: [
                        "-c",
                        cmdDlUpdate
                    ],
                }, function(err, stdout, stderr) {
                    if (err) {
                        showAlert(
                            "Unable to download update",
                            "Got errors while attempting to download update to Cloud9",
                            "I tried to download using curl and wget. See the browser's log for more info. "
                                + "Contact support@c9.io to help your resolve this issue."
                        );
                        
                        console.error(err.message, stderr);
                        return;
                    }
                    
                    decompress(date, updateFile);
                });
            });
        }
        
        function decompress(date, target) {
            fs.rmdir(installPath + "/updates/app.nw", { recursive: true }, function() {
                proc.execFile("tar", {
                    args: ["-zxf", basename(target)],
                    cwd: dirname(target)
                }, function(err, stdout, stderr) {
                    if (err) {
                        fs.unlink(target, function() {});
                        return;
                    }
                
                    // fs.writeFile(installPath + "/updates/app.nw/version", date, function(){
                        update(date);
                    // });
                });
                
                return false;
            });
        }
        
        function flagUpdate(date) {
            if (typeof document === "undefined")
                return;
            
            layout.flagUpdate(function() {
                showUpdatePopup(date);
            });
        }
        
        function showUpdatePopup(date) {
            showConfirm("Cloud9 needs to be updated", 
                "Update Available", 
                "There is an update available of Cloud9. ", 
                function() {
                    restart();
                }, 
                function() {
                    // Do nothing
                },
                {
                    yes: "Update",
                    no: "Not now",
                });
        }
        
        //@TODO needs to be platform specific
        function getC9Path() {
            return options.path + "/bin/c9";
        }
        
        function update(date) {
            // Use the update script from the new package
            var script = join(getC9Path(), "../../scripts/checkforupdates.sh");
            
            var path = options.path;
            var appRoot, appPath;
            var updateRoot = installPath;
            
            if (c9.platform == "linux") {
                // @todo
                return alert("Unsupported Platform");
            }
            else if (c9.platform == "win32") {
                var toCygwinPath = function(winPath) {
                    return winPath.replace(/(\w):/, "/$1").replace(/\\/g, "/");
                };
                // script = toCygwinPath(script);
                path = toCygwinPath(path);
                updateRoot = toCygwinPath(updateRoot);
                appPath = path;
                appRoot = path.substr(0, path.lastIndexOf("/"));
            }
            else if (c9.platform == "darwin") {
                // Set a default path during development
                if (path.indexOf("Contents/Resources") == -1)
                    path = "/Applications/Cloud9.app/Contents/Resources/app.nw";
                
                appPath = path;
                appRoot = path.substr(0, path.lastIndexOf("/"));
            }
            
            fs.readFile(script, "utf8", function(e, scriptContent) {
                // replace $R1 - $R5 in the bash script by 
                var url = PROTOCOL + "://" + HOST + ":" + PORT + "/nw/" + c9.platform + "/";
                var args = [script, appRoot, appPath, updateRoot, date, nodeBin, url];
                scriptContent = scriptContent.replace(/\$R(\d)/g, function(_, i) {
                    return args[i];
                });
                proc.spawn(BASH, {
                    args: ["-c", scriptContent]
                }, function(err, child) {
                    if (err) return console.error(err);
                    
                    child.stdout.on("data", function(chunk) {
                        console.log(chunk);
                    });
                    
                    child.stderr.on("data", function(chunk) {
                        console.log(chunk);
                    });
                    
                    child.on("exit", function(code) {
                        if (code !== 0) {
                            console.log("Update Failed.");
                            // @todo cleanup
                        }
                        else {
                            // restart();
                            flagUpdate(date);
                        }
                    });
                });
            });
        }
        
        function restart() {
            // nativeRequire('nw.gui').Window.get().reloadIgnoringCache(); 
            // todo this doesn't work
            proc.spawn(getC9Path(), {
                args: ["restart"],
                detached: true
            }, function(err, process) {
                if (err) return;

                // required so the parent can exit
                process.unref();
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
         * Draws the file tree
         * @event afterfilesave Fires after a file is saved
         * @param {Object} e
         *     node     {XMLNode} description
         *     oldpath  {String} description
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            checkForUpdates: checkForUpdates,
            /**
             * 
             */
            restart: restart,
            /**
             * @ignore
             */
            update: update
        });
        
        register(null, {
            "local.update": plugin
        });
    }
});
