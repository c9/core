module.exports = function startup(options, imports, register) {

    var prefix = options.prefix || "/static";
    var rjs = {
        "paths": {},
        "packages": [],
        "baseUrl": prefix
    };
    
    var workerPrefix = options.workerPrefix || "/static";

    var connect = imports.connect.getModule();
    var staticServer = connect.createServer();
    imports.connect.useMain(options.bindPrefix || prefix, staticServer);

    imports.connect.setGlobalOption("staticPrefix", prefix);
    imports.connect.setGlobalOption("workerPrefix", workerPrefix);
    imports.connect.setGlobalOption("requirejsConfig", rjs);

    var mounts = [];

    register(null, {
        "connect.static": {
            addStatics: function(statics) {
                mounts.push.apply(mounts, statics);
                statics.forEach(function(s) {
                    var mount = s.mount.replace(/^\/?/, "/");
                    if (s.router) {
                        var server = connect.static(s.path);
                        staticServer.use(mount, function(req, res, next) {
                            s.router(req, res);
                            server(req, res, next);
                        });
                    } else {
                        staticServer.use(mount, connect.static(s.path));
                    }

                    var libs = s.rjs || {};
                    for (var name in libs) {
                        if (typeof libs[name] === "string") {
                            rjs.paths[name] = join(prefix, libs[name]);
                        } else {
                            rjs.packages.push(libs[name]);
                        }
                    }
                });
            },

            getMounts: function() {
                return mounts;
            },

            getRequireJsPaths: function() {
                return rjs.paths;
            },

            getRequireJsPackages: function() {
                return rjs.packages;
            },

            getStaticPrefix: function() {
                return prefix;
            },
            
            getRequireJsConfig: function() {
                return rjs;
            },
            
            getWorkerPrefix: function() {
                return workerPrefix;
            }
        }
    });

    function join(prefix, path) {
        return prefix.replace(/\/*$/, "") + "/" + path.replace(/^\/*/, "");
    }
};
