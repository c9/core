// used when nak is run from a script
exports.run = function(options) {
  if (!options) {
    options = process.argv;
    options.splice(0, 2);
    
    // from a script
    if (options[0] === "--json") {
      options = JSON.parse(options[1]);
    } 
    // from the bin
    else {
      options = require("../lib/options").parseArgs(options);
      options.path = options.args.pop();
      
      if (options.args.length == 1)
        options.query = options.args.pop();
      else if (options.args.length == 2) {
        options.replacement = options.args.pop();
        options.query = options.args.pop();
      }
    }
  }
  main(options);
};

function main(options) {
var fs = require('fs'),
    path = require('path'),
    walkdir = require('../lib/walkdir').walkdir,
    PathFilter = require('../lib/path-filter');

// arguments
var fpath = path.resolve(options.path),
    replacement = options.replacement,
    query = options.query,
    textColor = "",
    matches = 0,
    filecount = 0;

if (process.platform == "win32")
  fpath = options.path.replace(/\\/g, "/").replace(/\/$/, "");
  
if (options.startPaths) {
  if (typeof options.startPaths == "string")
    options.startPaths = [options.startPaths];
  options.startPaths = options.startPaths.map(function(p) {
    if (p[0] == "/" && fpath.slice(-1) == "/")
      p = p.substring(1);
    if (p.slice(-1) === "/")
      p = p.slice(0, - 1);
    var fullPath = path.normalize(fpath + p);
    var base = fpath;
    if (process.platform == "win32") {
      fullPath = fullPath.replace(/\\/g, "/");
      base = base.replace(/\\/g, "/");
    }
    if (fullPath.lastIndexOf(base, 0) === 0) {
      return p;
    }
  }).filter(Boolean);
  // filter out nested paths
  var prev = "";
  options.startPaths = options.startPaths.sort().filter(function(p) {
    if (prev && p[prev.length] === "/" && p.substring(0, prev.length) === prev)
      return false;
    prev = p;
    return true;
  });
}

if (process.platform == "win32" && (fpath[0] == "/" || !fpath)) {
  options.startPaths = options.startPaths.map(function(p) {
    return p.replace(/^\//, "");
  });
  fpath = fpath.substr(1);
}

if (options.color) {
  var colors = require('colors'),
  queryString = String(options.query);
  textColor = queryString.substring(1, queryString.length - 1);
}

setInclusions();
setExclusions(fpath, options.startPaths);
// console.log(options)
function log(text) {
  process.stdout.write(text + "\n");
}
// set the query up, and present a final summary; also, pump out results as they come.
// "streaming" output like this is slower (because log blocks)
// but serves a purpose when finding text
if (typeof callback != "undefined") {
  var Stream = require('stream').Stream;
  var stream = new Stream();
  stream.readable = true;

  callback(null, {stream: stream});

  if (query) {
    makeQuery(query, replacement);
    var output = "";

    walkdir(fpath, options, function(file, lines, _matches) {
      stream.emit("data", file + "\n" + lines);
      matches += _matches;
      filecount++;
    }, function() {
      if (!options.ackmate)
        stream.emit("data", "Found " + matches + (matches == 1 ? " match" : " matches") + " in " + filecount + (filecount == 1 ? " file " : " files "));

      stream.emit("end", {count : matches, filecount: filecount});
    });
  }
  // if we're listing, callback at the very end
  else if (options.list) {
    walkdir(fpath, options, function(lines) {
        stream.emit("data", lines);
        stream.emit("end");
    });
  }
}
// if we're listing, callback at the very end
else if (options.list || !query) {
  walkdir(fpath, options, function(lines) {
    log(lines);
  });
}
else if (query) {
  makeQuery(query, replacement);

  walkdir(fpath, options, function(file, lines, _matches) {
    if (!options.color) {
      log(file);
      log(lines);
    }
    else {
      log(file.cyan);
      lines = lines.grey;
      lines = lines.replace(options.query, textColor.yellowBG);
      log(lines);
    }

    matches += _matches;
    filecount++;
  }, function() {
    if (!options.ackmate)
      log("Found " + matches + (matches == 1 ? " match" : " matches") + " in " + filecount + (filecount == 1 ? " file " : " files "));
  });
}

function setInclusions() {
  options.inclusions = [];
  var paths = (options.pathInclude || '').split(',');
  var i = paths.length;
  while (i--)
    options.inclusions.push(paths[i].trim());
}

function setExclusions(fpath, startPaths) {
  var exclusions = [options.pathToNakignore];
  (startPaths || []).concat([""]).forEach(function(p) {
    exclusions.push(fpath + p + "/.nakignore");
    if (options.addVCSIgnores)
      exclusions.push(fpath + p + "/.gitignore");
  });

  var combinedExclusions = exclusions.map(function(p) {
    // if these ignore files don't exist, don't worry about them
    try {
      return fs.readFileSync(p, "utf8");
    } catch (e) { /* console.log(e) */ }
    return "";
  }).join("\n");
  
  if (options.ignore)
    combinedExclusions += "\n" + options.ignore.replace(/,/g, "\n");
  
  if (combinedExclusions.length) {
    options.exclusions = combinedExclusions.split(/\r?\n/);
  }
}

function makeQuery(query, replacement) {
  var flags = "gm";
  if (options.literal)
    query = PathFilter.escapeRegExp(query);
  if (options.ignoreCase)
    flags += "i";

  if (options.wordRegexp)
    query = "\\b(?:" + query + ")\\b";

  options.query = new RegExp(query, flags);

  options.queryClean = new RegExp(query, flags.substr(1));

  if (typeof replacement == "string") {
    options.replacement = replacement;
  }
}

}

var simplefunc = require("simplefunc");

exports.serialize = function(fn) {
  return simplefunc.toJson(fn);
};

exports.deserialize = function(fn) {
  return simplefunc.fromJson(fn);
};
