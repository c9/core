
var path = require("path");
var staticMiddleware = require("../../connect/middleware/static");

module.exports = function startup(options, imports, register) {
    var connect = imports.connect;
    
    connect.useMain(staticMiddleware(path.join(__dirname, "www")));
    
    register(null, {});
};
