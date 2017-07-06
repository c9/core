/*global win windowManager*/
define(function(require, exports, module) {
    var assert = require("c9/assert");

    main.consumes = [
        "Plugin", "api", "fs", "auth", "http", "c9", "dialog.alert"
    ];
    main.provides = ["info"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        var api = imports.api;
        var fs = imports.fs;
        var auth = imports.auth;
        var http = imports.http;
        var c9 = imports.c9;
        var showAlert = imports["dialog.alert"].show;
        
        var ANONYMOUS = -1;
        
        assert(options.user && options.project, 
            "Both options.user and options.project need to be set for 'info' to work");
        
        var user = options.user;
        var project = options.project;
        var installPath = options.installPath;
        var settingDir = options.settingDir || installPath;
        var settings, loadedUserSettings;

        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            if (options.cookie)
                checkLoginCookie(options.cookie);
            
            auth.on("logout", function() {
                settings.saveToCloud.user = false;
                
                emit("change", { user: { fullname: "Logged Out", email: "" }});
                fs.exists(settingDir + "/profile.settings", function(exists) {
                    if (exists)
                        fs.unlink(settingDir + "/profile.settings", function() {});
                });
            });
            auth.on("login", login);
            auth.on("relogin", login);
            
            login();
        }
        
        /***** Methods *****/
        
        function initSettings() {
            // Send change events to all windows
            settings.on("change:user", function(e) {
                if (e && e.userData != "userSettings")
                    windowManager.signalToAll("updateUserSettings", { data: e.data });
            });
            
            // Listen for changes for this window
            window.win.on("updateUserSettings", function(e) {
                settings.update("user", e.data, "userSettings");
            });
        }
        
        function login(allowPrompt, callback) {
            if (typeof allowPrompt === "function")
                return login(false, allowPrompt);
            if (!callback)
                callback = function() {};
            
            // We'll always fetch the latest account, to get any
            // special info like saucelabs keys & beta access, and store it to disk
            api.user.get("", { noLogin: !allowPrompt && user.id !== ANONYMOUS },
            function(err, _user) {
                if (err) {
                    // If the user wasn't logged in before, panic
                    if (user.id === ANONYMOUS) {
                        return canHasInternets(function(online) {
                            if (!online)
                                return callback(); // allow this one to slip
                            authError(null, callback);
                        });
                    }
                    authorizeCopy();
                    return callback(err);
                }
                
                var oldUser = user;
                user = _user;
                
                authorizeCopy();
                
                if (!c9.hosted && !loadedUserSettings) {
                    updateUserSettings(function() {
                        loadedUserSettings = true;
                    });
                }
                
                emit("change", { oldUser: oldUser, user: user, workspace: project });
                
                getLoginCookie(function(err, value) {
                    user.cookie = value;
                    fs.writeFile(
                        settingDir + "/profile.settings",
                        JSON.stringify(user, null, 2),
                        "utf8",
                        function(err) {
                            if (err) console.error(err);
                            
                            callback(err, user, project);
                        }
                    );
                });
            });
        }
        
        function updateUserSettings(callback) {
            api.settings.get("user", {}, function(err, userSettings) {
                try { userSettings = JSON.parse(userSettings); }
                catch (e) { 
                    console.error("Could not read user settings: ", e); 
                    return;
                }
                
                settings.update("user", userSettings);
                settings.saveToCloud.user = true;
                
                callback();
            });
        }
        
        function authorizeCopy() { 
            api.users.post(
                "authorize_desktop",
                {
                    body: { uid: user.id, version: c9.version },
                    noLogin: true
                },
                function(err, response) {
                    // ignore err; no-internet handling passed above
                    if (err)
                        return console.warn(err);
                    if (response && response.reason)
                        return authError(response.reason);
                }
            );
        }
        
        function authError(message, callback) {
            auth.logout();
            showAlert(
                "Authentication failed",
                "Could not authorize your copy of Cloud9 Desktop.",
                message,
                function() {
                    // Sigh. Ok, let the user in, but nag again later.
                    auth.logout();
                    setTimeout(function() {
                        window.app["dialog.alert"].show(
                            "Authorize Cloud9 Desktop",
                            "Please authorize your copy of Cloud9 Desktop.",
                            "Authorization is required for cloud connectivity.",
                            function() {
                                login(true, callback);
                            }
                        );
                    }, 20 * 60 * 100);
                }
            );
        }
        
        function canHasInternets(callback) {
            http.request("http://google.com", function(err, data) {
                callback(!err);
            });
        }
        
        function getUser(callback) {
            if (!callback) return user;
            if (user && user.id != ANONYMOUS) 
                return callback(null, user);
            plugin.once("change", function(e) { callback(null, e.user); });
        }
        
        function getWorkspace(callback) {
            if (!callback) return project;
            if (project) return callback(null, user);
            plugin.once("change", function(e) { callback(null, e.workspace); });
        }
        
        function getLoginCookie(cb) {
            win.cookies.get({
                url: "https://c9.io/", name: "c9.live"
            }, function(cookie) {
                cb(null, cookie && cookie.value);
            });
        }
        
        function setLoginCookie(value, cb) {
            win.cookies.set({
                url: "https://c9.io/",
                name: "c9.live",
                secure: true,
                value: value,
                expirationDate: Math.floor(Date.now() / 1000) + 365 * 24 * 3600
            }, cb);
        }
        
        function checkLoginCookie(value) {
            getLoginCookie(function(err, val) {
                if (!val) {
                    setLoginCookie(value);
                }
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
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
            get settings() { throw new Error("Not Allowed"); },
            set settings(v) { settings = v; initSettings(); },
            
            /**
             * Returns the logged in user.
             * @return {Object} The currently user
             */
            getUser: getUser,
            
            /**
             * Return the active workspace.
             * @return {Object} The currently active workspace
             */
            getWorkspace: getWorkspace,
            
            /**
             * 
             */
            updateUserSettings: updateUserSettings,
            
            _events: [
                /**
                 * Fired when the user information changes.
                 * 
                 * @param {Object} [oldUser]
                 * @param {Object} [oldWorkspace]
                 * @param {Object} user
                 * @param {Object} workspace
                 * @event change
                 */
                "change"
            ],
            
            /**
             * Login 
             * 
             * @param allowPrompt  Allow showing a login prompt
             * @param callback
             */
            login: login
        });
        
        register(null, {
            info: plugin
        });
    }
});