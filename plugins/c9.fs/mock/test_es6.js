function fnProgress(loaded, total, complete) {}
fnProgress(0, 1, 0);

var myFun = (param1, param2) => {
    return param1;
};

param2; // should report an error

myFun();

function* blie(input) {
    yield input;
    yield blie();
}
blie();

import { y as y } from 'mod';
y;

import * as z from 'mod';
z;

export default function exported(foo, bar) {
    foo;
    bar;
}
exported();

var a, b;
var iterableObj;
[a, b, ...iterableObj] = [1, 2, 3, 4, 5];
a;
b;
iterableObj;

var [left, right] = [1, 2];
left;
right;

exported(...blie);
var array = [left, right, ...blie];
array;

var qux = {left};
qux;
var {p,q} = { p: 1, q: 2};
p;
q;

class Blie {}

class Model extends Blie {
  constructor(properties) {
    this.properties = properties;
  }

  toObject() {
    return this.properties;
  }
}

new Model();