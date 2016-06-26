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
