var util = require('util');
var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
var InternalOAuthError = require('passport-oauth').InternalOAuthError;

function Strategy(options, verify) {
    options = options || {};
    var baseUrl = options.baseUrl || "https://auth.c9.io/oauth";
    
    options.authorizationURL = baseUrl + "/authorize";
    options.tokenURL = baseUrl + "/access_token";
    options.scopeSeparator = ",";
    
    OAuth2Strategy.call(this, options, verify);
    this.name = "cloud9";
    this._userProfileURL = options.userProfileURL || "https://api.c9.io/user";
}

util.inherits(Strategy, OAuth2Strategy);

Strategy.prototype.userProfile = function(accessToken, done) {
    this._oauth2.useAuthorizationHeaderforGET(true);
    this._oauth2.get(this._userProfileURL, accessToken, function (err, body, res) {
        if (err)
            return done(new InternalOAuthError('failed to fetch user profile', err));
        
        try {
            var json = JSON.parse(body);
            
            var profile = { provider: "cloud9" };
            profile.id = json.id;
            profile.displayName = json.name;
            profile.username = json.login;
            profile.emails = [{ value: json.email }];
            
            profile._raw = body;
            profile._json = json;
            
            done(null, profile);
        } catch (e) {
          done(e);
        }
    });
};

module.exports = Strategy;