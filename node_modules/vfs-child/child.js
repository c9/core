var Worker = require('vfs-socket/worker').Worker;
// Create a local vfs from the config at argv[2]
console.log = console.error;
var config = JSON.parse(process.argv[2]);
var vfs = require('vfs-local')(config);
// Wrap the vfs in a worker agent
var worker = new Worker(vfs);
// Connect the agent to stdin (a duplex pipe)
worker.connect([process.stdin, process.stdout]);
// Kill self and all children if the connection goes down
worker.on("disconnect", function (err) {
  if (err) console.error(err.stack);
  process.exit();
});
// Let it begin
process.stdin.resume();
