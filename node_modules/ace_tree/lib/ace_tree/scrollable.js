/**
 * The main class required to set up a Tree instance in the browser.
 *
 * @class Tree
 **/

define(function(require, exports, module) {
"use strict";

var oop = require("ace/lib/oop");
var EventEmitter = require("ace/lib/event_emitter").EventEmitter;


var scrollable = {};

(function() {
    oop.implement(this, EventEmitter);

    this.$scrollTop = 0;
    this.getScrollTop = function() { return this.$scrollTop; };
    this.setScrollTop = function(scrollTop) {
        scrollTop = Math.round(scrollTop);
        if (this.$scrollTop === scrollTop || isNaN(scrollTop))
            return;

        this.$scrollTop = scrollTop;
        this._signal("changeScrollTop", scrollTop);
    };

    this.$scrollLeft = 0;
    this.getScrollLeft = function() { return this.$scrollLeft; };
    this.setScrollLeft = function(scrollLeft) {
        scrollLeft = Math.round(scrollLeft);
        if (this.$scrollLeft === scrollLeft || isNaN(scrollLeft))
            return;

        this.$scrollLeft = scrollLeft;
        this._signal("changeScrollLeft", scrollLeft);
    };

    
}).call(scrollable);

module.exports = scrollable;
});
