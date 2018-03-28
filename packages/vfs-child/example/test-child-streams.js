// var vfs = require('vfs-local')({root: __dirname + "/"});
// test(vfs);

var Parent = require('vfs-child').Parent;

var parent = new Parent({root: __dirname + "/"});

parent.connect(function (err, vfs) {
  if (err) throw err;
  test(vfs);    
});

function test(vfs) {
    vfs.readfile("test-child-streams.js", {}, function (err, meta) {
        if (err) throw err;
        meta.stream.on("end", function () {
            vfs.mkfile("foobar.js", {stream: require('fs').createReadStream(__filename)}, function (err, meta) {
                if (err) throw err;
                console.log("META", meta);
            });
        });
    });
}
