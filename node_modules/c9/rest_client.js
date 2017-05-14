var error = require("http-error");
var http = require("http");
var https = require("https");
var _ = require("lodash");
var once = require("./async_tools").once;
var debug = require("debug")("rest:client");

/*
 * Example:
 * optional config.username & config.password for Basic Auth
 * var client = new RestClient("localhost", "3131", {protocol: "https", username: "abc", password: "def"});
 */
function RestClient(host, port, config) {
    var protocol = config.protocol || "http";
    if (protocol !== "https" && protocol !== "http")
        return console.error("Unknown protocol:", protocol);

    var proto = protocol === "https" ? https : http;
    
    var log = config.logger || debug;

    this.request = function request(method, path, body, callback) {
        if (!callback) {
            callback = body;
            body = undefined;
        }
        
        var done = once(callback);
        
        method = method.toLowerCase();
        var payload = "";
        if (body && (method == "put" || method == "post" || method == "delete")) {
            payload = JSON.stringify(body);
        }
        
        var headers = _.extend({
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload)
        }, config.headers || {});
        
        var options = {
            hostname: host,
            port: port,
            path: path,
            method: method,
            headers: headers,
            timeout: config.timeout || 60 * 1000,
            pool: config.pool || {
                maxSockets: 100000,
            },
        };
        if (config.username)
            options.auth = config.username + ":" + config.password;

        var req = proto.request(options, onResponse(done, options, body));
        
        /** Keep requests alive for long running requests **/
        req.setSocketKeepAlive(true);
        
        req.on("error", function(e) {
            log("ERROR %s %s://%s:%s%s %s", 
                options.method, 
                protocol, options.hostname, options.port, options.path, 
                e.stack || e.message
            );
            done(e);
        });

        req.end(payload);
    };

    var that = this;
    ["get", "post", "put", "delete", "options"].forEach(function (method) {
        that[method] = that.request.bind(that, method);
    });

    function onResponse(callback, options, body) {
        return function(res) {
            var data = "";
            var json;

            res.on("data", function(d) {
                data += d;
            });

            res.on("end", function() {
                try {
                    json = JSON.parse(data);
                } catch (e) {
                    json = data;
                }
    
                if (res.statusCode >= 300) {
                    var msg = 
                        (json.error && json.error.message) ||
                        "Request failed with status code " + res.statusCode;
                    
                    var err = new error.HttpError(msg, res.statusCode);
                    
                    if (json.error) {
                        for (var key in json.error)
                            err[key] = json.error[key];
                    }
                    

                    done(err, json);
                }
                else {
                    done(null, json);
                }
            });
    
            res.on("error", function(e) {
                done(e);
            });
    
            res.on("timeout", function() {
                done(new Error("Request timed out"));
            });
    
            var called = false;
            function done(err, json) {
                if (called)
                    return;
    
                if (err) {
                    log("ERROR %d %s %s://%s:%s%s REQ %j RES %j %j",
                        res.statusCode, options.method, 
                        protocol, options.hostname, options.port, options.path, 
                        body || {}, data, err
                    );
                } else {
                    log("%d %s %s://%s:%s%s REQ %j RES %j",
                        res.statusCode, options.method, 
                        protocol, options.hostname, options.port, options.path, 
                        body || {}, data
                    );
                }
    
                called = true;
                callback(err, json);
            }
        };
    }
}

module.exports = RestClient;