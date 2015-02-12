"use strict";

var assert = require("assert");
var frontdoor = require("frontdoor");
var cookie = require("cookie");
var Passport = require("passport").Passport;
var Cloud9Strategy = require("./strategy");

plugin.consumes = [
    "session",
    "connect.redirect"
];
plugin.provides = ["c9.login"];

module.exports = plugin;

function plugin(options, imports, register) {
    assert(options.appId, "Option 'appId' is required");
    assert(options.appSecret, "Option 'appSecret' is required");
    assert(options.callback, "Option 'callback' is required");
    assert(options.logout, "Option 'logout' is required");
    assert(options.baseUrl, "Option 'baseUrl' is required");
    assert(options.domain, "Option 'domain' is required");
    assert(options.ssoCookie, "Option 'ssoCookie' is required");
    assert(options.ssoCookie.name, "Option 'ssoCookie.name' is required");
    assert(options.ssoCookie.maxAge, "Option 'ssoCookie.maxAge' is required");
    
    var session = imports.session;
    var passport = new Passport();
    
    session.use(passport.initialize());
    session.use(function(req, res, next) {
        passport.session()(req, res, function(err) {
            if (err) return next(err);
            if (!req.user) return next();
            
            var uid = req.cookies[options.ssoCookie.name];
            if (uid != req.user.id) {
                req.logout();
                return next();
            }
            
            next();
        });
    });
    
    passport.serializeUser(function(user, done) {
        var id;
        try {
            id = JSON.stringify(user);
        }
        catch (e) {
            return done(e);
        }
        done(null, id);
    });

    passport.deserializeUser(function(id, done) {
        var user;
        try {
            user = JSON.parse(id);
        }
        catch (e) {
            return done(e);
        }
        done(null, user);
    });

    var cloud9Strategy = new Cloud9Strategy({
        clientID: options.appId,
        clientSecret: options.appSecret,
        callbackURL: options.callback,
        userProfileURL: options.userProfileURL,
        baseUrl: options.baseUrl,
    }, function(accessToken, refreshToken, params, profile, done) {
        var user = {
            id: profile.id,
            username: profile.username,
            fullname: profile.displayName ? profile.displayName.trim() : profile.username,
            token: accessToken
        };
        done(null, user);
    });
    
    passport.use(cloud9Strategy);

    var api = frontdoor();
    passport.section = api.section("auth");
    session.use(api);

    passport.section.get("/logout", function(req, res, next) {
        res.redirect(options.baseUrl + "/logout?redirect_uri=" + encodeURIComponent(options.logout));
    });
    passport.section.get("/cloud9", passport.authenticate("cloud9"));
    passport.section.get("/cloud9/callback", function(req, res, next) {
        passport.authenticate("cloud9", function(err, user, info) {
            if (err) return next(err);

            if (user) {
                req.login(user, function(err) {
                    if (err) return next(err);
                    setCookie(res, req.user.id, options.ssoCookie.maxAge);
                    res.returnTo(req, "/");
                });
            }
            else {
                res.redirect("/auth/cloud9");
            }

        })(req, res, next);
    });
    
    passport.section.get("/cloud9/logout", function(req, res, next) {
        req.logout();
        clearCookie(res);
        res.redirect("/");
    });
    
    function clearCookie(res) {
        setCookie(res, "", new Date(1));    
    }
    function setCookie(res, value, ttl) {
        res.setHeader("Set-Cookie", cookie.serialize(options.ssoCookie.name, value, { 
            domain: "." + options.domain,
            path: "/",
            expires: ttl instanceof Date ? ttl : new Date(Date.now() + ttl),
            secure: true,
            httpOnly: true
        }));    
    }
    
    register(null, {
        "c9.login": passport
    });
}