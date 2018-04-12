module.exports = function(module, reporter, options) {
    if (typeof module !== "undefined" && module === require.main) {
        if (typeof global.onload === "undefined")
            global.onload = undefined;
        var file = module.filename;
        var Mocha = require("mocha");
        var mocha = new Mocha(options || {});
        mocha.reporter(reporter || "spec");
        var suite = mocha.suite;
        suite.emit('pre-require', global, file, mocha);
        suite.emit('require', require(file), file, mocha);
        setTimeout(function() {
            suite.emit('post-require', global, file, mocha);
            mocha.run(process.exit);
        }, 0);
    }
};