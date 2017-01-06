/**
 * Data base class for the Cloud9 Debugger.
 * @class debugger.Data
 */
/**
 * Retrieves an XML representation of this object.
 * @property {String} xml
 */
/**
 * Retrieves a json representation of thie object.
 * @property {String} json
 */
/**
 * Returns a string representation of this object (similar to {@link #xml})
 * @method toString
 * @return {String}
 */
/**
 * Determines whether the passed object is logically an exact copy.
 * @method equals
 * @param {Object} object
 */
define(function(require, exports, module) {
    
    var Emitter = require("events").EventEmitter;
    
    function Data(props, sets, singletons) {
        this.$props = props || [];
        this.$sets = sets || [];
        this.$single = singletons || [];
        
        var _self = this;
        this.$props.concat(this.$sets).concat(this.$single).forEach(function(prop) {
            _self.__defineGetter__(prop, function() { 
                return this.data[prop];
            });
            _self.__defineSetter__(prop, function(v) { 
                if (prop == "items")
                    this.children = v;
                this.data[prop] = v;
            });
        });
    }
    Data.prototype = new Emitter();
    Data.prototype.__defineGetter__("json", function() { 
        return this.data;
    });
    Data.prototype.__defineSetter__("json", function(v) { 
        this.data = v;
    });
    
    ["label", "status", "className", "isOpen", "noSelect", "$sorted"].forEach(function(prop) {
        Data.prototype.__defineGetter__(prop, function() { 
            return this.data[prop];
        });
        Data.prototype.__defineSetter__(prop, function(v) { 
            this.data[prop] = v;
        });
    });
    
    Data.prototype.findNextTest = function() {
        return (function recur(node, down) {
            if (!node.parent) return false;
            
            var i, items;
            if (down) {
                items = node.items;
                i = 0;
            }
            else {
                i = node.parent.items.indexOf(node) + 1;
                node = node.parent;
                items = node.items;
            }
            
            for (var j; i < items.length; i++) {
                j = items[i];
                
                if (j.type == "test" || j.type == "prepare")
                    return j;
                
                if (j.items) {
                    var found = recur(j, true);
                    if (found) return found;
                }
            }
            
            return recur(node);
        })(this, this.type != "test");
    };
    
    Data.prototype.findFileNode = function() {
        var node = this;
        while (node && node.type != "file") node = node.parent;
        return node || {};
    };
    
    Data.prototype.findAllNodes = function(type) {
        var nodes = [], node = this;
        type = new RegExp("^(" + type + ")$");
        
        (function recur(items) {
            for (var i = 0; i < items.length; i++) {
                var j = items[i];
                if (j && type.test(j.type)) nodes.push(j);
                else if (j && j.items) recur(j.items);
            }
        })([node]);
        
        return nodes;
    };
    
    Data.prototype.findRunner = function() {
        var node = this;
        while (node && !node.runner) node = node.parent;
        return node && node.runner || false;
    };
    
    Data.prototype.fixParents = function fixParents(node) {
        if (!node) node = this;
        if (!node.items) return;
        
        node.items.forEach(function(n) {
            if (!n.parent) n.parent = node;
            if (n.items) fixParents(n);
        });
    };
    
    Data.prototype.importItems = function(items) {
        var node = this;
        
        if (!node.items.length)
            node.items = Data.fromJSON(items);
        else {
            (function recur(myItems, newItems) {
                var map = {};
                (function _(items) { 
                    items.forEach(function(n) { 
                        map[n.label] = n; 
                        if (n.items) _(n.items);
                    });
                })(myItems);
                myItems.length = 0;
                
                for (var n, m, i = 0; i < newItems.length; i++) {
                    n = map[(m = newItems[i]).label];
                    
                    // Update Existing
                    if (n) {
                        for (var prop in m) {
                            if (prop == "items") 
                                recur(n.items, m.items);
                            else n.data[prop] = m[prop];
                        }
                        delete map[m.label];
                    }
                    // Create a new node
                    else {
                        n = Data.fromJSON([m])[0];
                    }
                    
                    myItems.push(n);
                }
            })(node.items, items);
        }
    };
    
    Data.prototype.clone = function(forResults) {
        var _ = function() {};
        _.prototype = this;
        var clone = new _();
        var items, parent, passed, isSelected, isOpen;
        
        clone.__defineGetter__("children", function() { return this.items; });
        clone.__defineGetter__("map", function() { return this.map; });
        
        clone.__defineGetter__("parent", function() { return parent; });
        clone.__defineSetter__("parent", function(v) { parent = v; });
        
        if (!forResults) isSelected = this.isSelected;
        clone.__defineGetter__("isSelected", function() { return isSelected; });
        clone.__defineSetter__("isSelected", function(v) { isSelected = v; });
        
        if (forResults) {
            isOpen = this.isOpen;
            clone.__defineGetter__("isOpen", function() { return isOpen; });
            clone.__defineSetter__("isOpen", function(v) { isOpen = v; });
        }
        
        if (this.type == "file" || this.type == "testset") {
            if (forResults) {
                passed = this.passed;
                clone.__defineGetter__("passed", function() { return passed; });
                clone.__defineSetter__("passed", function(v) { passed = v; });
            }
        }
        if (forResults || this.type == "runner" || this.type == "root" || this.type == "node") {
            if (this.items) items = this.items.slice(0);
            clone.__defineGetter__("items", function() { return items; });
            clone.__defineSetter__("items", function(v) { items = v; });
        }
        
        clone.clone = this.clone.bind(this);
        
        return clone;
    };
    
    Data.prototype.serialize = function(toJson) {
        var obj = {};
        
        for (var prop in this.data) {
            if (prop.match(/^(parent|isSelected|items|map|children|runner|tree)$/))
                continue;
            
            if (this.data[prop] === undefined || this.data[prop] === null 
              || Array.isArray(this.data[prop]) && !this.data[prop].length)
                continue;
            
            if (prop == "coverage") {
                obj.coverage = this.data.coverage.serialize(true);
                continue;
            }
            
            obj[prop] = this.data[prop];
        }
        
        if (this.data.items && this.data.items.length) {
            obj.items = this.data.items.map(function(item) {
                return item.serialize(true);
            });
        }
        
        return toJson ? obj : JSON.stringify(obj);
    };
    
    module.exports = Data;
    
});