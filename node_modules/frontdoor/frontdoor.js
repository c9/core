"use strict";

require("amd-loader");

var Route = require("./lib/route");
var Section = require("./lib/section");
var Types = require("./lib/types");
var middleware = require("./lib/middleware");
var Api = require("./lib/api");

module.exports = function(description) {
    return new Api(description);
};

module.exports.Section = Section;
module.exports.Route = Route;
module.exports.Types = Types;
module.exports.middleware = middleware;


