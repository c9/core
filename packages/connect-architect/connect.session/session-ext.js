var Session = require("./session");
var assert = require("assert");

module.exports = function startup(options, imports, register) {

    assert(options.key, "option 'key' is required");
    assert(options.secret, "option 'secret' is required");

    var connect = imports.connect;
    var sessionStore = imports["session-store"];

    var sessionOptions = {
        store: sessionStore,
        key: options.key,
        secret: options.secret,
        cookie: {}
    };
    if ("proxy" in options)
        sessionOptions.proxy = options.proxy;
        
    var cookie = sessionOptions.cookie;
    if ("secure" in options)
        cookie.secure = options.secure;
        
    if ("maxAge" in options)
        cookie.maxAge = options.maxAge;

    var connectModule = imports.connect.getModule();
    var sessionRoutes = connectModule();
    connect.useSession(sessionRoutes);

    sessionRoutes.use(Session(sessionOptions, cookie));

    register(null, {
        session: {
            getKey: function() {
                return options.key;
            },
            get: sessionStore.get,
            use: sessionRoutes.use.bind(sessionRoutes)
        }
    });
};