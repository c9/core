define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "Plugin",
        "c9", "proc", "Dialog", "ui",
    ];
    main.provides = ["plugin.updater.npm"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports["Plugin"];
        var c9 = imports["c9"];
        var proc = imports["proc"];
        var Dialog = imports["Dialog"];
        var ui = imports["ui"];

        var async = require("async");
        var path = require("path");
        var semverCompare = require("semver-compare");

        var NPM_MIN_VERSION = "2.6.0";

        /***** Initialization *****/

        var npmBin = options.npmBin || "/home/ubuntu/.nvm/nvm-exec";
        var managedPath = options.managedPath || "/home/ubuntu/.c9/managed";

        var managedRcPath = [managedPath, ".npmrc"].join("/");
        var managedNpmPath = [managedPath, "npm"].join("/");
        var managedEtcPath = [managedNpmPath, "etc"].join("/");
        var managedCachePath = [managedPath, "npm", "cache"].join("/");
        var managedPluginsPath = [managedPath, "plugins"].join("/");
        var managedModulesPath = [managedPath, "node_modules"].join("/");

        var plugin = new Plugin("Ajax.org", main.consumes);

        function load() {
            ui.insertCss(require("text!./style.css"), false, plugin);

            var pkgs = options.packages;

            if (!pkgs) {
                console.warn("[plugin.updater.npm] no managed packages configured, not loading.");
                return;
            }

            // TODO: DRY error handling

            fsMkdirs([ managedPath, managedEtcPath, managedModulesPath, managedPluginsPath ], function(err) {
                if (err) {
                    console.error("[plugin.updater.npm]", err);
                    showErrorDialog(err);
                    return;
                }

                fsWriteNpmrc(function(err) {
                    if (err) {
                        console.error("[plugin.updater.npm]", err);
                        showErrorDialog(err);
                        return;
                    }

                    npmCheckVersion(function(err) {
                        if (err) {
                            console.error("[plugin.updater.npm]", err);
                            showErrorDialog(err);
                            return;
                        }

                        // TODO: clean up the flow for detecting and installing missing
                        //       packages. the nested functions are messy.

                        async.filter(pkgs, function(pkg, done) {
                            npmExplorePath(pkg, function(err, path) {
                                var isMissing = !!err;

                                if (isMissing)
                                    debug("missing package:", pkg, err);

                                done(isMissing);
                            });
                        }, function(missing) {
                            if (missing.length) {
                                console.info("[plugin.updater.npm] Installing missing plugins:", missing);
                                showUpdateDialog();

                                npmInstall(missing, function(err) {
                                    if (err) {
                                        console.error("[plugin.updater.npm]", err);
                                        showErrorDialog(err);
                                        return;
                                    }

                                    buildLinks(pkgs, function(err) {
                                        if (err) {
                                            console.error("[plugin.updater.npm]", err);
                                            showErrorDialog(err);
                                            return;
                                        }

                                        // reload browser
                                        window.location.reload();
                                    });
                                });
                            }
                            else {
                                npmOutdated(pkgs, function(err, outdated) {
                                    if (err) {
                                        console.error("[plugin.updater.npm]", err);
                                        showErrorDialog(err);
                                        return;
                                    }

                                    if (!outdated) {
                                        debug("Plugins up-to-date.");
                                        return;
                                    }

                                    console.info("[plugin.updater.npm] Updating outdated plugins:", outdated);
                                    showUpdateDialog();

                                    buildLinks(pkgs, function(err) {
                                        if (err) {
                                            console.error("[plugin.updater.npm]", err);
                                            showErrorDialog(err);
                                            return;
                                        }

                                        npmUpdate(outdated, function(err) {
                                            if (err) {
                                                console.error("[plugin.updater.npm]", err);
                                                alert("[plugin.updater.npm] Error: " + err.message);
                                            }

                                            // reload browser
                                            window.location.reload();
                                        });
                                    });
                                });
                            }
                        });
                    });
                });
            });
        }

        function unload() {
        }

        /* -- Helper Functions ----- */

        function debug(format) {
            if (c9.debug) {
                var util = require("util");
                console.info(util.format.apply(null,
                    Array.prototype.slice.call(arguments)
                ));
            }
        }

        function trimRight(str) {
            return str.replace(/\s+$/, "");
        }

        /* -- npm Management ----- */

        /**
         * Check that the installed npm version matches the NPM_MIN_VERSION
         * required
         *
         * @param {Function} callback
         * @param {Error=} callback.err  An error if the version is lower than required
         */
        function npmCheckVersion(callback) {
            npmExec("npm", ["-v"], function(err, stdout, stderr) {
                if (err) return callback(err, stdout, stderr);

                var version = stdout;

                debug("npm version", version);

                if (semverCompare(version, NPM_MIN_VERSION) === -1) {
                    var error = new Error("npm version " + NPM_MIN_VERSION + " or greater required");
                    return callback(error);
                }

                callback();
            });
        }

        function npmExec(command, args, callback) {
            debug(npmBin, { args: [ "npm", command ].concat(args) });

            proc.execFile(npmBin, {
                args: [ "npm", command ].concat(args),
                cwd: managedPath,
                env: {
                    "npm_config_production": "true",
                    "npm_config_depth": 0,
                    "npm_config_userconfig": "/dev/null",
                    "npm_config_prefix": managedNpmPath,
                    "npm_config_cache": managedCachePath,
                },
            }, function(err, stdout, stderr) {
                debug([err, stdout, stderr]);

                if (err) return callback(err, stdout, err.message);

                stdout = trimRight(stdout);
                stderr = trimRight(stderr);

                callback(null, stdout, stderr);
            });
        }

        /* -- Package Management ----- */

        function npmOutdated(pkgs, callback) {
            npmExec("outdated", ["--json"], function(err, stdout, stderr) {
                if (err)
                    return callback(err, null, stdout, stderr);

                if (!stdout)
                    return callback(null, null, stdout, stderr);

                var outdated = JSON.parse(stdout);
                outdated = Object.keys(outdated);

                callback(null, outdated, stdout, stderr);
            });
        }

        function npmInstall(pkgs, callback) {
            npmExec("install", ["--"].concat(pkgs), function(err, stdout, stderr) {
                callback(err, stdout, stderr);
            });
        }

        function npmUpdate(pkgs, callback) {
            npmExec("update", ["--"].concat(pkgs), function(err, stdout, stderr) {
                callback(err, stdout, stderr);
            });
        }

        function npmExplorePath(pkg, callback) {
            npmExec("explore", [pkg, "--", "pwd"], function(err, stdout, stderr) {
                if (err)
                    return callback(err, null, stderr);

                callback(null, stdout, stderr);
            });
        }

        /**
         * Build the symbolic links from `~/.c9/plugins` to the managed plugins.
         *
         * @param {String[]} pkgs  A list of package names to link.
         *
         * @param {Function} callback
         * @param {Error=} callback.err
         */
        function buildLinks(pkgs, callback) {
            async.each(pkgs, function(pkg, done) {
                npmExplorePath(pkg, function(err, pkgPath) {
                    if (err) return done(err);
                    fsLink(pkgPath, done);
                });
            }, callback);
        }

        /**
         * Removes symbolic links from the `~/.c9/managed/plugins` folder.
         */
        function fsRmLinks(callback) {
            debug("find", { args: [ managedPluginsPath, "-maxdepth", "1", "-type", "l", "-exec", "rm", "{}", ";" ] });

            // find . -maxdepth 1 -type l -exec rm {} \;

            proc.execFile("find", {
                args: [
                    managedPluginsPath,
                    "-maxdepth", "1",
                    "-type", "l",
                    "-exec", "rm", "{}", ";"
                ],
            }, function(err, stdout, stderr) {
                debug([err, stdout, stderr]);
                callback(err, stdout, stderr);
            });
        }

        /**
         * Create a symbolic link in `~/.c9/plugins` pointing to the given
         * plugin path.
         *
         * @param {String} pkgPath  Path to the source package folder
         */
        function fsLink(pkgPath, callback) {
            debug("ln", { args: [ "-s", "-f", pkgPath, [ managedPluginsPath, "." ].join("/") ]});

            proc.execFile("ln", {
                args: [
                    "-s", "-f",
                    pkgPath,
                    managedPluginsPath + "/.",
                ],
            }, function(err, stdout, stderr) {
                debug([err, stdout, stderr]);
                callback(err, stdout, stderr);
            });
        }

        function fsMkdirs(dirPaths, callback) {
            debug("mkdir", { args: [ "-p", "--" ].concat(dirPaths) });

            proc.execFile("mkdir", {
                args: [ "-p", "--" ].concat(dirPaths),
            }, function(err, stdout, stderr) {
                callback(err, stdout, stderr);
            });
        }

        function fsWriteNpmrc(callback) {
            var config = [
                "//registry.npmjs.org/:_authToken = a7c61f6e-5b10-41db-947f-8bc8f1f9468b",
                "production = true",
                "depth = 0",
                "userconfig = /dev/null",
                "prefix = " + managedNpmPath,
                "cache = " + managedCachePath,
            ];

            //
            // HACK: - fs.writeFile() does not always work? we are using echo
            //         instead
            //
            //       - config is not escaped
            //

            debug("sh", { args: [ "-c", "echo '" + config.join("\\n") + "' > " + managedRcPath ] });

            proc.execFile("sh", {
                args: [
                    "-c",
                    "echo '" + config.join("\\n") + "' > " + managedRcPath
                ],
            }, function(err, stdout, stderr) {
                callback(err, stdout, stderr);
            });
        }

        /* -- Interface ----- */

        /**
         * Show a modal upgrade progress dialog, blocking the IDE interface
         * while we are updating the plugins.
         */
        function showUpdateDialog() {
            var dialog = new Dialog("Ajax.org", [], {
                name: "plugin.updater.npm.dialog",
                class: "dialog-updater",
                allowClose: false,
                modal: true,
                elements: [
                ],
            });

            dialog.title = "Installing Updates";
            dialog.heading = "";
            dialog.body = "Your workspace will be updated to the newest version and reload automatically.";

            dialog.show();

            return dialog;
        }

        /**
         * Show an upgrade error dialog, requesting to delete and recreate the
         * workspace. This is shown for critical update errors.
         */
        function showErrorDialog(err) {
            var dialog = new Dialog("Ajax.org", [], {
                name: "plugin.updater.npm.error_dialog",
                allowClose: true,
                modal: true,
                elements: [
                ],
            });

            var errorMessage = (err && err.message) ? "" + err.message : err;

            dialog.title = "Error installing updates";
            dialog.heading = "";
            dialog.body = "<strong>Important updates could not be installed on this workspace.</strong><br><br>"
                + "Please delete this workspace and create a new one, in order to continue "
                + "working in an up-to-date environment.<br><br>"
                + "<div style='max-height: 100px; overflow: auto;'><small><code>" + errorMessage + "</code></small></div>";

            dialog.show();

            return dialog;
        }

        /***** Register and define API *****/

        plugin.on("load", load);
        plugin.on("unload", unload);

        /**
         * @class salesforc.sync
         */
        plugin.freezePublicAPI({
        });

        register(null, {
            "plugin.updater.npm" : plugin
        });
    }
});

