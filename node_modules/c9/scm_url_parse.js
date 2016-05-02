if (typeof define === "undefined") {		
    var define = function(fn) {		
        fn(require, exports, module);		
    };		
}

define(function(require, exports, module) {
    "use strict";
    
    var Url = require("url");
    
    var providers = {
        "bitbucket.org": "bitbucket",
        "github.com": "github",
        "source.developers.google.com": "google",
        "gitlab.com": "gitlab",
    };
    var defaultProvider = "unknown";
    
    
    /**
     * Checks if there are unexpected (dangerous) characters in the url
     * 
     * Source:
     * 
     * http://pubs.opengroup.org/onlinepubs/009695399/utilities/xcu_chap02.html
     * 
     * The application shall quote the following characters if they are to represent themselves:
     * 
     * |  &  ;  <  >  (  )  $  `  \  "  '  <space>  <tab>  <newline>
     * 
     * and the following may need to be quoted under certain circumstances. That is, these characters may be special depending on conditions described elsewhere in this volume of IEEE Std 1003.1-2001:
     * 
     * *   ?   [   #   ˜   =   %
     */
    function containsDangerousShellCharacters(url){
        return /[\s;&|><*?`$(){}[\]!#]/.test(url);
    }
    
    module.exports = function(url) {
        // scm urls cannot contain any of these
        if (containsDangerousShellCharacters(url))
            return;
        
        var m = url.match(/^(git)@([\w\.\d\-\_]+)(?:\/|:)([\w\.\d\-\_\/]+)/);
        if (m) {
            return {
                protocol: "ssh:",
                scm: "git",
                provider: providers[m[2]] || defaultProvider,
                auth: m[1],
                hostname: m[2],
                pathname: m[3]
            };
        }
    
        var parsed = Url.parse(url);
        
        if (
            parsed &&
            parsed.protocol &&
            parsed.protocol.match(/^(git|http|https|ssh):$/) &&
            parsed.hostname &&
            parsed.slashes &&
            parsed.pathname
        ) {
            var scm;
            var provider = providers[parsed.hostname] || defaultProvider;
            switch (provider) {
                case "github":
                    scm = "git";
                    break;
                case "google":
                    scm = "git";
                    break;
                case "bitbucket": 
                    scm = parsed.pathname.match(/\.git$/) ? "git": "hg";
                    break;
                case "gitlab":
                    scm = "git";
                    break;
                default:
                    scm = parsed.pathname.match(/\.git$/) ? "git": "hg";
            }




            return {
                protocol: parsed.protocol,
                scm: scm,
                provider: provider,
                auth: parsed.auth || "",
                hostname: parsed.hostname,
                pathname: parsed.pathname.replace(/^\/+/, ""),
                full: url
            };
        }
        else {
            return null;
        }
    };
});
