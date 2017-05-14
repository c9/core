// gutted from walkdir: https://github.com/soldair/node-walkdir
// speed up a bunch.

var fs = require("fs");
var PathFilter = require("./path-filter");
var path = require("path");
// weird, but keeping these outside of walkdir makes it faster
var finalizer,
    allPaths = Object.create(null),
    allStats = Object.create(null),
    allLinks = Object.create(null),
    ended = 0,
    jobs = 0,
    // since windows handles well paths with forward slashes
    // and we need .nakignore files to work the same on all platforms
    // we always use /
    DIR_SEP = "/",

    // makes sure we're asynching right
    job = function(value) {
      jobs += value;

      if(value < 1 && !tick) {
        tick = 1;
        process.nextTick(function(){
          tick = 0;
          if(jobs <= 0 && !ended) {
            ended = 1;
            finalizer();
          }
        });
      }
    }, tick = 0;

exports.walkdir = function(fpath, options, printCb, done) {
  var maxFiles = options.limit || -1;
  // if there are ignore rules, properly set them up
  var pathFilter = new PathFilter(options.inclusions, options.exclusions, options.hidden);

  // called at the end of the walk
  finalizer = function() {
    require('./finalizer')(fpath, options, allPaths, allStats, printCb, done);
  };
  
  var follow = options.follow;
  var list = options.list;
  var statAction = function(stat, parent, filepath) {
    // job(-1);
    if (!stat) return;
    
    // TODO: this could probably be cleaned up
    if (stat.isFile() && pathFilter.isPathAccepted(filepath)) {
      if (!list)
        allStats[filepath] = stat;
      if (allPaths[parent] === undefined)
        allPaths[parent] = [];

      allPaths[parent].push(filepath);
    }
    else if (stat.isDirectory() && pathFilter.isPathAccepted(filepath + DIR_SEP)) {
      maxFiles && readdir(filepath + DIR_SEP);
    }
  };
  var statter = function (parent, filepath) {
    // job(1); // statAction is sync
    // lstat is SLOW, but what other way to determine if something is a directory or file ?
    // also, sync is about 200ms faster than async...
    statAction(getStat(fpath + filepath), parent, filepath);
  };
  
  var getStat = function(filepath) {
    try {
      var stat = fs.lstatSync(filepath);
      if (follow && stat.isSymbolicLink()) {
        stat = fs.statSync(filepath);
        var fullPath = fs.realpathSync(filepath);
        if (allLinks[fullPath]) {
          return;
        }
        allLinks[fullPath] = true;
      }
      return stat;
    } catch (e) {
      // console.error(e);
    }
  };

  var readdirAction = function(files, filepath) {
    job(-1);
    if (!files) { return; }
    var fileCount = files.length, prefix = filepath;
    if (maxFiles >= 0) {
      if (maxFiles === 0) {
        return;
      }
      maxFiles -= fileCount;
      if (maxFiles <= 0) {
        maxFiles = 0;
        console.error("reached file number limit");
      }
    }
    while (fileCount--) {
      var file = files.shift(), filename = prefix + file;
      statter(filepath, filename);
    }
  };

  var readdir = function(filepath) {
    job(1);
    // async doesn't matter, we sort results at end anyway
    fs.readdir(fpath + filepath, function(err, files) {
      readdirAction(files, filepath);
    });
  };
  
  if (options.startPaths) {
    job(1);
    options.startPaths.forEach(function(p) {
      statter(path.dirname(p), p);
    });
    job(-1);
  }
  else
    readdir(DIR_SEP);
};
