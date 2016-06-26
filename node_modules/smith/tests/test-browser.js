var creationix = require('creationix');
var stack = require('stack');
var http = require('http');
var WebSocketServer = require('ws').Server
var spawn = require('child_process').spawn;

var Agent = require('smith').Agent;
var WebSocketTransport = require('smith').WebSocketTransport


var api = {
  add: function (a, b, callback) {
    callback(null, a + b);
  }
};

var server = http.createServer(stack(
  creationix.log(),
  creationix.static("/", __dirname + "/public")
));

var wss = new WebSocketServer({server: server});
wss.on("connection", function (websocket) {
  var agent = new Agent(api);
  agent.connect(new WebSocketTransport(websocket, true), function (err, browserAgent) {
    if (err) throw err;
    console.log({browserAgent:browserAgent});
  });
});

server.listen(8080, function () {
  var url = "http://localhost:" + server.address().port + "/index.html";
  console.log(__dirname + "/phantom.js")
  var env = Object.create(process.env);
  env.URL = url;
  console.log(url);
  var phantom = spawn("phantomjs", [__dirname + "/phantom.js"], {env: env, customFds: [-1, 1, 2]});
  phantom.on("exit", function (code, signal) {
    if (code) throw new Error("Child died with code " + code);
  });

});

