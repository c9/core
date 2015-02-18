define(function(require, exports, module) {
    "use strict";
    
    main.consumes = ["Plugin", "http", "auth.bootstrap"];
    main.provides = ["auth"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var http = imports.http;
        var _login = imports["auth.bootstrap"].login;

        /***** Initialization *****/
        
        var ANONYMOUS = -1;
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        var accessToken = options.accessToken || "";
        var apiUrl = options.apiUrl || "";
        var ideBaseUrl = options.ideBaseUrl;
        var uid = options.userId;
        var loggedIn = true;
        var checkLoop = createLoopDetector(3, 20 * 1000);

        /***** Methods *****/

        function request(url, options, callback) {
            if (!callback)
                return request(url, {}, options);

            if (loggingIn) {
                var onLogin = function() {
                    plugin.off("login", onLogin);
                    request(url, options, callback);
                };
                plugin.on("login", onLogin);
                return { abort: function() { plugin.off("login", onLogin); }};
            }
            
            options.query = options.query || {};
            
            // TODO try also using the Authorization header
            if (accessToken)
                options.query.access_token = accessToken;
                
            return http.request(url, options, function(err, data, res) {
                // If we get a 'forbidden' status code login again and retry
                if (res && res.status == 401 && !options.noLogin) {
                    if (!checkLoop(url)) {
                        console.trace("Login loop detected for URL " + url);
                        return callback(new Error("Login loop detected!"));
                    }
                    
                    plugin.once("login", function() {
                        request(url, options, callback);
                    });
                    login();
                    return;
                }
                
                callback(err, data, res);
            });
        }
        
        var loggingIn = false;
        function login(checkLogin) {
            if (loggingIn) {
                if (!checkLogin)
                    return;
                else
                    loggingIn();
            }
            
            emit("loggingin");
            
            loggingIn = _login(function(err, token) {
                loggingIn = false;
                accessToken = token;

                request(apiUrl + "/user", function(err, user) {
                    if (err || !user) {
                        console.warn("LOGIN: API /user err", err);
                        return setTimeout(login, 1000);
                    }
                    
                    if (user.id !== ANONYMOUS) {
                        loggedIn = true;
                        if (uid != user.id) {
                            uid = user.id;
                            emit("relogin", {uid: user.id});
                        }
                        // "login" or "logout" event is always dispatched after "loggingin" event
                        emit("login", {uid: user.id, oldUid: uid});
                    } else {
                        loggedIn = false;
                        emit("logout", {uid: user.id, newUid: ANONYMOUS});
                    }
                });
            }, function() {
                if (uid != ANONYMOUS) {
                    emit("logout", {uid: uid, newUid: ANONYMOUS});
                }
            }) || true;
        }
        
        function logout(callback) {
            accessToken = "invalid";
            loggingIn = false;

            http.request("/_auth/logout", function(err1) {
                http.request(ideBaseUrl + "/auth/signout", {
                    method: "POST"
                }, function(err2) {
                    loggedIn = false;
                    emit("logout", {uid: uid, newUid: ANONYMOUS});
                    callback && callback(err1 || err2);
                });
            });
        }
        
        function createLoopDetector(count, duration) {
            var log = {};
            
            return function check(url) {
                var now = Date.now();
                
                var calls = log[url];
                if (!calls) {
                    log[url] = [now];
                    return true;
                }
        
                while (calls.length && calls[0] < now - duration) {
                    calls.shift();
                }
                
                calls.push(now);
                return calls.length < count;
            };
        }
        
        /***** Register and define API *****/
        
        /**
         * Provides login information
         * @singleton
         **/
        plugin.freezePublicAPI({
            
            _events: [
                "loggingin",
                "login",
                "logout"
            ],
            
            /**
             * 
             */
            get loggedIn() { return loggedIn; },
            /**
             * 
             */
            get loggingIn() { return loggingIn; },
            /**
             * 
             */
            get accessToken() { return accessToken; },
            set accessToken(v) { accessToken = v; loggedIn = true;},
            
            /**
             * 
             */
            login: login,
            
            /**
             * @param {Function} [callback]
             */
            logout: logout,
            
            /**
             * Wrapper for http.request which adds authorization information to
             * the request
             * 
             * @param {String} url       target URL for the HTTP request
             * @param {Object} options  optional request options. Same format
             *   as {@link http#request http.request}.
             * @param {Function} callback                    Called when the request returns.
             * @param {Error}    callback.err                Error object if an error occured.
             * @param {String}   callback.data               The data received.
             * @param {Object}   callback.res           
             * @param {String}   callback.res.body           The body of the response message.
             * @param {Number}   callback.res.status         The status of the response message.
             * @param {Object}   callback.res.headers        The headers of the response message.
             */
            request: request
        });
        
        register(null, {
            auth: plugin
        });
    }
});