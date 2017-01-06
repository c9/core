// TODO: port this to a module

require("amd-loader");
var fs = require("fs");
var path = require("path");

var ENCODING = "UTF-8";
var DATE_NON_EXISTING = new Date("1980-01-01T00:00:00.00Z"); 

process.argv.shift();
process.argv.shift();
var indexFile = process.argv.shift();
var index = {};

try {
    index = JSON.parse(fs.readFileSync(indexFile, ENCODING));
} catch (e) {
    // Just use an empty index
}

var isChanged = false;

for (var i = 0; i < process.argv.length; i++) {
    var file = process.argv[i];
    var date = path.existsSync(file) ? fs.statSync(file).mtime : DATE_NON_EXISTING;
    if (!index[file] || date > new Date(index[file].date)) {
        console.error("Changed: " + file);
        isChanged = true;
    }
    index[file] = { date: date };
}

fs.writeFileSync(indexFile, JSON.stringify(index), ENCODING);

process.exit(isChanged ? 1 : 0);
