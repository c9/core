define(function(require, exports, module) {

var tree = require('treehugger/tree');

var valueRegistry = {};
window.valueRegistry = valueRegistry;

function Value() {
    this.init();
}

Value.prototype.init = function() {
    this.fields = {};
    this.doc = null;
    this.guid = null;
};

Value.prototype.get = function(name) {
    var rv;
    if (this.fields['_' + name]) {
        rv = this.fields['_' + name];
    }
    else {
        rv = [];
    }
    if (name !== '__proto__') {
        this.get('__proto__').forEach(function(p) {
            rv = rv.concat(p.get(name));
        });
    }
    // Dereference values, if necessary
    for (var i = 0; i < rv.length; i++)
        if(typeof rv[i] === 'string')
            rv[i] = valueRegistry[rv[i]];
    
    return rv;
};

Value.prototype.toJSON = function() {
    return {
        guid: this.guid,
        doc: this.doc,
        properties: this.fields
    };
};

Value.prototype.fieldHint = function(name, v) {
    if (!this.fields['_' + name]) {
        this.fields['_' + name] = [v];
    }
    else {
        this.fields['_' + name].push(v);
    }
};

function FunctionValue(node, returnValue) {
    this.init();
    this.node = node;
    this.returnValue = returnValue;
}

FunctionValue.prototype = new Value();

FunctionValue.prototype.getFargs = function() {
    return this.node ? this.node[1] : [];
};

FunctionValue.prototype.getBody = function() {
    return this.node ? this.node[2] : tree.cons('None', []);
};

FunctionValue.prototype.toJSON = function() {
    var json = Value.prototype.toJSON.call(this);
    json.returnValue = this.returnValue;
    return json;
};

function instantiate(fn, initVal) {
    var value = initVal || new Value();
    fn.get('prototype').forEach(function(p) {
        value.fieldHint('__proto__', p);
    });
    value.fieldHint('constructor', fn);
    return value;
}

function lookupValue(guid) {
    return valueRegistry[guid];
}

function fromJSON(json) {
    if(typeof json === "string")
        return json;
    
    var value = json.returnValue !== undefined ? new FunctionValue(json.node, json.returnValue) : new Value();
        
    var properties = json.properties || {};
    for(var p in properties) {
        properties[p].forEach(function(v) {
            value.fieldHint(p.substr(1), fromJSON(v));
        });
    }

    if(json.guid) {
        valueRegistry[json.guid] = value;
    }
    value.guid = json.guid;
    value.doc = json.doc;
    
    return value;
}
    
exports.Value = Value;
exports.FunctionValue = FunctionValue;
exports.instantiate = instantiate;
exports.fromJSON = fromJSON;
exports.lookupValue = lookupValue;

});