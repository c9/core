module.exports = function(options, imports, register) {
    
    if (options.mode === "devel")
        return register(null, {});

    function time() {
        // return new Error().stack.match(/(\s+at.*\n){2}\s+at(.*)/)[2];
        return new Date().toISOString().replace(/\.\d\d\dZ/, "Z");
    }
    
    function createLogger(log) {
        return function() {
            var args = [].slice.call(arguments);
            if (typeof args[0] !== "string")
                return log.apply(console, [time()].concat(args));
            args[0] = time() + " " + args[0];
            log.apply(console, args);
        };
    }

    if (!console._wrapped) {
        console._wrapped = true;
        console.log = createLogger(console.log);
        console.error = createLogger(console.error);
        console.warn = createLogger(console.warn);
    }
    
    register(null, {});
};