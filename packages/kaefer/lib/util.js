define(function(require, exports, module) {

exports.inherits = function(Child, Parent) {
  Child.prototype = Object.create(Parent.prototype, { constructor: { value: Child }});
};

});
