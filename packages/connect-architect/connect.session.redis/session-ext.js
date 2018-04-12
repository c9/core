var connect = require("connect");
var RedisStore = require("connect-redis")(connect);
var MultiRegionRedisStore = require("./multi-region-store")(connect);
var assert = require("assert");

module.exports = function startup(options, imports, register) {

    assert(options.master, "option 'master' is required");
    assert(options.master.host, "option 'master.host' is required");
    assert(options.master.port, "option 'master.port' is required");
    
    if (options.slave) {
        assert(options.slave.host, "option 'slave.host' is required is slave is set");
        assert(options.slave.port, "option 'slave.port' is required is slave is set");
    }
    
    var sessionStore;
    if (
        options.slave && options.master &&
        (options.slave.host !== options.master.host || options.master.port !== options.slave.port) 
    ) {
        sessionStore = new MultiRegionRedisStore({
            master: options.master,
            slave: options.slave,
            prefix: options.prefix || ""
        });
    }
    else {
        sessionStore = new RedisStore({
            port: options.master.port,
            host: options.master.host,
            pass: options.master.pass || "",
            prefix: options.prefix || ""
        });
    }
    
    register(null, {
        "session-store": {
            on: sessionStore.on.bind(sessionStore),
            get: sessionStore.get.bind(sessionStore),
            set: sessionStore.set.bind(sessionStore),
            destroy: sessionStore.destroy.bind(sessionStore),
            regenerate: sessionStore.regenerate.bind(sessionStore),
            createSession: sessionStore.createSession.bind(sessionStore),
            set generate(fn) {
                sessionStore.generate = fn;
            },
            get generate() {
                return sessionStore.generate;
            }
        }
    });
};