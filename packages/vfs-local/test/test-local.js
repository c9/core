/*global describe it before */

"use server";
"use mocha";

require("c9/inline-mocha")(module);

var expect = require('chai').expect;

describe('vfs-local', function () {
  this.timeout(5000);
  
  var root = __dirname + "/mock2/";
  var base = root.substr(0, root.length - 1);

  var vfs = require('vfs-lint')(require("vfs-local")({
    root: root,
    testing: true,
    defaultEnv: { CUSTOM: 43 },
    checkSymlinks: true
  }));

  var vfsLoose = require('vfs-lint')(require("vfs-local")({
    root: root
  }));

  var fs = require('fs');
  var child_process = require("child_process");
  if (!fs.existsSync) fs.existsSync = require('path').existsSync;
  
  describe('vfs.resolve()', function () {
    before(function(done){
      child_process.execFile("rm", ["-Rf", root], function(){
        child_process.execFile("cp", ["-a", __dirname + "/mock", root], function(err){
          if (err) throw err;
          
          done();
        });
      });
    });
    
    it('should prepend root when resolving virtual paths', function (done) {
      var vpath = "/dir/stuff.json";
      vfs.resolve(vpath, {}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("path").equals(base + vpath);
        done();
      });
    });
    it('should reject paths that resolve outside the root', function (done) {
      vfs.resolve("/../test-local.js", {}, function (err, meta) {
        expect(err).property("code").equals("EACCES");
        done();
      });
    });
    it('should not prepend when already rooted', function (done) {
      var path = base + "/file.txt";
      vfs.resolve(path, { alreadyRooted: true }, function (err, meta) {
        if (err) throw err;
        expect(meta).property("path").equal(path);
        done();
      });
    });
    it('should error with ENOENT when the path is invalid', function (done) {
      vfs.resolve("/notexists.txt", {}, function (err, meta) {
        expect(err).property("code").equals("ENOENT");
        done();
      });
    });
    it('should not check fs when checkSymlinks is off', function (done) {
      var vpath = "/badpath.txt";
      vfsLoose.resolve(vpath, {}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("path").equal(base + vpath);
        done();
      });
    });
  });

  describe('vfs.stat()', function () {
    it('should return stat info for the text file', function (done) {
      vfs.stat("/file.txt", {}, function (err, stat) {
        if (err) throw err;
        expect(stat).property("name").equal("file.txt");
        expect(stat).property("size").equal(23);
        expect(stat).property("mime").equal("text/plain");
        done();
      });
    });
    it("should error with ENOENT when the file doesn't exist", function (done) {
      vfs.stat("/badfile.json", {}, function (err, stat) {
        expect(err).property("code").equal("ENOENT");
        done();
      });
    });
  });

  describe('vfs.readfile()', function () {
    it("should read the text file", function (done) {
      vfs.readfile("/file.txt", {}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("mime").equals("text/plain");
        expect(meta).property("size").equals(23);
        expect(meta).property("etag");
        expect(meta).property("stream").property("readable");
        var stream = meta.stream;
        var chunks = [];
        var length = 0;
        stream.on("data", function (chunk) {
          chunks.push(chunk);
          length += chunk.length;
        });
        stream.on("end", function () {
          expect(length).equal(23);
          var body = chunks.join("");
          expect(body).equal("This is a simple file!\n");
          done();
        });
      });
    });
    it("should error with ENOENT on missing files", function (done) {
      vfs.readfile("/badfile.json", {}, function (err, meta) {
        expect(err).property("code").equal("ENOENT");
        done();
      });
    });
    it("should error with EISDIR on directories", function (done) {
      vfs.readfile("/", {}, function (err, meta) {
        expect(err).property("code").equal("EISDIR");
        done();
      });
    });
    it("should support head requests", function (done) {
      vfs.readfile("/file.txt", {head:true}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("mime").equal("text/plain");
        expect(meta).property("size").equal(23);
        expect(meta).property("mime").ok;
        expect(meta.stream).not.ok;
        done();
      });
    });
    it("should support 304 via etags", function (done) {
      vfs.readfile("/file.txt", {head:true}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("etag").ok
        var etag = meta.etag;
        vfs.readfile("/file.txt", {etag:etag}, function (err, meta) {
          if (err) throw err;
          expect(meta).property("mime").equal("text/plain");
          expect(meta).property("size").equal(23);
          expect(meta).property("notModified").ok;
          expect(meta.stream).not.ok;
          done();
        });
      });
    });
    it("should support range requests", function (done) {
      vfs.readfile("/file.txt", {range:{start:1,end:3}}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("mime").equal("text/plain");
        expect(meta).property("size").equal(3);
        expect(meta).property("etag").ok;
        expect(meta).property("partialContent").deep.equal({ start: 1, end: 3, size: 23 });
        expect(meta).property("stream").ok;
        var stream = meta.stream;
        var chunks = [];
        stream.on("data", function (chunk) {
          chunks.push(chunk);
        });
        stream.on("end", function () {
          var data = chunks.join("");
          expect(data).equal("his");
          done();
        });
      });
    });
    it("should support getting the last 10 bytes", function (done) {
      vfs.readfile("/file.txt", {range:{end:10},head:true}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("size").equal(10);
        expect(meta).property("etag").ok;
        expect(meta).property("partialContent").deep.equal({ start: 13, end: 22, size: 23 });
        done();
      });
    });
    it("should get rangeNotSatisfiable if start and end are both omitted", function (done) {
      vfs.readfile("/file.txt", {range:{}}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("rangeNotSatisfiable");
        done();
      });
    });
    it("should get rangeNotSatisfiable if start is after end", function (done) {
      vfs.readfile("/file.txt", {range:{start:5,end:4}}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("rangeNotSatisfiable");
        done();
      });
    });
  });

  describe('vfs.readdir()', function () {
    it("should read the directory", function (done) {
      vfs.readdir("/", {}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("etag");
        expect(meta).property("stream").property("readable");
        var stream = meta.stream;
        var parts = [];
        stream.on("data", function (part) {
          parts.push(part);
        });
        stream.on("end", function () {
          expect(parts).length(5);
          done();
        });
      });
    });
    it("should error with ENOENT when the folder doesn't exist", function (done) {
      vfs.readdir("/fake", {}, function (err, meta) {
        expect(err).property("code").equal("ENOENT");
        done();
      });
    });
    it("should error with ENOTDIR when the path is a file", function (done) {
      vfs.readdir("/file.txt", {}, function (err, meta) {
        expect(err).property("code").equal("ENOTDIR");
        done();
      });
    });
    it("should support head requests", function (done) {
      vfs.readdir("/", {head:true}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("etag").ok;
        expect(meta.stream).not.ok;
        done();
      });
    });
    it("should support 304 via etags", function (done) {
      vfs.readdir("/", {head:true}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("etag").ok;
        var etag = meta.etag;
        vfs.readdir("/", {etag:etag}, function (err, meta) {
          if (err) throw err;
          expect(meta).property("notModified").ok;
          expect(meta.stream).not.ok;
          done();
        });
      });
    });
  });

  describe('vfs.mkfile()', function () {
    it("should create a file using using readable in options", function (done) {
      var stream = fs.createReadStream(__filename);
      var vpath = "/test.js";
      // Make sure the file doesn't exist.
      expect(fs.existsSync(base + vpath)).not.ok;
      vfs.mkfile(vpath, { stream: stream }, function (err, meta) {
        if (err) {
          fs.unlinkSync(base + vpath);
          return done(err);
        }
        var actual = fs.readFileSync(base + vpath, "utf8");
        var original = fs.readFileSync(__filename, "utf8");
        fs.unlinkSync(base + vpath);
        expect(actual).equal(original);
        done();
      });
    });
    it("should create a file using writable in callback", function (done) {
      var vpath = "/test.js";
      // Make sure the file doesn't exist.
      expect(fs.existsSync(base + vpath)).not.ok;
      vfs.mkfile(vpath, {}, function (err, meta) {
        if (err) {
          fs.unlinkSync(base + vpath);
          return done(err);
        }
        expect(meta).property("stream").property("writable").ok;
        var writable = meta.stream;
        var readable = fs.createReadStream(__filename);
        readable.pipe(writable);
        writable.on("close", function () {
          var actual = fs.readFileSync(base + vpath, "utf8");
          var original = fs.readFileSync(__filename, "utf8");
          fs.unlinkSync(base + vpath);
          expect(actual).equal(original);
          done();
        });
      });
    });
    it("should update an existing file using readble in options", function (done) {
      var vpath = "/changeme.txt";
      var stream = fs.createReadStream(__filename);
      fs.writeFileSync(base + vpath, "Original Content\n");
      vfs.mkfile(vpath, {stream: stream}, function (err, meta) {
        if (err) {
          fs.unlinkSync(base + vpath);
          return done(err);
        }
        var actual = fs.readFileSync(base + vpath, "utf8");
        var original = fs.readFileSync(__filename, "utf8");
        fs.unlinkSync(base + vpath);
        expect(actual).equal(original);
        done();
      });
    }),
    it("should update an existing file using writable in callback", function (done) {
      var vpath = "/changeme.txt";
      fs.writeFileSync(base + vpath, "Original Content\n");
      vfs.mkfile(vpath, {}, function (err, meta) {
        if (err) {
          fs.unlinkSync(base + vpath);
          return done(err);
        }
        expect(meta).property("stream").property("writable").ok;
        var writable = meta.stream;
        var readable = fs.createReadStream(__filename);
        readable.pipe(writable);
        writable.on("saved", function () {
          var actual = fs.readFileSync(base + vpath, "utf8");
          var original = fs.readFileSync(__filename, "utf8");
          fs.unlinkSync(base + vpath);
          expect(actual).equal(original);
          done();
        });
      });
    });
    it("should not write to a read only file", function(done) {
      var vpath = "/readonly.txt";
      fs.writeFileSync(base + vpath, "read only");
      fs.chmodSync(base + vpath, "0444");
      vfs.mkfile(vpath, {}, function(err, meta) {
        fs.unlinkSync(base + vpath);
        expect(err).property("code").equal("EACCES");
        done();
      });
    });
    it("should create intermediate directories", function(done) {
      vfs.execFile("rm", {args: ["-rf", root + "/nested"]}, function() {
        vfs.mkfile("/nested/dir/file.txt", { parents: true }, function(err, meta) {
          meta.stream.write("juhu");
          meta.stream.end();
          
          meta.stream.on("saved", function() {
            var contents = fs.readFileSync(root + "nested/dir/file.txt", "utf8");
            vfs.execFile("rm", {args: ["-rf", root + "/nested"]}, done);
            expect(contents).equal("juhu");
          });
        });
      });
    });
    it("should buffer in memory prior before writing", function(done) {
      var vpath = "/changeme.txt";
      var stream = fs.createReadStream(__filename);
      fs.writeFileSync(base + vpath, "Original Content\n");
      vfs.mkfile(vpath, {stream: stream, bufferWrite: true}, function (err, meta) {
        if (err) {
          fs.unlinkSync(base + vpath);
          return done(err);
        }
        var actual = fs.readFileSync(base + vpath, "utf8");
        var original = fs.readFileSync(__filename, "utf8");
        fs.unlinkSync(base + vpath);
        expect(actual).equal(original);
        done();
      });
    });
  });

  describe('vfs.mkdir()', function () {
    it("should create a directory", function (done) {
      var vpath = "/newdir";
      // Make sure it doesn't exist yet
      expect(fs.existsSync(base + vpath)).not.ok;
      vfs.mkdir(vpath, {}, function (err, meta) {
        if (err) {
          fs.rmdirSync(base + vpath);
          return done(err);
        }
        expect(fs.existsSync(base + vpath)).ok;
        fs.rmdirSync(base + vpath);
        done();
      });
    });
    it("should error with EEXIST when the directory already exists", function (done) {
      vfs.mkdir("/dir", {}, function (err, meta) {
        expect(err).property("code").equal("EEXIST");
        done();
      });
    });
    it("should error with EEXIST when a file already exists at the path", function (done) {
      vfs.mkdir("/file.txt", {}, function (err, meta) {
        expect(err).property("code").equal("EEXIST");
        done();
      });
    });
  });

  describe('vfs.rmfile()', function () {
    it("should delete a file", function (done) {
      var vpath = "/deleteme.txt";
      fs.writeFileSync(base + vpath, "DELETE ME!\n");
      expect(fs.existsSync(base + vpath)).ok;
      vfs.rmfile(vpath, {}, function (err, meta) {
        if (err) throw err;
        expect(fs.existsSync(base + vpath)).not.ok;
        done();
      });
    });
    it("should error with ENOENT if the file doesn't exist", function (done) {
      var vpath = "/badname.txt";
      expect(fs.existsSync(base + vpath)).not.ok;
      vfs.rmfile(vpath, {}, function (err, meta) {
        expect(err).property("code").equal("ENOENT");
        done();
      });
    });
    it("should error with EISDIR if the path is a directory", function (done) {
      var vpath = "/dir";
      expect(fs.existsSync(base + vpath)).ok;
      vfs.rmfile(vpath, {}, function (err, meta) {
        if (process.platform == "darwin")
          expect(err).property("code").equals("EPERM");
        else
          expect(err).property("code").equal("EISDIR");
        
        done();
      });
    });
  });

  describe('vfs.rmdir()', function () {
    it("should delete a directory", function (done) {
      var vpath = "/newdir";
      fs.mkdirSync(base + vpath);
      expect(fs.existsSync(base + vpath)).ok;
      vfs.rmdir(vpath, {}, function (err, meta) {
        if (err) throw err;
        expect(fs.existsSync(base + vpath)).not.ok;
        done();
      });
    });
    it("should error with ENOENT if the directory doesn't exist", function (done) {
      var vpath = "/baddir";
      expect(fs.existsSync(base + vpath)).not.ok;
      vfs.rmdir(vpath, {}, function (err, meta) {
        expect(err).property("code").equal("ENOENT");
        done();
      });
    });
    it("should error with ENOTDIR if the path is a file", function (done) {
      var vpath = "/file.txt";
      expect(fs.existsSync(base + vpath)).ok;
      vfs.rmdir(vpath, {}, function (err, meta) {
        expect(err).property("code").equal("ENOTDIR");
        done();
      });
    });
    it("should do recursive deletes if options.recursive is set", function (done) {
      fs.mkdirSync(base + "/foo");
      fs.writeFileSync(base + "/foo/bar.txt", "Hello");
      expect(fs.existsSync(base + "/foo")).ok;
      expect(fs.existsSync(base + "/foo/bar.txt")).ok;
      vfs.rmdir("/foo", {recursive:true}, function (err, meta) {
        if (err) throw err;
        expect(fs.existsSync(base + "/foo/bar.txt")).not.ok;
        expect(fs.existsSync(base + "/foo")).not.ok;
        done();
      });
    });
  });

  describe('vfs.rename()', function () {
    it("should rename a file using options.to", function (done) {
      var before = "/start.txt";
      var after = "/end.txt";
      var text = "Move me please\n";
      fs.writeFileSync(base + before, text);
      expect(fs.existsSync(base + before)).ok;
      expect(fs.existsSync(base + after)).not.ok;
      vfs.rename(before, {to: after}, function (err, meta) {
        if (err) throw err;
        expect(fs.existsSync(base + before)).not.ok;
        expect(fs.existsSync(base + after)).ok;
        expect(fs.readFileSync(base + after, "utf8")).equal(text);
        fs.unlinkSync(base + after);
        done();
      });
    });
    it("should rename a file using options.from", function (done) {
      var before = "/start.txt";
      var after = "/end.txt";
      var text = "Move me please\n";
      fs.writeFileSync(base + before, text);
      expect(fs.existsSync(base + before)).ok;
      expect(fs.existsSync(base + after)).not.ok;
      vfs.rename(after, {from: before}, function (err, meta) {
        if (err) throw err;
        expect(fs.existsSync(base + before)).not.ok;
        expect(fs.existsSync(base + after)).ok;
        expect(fs.readFileSync(base + after, "utf8")).equal(text);
        fs.unlinkSync(base + after);
        done();
      });
    });
    it("should error with ENOENT if the source doesn't exist", function (done) {
      vfs.rename("/notexist", {to:"/newname"}, function (err, meta) {
        expect(err).property("code").equal("ENOENT");
        done();
      });
    });
  });

  describe('vfs.copy()', function () {
    it("should copy a file using options.to", function (done) {
      var source = "/file.txt";
      var target = "/copy.txt";
      var text = fs.readFileSync(base + source, "utf8");
      vfs.copy(source, {to: target}, function (err, meta) {
        if (err) throw err;
        expect(fs.existsSync(base + target)).ok;
        expect(fs.readFileSync(base + target, "utf8")).equal(text);
        fs.unlinkSync(base + target);
        done();
      });
    });
    it("should copy a file using options.from", function (done) {
      var source = "/file.txt";
      var target = "/copy.txt";
      var text = fs.readFileSync(base + source, "utf8");
      vfs.copy(target, {from: source}, function (err, meta) {
        if (err) throw err;
        expect(fs.existsSync(base + target)).ok;
        expect(fs.readFileSync(base + target, "utf8")).equal(text);
        fs.unlinkSync(base + target);
        done();
      });
    });
    it("should error with ENOENT if the source doesn't exist", function (done) {
      vfs.copy("/badname.txt", {to:"/copy.txt"}, function (err, meta) {
        expect(err).property("code").equal("ENOENT");
        done();
      });
    });
  });

  describe('vfs.symlink()', function () {
    it("should create a symlink", function (done) {
      var target = "file.txt";
      var vpath = "/newlink.txt";
      var text = fs.readFileSync(root + target, "utf8");
      vfs.symlink(vpath, {target: target}, function (err, meta) {
        if (err) throw err;
        expect(fs.readFileSync(base + vpath, "utf8")).equal(text);
        fs.unlinkSync(base + vpath);
        done();
      });
    });
    it("should error with ENOENT if the dire3ctory of the target file does not exists", function (done) {
      vfs.symlink("/file.txt", {target:"/this/is/crazy"}, function (err, meta) {
        expect(err).property("code").equal("ENOENT");
        done();
      });
    });
    it("should error with EEXIST if the file already exists", function (done) {
      var target = "/target.txt";
      fs.writeFileSync(root + target, "Target");
      vfs.symlink("/file.txt", {target: target}, function (err, meta) {
        fs.unlinkSync(base + target);
        expect(err).property("code").equal("EEXIST");
        done();
      });
    });
  });

  describe('vfs.watch()', function () {
    it("should notice a directly watched file change (OS changing it)", function (done) {
      var vpath = "/newfile.txt";
      expect(fs.existsSync(base + vpath)).not.ok;
      fs.writeFile(base + vpath, "Test", function(){
        vfs.watch(vpath, {}, function (err, meta) {
          if (err) throw err;
          expect(meta).property("watcher").ok;
          var watcher = meta.watcher;
          watcher.on("change", function listen(event, filename) {
            expect(event).equal(inner ? "delete" : "change");
            if (process.platform !== "darwin")
              expect(filename).equal(vpath.substr(1));
            
            if (inner) {
              watcher.close();
              done();
            }
          });
          
          var inner = false;
          fs.writeFile(base + vpath, "Change!", function(){
            setTimeout(function(){
              inner = true;
              fs.unlinkSync(base + vpath);
            }, 100);
          });
        });
      });
    });
    it("should notice a directly watched file change (change via VFS)", function (done) {
      var vpath = "/newfile.txt";
      expect(fs.existsSync(base + vpath)).not.ok;
      fs.writeFile(base + vpath, "Test", function(){
        vfs.watch(vpath, {}, function (err, meta) {
          if (err) throw err;
          expect(meta).property("watcher").ok;
          var watcher = meta.watcher;
          watcher.on("change", function listen(event, filename) {
            if (process.platform !== "darwin")
              expect(filename).equal(vpath.substr(1));
            
            if (inner) {
              watcher.close();
              done();
            }
          });
          
          var inner = false;
          vfs.mkfile(vpath, {}, function(err, meta){
            var stream = meta.stream;
            stream.write("Change!");
            stream.end();
            setTimeout(function(){
              inner = true;
              fs.unlinkSync(base + vpath);
            }, 100);
          });
        });
      });
    });
    it("should notice a new file in a watched directory", function (done) {
      var vpath = "/newfile.txt";
      expect(fs.existsSync(base + vpath)).not.ok;
      vfs.watch("/", {}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("watcher").ok;
        var watcher = meta.watcher;
        watcher.on("change", function (event, filename) {
          watcher.close();
          expect(event).ok;
          if (process.platform !== "darwin")
            expect(filename).equal(vpath.substr(1));
          fs.unlinkSync(base + vpath);
          done();
        });
        fs.writeFileSync(base + vpath, "newfile!");
      });
    });
    it("should return error if path does not exist", function(done) {
      var vpath = "/newfile.txt";
      expect(fs.existsSync(base + vpath)).not.ok;
      vfs.watch(base + vpath, {file: false}, function (err, meta) {
        expect(err).ok;
        done();
      });
    });
  });

  describe('vfs.connect()', function () {
    var net = require('net');
    it("should connect to a tcp server and ping-pong", function (done) {
      var stream;
      var server = net.createServer(function (client) {
        client.setEncoding('utf8');
        client.once("data", function (chunk) {
          expect(chunk).equal("ping");
          stream.once("data", function (chunk) {
            expect(chunk).equal("pong");
            client.end();
            stream.end();
            server.close();
            done();
          });
          client.write("pong");
        });
      });
      server.listen(function () {
        var port = server.address().port;
        vfs.connect(port, {encoding:"utf8"}, function (err, meta) {
          if (err) throw err;
          expect(meta).property("stream").ok;
          stream = meta.stream;
          stream.write("ping");
        });
      });
    });
  });

  describe('vfs.spawn()', function () {
    it("should spawn a child process", function (done) {
      var args = ["-e", "process.stdin.pipe(process.stdout);try{process.stdin.resume()}catch(e){};"];
      vfs.spawn(process.execPath, {args: args, stdoutEncoding: "utf8"}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("process").ok;
        var child = meta.process;
        expect(child).property("stdout").ok;
        expect(child).property("stdin").ok;
        child.stdout.on("data", function (chunk) {
          expect(chunk).equal("echo me");
          child.stdout.on("end", function () {
            done();
          });
          child.stdin.end();
        });
        child.stdin.write("echo me");
      });
    });
    it("should have environment variables from process, fsOptions, and call", function (done) {
      process.env.PROCESS = 42;
      var args = ["-e", "console.log([process.env.PROCESS, process.env.CUSTOM, process.env.LOCAL].join(','))"];
      vfs.spawn(process.execPath, {args:args, stdoutEncoding: "utf8", stderrEncoding: "utf8", env: {LOCAL:44}}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("process").ok;
        var child = meta.process;
        var stdout = [];
        child.stdout.on("data", function (chunk) {
          stdout.push(chunk);
        });
        child.stdout.on("end", function () {
          stdout = stdout.join("");
          expect(stdout).equal("42,43,44\n");
          done();
        });
      });
    });
  });

  describe('vfs.execFile()', function () {
    it("should exec a child process", function (done) {
      var args = ["-p", "-e", "process.version"];
      vfs.execFile(process.execPath, {args:args}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("stdout").equal(process.version + "\n");
        expect(meta).property("stderr").equal("");
        done();
      });
    });
    it("should have environment variables from process, fsOptions, and call", function (done) {
      process.env.PROCESS = 42;
      var args = ["-e", "console.log([process.env.PROCESS, process.env.CUSTOM, process.env.LOCAL].join(','))"];
      vfs.execFile(process.execPath, {args:args, env: {LOCAL:44}}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("stdout").equal("42,43,44\n");
        done();
      });
    });
    it("should return stdout and stderr on the error object", function(done) {
      var args = ["-e", "console.error('error'); console.log('out'); process.exit(1);"];
      vfs.execFile(process.execPath, {args:args}, function (err, meta) {
        expect(err).property("stderr").equal("error\n");
        expect(err).property("stdout").equal("out\n");
        expect(err).property("code").equal(1);
        done();
      });
    });
  });

  describe('vfs.on(), vfs.off(), vfs.emit()', function () {
    it ("should register an event listener and catch an event", function (done) {
      vfs.on("myevent", onEvent, function (err) {
        if (err) throw err;
        vfs.emit("myevent", 42, function (err) {
          if (err) throw err;
        });
      });
      function onEvent(data) {
        expect(data).equal(42);
        vfs.off("myevent", onEvent, done);
      }
    });
    it("should catch multiple events of the same type", function (done) {
      var times = 0;
      vfs.on("myevent", onEvent, function (err) {
        if (err) throw err;
        vfs.emit("myevent", 43, function (err) {
          if (err) throw err;
        });
        vfs.emit("myevent", 43, function (err) {
          if (err) throw err;
        });
      });
      function onEvent(data) {
        expect(data).equal(43);
        if (++times === 2) {
          vfs.off("myevent", onEvent, done);
        }
      }
    });
    it("should call multiple listeners for a single event", function (done) {
      var times = 0;
      vfs.on("myevent", onEvent1, function (err) {
        if (err) throw err;
        vfs.on("myevent", onEvent2, function (err) {
          if (err) throw err;
          vfs.emit("myevent", 44, function (err) {
            if (err) throw err;
          });
        });
      });
      function onEvent1(data) {
        expect(data).equal(44);
        times++;
      }
      function onEvent2(data) {
        expect(data).equal(44);
        if (++times === 2) {
          vfs.off("myevent", onEvent1, function (err) {
            if (err) throw err;
            vfs.off("myevent", onEvent2, done);
          });
        }
      }
    });
    it("should stop listening after a handler is removed", function (done) {
      vfs.on("myevent", onEvent, function (err) {
        if (err) throw err;
        vfs.emit("myevent", 45, function (err) {
          if (err) throw err;
          vfs.off("myevent", onEvent, function (err) {
            if (err) throw err;
            vfs.emit("myevent", 46, done);
          });
        });
      });
      function onEvent(data) {
        expect(data).equal(45);
      }
    });
  });

  describe('vfs.extend()', function () {
    it("should extend using a local file", function (done) {
      vfs.extend("math", {file: __dirname + "/math.js"}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("api").ok;
        var api = meta.api;
        expect(api).property("add").a("function");
        expect(api).property("multiply").a("function");
        api.add(3, 4, function (err, result) {
          if (err) throw err;
          expect(result).equal(3 + 4);
          vfs.unextend("math", {}, done);
        });
      });
    });
    it("should extend using a string", function (done) {
      var code = fs.readFileSync(__dirname + "/math.js", "utf8");
      vfs.extend("math2", {code: code}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("api").ok;
        var api = meta.api;
        expect(api).property("add").a("function");
        expect(api).property("multiply").a("function");
        api.add(3, 4, function (err, result) {
          if (err) throw err;
          expect(result).equal(3 + 4);
          vfs.unextend("math2", {}, done);
        });
      });
    });
    it("should extend using a stream", function (done) {
      var stream = fs.createReadStream(__dirname + "/math.js");
      vfs.extend("math3", {stream: stream}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("api").ok;
        var api = meta.api;
        expect(api).property("add").a("function");
        expect(api).property("multiply").a("function");
        api.add(3, 4, function (err, result) {
          if (err) throw err;
          expect(result).equal(3 + 4);
          vfs.unextend("math3", {}, done);
        });
      });
    });
    it("should error with EEXIST if the same extension is added twice", function (done) {
      vfs.extend("math", {file: __dirname + "/math.js"}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("api").ok;
        vfs.extend("math", {file: __dirname + "/math.js"}, function (err, meta) {
          expect(err).property("code").equal("EEXIST");
          vfs.unextend("math", {}, done);
        });
      });
    });
    it("should error with EACCES if the same extension name is empty", function (done) {
      vfs.extend("", {file: __dirname + "/math.js"}, function (err, meta) {
        expect(err).property("code").equal("EACCES");
        done();
      });
    });
    it("should allow a redefine if options.redefine is set", function (done) {
      vfs.extend("test", {file: __dirname + "/math.js"}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("api").ok;
        vfs.extend("test", {redefine: true, file: __dirname + "/math.js"}, function (err, meta) {
          if (err) throw err;
          expect(meta).property("api").ok;
          vfs.unextend("test", {}, done);
        });
      });
    });
  });

  describe('vfs.unextend()', function () {
    it("should remove an extension", function (done) {
      vfs.extend("math7", {file: __dirname + "/math.js"}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("api").ok;
        vfs.use("math7", {}, function (err, meta) {
          if (err) throw err;
          expect(meta).property("api").ok;
          vfs.unextend("math7", {}, function (err, meta) {
            if (err) throw err;
            vfs.use("math7", {}, function (err, meta) {
              expect(err).property("code").equal("ENOENT");
              done();
            });
          });
        });
      });
    });
  });

  describe('vfs.use()', function () {
    it("should load an existing api", function (done) {
      vfs.extend("math4", {file: __dirname + "/math.js"}, function (err, meta) {
        if (err) throw err;
        expect(meta).property("api").ok;
        vfs.use("math4", {}, function (err, meta) {
          if (err) throw err;
          expect(meta).property("api").ok;
          var api = meta.api;
          expect(api).property("add").a("function");
          expect(api).property("multiply").a("function");
          api.add(3, 4, function (err, result) {
            if (err) throw err;
            expect(result).equal(3 + 4);
            vfs.unextend("math4", {}, done);
          });
        });
      });
    });
    it("should error with ENOENT if the api doesn't exist", function (done) {
      vfs.use("notfound", {}, function (err, meta) {
        expect(err).property("code").equal("ENOENT");
        done();
      });
    });
  });

  describe('vfs sandboxing', function () {
    it("should sandbox stat", function (done) {
      vfs.stat("/stuff.json", { sandbox: "/dir" }, function (err, stat) {
        if (err) throw err;
        expect(stat).property("name").equal("stuff.json");
        done();
      });
    });
    it("should sandbox readfile", function (done) {
      vfs.readfile("/stuff.json", { sandbox: "/dir" }, function (err, meta) {
        if (err) throw err;
        expect(meta).property("stream").property("readable");
        done();
      });
    });
    it("should sandbox mkfile", function (done) {
      var vpath = "/test.js";
      var sandbox = "/dir";
      // Make sure the file doesn't exist.
      fs.unlink(base + sandbox + vpath, function(){
        expect(fs.existsSync(base + sandbox + vpath)).not.ok;
        vfs.mkfile(vpath, { sandbox: sandbox }, function (err, meta) {
          if (err) {
            fs.unlinkSync(base + sandbox + vpath);
            return done(err);
          }
          expect(meta).property("stream").property("writable").ok;
          var writable = meta.stream;
          writable.on("close", function () {
            expect(fs.existsSync(base + sandbox + vpath)).ok;
            fs.unlinkSync(base + sandbox + vpath);
            done();
          });
          writable.end("juhu");
        });
      });
    });
    it("should sandbox watcher events", function (done) {
      var vpath = "/newfile.txt";
      var sandbox = "/dir";
      fs.unlink(base + sandbox + vpath, function(){
        expect(fs.existsSync(base + sandbox + vpath)).not.ok;
        fs.writeFile(base + sandbox + vpath, "Test", function(){
          vfs.watch(vpath, { sandbox: sandbox }, function (err, meta) {
            if (err) throw err;
            var watcher = meta.watcher;
            watcher.on("change", function listen(event, filename) {
              if (process.platform !== "darwin")
                expect(filename).equal(vpath.substr(1));
              
              if (inner) {
                watcher.close();
                done();
              }
            });
            
            var inner = false;
            vfs.mkfile(vpath, { sandbox: sandbox }, function(err, meta){
              var stream = meta.stream;
              stream.write("Change!");
              stream.end();
              setTimeout(function(){
                inner = true;
                fs.unlinkSync(base + sandbox + vpath);
              }, 100);
            });
          });
        });
      });
    });
  });

});
