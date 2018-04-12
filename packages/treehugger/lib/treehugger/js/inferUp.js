define(function(require, exports, module) {

require('treehugger/traverse');

var STRING_TYPE = 'string';
var NUMBER_TYPE = 'number';

function VarTracker() {
  this.vars = {};
}

VarTracker.prototype.track = function(name) {
  if(!this.vars[name]) {
    this.vars[name] = {types: [], exps: []};
  }
};

function coerceTypes(t1, t2) {
  if(t1.length !== 1 || t2.length !== 1) {
    return t1.concat(t2);
  }
  t1 = t1[0];
  t2 = t2[0];
  if(t1 === t2) {
    return [t1];
  } else if(t1 === STRING_TYPE || t2 === STRING_TYPE) {
    return [STRING_TYPE];
  }
  return [t1, t2];
}

VarTracker.prototype.getTypes = function(e) {
  var tracker = this;
  var types = [];
  e.rewrite("String(_)", function() { types.push(STRING_TYPE); },
            "Number(_)", function() { types.push(NUMBER_TYPE); },
            "Var(nm)", function(b) {
              var analysis = tracker.vars[b.nm.value];
              if(analysis.types.length > 0) {
                types = types.concat(analysis.types);
              } else {
                analysis.exps.forEach(function(e) {
                  types = types.concat(tracker.getTypes(e));
                });
              }
            },
            "New(te, args)", function(b) {
              types.push(b.te);
            },
            "Op(op, e1, e2)", function(b) {
              types = types.concat(coerceTypes(tracker.getTypes(b.e1), tracker.getTypes(b.e2)));
            });
  return types;
};

VarTracker.prototype.hint = function(name, e) {
  if(!this.vars[name]) return; // Don't care
  var tracker = this;
  var analysis = this.vars[name];
  e.traverseTopDown("Var(nm)", function(b) {
              tracker.track(b.nm.value);
            });
  analysis.exps.push(e);
};

function inferType(node) {
  var tracker = new VarTracker();
  var name;
  node.rewrite("Var(nm)", function(b) {
    name = b.nm.value;
    tracker.track(name);
    this.traverseUp("VarDecls(vardecs)", function(b) {
                      b.vardecs.filter("VarDeclInit(name, e)", function(b) {
                        tracker.hint(b.name.value, b.e);
                      });
                    },
                    "ExpStat(Assign(Var(name), e))", function(b) {
                      tracker.hint(b.name.value, b.e);
                    });
  });
  console.log(tracker, name, tracker.getTypes(node));
  //return tracker.getTypes(name);
}

exports.inferType = inferType;

});