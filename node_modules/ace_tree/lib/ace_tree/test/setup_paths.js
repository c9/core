var modules = require("module");
var oldResolve = modules._resolveFilename;
var extraPaths = [
    __dirname + "/../../../../ace/lib",
    __dirname + "/../../node_modules/ace/lib",
    __dirname + "/../"    
];
modules._resolveFilename = function(request, paths) {
    // Ensure client extensions can be loaded
    request = request.replace(/^ext\//, "ext.")
            .replace(/^core\//, "cloud9.core/www/core/")
            .replace(/^lib\/chai\//, "chai/");
    // Add the extra paths
    extraPaths.forEach(function(p) {
        if (paths.paths.indexOf(p) === -1)
            paths.paths.push(p);
    });
    return oldResolve(request, paths);
};
