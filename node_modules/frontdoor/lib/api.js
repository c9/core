"use strict";

var Section = require("./section");
var middleware = require("./middleware");

module.exports = function Api(description) {
    Section.call(this, "", description);
    
    this.use(middleware.jsonWriter());
};

