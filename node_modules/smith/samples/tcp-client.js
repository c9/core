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
