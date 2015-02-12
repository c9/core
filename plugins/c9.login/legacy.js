"use strict";

var assert = require("assert");
var url = require("url");
var Cloud9LegayStrategy = require("./legacy_strategy");
var cookieSignature = require("cookie-signature");
var decrypt = require("c9/crypt").decrypt;
var login = require("connect-ensure-login");

plugin.consumes = [
    "db",
    "passport",
    "connect.redirect",
    "connect.cookieparser",
    "session-store"
];
plugin.provides = ["c9.login"];

module.exports = plugin;

function plugin(options, imports, register) {
    assert(options.appId, "Option 'appId' is required");
    assert(options.ideBaseUrl, "Option 'ideBaseUrl' is required");
    assert(options.baseUrl, "Option 'baseUrl' is required");
    assert(options.ssoCookie, "Option 'ssoCookie' is required");
    assert(options.ssoSecret, "Option 'ssoSecret' is required");
    
    var db = imports.db;
    var passport = imports.passport;
    var sessionStore = imports["session-store"];

    // use the 'proxy' cookie to have federated logout
    passport.useStart(function(req, res, next) {
        var hash;
        // anonymous login
        if (!req.cookies || !(hash = req.cookies[options.ssoCookie]))
            return done();
            
        var encrypted = cookieSignature.unsign(hash, options.ssoSecret);
        if (!encrypted)
            return done();
                
        var sessionId = decrypt(encrypted, options.ssoSecret);
        
        sessionStore.get(sessionId, function(err, session) {
            if (err) return done(err);
            done(null, session && session.uid);
        });
        
        function done(err, ssoUid) {
            if (err) return next(err);
            ssoUid = ssoUid || -1;
            var session = req.session;
            if (session && session.passport && session.passport.user && session.passport.user != ssoUid) {
                return req.session.regenerate(function(err) {
                    if (err) return next(err);
                    
                    if (session.returnTo)
                        req.session.returnTo = session.returnTo;
                        
                    delete req.user;
                    next();
                });
            }
            else {
                if (!req.session.passport)
                    req.session.passport = {};
                
                req.session.passport.user = ssoUid;
                next();
            }
        }
    });
    
    var cloud9Strategy = new Cloud9LegayStrategy({
        clientID: options.appId,
        ideBaseUrl: options.ideBaseUrl,
        callback: options.baseUrl + "/auth/c9l/callback",
        db: db
    });
    
    passport.use(cloud9Strategy);

    passport.section.get("/c9l", passport.authenticate("c9l"));
    passport.section.get("/c9l/callback", [
        passport.authenticate("c9l"),
        function(req, res, next) {
            var user = req.user;
            
            if (user) {
                req.login(user, function(err) {
                    if (err) return next(err);
                    res.returnTo(req, "/");
                });
            }
            else {
                res.redirect("/auth/c9l");
            }
        }
    ]);
    
    register(null, {
        "c9.login": {
            ensureLoggedIn: function() {
                return function(req, res, next) {
                    var redirect = options.baseUrl + "/_auth/c9l";
                    var nonce = req.parsedUrl.query.__c9_preview_id__;
                    
                    if (nonce) {
                        redirect += "?nonce=" + encodeURIComponent(nonce);
                        delete req.parsedUrl.query.__c9_preview_id__;
                        delete req.parsedUrl.search;
                        req.originalUrl = url.format(req.parsedUrl);
                    }
                    
                    login.ensureLoggedIn({
                        redirectTo: redirect
                    })(req, res, next);
                };
            }
        }
    });
}