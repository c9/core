# Smith

[![Build Status](https://secure.travis-ci.org/c9/smith.png)](http://travis-ci.org/c9/smith)

Smith is an RPC agent system for Node.JS used in architect and vfs.

## Usage

Smith can be used in any situation where you have a duplex node stream.  This
can be over tcp, stdio, a pipe, or anything that sends bytes back and forth.

### TCP client-server example

In this example, I have a TCP server that serves an add function to any agent
clients who want to consume the service.

For the server, we create a small agent and serve it on a listening tcp port.

```js
var net = require('net');
var Agent = require('smith').Agent;

var api = {
  add: function (a, b, callback) {
    callback(null, a + b);
  }
};

// Start a TCP server
net.createServer(function (socket) {
  // Create the agent that serves the shared api.
  var agent = new Agent(api);
  // Connect to the remote agent
  agent.connect(socket, function (err, api) {
    if (err) return console.error(err.stack);
    console.log("A new client connected");
  });
  // Log when the agent disconnects
  agent.on("disconnect", function (err) {
    console.error("The client disconnected")
    if (err) console.error(err.stack);
  });

}).listen(1337, function () {
  console.log("Agent server listening on port 1337");
});
```

Then to consume this TCP service, we can create an agent and connect it to the
tcp server.

```js
var net = require('net');
var Agent = require('smith').Agent;

var socket = net.connect(1337, function () {
  // Create our client
  var agent = new Agent()
  agent.connect(socket, function (err, api) {
    api.add(4, 5, function (err, result) {
      if (err) throw err;
      console.log("4 + 5 = %s", result);
      agent.disconnect();
    });
  });
});
```

For an example of how to reconnect if the connection goes down, see
https://github.com/c9/smith/blob/master/samples/tcp-client-autoreconnect.js

### STDIO Parent-Child Example

Here we create a node process that spawns a child process, and the two talk to eachother calling functions both directions.

Both share a simple API library.

```js
exports.ping = function (callback) {
    callback(null, process.pid + " pong");
}
```

The parent creates an Agent,spawns the child, and connects.

```js
var spawn = require('child_process').spawn;
var Agent = require('smith').Agent;
var Transport = require('smith').Transport;

// Create an agent instance using the shared API
var agent = new Agent(require('./process-shared-api'));

// Spawn the child process that runs the other half.
var child = spawn(process.execPath, [__dirname + "/process-child.js"]);
// Forward the child's console output
child.stderr.pipe(process.stderr);

var transport = new Transport(child.stdout, child.stdin);
agent.connect(transport, function (err, api) {
  if (err) throw err;
  // Call the child's API in a loop
  function loop() {
    api.ping(function (err, message) {
      if (err) throw err;
      console.log("Child says %s", message);
    })
    setTimeout(loop, Math.random() * 1000);
  }
  loop();
});
```

The child resumes stdin, creates an Agent, and connects.

```js
var Agent = require('smith').Agent;
var Transport = require('smith').Transport;

// Redirect logs to stderr since stdout is used for data
console.log = console.error;

// Start listening on stdin for smith rpc data.
process.stdin.resume();

var agent = new Agent(require('./process-shared-api'));
var transport = new Transport(process.stdin, process.stdout);
agent.connect(transport, function (err, api) {
  if (err) throw err;
  // Call the parent's API in a loop
  function loop() {
    api.ping(function (err, message) {
      if (err) throw err;
      console.log("Got %s from parent", message);
    })
    setTimeout(loop, Math.random() * 1000);
  }
  loop();
});
```

## Class: Agent

Agent is the main class used in smith.  It represents an agent in your mesh
network.  It provides a set of service functions exposed as async functions.

### new Agent(api)

Create a new Agent instance that serves the functions listed in `api`.

### agent.api

The functions this agent serves locally to remote agents.

### agent.remoteApi

A object containing proxy functions for the api functions in the remote agent.
Calling these functions when the remote is offline will result in the last
argument being called with a ENOTCONNECTED error (assuming it's a function).

### agent.connectionTimeout

If the connection hasn't happened by 10,000 ms, an ETIMEDOUT error will
happen.  To change the timeoutvalue, change `connectionTimeout` on either the
instance or the prototype.  Set to zero to disable.

### Event: 'connect'

`function (remoteApi) { }`

When the rpc handshake is complete, the agent will emit a connect event
containing the remoteApi.

### Event: 'disconnect'

`function () { }`

Emitted when the transport dies and the remote becomes offline

### Event: 'drain'

When the writable stream in the transport emits drain, it's forwarded here

### agent.connect(transport, [callback]))

Start the connection to a new remote agent using `transport`.  Emits `connect` when
ready or `error` on failure.  Optionally use the callback to get `(err, api,
agent)` results.

The `transport` argument is either a Transport instance or a duplex Stream.
The callback will be called with `(err, remoteApi)`.

### agent.disconnect(err)

Tell the agent to disconnect from the transport with optional error reason `err`.

### agent.send(message)

Encode a message and send it on the transport.  Used internally to send
function calls.  Returns false if the kernel buffer is full.

## Class: Transport

Transport is a wrapper around a duplex socket to allow two Agent instances to
talk to eachother.  A transport will shut down itself if either end of the
socket ends and emit an `error` event.

### new Transport(input, [output])

Pass in either a duplex Stream instance or two streams (one readable, one
writable).  This transport object can then be used to connect to another
Agent.

### Event: 'message'

`function (message) { }`

Emitted when a message arrives from the remote end of the transport.ts

### Event: 'drain'

`function () { }`

Emitted when the writable stream emits drain. (The write buffer is empty.)

### Event: 'disconnect'

`function (err) { }`

Emitted when the transport dies.  If this was caused by an error, it will be
emitted here.

### transport.send(message)

Send a message to the other end of the transport.  Message is JSON
serializable object with the addition of being able to serialize node Buffer
instances and `undefined` values.  Returns true if the kernel buffer is full
and you should pause your incoming stream.
