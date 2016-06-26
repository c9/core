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
