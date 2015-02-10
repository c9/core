var passport = require('passport');
var util = require('util');
var InternalOAuthError = require("passport-oauth").InternalOAuthError;


function Cloud9Legacy(options) {
    passport.Strategy.call(this);
    this.name = 'c9l';
  
    this.clientID = options.clientID;
    this.ideBaseUrl = options.ideBaseUrl;
    this.callback = options.callback;
    this.db = options.db;
}

/**
 * Inherit from `passport.Strategy`.
 */
util.inherits(Cloud9Legacy, passport.Strategy);

/**
 * Authenticate request based on the contents of a HTTP Basic authorization
 * header.
 *
 * @param {Object} req
 * @api protected
 */
Cloud9Legacy.prototype.authenticate = function(req, options) {
    var that = this;
    options = options || {};
    
    // the callback handler
    if (req.query && req.query.code) {
        this.db.AccessToken
            .findOne({
                token: req.query.code
            })
            .populate("user")
            .exec(function(err, token) {
                if (err)
                    return that.error(new InternalOAuthError('failed to obtain access token', err));
                
                req.session.token = req.query.code;
                that.success(token.user);
            });
        return;
    }
    
    var nonce = req.parsedUrl.query.nonce;
    if (nonce) {
        this.redirect(
            this.ideBaseUrl + 
            "/api/nc/auth" +
            "?response_type=nonce" +
            "&client_id=" + encodeURIComponent(this.clientID + "_nonce") +
            "&nonce=" + encodeURIComponent(nonce)
        );
    } 
    else {
        this.redirect(
            this.ideBaseUrl + 
            "/api/nc/auth" +
            "?response_type=token" +
            "&client_id=" + encodeURIComponent(this.clientID) +
            "&login_hint=" + encodeURIComponent(options.loginHint || "")
        );
    }
};

/**
 * Expose `Cloud9Legacy`.
 */ 
module.exports = Cloud9Legacy;