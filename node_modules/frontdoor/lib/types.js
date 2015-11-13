"use strict";

var inherits = require("util").inherits; 

exports.Types = function() {
    this.types = {};
    
    this.register("string", new exports.String());
    this.register("number", new exports.Number());
    this.register("boolean", new exports.Boolean());
    this.register("int", new exports.Integer());
    this.register("json", new exports.Json());
    this.register("array", new exports.Array());
    this.register("array[string]", new exports.Array(new exports.String()));
};
exports.Types.prototype.register = function(name, type) {
    type.name = name;
    if (type instanceof RegExp)
        type = new exports.RegExp(type);
        
    this.types[name] = type;
    return this;
};
exports.Types.prototype.get = function(name) {
    // if it already is a type return it
    if (name.check && name.parse)
        return name;
        
    var type = this.types[name];
    if (!type)
        throw new Error("Unknown type ", name);
        
    return type;
};

exports.Type = function() {};
exports.Type.prototype.parse = function(string) {
    return string;
};
exports.Type.prototype.check = function(value) {
    return true;
};
exports.Type.prototype.toString = function() {
    return this.name;
};

exports.RegExp = function(re) {
    this.re = re;
};
inherits(exports.RegExp, exports.Type);
exports.RegExp.prototype.parse = function(value) {
    return value.toString();
};
exports.RegExp.prototype.check = function(value) {
    if (typeof value !== "string") return false;
    value = value.toString();
    var match = value.match(this.re);
    return match && value === match[0];
};
exports.RegExp.prototype.toString = function() {
    return (this.name ? this.name + " " : "") + this.re.toString();
};

exports.Json = function() {};
inherits(exports.Json, exports.Type);
exports.Json.prototype.parse = function(string) {
    return JSON.parse(string);
};

exports.Array = function(itemType) {
    this.itemType = itemType;
};
inherits(exports.Array, exports.Json);
exports.Array.prototype.check = function(value) {
    if (!Array.isArray(value))
        return false;
        
    if (!this.itemType)
        return true;
        
    for (var i = 0; i < value.length; i++) {
        if (!this.itemType.check(value[i]))
            return false;
    }
    return true;
};

exports.String = function() {};
inherits(exports.String, exports.Type);
exports.String.prototype.check = function(value) {
    return typeof value == "string";
};

exports.Number = function() {};
inherits(exports.Number, exports.Type);
exports.Number.prototype.parse = function(string) {
    var value = parseFloat(string);
    if (isNaN(value))
        throw new TypeError("Could not parse string as number");
    return value;
};
exports.Number.prototype.check = function(value) {
    return typeof value == "number" || !isNaN(parseFloat(value));
};

exports.Integer = function(min, max) {
    this.min = min === undefined ? Number.MIN_VALUE : min;
    this.max - max === undefined ? Number.MAX_VALUE : max;
};
inherits(exports.Integer, exports.Type);
exports.Integer.prototype.parse = function(string) {
    return parseInt(string, 10);
};
exports.Integer.prototype.check = function(value) {
    return (
        typeof value == "number" && Math.round(value) == value
    );
};

exports.Boolean = function() {};
inherits(exports.Boolean, exports.Type);
exports.Boolean.prototype.parse = function(string) {
    if (string !== "true" && string !== "false")
        throw new Error("Could not parse '" +  string +"' as a boolean");
        
    return string == "true";
};
exports.Boolean.prototype.check = function(value) {
    return typeof value == "boolean";
};