var path = require("path");
var fs = require("fs");

function changeFile(filepath, handler) {
    var value = fs.readFileSync(filepath, "utf8");
    value = handler(value);
    fs.writeFileSync(filepath, value, "utf8");
}

var loadRulesPath = require.resolve("eslint/lib/load-rules")
var contents = `module.exports = function() {
require("babel-polyfill");
var rules = {`;

fs.readdirSync(loadRulesPath + "/../rules").forEach(file => {
    if (path.extname(file) == ".js") {
        file = file.slice(0, -3);
        contents += '    "' + file + '": ' + 'require("eslint/lib/rules/' + file + '"),\n';
    }
});

contents += `}\n
var jsxRules = require("eslint-plugin-react").rules;
Object.keys(jsxRules).forEach(function(key) { rules["react/" + key] = jsxRules[key]; })
return rules
};
`
changeFile(loadRulesPath, function() { return contents });
changeFile(require.resolve("eslint/lib/linter"), function(src) { 
    return src.replace('require(parserName)', 'require("espree")'); 
});
changeFile(require.resolve("espree/espree"), function(src) {
    return src.replace(/acornOptions = {[^}\s]*/g, 'acornOptions = {allowImportExportEverywhere:true,')
        .replace(/(function isValid(?:Node|Token)\(\w+\) {)(?!ret)/g, "$1return true;");
});




var webpack = require("webpack");
var outputPath = __dirname + "/../worker/eslint_browserified.js"
webpack({
    entry: "eslint/lib/linter",
    module: {
        rules: [{ 
            test: /\.js$/,
             include: [
                path.resolve(__dirname)
            ],
            enforce: 'pre',
            loader: "babel-loader",
            options: {
                presets: ["es2015"],
                compact: false
            },
         }]
    },
    output: {
        path: path.dirname(outputPath),
        filename: path.basename(outputPath),
        library: "eslint",
        // libraryTarget: "window",
        libraryTarget: "amd"
    }, 
    resolve: {
        unsafeCache: true,
    }
}, (err, stats) => {
    if (err || stats.hasErrors()) {
        console.log(err, stats)
    }
    var commentRe = /^(;)?(?:\s*(?:\/\/.+\n|\/\*(?:[^*]|\*(?!\/))*\*\/))+(?: *\n)?/gm;
    changeFile(outputPath, function(src) { 
        return "// generated using packager/eslint.js\n"
            + src.replace(commentRe, "$1")
            .replace('define("eslint", ', "define(")
            .replace(/^ {4,}/gm, function(indentation) {
                return indentation.replace(indentation.length % 4 ? / {2}/g :/ {4}/g, "\t")
            }); 
    })
});