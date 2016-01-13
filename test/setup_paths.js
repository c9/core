var modules = require("module");
var oldResolve = modules._resolveFilename;
var extraPaths = [
    __dirname + "/../node_modules/ace/lib",
    __dirname + "/../node_modules/v8debug/lib",
    __dirname + "/../"
];
var extraPathOverrides = [
    __dirname + "/../node_modules/treehugger/lib",
];
modules._resolveFilename = function(request, parent) {
    // Ensure client extensions can be loaded
    request = request.replace(/^ext\//, "ext.")
            .replace(/^core\//, "cloud9.core/www/core/")
            .replace(/^lib\/chai\//, "chai/")
            .replace(/^lib\/jsonm\//, "jsonm/");
    // Add the extra paths
    extraPaths.forEach(function(p) {
        if (parent.paths.indexOf(p) === -1)
            parent.paths.push(p);
    });
    extraPathOverrides.forEach(function(p) {
        if (parent.paths.indexOf(p) === -1)
            parent.paths.unshift(p);
    });
    return oldResolve(request, parent);
};
