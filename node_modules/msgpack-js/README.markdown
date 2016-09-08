# msgpack for node

[![Build Status](https://secure.travis-ci.org/creationix/msgpack-js.png)](http://travis-ci.org/creationix/msgpack-js)

A handwritten msgpack encoder and decoder for Node.JS.

The original format can be found at <http://wiki.msgpack.org/display/MSGPACK/Format+specification>


## Extension

I've extended the format a little to allow for encoding and decoding of `undefined` and `Buffer` instances.

This required three new type codes that were previously marked as "reserved".
This change means that using these new types will render your serialized data
incompatible with other messagepack implementations that don't have the same
extension.

There are two new types for storing node `Buffer` instances. These work just 
like "raw 16" and "raw 32" except they are node buffers instead of strings.

    buffer 16  11011000  0xd8
    buffer 32  11011001  0xd9

Also I've added a type for `undefined` that works just like the `null` type.

    undefined  11000100  0xc4

## Usage

``` javascript
var msgpack = require('msgpack');
var assert = require('assert');

var initial = {Hello: "World"};
var encoded = msgpack.encode(initial);
var decoded = msgpack.decode(encoded);

assert.deepEqual(initial, decoded);
```

