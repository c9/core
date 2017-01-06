var request = require('request');
var util = require("./util");
var arrayToObject = util.arrayToObject;
var stripHtml = util.stripHtml;
var asyncForEach = util.asyncForEach;
var addLinkTargets = util.addLinkTargets;
var LINK_TARGET = "c9doc";
var patch = require("./patch.js");

function getRootObjects(callback) {
    request({ url: 'https://developer.mozilla.org/en/JavaScript/Reference' }, function(err, response) {
        if (err) throw err;
        var globalObjectsRegex = /https:\/\/developer.mozilla.org\/en\/JavaScript\/Reference\/Global_Objects\/([a-zA-Z0-9]+)/g;
        var match, matches = [];
        while (match = globalObjectsRegex.exec(response.body)) {
            matches.push(match[1]);
        }
        matches = Object.keys(arrayToObject(matches)); // setify
        callback(matches);
    });
}

function parseProperties(rootObject, html, intoObject, guidPrefix, isFn) {
    var propertiesRegex = new RegExp("(https:\\/\\/developer.mozilla.org\\/en\\/JavaScript\\/Reference\\/Global_Objects\\/" + rootObject + "\\/[a-zA-Z0-9]+)\">(<code>)?([a-zA-Z0-9]+)", "g");
    var match;
    while (match = propertiesRegex.exec(html)) {
        var entry = {
            docUrl: match[1],
            guid: guidPrefix + match[3],
            properties: { _return: []}
        };
        intoObject['_' + match[3]] = [entry];
    }
}

function getObjectInfo(rootObject, callback) {
    console.log("Requesting: ", rootObject);
    request({ url: 'https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/' + rootObject }, function(err, response) {
        if (err) throw err;
        var data = { object: {}, instance: {}};
        

        var methodsSplitRegex = />\s*Methods\s*<\/h|>\s*<span>\s*Methods\s*<\/span>\s*<\/h/;
        
        var body = response.body;
        var parts = body.split(/<\/code>\s*instances\s*<\/h2>/);
        var staticBody = parts[0];
        var instanceBody = parts[1] || "";
        // static
        parts = staticBody.split(methodsSplitRegex);
        parseProperties(rootObject, parts[0], data.object, "es5:" + rootObject + "/", false);
        parseProperties(rootObject, parts[1], data.object, "es5:" + rootObject + "/", true);
        delete data.object._prototype;
        // instance
        parts = instanceBody.split(methodsSplitRegex);
        parseProperties(rootObject, parts[0], data.instance, "es5:" + rootObject + "/prototype/", false);
        parseProperties(rootObject, parts[1], data.instance, "es5:" + rootObject + "/prototype/", true);
        delete data.instance['_' + rootObject];
        callback(data);
    });
}

function getPropertyInfo(data, callback) {
    console.log("Fetching: ", data[0].docUrl);
    request({ url: data[0].docUrl }, function(err, response) {
        if (err) throw err;
        var description =
            response.body.split(/>\s*Summary\s*<\/h[^>]*>/)[1] ||
            response.body.split(/>\s*Description\s*<\/h[^>]*>/)[1] ||
            "";
        description = description.split(/<\/div>/)[0];
        data[0].doc = addLinkTargets(description, LINK_TARGET);
        callback(data);
    });
}

getRootObjects(function(rootObjects) {
    var json = {};
    asyncForEach(rootObjects, function(rootObject, next) {
        if (rootObject.match(/^[a-z]/)) {
            request({ url: 'https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/' + rootObject }, function(err, response) {
                if (err) throw err;
                var obj = {
                    guid: "es5:" + rootObject,
                    docUrl: "https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/" + rootObject,
                };
                parseProperties(rootObject, response.body, json, "es5:", true);
                next();
            });
        }
        else {
            getObjectInfo(rootObject, function(data) {
                asyncForEach(Object.keys(data.instance).map(function(k) { return data.instance[k]; }), function(el, next) {
                    getPropertyInfo(el, next);
                }, function() {
                    asyncForEach(Object.keys(data.object).map(function(k) { return data.object[k]; }), function(el, next) {
                        getPropertyInfo(el, next);
                    }, function() {
                        var builtin = {
                            guid: "es5:" + rootObject,
                            docUrl: "https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/" + rootObject,
                            properties: {
                                _prototype: [{
                                    guid: "es5:" + rootObject + "/prototype",
                                    properties: data.instance
                                }]
                            }
                        };
                        for (var p in data.object) {
                            builtin.properties[p] = data.object[p];
                        }
                        console.log(JSON.stringify(builtin, null, 2));
                        json[builtin.guid] = builtin;
                        next();
                    });
                });
            });
        }
    }, function() {
        var allProps = {};
        Object.keys(json).forEach(function(tl) {
            var name = tl.split(':')[1];
            allProps['_' + name] = [tl];
        });
        json.exports = {
            guid: "es5:exports",
            properties: allProps
        };
        json = patch.patchCommon(json);
        require('fs').writeFileSync('../builtin.jst', JSON.stringify(json, null, 2), "UTF-8");
    });
});
