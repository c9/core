/**
 * Allow code that lives on the server to resolve paths like
 * require("plugins/c9.language/language"),
 * just like on the client.
 */
var modules = require("module");
var oldResolve = modules._resolveFilename;
var path = require("path");
var root = path.join(__dirname, "/../..");
var extraPaths = [ root, root + "/plugins/node_modules" ];
modules._resolveFilename = function(request, parent) {
    if (!parent) parent = { paths: [], filename: "" };
    // Ensure client extensions can be loaded
    request = request.replace(/^lib\//, "node_modules/");
    // ensure we never use node_modules outside of root dir
    if (parent.paths[0] && parent.paths[0].indexOf(root) == 0) {
        parent.paths = parent.paths.filter(function(p) {
            return p.indexOf(root) == 0;
        });
    }
    // Add the extra paths
    extraPaths.forEach(function(p) {
        if (parent.paths.indexOf(p) === -1)
            parent.paths.push(p);
    });
    try {
        return oldResolve(request, parent);
    } catch (e) {
        // handle client- -> ide/ rename for configs
        if (/client-[^\\\/]+$/.test(path.basename(request))) {
            request = request.replace(/\/client-([^\\\/]+)$/, "/ide/$1");
            return oldResolve(request, parent);
        }
        throw e;
    }
};
