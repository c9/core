/*
 * @copyright Copyright(c) 2011 Ajax.org B.V. <info AT ajax.org>
 * @author Mostafa Eweda <mostafa AT c9 DOT io>
 */

define(function(require, exports, module) {
"use strict";

function Heap(param) {
    var pq;
    if (Array.isArray(param)) {
        pq = param.slice();
        pq.unshift(null);
    }
    else {
        pq = [null];
    }
    this.pq = pq;
    this.__defineGetter__("N", function () {
        return pq.length - 1;
    });
    for (var k = Math.floor(this.N / 2); k >= 1; k--)
        this.sink(k);
}

(function() {
    this.empty = function() {
        return this.N === 0;
    };

    this.size = function() {
        return this.N;
    };

    this.min = function() {
        if (this.empty()) throw new Error("Priority queue underflow");
        return this.pq[1];
    };

    this.push = function(x) {
        this.pq.push(x);
        this.heapify(this.N);
    };

    this.pop = function() {
        if (this.empty()) throw new Error("Priority queue underflow");
        this.$exch(1, this.N);
        var min = this.pq.splice(this.pq.length - 1, 1)[0];
        this.sink(1);
        return min;
    };

    this.heapify = function(k) {
        while (k > 1 && this.$greater(Math.floor(k / 2), k)) {
            this.$exch(k, Math.floor(k / 2));
            k = Math.floor(k / 2);
        }
    };

    this.sink = function(k) {
        while (2 * k <= this.N) {
            var j = 2 * k;
            if (j < this.N && this.$greater(j, j + 1)) j++;
            if (!this.$greater(k, j)) break;
            this.$exch(k, j);
            k = j;
        }
    };

    this.$exch = function(i, j) {
        var swap = this.pq[i];
        this.pq[i] = this.pq[j];
        this.pq[j] = swap;
    };

    this.$greater = function(i, j) {
        return this.pq[i] > this.pq[j];
    };
}).call(Heap.prototype);

module.exports = Heap;

});