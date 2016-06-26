// DEPRECATED, OUT OF DATE
define(function(require, exports, module) {

var ast = require('ast'),
    Node = ast.Node;

if (!Function.prototype.curry) {
  Function.prototype.curry = function () {
    var fn = this, args = Array.prototype.slice.call(arguments);
    return function () {
      return fn.apply(this, args.concat(Array.prototype.slice.call(arguments)));
    };
  };
}

function normalizeArgs(args) {
  if(args.length === 1 && args[0].apply) { // basic, one function, shortcut!
    return args[0];
  }
  args = Array.prototype.slice.call(args, 0);
  if(args[0] && Object.prototype.toString.call(args[0]) === '[object Array]') {
    args = args[0];
  }
  return function() {
    var result;
    for(var i = 0; i < args.length; i++) {
      if(typeof args[i] === 'string') {
        var parsedPattern = ast.parse(args[i]);
        var bindings = parsedPattern.match(this);
        if(bindings) {
          if(args[i+1] && args[i+1].apply) {
            result = args[i+1].call(this, bindings);
            i++;
          } else {
            result = this;
          }
          if(result) {
            return result;
          }
        } else if(args[i+1] && args[i+1].apply) {
          i++;
        }
      } else if(args[i].apply) {
        result = args[i].call(this);
        if(result) {
          return result;
        }
      } else {
        throw Error("Invalid argument: ", args[i]);
      }
    }
    return false;
  };
}

exports.all = function(fn) {
  var newChildren, result, i;
  fn = normalizeArgs(arguments);
  if(this instanceof ast.ConsNode) {
    newChildren = [];
    for (i = 0; i < this.length; i++) {
      result = fn.call(this[i]);
      if (result) {
        newChildren.push(result);
      } else {
        return false;
      }
    }
    return ast.cons(this.cons, newChildren);
  } else if(this instanceof ast.ListNode) {
    newChildren = [];
    for (i = 0; i < this.length; i++) {
      result = fn.call(this[i]);
      if (result) {
        newChildren.push(result);
      } else {
        return false;
      }
    }
    return ast.list(newChildren);
  } else {
    return this;
  }
};

exports.one = function(fn) {
  var newChildren, result, i, oneSucceeded;
  fn = normalizeArgs(arguments);

  if(this instanceof ast.ConsNode) {
    newChildren = [];
    oneSucceeded = false;
    for (i = 0; i < this.length; i++) {
      result = fn.call(this[i]);
      if (result) {
        newChildren.push(result);
        oneSucceeded = true;
      } else {
        newChildren.push(this[i]);
      }
    }
    if (oneSucceeded) {
      return ast.cons(this.cons, newChildren);
    } else {
      return false;
    }
  } else if(this instanceof ast.ListNode) {
    newChildren = [];
    oneSucceeded = false;
    for (i = 0; i < this.length; i++) {
      result = fn.call(this[i]);
      if (result) {
        newChildren.push(result);
        oneSucceeded = true;
      } else {
        newChildren.push(this[i]);
      }
    }
    if (oneSucceeded) {
      return ast.list(this.cons, newChildren);
    } else {
      return false;
    }
  } else {
    return this;
  }
};

/**
 * Sequential application last argument is term
 */
exports.seq = function() {
  var fn;
  var t = this;
  for ( var i = 0; i < arguments.length; i++) {
    fn = arguments[i];
    t = fn.call(t);
    if (!t) {
      return false;
    }
  }
  return this;
};

/**
 * Left-choice (<+) application
 */
exports.leftChoice = function() {
  var t = this;
  var fn, result;
  for ( var i = 0; i < arguments.length; i++) {
    fn = arguments[i];
    result = fn.call(t);
    if (result) {
      return result;
    }
  }
  return false;
};

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

exports.map = function(fn) {
  fn = normalizeArgs(arguments);
  return this.all(fn);
};

// fn return boolean
exports.filter = function(fn) {
  var matching = [];
  fn = normalizeArgs(arguments);
  this.forEach(function(el) {
    var result = fn.call(el);
    if(result) {
      matching.push(result);
    }
  });
  return ast.list(matching);
};

exports.alltd = function(fn) {
  fn = normalizeArgs(arguments);
  return this.leftChoice(fn, exports.all.curry(exports.alltd.curry(fn)));
};

exports.topdown = function(fn) {
  fn = normalizeArgs(arguments);
  return this.seq(fn, exports.all.curry(exports.topdown.curry(fn)));
};

exports.bottomup = function(fn) {
  fn = normalizeArgs(arguments);
  return this.seq(exports.all.curry(exports.bottomup.curry(fn)), fn);
};

exports.innermost = function(fn) {
  fn = normalizeArgs(arguments);
  return this.bottomup(exports.attempt.curry(exports.seq.curry(fn, exports.innermost.curry(fn))));
};

exports.collect = function(fn) {
  fn = normalizeArgs(arguments);
  var results = [];
  this.alltd(function() {
      var r = fn.call(this);
      if(r) {
        results.push(r);
      }
      return r;
    });
  return ast.list(results);
};

exports.apply = function(fn) {
  fn = normalizeArgs(arguments);
  return fn.call(this);
};

exports.removeDuplicates = function() {
  var newList = [];
  lbl: for(var i = 0; i < this.length; i++) {
    for(var j = 0; j < newList.length; j++) {
      if(newList[j].match(this[i])) {
        continue lbl;
      }
    }
    newList.push(this[i]);
  }
  return new ast.list(newList);
};

Node.prototype.rewrite = {};

for(var p in exports) {
    if(exports.hasOwnProperty(p)) {
        Node.prototype.rewrite[p] = exports[p];
    }
}

});