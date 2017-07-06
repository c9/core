/**
 * Cloud9 Language Foundation
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {

var completeUtil = require("plugins/c9.ide.language/complete_util");
var workerUtil = require("plugins/c9.ide.language/worker_util");
var baseLanguageHandler = require('plugins/c9.ide.language/base_handler');

var completer = module.exports = Object.create(baseLanguageHandler);

var modeCache = {}; // extension -> static data
var iconLanglist = ["php", "css"];

completer.handlesLanguage = function(language) {
    return ["css"/*, "php"*/].indexOf(language) !== -1;
};

completer.getMaxFileSizeSupported = function() {
    return Infinity;
};

completer.complete = function(doc, fullAst, pos, options, callback) {
    var language = this.language;
    var line = doc.getLine(pos.row);
    var idRegex = workerUtil.getIdentifierRegex(pos);
    var identifier = options.identifierPrefix;
    if (line[pos.column - 1] === ".")
        return callback([]);

    var mode = modeCache[language];

    if (mode === undefined) {
        var text;
        if (language)
            text = completeUtil.fetchTextSync('plugins/c9.ide.language.generic/modes/' + this.language + '.json');
        try {
            mode = text ? JSON.parse(text) : {};
        } catch (e) {
            console.error(e);
            mode = {};
        }
        // Cache
        modeCache[language] = mode;
    }

    function getIcon(type) {
        if (iconLanglist.indexOf(language) === -1)
            return null;
        var iconMap = {
            "variable": "property",
            "type": "property2",
            "constant": "method2",
            "color": "method2",
            "font": "method2",
            "function": "method2",
            "pseudo.element": "event",
            "pseudo.class": "event"
        };
        var subs = Object.keys(iconMap);
        for (var i = 0; i < subs.length; i++)
            if (type.indexOf(subs[i]) !== -1)
                return iconMap[subs[i]];
        return null;
    }

    // keywords, functions, constants, ..etc
    var types = Object.keys(mode);
    var matches = [];
    types.forEach(function (type) {
        var icon = getIcon(type);
        var nameAppend = "", replaceAppend = "";
        if (type.indexOf("function") !== -1) {
            nameAppend = "()";
            replaceAppend = "(^^)";
        }
        var deprecated = type.indexOf("deprecated") === -1 ? 0 : 1;
        var compls = completeUtil.findCompletions(identifier, mode[type]);
        matches.push.apply(matches, compls.map(function(m) {
            return {
                name: m + nameAppend,
                replaceText: m + replaceAppend,
                doc: deprecated ? ("Deprecated: <del>" + m + nameAppend + "</del>") : null,
                icon: icon,
                meta: type,
                identifierRegex: idRegex,
                priority: 2 - deprecated
            };
        }));
    });
    
    callback(matches);
};


});
