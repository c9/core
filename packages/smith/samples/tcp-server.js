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
