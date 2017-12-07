// build script to bundle eslint and eslint-plugin-react in a format usable by language worker

var path = require("path");
var fs = require("fs");

function changeFile(filepath, handler, ignoreBackup) {
    var value;
    try {
        value = fs.readFileSync(filepath + ".bak", "utf8");
    } catch (e) {
        value = fs.readFileSync(filepath, "utf8");
        // backup the file in case the script is invoked again without clean npm install
        if (!ignoreBackup)
            fs.writeFileSync(filepath + ".bak", value, "utf8");
    }
    
    if (typeof handler == "function") {
        value = handler(value);
    } else {
        handler.forEach(function(v) {
            value = safeReplace(value, ...v);
        });
    }
    fs.writeFileSync(filepath, value, "utf8");
}

function safeReplace(src, pattern, value, count) {
    var matchCount = 0;
    var replacer = value
    if (typeof replacer == "string") {
        replacer = function(...args) {
            // expand placeholders of form $i in the replacement string
            return value.replace(/[$](\d)/g, (_, i) => args[i]);
        }
    }

    src = src.replace(pattern, function(...args) {
        matchCount++;
        return replacer(...args);
    });
    if (count != undefined && count != matchCount)
        throw new Error(`expected "${pattern}" to match ${count} times instead of ${n}`);
    return src;
}

var loadRulesPath = require.resolve("eslint/lib/load-rules");
var contents = `module.exports = function() {
var rules = {`;

var ruleNames = fs.readdirSync(path.join(loadRulesPath, "../rules"));
ruleNames.forEach(function(file) {
    if (file.endsWith(".js")) {
        file = file.slice(0, -3);
        contents += '    "' + file + '": ' + 'require("eslint/lib/rules/' + file + '"),\n';
    }
});

contents += `}\n
var jsxRules = require("eslint-plugin-react").rules;
Object.keys(jsxRules).forEach(function(key) { rules["react/" + key] = jsxRules[key]; })
return rules
};
`;

changeFile(loadRulesPath, function() { return contents });
changeFile(require.resolve("eslint/lib/linter"), [
    [/^/, `//a
        require('core-js/es6');
        require('core-js/fn/symbol');
        require('core-js/fn/set');
        require('core-js/fn/array/from');
        require('core-js/fn/array/find-index');
        require('core-js/fn/string/raw');
        require('core-js/fn/map');
        require('core-js/fn/weak-map');
        require("regenerator-runtime/runtime");
    `.replace(/^\s*/gm, ""), 1],
    ['require(config.parser)', 'require("espree")', 1],
    [`require("./config/config-validator")`, `{validateRuleOptions: x=>x}`, 1]
]);

changeFile(require.resolve("espree/espree"), function(src) {
    return src.replace(/acornOptions = {[^}\s]*/g, 'acornOptions = {allowImportExportEverywhere:true,')
        .replace(/(function isValid(?:Node|Token)\(\w+\) {)(?!ret)/g, "$1return true;");
});




var webpack = require("webpack");
var outputPath = __dirname + "/../worker/eslint_browserified.js";
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
                compact: false,
                plugins: ["babel-plugin-unassert"]
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
        return console.log(err, stats);
    }
    var commentRe = /^(;)?(?:\s*(?:\/\/.+\n|\/\*(?:[^*]|\*(?!\/))*\*\/))+(?: *\n)?/gm;
    changeFile(outputPath, function(src) { 
        return "// generated using packager/eslint.js\n"
            + src.replace(commentRe, "$1")
            .replace('define("eslint", ', "define(")
            .replace("if (severityValue === 0 || severityValue === 1 || severityValue === 2) {", "if (typeof severityValue === 'number') {")
            .replace(/^ {4,}/gm, function(indentation) {
                return indentation.replace(indentation.length % 4 ? / {2}/g : / {4}/g, "\t");
            }); 
    }, true);
});