"use strict";

var ejs = require("ejs");

module.exports = function(options, imports, register) {
    
    imports["connect.render"].registerEngine("ejs", createView);
    
    ejs.filters.JSONToJS = function(obj, indent) {
        return JSON.stringify(obj, null, indent).replace(/<\/?script|[\u2028\u2029]/g, function(a) {
            var h =  a.charCodeAt(0).toString(16);
            return (h.length == 2 ? "\\x" : "\\u") + h + a.substr(1);
        });
    };
    
    var helper = {
        timeSpan: function(ts) {
            var sec = 1000;
            var min = 60 * sec;
            var hour = 60 * min;

            return pad(~~(ts / hour)) + ":" + pad(~~((ts % hour) / min)) + ":" + pad(~~((ts % min) / sec));
            
            function pad(d) {
                if (d < 10)
                    return "0" + d;
                else
                    return d;
            }
        },
        timeSpanSince: function(ts) {
            return helper.timeSpan(Date.now() - ts);
        }
    };
    
    
    function createView(path, callback) {
        return callback(null, function(res, options, callback) {
            options.helper = helper;
            ejs.renderFile(path, options, function(err, template) {
                if (err) return callback(err);
                
                callback(null, {
                    headers: {"Content-Type": "text/html"},
                    body: template
                });
            }); 
        });
    }
    
    register(null, {
        "connect.render.ejs": {
            addHelper: function(name, helper) {
                helper[name] = helper;
            }
        }
    });
};