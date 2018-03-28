var data = {
    // File management
    resolve:  [ "path", "string", "options", "object" ],
    stat:     [ "path", "string", "options", "object" ],
    readfile: [ "path", "string", "options", "object" ],
    readdir:  [ "path", "string", "options", "object" ],
    mkfile:   [ "path", "string", "options", "object" ],
    mkdir:    [ "path", "string", "options", "object" ],
    rmfile:   [ "path", "string", "options", "object" ],
    rmdir:    [ "path", "string", "options", "object" ],
    rename:   [ "path", "string", "options", "object" ],
    copy:     [ "path", "string", "options", "object" ],
    symlink:  [ "path", "string", "options", "object" ],

    // Wrapper around fs.watch or fs.watchFile
    watch:    [ "path", "string", "options", "object" ],

    // Network connection
    connect:  [ "port", "number", "options", "object" ],

    // Process Management
    spawn:    [ "executablePath", "string", "options", "object" ],
    execFile: [ "executablePath", "string", "options", "object" ],

    // Basic async event emitter style API
    on:       [ "name", "string", "handler", "function" ],
    off:      [ "name", "string", "handler", "function" ],
    emit:     [ "name", "string", "value", "*" ],

    // Extending the API
    extend:   [ "name", "string", "options", "object" ],
    use:      [ "name", "string", "options", "object" ]
};

module.exports = function lint(vfs) {
    Object.keys(data).forEach(function (key) {
        var vars = data[key];
        var fn = vfs[key];

        if (!fn) throw new TypeError("Missing " + key + " function");
        if (typeof fn !== "function") throw new TypeError(key + " is not a function");

        vfs[key] = function (path, options, callback) {

            if (typeof arguments[2] !== "function") {
                throw new TypeError(key + ": Please pass in a function for the callback");
            }

            var errors = [];
            for (var i = 0; i < 2; i++) {
                var name = vars[i * 2];
                var value = arguments[i];
                var expectedType = vars[i * 2 + 1];
                if (expectedType === "*") continue;
                var actualType = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
                if (actualType !== expectedType) {
                    errors.push("Expected " + name + " to be " + expectedType + " but was " + actualType);
                }
            }

            if (errors.length) {
              return callback (new TypeError(key + ": " + errors.join(", ")));
            }
            try {
              return fn.apply(this, arguments);
            }
            catch (err) {
              return callback(err);
            }
        };
    });
    return vfs;
};
