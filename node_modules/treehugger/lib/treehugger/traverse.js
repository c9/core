define(function(require, exports, module) {

var tree = require('treehugger/tree');

if (!Function.prototype.curry) {
    Function.prototype.curry = function() {
        var fn = this,
            args = Array.prototype.slice.call(arguments);
        return function() {
            return fn.apply(this, args.concat(Array.prototype.slice.call(arguments)));
        };
    };
}

function normalizeArgs(args) {
    if (args.length === 1 && args[0].apply) { // basic, one function, shortcut!
        return args[0];
    }
    args = Array.prototype.slice.call(args, 0);
    if (args[0] && Object.prototype.toString.call(args[0]) === '[object Array]') {
        args = args[0];
    }
    return function normalizeArgsHelper() {
        var result;
        for (var i = 0; i < args.length; i++) {
            if (typeof args[i] === 'string') {
                var parsedPattern = tree.parse(args[i]);
                var bindings = parsedPattern.match(this);
                if (bindings) {
                    while (args[i + 1]) {
                        if (args[i + 1].apply)
                            break;
                        i++;
                    }
                    if (args[i + 1] && args[i + 1].apply) {
                        result = args[i + 1].call(this, bindings, this);
                        i++;
                    }
                    else
                        result = this;
                    if (result)
                        return result;
                }
                else if (args[i + 1] && args[i + 1].apply)
                    i++;
            }
            else if (args[i].apply) {
                result = args[i].call(this, this);
                if (result)
                    return result;
            }
            else
                throw Error("Invalid argument: ", args[i]);
        }
        return false;
    };
}

exports.traverseAll = function(fn) {
    var result, i;
    fn = normalizeArgs(arguments);
    if (this instanceof tree.ConsNode || this instanceof tree.ListNode) {
        for (i = 0; i < this.length; i++) {
            result = fn.call(this[i]);
            if (!result)
                return false;
        }
    }
    return this;
};

/**
 * Sequential application last argument is term
 */
function seq() {
    var fn;
    var t = this;
    for (var i = 0; i < arguments.length; i++) {
        fn = arguments[i];
        t = fn.call(t);
        if (!t)
            return false;
    }
    return this;
}
// Try
exports.attempt = function(fn) {
    fn = normalizeArgs(arguments);
    var result = fn.call(this);
    return !result ? this : result;
};

exports.debug = function(pretty) {
    console.log(pretty ? this.toPrettyString("") : this.toString());
    return this;
};

// A somewhat optimized version of the "clean" topdown traversal
function traverseTopDown(fn) {
    var result, i;
    result = fn.call(this);
    if(result)
        return result;
    if (this instanceof tree.ConsNode || this instanceof tree.ListNode) {
        for (i = 0; i < this.length; i++) {
            traverseTopDown.call(this[i], fn);
        }
    }
    return this;
}

exports.traverseTopDown = function(fn) {
    fn = normalizeArgs(arguments);
    return traverseTopDown.call(this, fn);
    //exports.rewrite.call(this, fn, exports.traverseAll.curry(exports.traverseTopDown.curry(fn)));
    //return this;
};

/**
 * Traverse up the tree (using parent pointers) and return the first matching node
 * Doesn't only traverse parents, but also upward siblings
 */
exports.traverseUp = function(fn) {
    fn = normalizeArgs(arguments);
    var result = fn.call(this);
    if(result)
        return result;
    if (!this.parent)
        return false;
    return this.parent.traverseUp(fn);
};

exports.collectTopDown = function(fn) {
    fn = normalizeArgs(arguments);
    var results = [];
    this.traverseTopDown(function() {
        var r = fn.call(this);
        if (r) {
            results.push(r);
        }
        return r;
    });
    return tree.list(results);
};

exports.map = function(fn) {
    fn = normalizeArgs(arguments);
    var result, results = [];
    for (var i = 0; i < this.length; i++) {
        result = fn.call(this[i], this[i]);
        if (result) {
            results.push(result);
        }
        else {
            throw Error("Mapping failed: ", this[i]);
        }
    }
    return tree.list(results);
};

exports.each = function(fn) {
    fn = normalizeArgs(arguments);
    for (var i = 0; i < this.length; i++) {
        fn.call(this[i], this[i]);
    }
};

// fn return boolean
exports.filter = function(fn) {
    fn = normalizeArgs(arguments);
    var matching = [];
    this.forEach(function(el) {
        var result = fn.call(el);
        if (result) {
            matching.push(result);
        }
    });
    return tree.list(matching);
};

exports.rewrite = function(fn) {
    fn = normalizeArgs(arguments);
    return fn.call(this);
};

exports.isMatch = function(pattern) {
    return !!this.rewrite(pattern);
};

// Add above methods to all tree nodes
for (var p in exports) {
    if (exports.hasOwnProperty(p)) {
        tree.Node.prototype[p] = exports[p];
    }
}

exports.addParentPointers = function(node) {
    return node.traverseTopDown(function() {
        var that = this;
        this.traverseAll(function() {
            this.parent = that;
            return this;
        });
    });
};

});