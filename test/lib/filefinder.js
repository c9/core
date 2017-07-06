/*
filefinder - find files matching a specific file name pattern that are not found on a specified blacklist

=example=
  new filefinder("/tmp", "files", ".*_test.js", "/tmp/blacklist", function(err, res) {
    console.log(util.inspect(res));  
  });

--dirlist--
one_test.js
two_test.js
three.js
four_test.js

--blacklist--
one_test.js
files/two_test.js
four

--result--
{ countOk: 2,
  countPatternMis: 1,
  countBl: 1,
  list: [ 'files/four_test.js', 'files/one_test.js' ] }
  
*/

var fs = require("fs");
var util = require("util");
var path = require("path");


var DEBUGMODE = false;



function filefinder(basedir, subdir, fnpattern, blacklistfile, cb) {
  if (DEBUGMODE) console.log("\n\n\n\nfilefinder()");
  if (cb) cb();
}

filefinder.prototype.find = function(basedir, subdir, fnpattern, blacklistfile, cb) {
  if (DEBUGMODE) console.log("\n\n\n\nfind(%s, %s, %s)", path.join(basedir, subdir), fnpattern, blacklistfile);
  this.basedir = basedir;
  this.subdir = subdir;
  this.pattern = fnpattern;
  this.blacklistfile = blacklistfile;
  
  this.flist = [];
  this.countBlacklisted = 0;
  this.countPatternMis = 0;
  var _self = this;
  
  _self.getBlacklist(this.blacklistfile, function(err, blacklist) {
    _self.treewalk(basedir, subdir, fnpattern, blacklist, _self.flist, function(err, res) {
      // compose results object
      var result = {
        countOk: _self.flist.length,
        countPatternMis: _self.countPatternMis,
        countBl: _self.countBlacklisted,
        list: _self.flist,
        blacklist: blacklist
      };
      cb(null, result);
    });
  });
};

filefinder.prototype.getBlacklist = function(filename, cb) {
  if (DEBUGMODE) console.log("getBlacklist()");
  var _self = this;
  _self.getFileInArray(filename, function(err, blacklist) {
    if (err) return cb(new Error("error reading blacklist file"));
    _self.arrayRemoveCrap(blacklist, function(err, blacklist) {
      if (DEBUGMODE) console.log("--blacklist--\nlength: %s\n%s\n-------------", blacklist.length, util.inspect(blacklist));
      cb(null, blacklist);
    });
  });
};

//  read a text file and make each line a member of an array
filefinder.prototype.getFileInArray = function(filename, cb) {
  if (DEBUGMODE) console.log("getFileInArray()");
  var array = [];
  fs.exists(filename, function (exists) {
    if (!exists) return cb(null, array);
    fs.readFile(filename, function(err, data) {
      if(err) return cb(err);
      array = data.toString().split("\n");
      cb(null, array);
    });
  });
};

filefinder.prototype.arrayRemoveCrap = function(array, cb) {
  if (DEBUGMODE) console.log("arrayRemoveCrap()");
    
  function removeComments(element, index, array) {      
    // clean-up whitespace, comments etc.
    array[index] = array[index].replace(/\s*#.*|^\s*|\s*$/g, '');
  }
  array.forEach(removeComments);
  
  array = array.filter(function(e) {
    return e !== "";
  });
  
  cb(null, array);
};


filefinder.prototype.treewalk = function(basedir, subdir, fnpattern, blacklist, foundfilesarray, cb) {
  var _self = this;
  var fulldir = path.join(basedir, subdir);
  if (DEBUGMODE) console.log(">treewalk (dir: %s, fnpattern: %s)", fulldir, fnpattern);
  var results = [];

  fs.readdir(fulldir, function(err, list) {
    if (err) return cb(err);
    var i = 0;

    function next() {
      var file = list[i++];
      if (!file) return cb(null, foundfilesarray.length);
      var partName = path.join(subdir, file).replace(/\\/g, "/");
      var filepath = path.join(fulldir, file);
      
      // get file info
      fs.stat(filepath, function(err, stat) {
        if (stat && stat.isDirectory()) {
          if (blacklist && blacklist.indexOf(partName + "/") !== -1)
            return next();
          // directory, so recurse
          _self.treewalk(basedir, partName, fnpattern, blacklist, foundfilesarray, function(err, res) {
            results = results.concat(res);
            next();
          });
        }
        else {
          // file found, matches pattern?
          if (file.match(fnpattern) === null) {
            _self.countPatternMis++;
            return next();
          }
          
          // check if blacklisted
          if (!blacklist || blacklist.indexOf(partName) == -1) {
              if (DEBUGMODE) console.log("file found: %s", partName);
              foundfilesarray.push(partName);
          }
          else {
            _self.countBlacklisted++;
            if (DEBUGMODE) console.log("File blacklisted: ", partName);
          }
          next();
        }
      });
    }
    next();
  });
};

// export the class
module.exports = new filefinder();


