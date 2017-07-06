var Fs = require("fs");

var emojis = Fs.readFileSync(__dirname + "/emojis.txt", "utf8");

var lines = emojis.split(/\n/);
console.log("number of lines:", lines.length);

var json = {
    "map": {},
    "reverse": {}
};
lines.forEach(function(line, i) {
    if (!/([a-f0-9]{4,4})\s*(:[\w_\-\+]*:)/.test(line))
        return console.log("ERR: no match in line", i + 1, ":", line);

    var parts = line.split(/[\s]+/);
    var code = parts.shift();
    parts = parts.filter(function(part) {
        return !!part;
    });
    json.map[code] = parts;
    for (var i = 0, l = parts.length; i < l; ++i)
        json.reverse[parts[i]] = code;
});
console.log("number of emojis:", Object.keys(json.map).length);

Fs.writeFileSync(__dirname + "/emojis.json", JSON.stringify(json, null, 4), "utf8");

Fs.writeFileSync(__dirname + "/emojis.js",
    "define(function(require, exports, module) {" +
        "module.exports=" + JSON.stringify(json) + ";" +
    "});",
    "utf8"
);

