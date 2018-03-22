(function(global) {
"use strict";

var token = "";

var auth = global.auth = function(options) {
    // can only be called once
    global.auth = null;

    var onLoad = options.onLoad; 
    var preload = options.preload || noop;
    var authorized = options.authorized || noop;
    var background = options.background || noop;
    
    importCssString("html.fulliframe, body.fulliframe {\
        overflow: hidden;\
        margin: auto;\
        height: 100%;\
        width: 100%;\
    }");
    
    function noop(callback) { callback(); }
    
    if (onLoad) {
        auth.parallel([].concat(
            background,
            auth.serial([
                auth.parallel([
                    preload,
                    login
                ]),
                authorized,
            ])
        ))(done);
    }
    
    function login(callback, errback) {
        var oauth = new Auth(options.clientId, options.authorizationUrl, options.loginHint);
        
        oauth.authorize(true, function(err, _token) {
            if (err) 
                return iframeLogin();
                
            token = _token.access_token;
            callback(null, token);
        });
        
        function iframeLogin() {
            errback && errback();
            oauth.authorize(false, function(err, _token) {
                if (err) return callback(err);
                token = _token.access_token;
                callback(null, token);
            });
        }
        
        return function cancel() {
            oauth.cancel();
        };
    }
    
    function done(err) {
        onLoad(err, token);
    }
    
    return {
        login: login
    };
};

function bindScript(script) {
    if (typeof script == "function")
        return script;
    else
        return loadScript.bind(null, script, token);
}

auth.serial = function(list) {
    return function(callback) {
        serial(list.map(bindScript), callback);
    };
};

auth.parallel = function(list) {
    return function(callback) {
        parallel(list.map(bindScript), callback);
    };
};

function loadScript(path, token, callback) {
    var head = document.head || document.getElementsByTagName("head")[0] || document.documentElement;
    var s = document.createElement('script');

    var and = path.indexOf("?") >= 0 ? "&" : "?";
    s.src = path + (token ? and + "access_token=" + encodeURIComponent(token) : "");
    if (s.src.indexOf("://" + window.location.host) == -1)
        s.crossOrigin = true;
    head.appendChild(s);

    s.onload = s.onreadystatechange = function(_, isAbort) {
        if (isAbort || !s.readyState || s.readyState == "loaded" || s.readyState == "complete") {
            s = s.onload = s.onreadystatechange = null;
            if (!isAbort)
                callback();
        }
    };
}

// copied from ace/lib/dom
function importCssString(cssText) {
    var style;
    
    if (document.createStyleSheet) {
        style = document.createStyleSheet();
        style.cssText = cssText;
    } else {
        style = document.createElementNS
            ? document.createElementNS("http://www.w3.org/1999/xhtml", "style")
            : document.createElement("style");

        style.appendChild(document.createTextNode(cssText));

        (document.head || document.getElementsByTagName("head")[0] || document.documentElement).appendChild(style);
    }
}

function serial(handlers, callback) {
    (function loop(i) {
        if (i >= handlers.length) return callback();
        
        handlers[i](function(err) {
            if (err) return callback(err);
            
            loop(i + 1);
        });
    })(0);
}

function parallel(handlers, callback) {
    var hadErr = false;
    var count = 0;
    handlers.forEach(function(handler) {
        handler(function(err) {
            if (hadErr) return;
            if (err) {
                hadErr = true;
                return callback(err);
            }
            count += 1;
            if (count == handlers.length)
                return callback();
        });
    });
}

// install exactly one global listener
var listeners = {};
window.addEventListener("message", function(e) {
    var token = e.data.token;
    if (token) {
        for (var url in listeners) {
            if (url.indexOf(e.origin) === 0) {
                var callback = listeners[url][token.state];
                delete listeners[url][token.state];
                if (callback) callback(null, token);

                // make sure later listeners can't steal the token
                e.data.token = null;
                break;
            }
        }
    }
}, true);


function Auth(clientId, authorizationUrl, loginHint) {
    this.clientId = clientId;
    this.authorizationUrl = authorizationUrl;
    this.loginHint = loginHint;
    listeners[authorizationUrl] = {};
}

Auth.prototype.authorize = function(immediate, callback) {
    if (typeof immediate == "function")
        return this.authorize({}, immediate);
    
    immediate = immediate || false;
    
    var that = this;
    this.state = uid(15);
    
    var url = this.authorizationUrl + 
        "?response_type=postmessage" +
        "&client_id=" + encodeURIComponent(this.clientId) +
        "&state=" + encodeURIComponent(this.state) +
        "&style=overlay";
        
    if (this.loginHint)
        url += "&login_hint=" + encodeURIComponent(this.loginHint || "");
        
    if (immediate)
        url += "&immediate=1";
    
    var frame = this._createFrame(url, immediate);
    var timeout = immediate ? 3000 : 0;

    if (timeout) {
        var timer = setTimeout(function() {
            that._unpoll();
            callback(new Error("Login timed out"));
        }, timeout);
    }
    
    this._removeFrame = function() {
        clearTimeout(timer);
        
        frame.parentNode.removeChild(frame);
        document.documentElement.className = document.documentElement.className.replace(/\bfulliframe\b/, "");
        document.body.className = document.body.className.replace(/\bfulliframe\b/, "");
        that._removeFrame = null;
    };
    
    this._poll(function(err, token) {
        if (that._removeFrame)
            that._removeFrame();
        
        if (err)
            return callback(err);
            
        if (token.error) {
            err = new Error(token.error);
            err.code = token.error_code;
            return callback(err);
        }
        
        that.token = token;
        return callback(null, token);
    });
};

Auth.prototype.cancel = function() {
    this._unpoll();
    if (this._removeFrame)
        this._removeFrame();
};

Auth.prototype._createFrame = function(url, hidden) {
    var frame = document.createElement("iframe");
    frame.setAttribute("src", url);
    frame.setAttribute("frameborder", "0");
    if (hidden) {
        frame.style.width = "1000px";
        frame.style.height = "1000px";
        frame.style.left = "-10000px";
    }
    else {
        frame.style.width = "100%";
        frame.style.height = "100%";
        frame.style.zIndex = "300000";
        document.documentElement.className += " fulliframe";
        document.body.className += " fulliframe";
    }
    frame.style.position = "absolute";
    document.body.appendChild(frame);
    return frame;
};

Auth.prototype._poll = function(callback) {
    listeners[this.authorizationUrl][this.state] = callback;
};

Auth.prototype._unpoll = function() {
    delete listeners[this.authorizationUrl][this.state];
};

function uid(length) {
    var buf = new Uint8Array(new ArrayBuffer(length));
    (window.crypto || window.msCrypto).getRandomValues(buf);
    
    return btoa(Array.prototype.reduce.call(buf, function(s, c) {
        return s + String.fromCharCode(c);
    }, "")).slice(0, length);
}

})(this);