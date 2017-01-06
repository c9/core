var Fs = require("fs");

var builders = {};
var buildersPath = __dirname + "/builders/";
Fs.readdirSync(buildersPath).forEach(function (name) {
    var json = JSON.parse(Fs.readFileSync(buildersPath + name));
    json.caption = name.replace(/\.build/, "");
    json.$builtin = true;
    builders[json.caption] = json;
});

module.exports = builders;
