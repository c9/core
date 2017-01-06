define(function(require, exports, module) {

var PROPER = require('plugins/c9.ide.language.javascript/scope_analyzer').PROPER;
var MAYBE_PROPER = require('plugins/c9.ide.language.javascript/scope_analyzer').MAYBE_PROPER;
var NOT_PROPER = require('plugins/c9.ide.language.javascript/scope_analyzer').NOT_PROPER;
var MAX_VALUES_LENGTH = 15;

var valueRegistry = {};

var contextStack = [];

function Property(values, confidence, path, row) {
    this.values = values;
    this.confidence = confidence;
    this.path = path;
    this.row = row;
}

function Value(name, node) {
    this.init(name, node);
}

Value.enterContext = function(name) {
    contextStack.push([name, 0]);
};

Value.leaveContext = function() {
    contextStack.pop();
};

Value.prototype.init = function(name, node) {
    var guid = '';
    for (var i = 0; i < contextStack.length; i++) {
        guid += contextStack[i][0] + '[' + contextStack[i][1] + ']/';
    }
    var top = contextStack[contextStack.length - 1];
    if (top) {
        top[1]++;
    }
    if (name) {
        guid += name;
    } else {
        guid = guid.substring(0, guid.length - 1);
    }
    this.guid = guid;
    this.properties = {};
    this.doc = null;
    this.docUrl = null;
    if (node) {
        this.pos = node.getPos();
    }
    valueRegistry[guid] = this;
};

Value.prototype.get = function(name) {
    var coll = new ValueCollection();
    if (this.properties['_' + name]) {
        coll.extend(this.properties['_' + name].values);
    }

    if (name !== '__proto__') {
        this.get('__proto__').forEach(function(p) {
            coll.extendPrototype(p.get(name).toArray());
        });
    }
    coll.deref();
    return coll;
};

Value.prototype.getPropertyNames = function() {
    var results = Object.keys(this.properties).map(function(s) {
        return s.substr(1);
    });
    this.get('__proto__').forEach(function(p) {
        return Object.keys(p.properties).forEach(function (s) {
            results.push(s.substr(1));
        });
    });
    return results;
};

Value.prototype.toJSON = function() {
    var fieldJSON = {};
    var properties = this.properties;
    for (var p in properties) {
        if (properties.hasOwnProperty(p)) {
            var prop = properties[p];
            return new Property(prop.values.map(function(v) { return v.guid; }), prop.confidence, prop.path, prop.row);
        }
    }
    return {
        guid: this.guid,
        doc: this.doc,
        properties: fieldJSON,
        pos: this.pos
    };
};

Value.prototype.markProperDeclaration = function(uname, confidence, path, row) {
    if (!this.properties[uname])
        return;    
    if (path)
        this.properties[uname].path = path;
    if (row)
        this.properties[uname].row = row;    
    if (confidence && this.properties[uname].confidence < PROPER)
        this.properties[uname].confidence += confidence;
};

Value.prototype.isProperDeclaration = function(name) {
    if (!this.properties['_' + name])
        return false;
    if (this.properties['_' + name].confidence > MAYBE_PROPER)
        return true;
    var result;
    if (name !== '__proto__') {
        this.get('__proto__').forEach(function(p) {
            if (p.isProperDeclaration(name))
                result = true;
        });
    }
    return result;
};

Value.prototype.hint = function(name, v, declarationConfidence, path, row) {
    if (!v)
        throw Error("Hinting an empty value!");
    if (!this.properties['_' + name]) {
        this.properties['_' + name] = new Property([v], declarationConfidence, path, row);
    }
    else {
        var currentValues = this.properties['_' + name].values;
        this.markProperDeclaration('_' + name, declarationConfidence, row);
        for (var i = 0; i < currentValues.length; i++) {
            if (currentValues[i].guid === v.guid) {
                return;
            }
        }
        currentValues.push(v);
    }
};

Value.prototype.hintMultiple = function(name, valueColl, declarationConfidence, path, row) {
    // TODO: Optimize
    var _self = this;
    valueColl.forEach(function(v) {
        _self.hint(name, v, NOT_PROPER);
    });
    // Set confidence only once because it would add up otherwise
    this.markProperDeclaration('_' + name, declarationConfidence, path, row);
};

function ValueCollection(values, prototypeValues) {
    this.values = values || [];
    this.prototypeValues = prototypeValues || [];
}

ValueCollection.prototype.extend = function(coll) {
    if (coll instanceof ValueCollection) {
        for (var i = 0; i < coll.values.length; i++) {
            this.add(coll.values[i]);
        }
        for (var i = 0; i < coll.prototypeValues.length; i++) {
            this.addFromPrototype(coll.prototypeValues[i]);
        }
    } else {
        for (var i = 0; i < coll.length; i++) {
            this.add(coll[i]);
        }
    }
};

ValueCollection.prototype.extendPrototype = function(coll) {
    this.prototypeValues = this.prototypeValues.concat(coll);
};

ValueCollection.prototype.toArray = function() {
    return this.values.concat(this.prototypeValues);
};

ValueCollection.prototype.add = function(value) {
    if (!value)
        throw Error("Adding empty value!");
    if (this.values.length > MAX_VALUES_LENGTH)
        return;
    this.values.push(value);
};

ValueCollection.prototype.addFromPrototype = function(value) {
    if (this.prototypeValues.length > MAX_VALUES_LENGTH)
        return;
    this.prototypeValues.push(value);
};

ValueCollection.prototype.forEach = function(fn) {
    this.values.forEach(fn);
    this.prototypeValues.forEach(fn);
};

ValueCollection.prototype.deref = function() {
    var values = this.values;
    for (var i = 0; i < values.length; i++)
        if (typeof values[i] === 'string')
            values[i] = valueRegistry[values[i]];
    values = this.prototypeValues;
    for (var i = 0; i < values.length; i++)
        if (typeof values[i] === 'string')
            values[i] = valueRegistry[values[i]];
};

ValueCollection.prototype.isEmpty = function() {
    return this.values.length === 0 && this.prototypeValues.length === 0;
};

function FunctionValue(name, node, callOnly) {
    this.init(name, node);
    this.node = node;
    this.callOnly = callOnly;
    if (name || node) {
        this.hintMultiple('__proto__', lookupValue("es5:Function").get('prototype'));
    }
}

FunctionValue.prototype = new Value('<ignore>');

FunctionValue.prototype.getFargs = function() {
    if (this.fargs)
        return this.fargs;
    else if (this.node) {
        var fargs = [];
        var fargsNode = this.node[1];
        for (var i = 0; i < fargsNode.length; i++) {
            fargs.push(fargsNode[i][0].value);
        }
        this.fargs = fargs;
        return fargs;
    }
    else
        return [];
};

FunctionValue.prototype.toJSON = function() {
    var json = Value.prototype.toJSON.call(this);
    json.fargs = this.getFargs();
    return json;
};

function SerializedFunctionValue(name) {
    this.init(name);
}

SerializedFunctionValue.prototype = new FunctionValue();

function instantiate(fn, initVal, node, name) {
    var value = initVal || new Value(name, node);
    value.hintMultiple('__proto__', fn.get('prototype'));
    value.hint('constructor', fn, PROPER);
    return value;
}

function lookupValue(guid) {
    if (!valueRegistry[guid])
        throw Error("Could not find " + guid);
    return valueRegistry[guid];
}

function fromJSON(json) {
    if (typeof json === "string")
        return json;
    
    var properties = json.properties || {};
    var value;

    if (properties._return !== undefined) {
        value = new SerializedFunctionValue();
        if (json.fargs) {
            value.fargs = json.fargs;
            for (var i = 0; i < value.fargs.length; i++) {
                if (!value.fargs[i].type)
                    value.fargs[i].type = ["es5:Object"];
            }
        }
    }
    else {
        value = new Value();
    }
    
    for (var p in properties) {
        var prop = properties[p];
        // Allow property values as [v] or {values: [v]}
        if (!prop.forEach) {
            (prop.values || []).forEach(function(v) {
                value.hint(p.substr(1), fromJSON(v), PROPER, v.path || json.path, v.row);
            });
        }
        else {
            prop.forEach(function(v) {
                value.hint(p.substr(1), fromJSON(v), PROPER, v.path || json.path, v.row);
            });
        }
    }

    if (json.guid) {
        valueRegistry[json.guid] = value;
    }
    value.guid = json.guid;
    value.doc = json.doc;
    value.docUrl = json.docUrl;
    value.path = json.path;
    value.row = json.row;
    
    return value;
}
    
exports.Value = Value;
exports.ValueCollection = ValueCollection;
exports.FunctionValue = FunctionValue;
exports.instantiate = instantiate;
exports.fromJSON = fromJSON;
exports.lookupValue = lookupValue;

exports.getRegistry = function() { return valueRegistry; };

exports.reset = function() {
    valueRegistry = {};
    contextStack = [];
};

});
