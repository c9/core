var connect = require("connect");
var MongoStore = require("connect-mongo")(connect);
var assert = require("assert");

module.exports = function startup(options, imports, register) {
    assert(options.host, "Option 'host' is required");
    assert(options.db, "Option 'db' is required");

    var sessionStore = new MongoStore(options);

    register(null, {
        "session-store": {
            on: sessionStore.on.bind(sessionStore),
            get: sessionStore.get.bind(sessionStore),
            set: sessionStore.set.bind(sessionStore),
            destroy: sessionStore.destroy.bind(sessionStore),
            regenerate: sessionStore.regenerate.bind(sessionStore),
            createSession: sessionStore.createSession.bind(sessionStore)
        }
    });
};
