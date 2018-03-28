var module = require("module");

var oldResolve = module._resolveFilename;
var extraPaths = [
    __dirname
];

module._resolveFilename = function(request, paths) {
    // Add the extra paths
    extraPaths.forEach(function(p) {
        if(paths.paths.indexOf(p) === -1)
            paths.paths.push(p);
    });
    return oldResolve(request, paths);
};