# HTTP Adapter

This module is a connect/stack middleware module that wraps a vfs instance and
serves it via a HTTP RESTful interface.

The module is a setup function that creates a middleware instance.

```js
var root = "http://localhost:8080/rest/";

var vfs = require('vfs-local')({
  root: process.cwd(),
  httpRoot: root,
});

require('http').createServer(require('stack')(
  require('vfs-http-adapter')("/rest/", vfs)
)).listen(8080);

console.log("RESTful interface at " + root);
```

## `HEAD /any/path`

All HEAD requests are converted to GET requests internally and act identical,
except there is an internal flag in the vfs layer telling it to not stream the body.

## `GET /path/to/file`

Serve a file to the client as a stream.  Supports etags and range requests.

## `GET /directory/path/with/slash/`

Serve a directory listing as a JSON document.

This is served as a streaming json document with a weak etag (since the order
of the entries is not defined.)  It supports conditional GET requests

See `vfs.readdir` below for the format of the JSON.

## `PUT /path/to/file`

Recieve a file from the client and save it to the vfs.  The file body is streamed.

## `PUT /directory/path/with/slash/`

Create a directory

## `DELETE /path/to/file`

Delete a file.

## `DELETE /directory/path/with/slash/`

Delete a directory (not recursive)


## `POST /path/to/target`

POST is used for various adhoc commands that are useful but don't fit well into
the RESTful paradigm.  The client sends a JSON body containing the request information.

Currently this includes:

 - {"renameFrom": from} - rename a file from `from` to `target`.
 - {"copyFrom": from} - copy a file from `from` to `target`.
 - {"linkTo": data} - create a symlink at `target` containing `data`.

