AMD loader for node.js
======================

node-amd-loader adds the capability to load unmodified AMD (Asynchronous Module DefinitionAsynchronous Module Definition) from node.js applications.

Installation
------------

`node-amd-loader` can be easily installed using [npm](http://npmjs.org).

    npm install amd-loader
    
Before being able to load AMD modules the `amd-loader` module has to be required.

    require("amd-loader");
    
This needs to be done only once.

Features
--------

### load modules which use AMD define() ###

Load modules which are written using  AMD [define](http://wiki.commonjs.org/wiki/Modules/AsynchronousDefinition#define.28.29_function) from node.js node.

amd.js

```javascript
    define(function(require, exports, module) {
        exports.B = "B";
    });
```

main.js

```
    require("amd-loader");
    var amd = require("./amd");
```

### support requireJS asyncronous loading syntax ###

From within an AMD modules the async require syntax introduced by [requireJS](http://requirejs.org) can be used.

```javascript
    require(["fs"], function(fs) {
        fs.readFile(...);
    })
```

### support requireJS text plugin ###

From within an AMD module the requireJS text plugin is supported.

```javascript
    var readme = require("text!./readme.md");
```

Continuous Integration status
-----------------------------

This project is tested with [Travis CI](http://travis-ci.org)
[![Build Status](https://secure.travis-ci.org/ajaxorg/node-amd-loader.png)](http://travis-ci.org/ajaxorg/node-amd-loader)

Credits
-------

[Kris Zip](https://github.com/kriszyp) came up the the initial [idea](https://gist.github.com/650000) how to hijack the node module loading.

License
-------

MIT license. See the LICENSE file for details.