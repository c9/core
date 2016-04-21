var MemoryStore = require("connect").session.MemoryStore;

module.exports = function startup(options, imports, register) {

    var sessionStore = new MemoryStore({ reapInterval: -1 });

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
