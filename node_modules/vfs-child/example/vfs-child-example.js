var Parent = require('vfs-child').Parent;
var vfsHttpAdapter = require('vfs-http-adapter');
var Stack = require('stack');

var parent = new Parent({root: __dirname + "/"});
parent.connect();
parent.once("connect", function (vfs) {
  console.log("Starting http server");
  require('http').createServer(Stack(
    vfsHttpAdapter("/child/", vfs)
  )).listen(8080, function () {
    console.log("child filesystem listening at http://localhost:8080/child/");
  });
});
parent.on("connect", function () {
  console.log("Child spawned and connected");
});
parent.on("disconnect", function () {
  console.log("Child died, spawning new child in 500ms");
  setTimeout(function () {
    parent.connect();
  }, 500);
});
