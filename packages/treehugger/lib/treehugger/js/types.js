define(function(require, exports, module) {

var tree = require('treehugger/tree');
require('treehugger/traverse');

function startsWithCapital(value) {
  if(value.length === 0) {
    return false;
  }
  return value[0].toUpperCase() === value[0];
}

function lhsToString(n) {
  return n.rewrite("Var(nm)", function(b) { return b.nm.value; },
                   "PropAccess(e, p)", function(b) { return lhsToString(b.e) + "." + b.p.value; });
}

function lhsName(n) {
  return n.rewrite("Var(nm)", function(b) { return b.nm.value; },
                   "PropAccess(e, p)", function(b) { return b.p.value; });
}

exports.typeAnalysisPrototype = function(repository) {
  repository.types = repository.types || {};
  var types = repository.types;
  
  function findProperties(type, n) {
    return n.collectTopDown('PropAccess(This(), _)', 'Function(_, _, _)', 'Call(PropAccess(This(), _), _)')
            .filter('PropAccess(This(), p)', function(bindings) {
                type.properties[bindings.p.value] = {
                  name: bindings.p.value,
                  meta: this.meta.pos
                };
              });
  }
  return [
    'Function(nm, fargs, body)', function(bindings) {
        if(startsWithCapital(bindings.nm.value)) {
          types[bindings.nm.value] = {
            name: bindings.nm.value, 
            constructorArgs: bindings.fargs.map(function(n) { return this.value; }).toArray(),
            methods: {},
            staticMethods: {},
            properties: {},
            meta: this.meta
          };
          findProperties(types[bindings.nm.value], bindings.body);
          return this;
        }
        return false;
      },
    'Assign(lhs, Function(nm, fargs, body))', function(bindings) {
        var nm = lhsName(bindings.lhs);
        var qid = lhsToString(bindings.lhs);
        if(startsWithCapital(nm)) {
          types[qid] = {
            name: nm, 
            constructorArgs: bindings.fargs.map(function(n) { return this.value; }).toArray(),
            methods: {},
            staticMethods: {},
            properties: {},
            meta: this[1].meta
          };
          findProperties(types[qid], bindings.body);
          return this;
        }
        return false;
      }, 
    'Assign(PropAccess(PropAccess(t, "prototype"), method), Function(nm, fargs, body))', function(bindings) {
        var qid = lhsToString(bindings.t);
        var t = types[qid];
        if(!t) return false;
        t.methods[bindings.method.value] = {
          name: bindings.method.value,
          args: bindings.fargs.map(function(n) { return this.value; }).toArray(),
          meta: this[1].meta
        };
        findProperties(types[qid], bindings.body);
        return this;
      },
    'Assign(PropAccess(t, method), Function(nm, fargs, body))', function(bindings) {
        var name = lhsName(bindings.t);
        var qid = lhsToString(bindings.t);
        if(startsWithCapital(name)) {
          var t = types[qid];
          if(!t) return false;
          t.staticMethods[bindings.method.value] = {
            name: bindings.method.value,
            args: bindings.fargs.map(function(n) { return this.value; }).toArray(),
            meta: this[1].meta
          };
          findProperties(types[qid], bindings.body);
          return this;
        }
        return false;
      },
    'Assign(PropAccess(t, "prototype"), ObjectInit(props))', function(bindings) {
        var qid = lhsToString(bindings.t);
        var t = types[qid];
        if(!t) return false;
        bindings.props.filter('PropertyInit(method, Function(nm2, fargs, body))', function(bindings) {
            t.methods[bindings.method.value] = {
              name: bindings.method.value,
              args: bindings.fargs.map(function(n) { return this.value; }).toArray(),
              meta: this[1].meta
            };
            findProperties(types[qid], bindings.body);
          });
        return this;
      } 
  ];
};

exports.functionAnalysis = function(repository) {
  repository.functions = repository.functions || {};
  var functions = repository.functions;
  return [
    'Function(nm, fargs, body)', function(bindings) {
        if(bindings.nm.value && !startsWithCapital(bindings.nm.value)) {
          functions[bindings.nm.value] = {
            name: bindings.nm.value, 
            args: bindings.fargs.map(function(n) { return this.value; }).toArray(),
            meta: this.meta.pos
          };
          return this;
        }
        return false;
      },
    'Assign(lhs, Function(nm, fargs, body))', function(bindings) {
        var nm = lhsName(bindings.lhs);
        var qid = lhsToString(bindings.lhs);
        if(!startsWithCapital(nm)) {
          functions[qid] = {
            name: nm, 
            args: bindings.fargs.map(function(n) { return this.value; }).toArray(),
            meta: this.meta.pos
          };
          return this;
        }
        return false;
      }
  ];
};

exports.analyze = function(n) {
  var repository = {};
  n.collectTopDown(exports.typeAnalysisPrototype(repository)
            .concat(exports.functionAnalysis(repository)));
  return repository;
};

});