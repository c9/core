define(function(require, exports, module) {

exports.inherits = function(Child, Parent) {
  Child.prototype = Object.create(Parent.prototype, { constructor: { value: Child }});
}

exports.uid = function() {
    return (Date.now() + Math.random() * 0x100000000).toString(36) + (Math.random() * 0x100000000).toString(36);
}

});