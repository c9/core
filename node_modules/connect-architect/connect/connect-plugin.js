var utils = require("connect/lib/utils");
var netutil = require("netutil");
var connect = require("connect");
var http = require("http");
var https = require("https");

module.exports = function startup(options, imports, register) {
    var globalOptions = options.globals ? merge([options.globals]) : {};
    
    var requestMethods = {};
    var responseMethods = {};
    
    var app = connect();

    var hookNames = [
        "Start",
        "Setup",
        "Main",
        "Session"
    ];
    var api = {
        getModule: function() {
            return connect;
        },
        getUtils: function() {
            return utils;
        },
        /**
         * set per request options. Used e.g. for the view rendering
         */ 
        setOptions: function(options) {
            return function(req, res, next) {
                res.setOptions(options);
                next();
            };
        },
        resetOptions: function() {
            return function(req, res, next) {
                res.resetOptions();
                next();
            };
        },
        setGlobalOption: function(key, value) {
            globalOptions[key] = value;
        },
        getGlobalOption: function(key) {
            return globalOptions[key];
        },
        addResponseMethod: function(name, method) {
            responseMethods[name] = method;
        },
        addRequestMethod: function(name, method) {
            requestMethods[name] = method;
        }

    };
    
    api.addResponseMethod("setOptions", function(options) {
        this._options = this._options || [];
        this._options.push(options);
    });
    
    api.addResponseMethod("getOptions", function(options) {
        var opts = [globalOptions].concat(this._options || []);
        if (options)
            opts = opts.concat(options);
        
        return merge(opts);
    });
    
    api.addResponseMethod("resetOptions", function() {
        if (this._options)
            this._options.pop();
    });

    
    hookNames.forEach(function(name) {
        var hookServer = connect();
        app.use(hookServer);
        api["use" + name] = hookServer.use.bind(hookServer);
    });

    var connectHook = connectError();
    app.use(connectHook);
    api.useError = connectHook.use;

    api.useSetup(connect.cookieParser());
    api.useSetup(connect.urlencoded());
    api.useSetup(connect.json());

    api.addRoute = app.addRoute;
    api.use = api.useMain;

    api.on = app.on;
    api.emit = app.emit;

    api.useStart(function(req, res, next) {
        for (var name in requestMethods)
            req[name] = requestMethods[name];
            
        for (var name in responseMethods)
            res[name] = responseMethods[name];
            
        next();
    });

    function startListening (port, host) {
        api.getPort = function () {
            return port;
        };
        api.getHost = function () {
            return host;
        };

        var server;
        var proto;
        if (options.secure) {
            proto = "https";
            server = https.createServer(options.secure , app);
        }
        else {
            proto = "http";
            server = http.createServer(app);
        }

        server.listen(port, host, function(err) {
            if (err)
                return register(err);

            console.log("Connect server listening at " + proto + "://"
                + (host == "0.0.0.0" && options.showRealIP
                ? getLocalIPs()[0]
                : host) + ":" + port);

            register(null, {
                "onDestruct": function(callback) {
                    app.close();
                    app.on("close", callback);
                },
                "connect": api,
                "http": {
                    getServer: function() {
                        return server;
                    }
                }
            });
        });
        
        if (options.websocket)
            attachWsServer(server, app);
        
        function attachWsServer(server, app) {
            server.on("upgrade", function(req, socket, head) {
                var res = new http.ServerResponse(req);
                req.ws = {
                    socket: socket,
                    head: head
                };
                req.method = "UPGRADE";
                
                res.write = function() {
                    // console.log("RES WRITE", arguments);
                };
                res.writeHead = function() {
                    // console.log("RES WRITEHEAD", arguments);
                };
                res.end = function() {
                    // console.log("RES END", arguments);
                    socket.end();
                };
                
                app.handle(req, res, function(err) {
                    if (err) {
                        console.error("Websocket error", err);
                    }
                    
                    socket.end();
                });
            });
        }
    }

    if (options.port instanceof Array) {
        netutil.findFreePort(options.port[0], options.port[1], options.host, function(err, port) {
            if (err)
                return register(err);

            startListening(port, options.host || "localhost");
        });
    } else {
        startListening(options.port, options.host || "localhost");
    }
    
    function connectError() {
        var filters = [];
    
        function handle(err, req, res, out) {
            var rest = filters.concat();
    
            function next(err) {
                var filter = rest.shift();
                if (!filter)
                    return out(err);
    
                filter(err, req, res, next);
            }
            next(err);
        }
    
        handle.use = function(middleware) {
            filters.push(middleware);
        };
        
        return handle;
    }
    
    function getLocalIPs() {
        var os = require("os");
    
        var interfaces = os.networkInterfaces ? os.networkInterfaces() : {};
        var addresses = [];
        for (var k in interfaces) {
            for (var k2 in interfaces[k]) {
                var address = interfaces[k][k2];
                if (address.family === "IPv4" && !address.internal) {
                    addresses.push(address.address);
                }
            }
        }
        return addresses;
    }
};

function merge(objects) {
    var result = {};
    for (var i=0; i<objects.length; i++) {
        var obj = objects[i];
        for (var key in obj) {
            result[key] = obj[key];
        }
    }
    return result;
}