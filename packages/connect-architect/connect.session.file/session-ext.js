var assert = require("assert");
var path = require("path");
var fs = require("fs");
var Store = require("connect/lib/middleware/session/store");

module.exports = function startup(options, imports, register) {

    assert(options.sessionsPath, "option 'sessionsPath' is required");
    
    if (!path.existsSync(path.dirname(options.sessionsPath))) {
        fs.mkdir(path.dirname(options.sessionsPath), 0755);
    }
    if (!path.existsSync(options.sessionsPath)) {
        fs.mkdir(options.sessionsPath, 0755);
    }

    var sessionStore = new FileStore({
        basePath: options.sessionsPath,
        reapInterval: 60 * 60 * 1000    // 1 hour
    });
    
    register(null, {
        "session-store": {
            on: sessionStore.on.bind(sessionStore),
            get: sessionStore.get.bind(sessionStore),
            set: sessionStore.set.bind(sessionStore),
            destroy: sessionStore.destroy.bind(sessionStore),
            regenerate: sessionStore.regenerate.bind(sessionStore),
            createSession: sessionStore.createSession.bind(sessionStore)
        }
    });
    
};


var FileStore = function(options) {
    var self = this;
    self.basePath = options.basePath;
    self.reapInterval = options.reapInterval || -1;
    if (self.reapInterval > 0) {
        setInterval(function() {
            fs.readdir(self.basePath, function(err, files) {
                if (err) {
                    console.error(err);
                    return;
                }
                files.forEach(function(file) {
                    fs.readFile(self.basePath + "/" + file, function(err, data) {
                        if (err) {
                            console.error(err);
                            return;
                        }
                        var sess = JSON.parse(data);
                        var expires = (typeof sess.cookie.expires === 'string')
                            ? new Date(sess.cookie.expires)
                            : sess.cookie.expires;
                        if (!expires || new Date < expires) {
                            // session ok
                        } else {
                            self.destroy(file);
                        }                      
                    });
                });
            });
        }, self.reapInterval);
    }
};

FileStore.prototype.__proto__ = Store.prototype;

FileStore.prototype.get = function(sid, fn){
  var self = this;
  sid = sid.replace(/\//g, "_");
  path.exists(self.basePath + "/" + sid, function(exists) {
      if (exists) {
          fs.readFile(self.basePath + "/" + sid, function(err, data) {
              if (err) {
                  fn && fn(err);
              }
              else {
                  var sess;
                  try {
                      sess = JSON.parse(data);
                  } catch(e) {
                      console.warn("Error '" + e + "' reading session: " + sid, data);
                      self.destroy(sid, fn);
                      return;
                  }
                  var expires = (typeof sess.cookie.expires === 'string')
                      ? new Date(sess.cookie.expires)
                      : sess.cookie.expires;
                  if (!expires || new Date < expires) {
                      fn(null, sess);
                  } else {
                      self.destroy(sid, fn);
                  }                      
              }
          });
      }
      else {
          fn();
      }
  });      
};

FileStore.prototype.set = function(sid, sess, fn){
  var self = this;
  sid = sid.replace(/\//g, "_");
  var path = self.basePath + "/" + sid;
  var tmpPath = path + "~" + new Date().getTime();
  fs.writeFile(path, JSON.stringify(sess), function(err) {
      if (err)
        return fn && fn(err);

      fs.rename(tmpPath, path, function(err) {
        fn && fn(err);
      });
  });
};

FileStore.prototype.destroy = function(sid, fn){
  var self = this;
  sid = sid.replace(/\//g, "_");
  path.exists(self.basePath + "/" + sid, function(exists) {
      if (exists) {
          fs.unlink(self.basePath + "/" + sid, function(err) {
              if (err) {
                  fn && fn(err);
              }
              else {
                  fn && fn();
              }
          });              
      } else {
          fn && fn();
      }
  });
};

FileStore.prototype.all = function(fn){
    var self = this;
    fs.readdir(self.basePath, function(err, files) {
        if (err) {
            fn && fn(err);
            return;
        }
        var arr = [];
        files.forEach(function(file) {
            // TODO: Make this async.
            arr.push(JSON.parse(fs.readFileSync(self.basePath + "/" + file)));
        });
        fn && fn(arr);
    });
};

FileStore.prototype.clear = function(fn){
    throw new Error("NYI");
/*
  this.sessions = {};
  fn && fn();
*/
};

FileStore.prototype.length = function(fn){
    throw new Error("NYI");
/*
  fn(null, Object.keys(this.sessions).length);
*/
};
