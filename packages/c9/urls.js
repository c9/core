/**
 * Base URL utilities for the Ajax.org Cloud IDE
 * 
 * Access via require("c9/urls").
 *
 * @copyright 2015, Ajax.org B.V.
 */

var assert = require("assert");

function getHost(req) {
    var host = 
        req.headers && req.headers.host ||
        req.host ||
        req.url ||
        req;
        
    return host.replace(/^https?:\/\/([^/]*).*/, "$1");
}

function splitDomain(req, domains) {
    var host = getHost(req);
    
    var allDomains = domains.join("|");
    var domainRe = new RegExp("^(.*?)\\.?(" + allDomains.replace(".", "\\.") + ")(?::(\\d+))?$");

    var m = host.match(domainRe);
    if (m) {
        return {
            subDomains: m[1],
            domainName: m[2],
            port: m[3] || ""
        };
    } else {
        return {
            subDomains: "",
            domainName: host.split(":")[0],
            port: host.split(":")[1] || ""
        };
    }
}

/**
 * Get a desired base URL, given some context.
 * 
 * Example for a request coming into the IDE service:
 * 
 * ```
 * getBaseUrl(req, "https://ide.$DOMAIN", "https://preview.$DOMAIN");
 * ```
 * 
 * The above example will determine the domain name from the request,
 * by stripping off the "https://ide." part. So, for a domain like
 * "https://ide.c9.io" we'll get "c9.io". For a domain like
 * "https://ide.dogfooding-lennartcl.c9.io" we'll get dogfooding-lennartcl.c9.io.
 * If there is no match, a warning is shown. The target pattern
 * is used to construct the resulting URL, e.g. https://preview.c9.io.
 * 
 * @param req
 *     The current request object or URL
 * @param {String} [sourceUrlPattern]
 *     The URL pattern of the current service, e.g. https://ide.$DOMAIN if
 *     we are getting an incoming request for the IDE service
 * @param {String} targetBaseUrlPattern
 *     The URL pattern of the target service. E.g., if we want to
 *     construct the base URL of the API service, this might be https://api.$DOMAIN.
 */
function getBaseUrl(req, sourceBaseUrlPattern, targetBaseUrlPattern) {
    var sourceHost = getHost(req);

    if (typeof sourceHost !== "string")
        throw new Error("Not a valid request object: " + req);

    if (!sourceBaseUrlPattern)
        throw new Error("getBaseUrl() requires at least two arguments");
        
    if (!targetBaseUrlPattern)
        targetBaseUrlPattern = sourceBaseUrlPattern;

    var sourceHostMatcher = sourceBaseUrlPattern
        .replace(/^https?:\/\//, "")
        .replace(/\/.*/, "")
        .replace(/\./, "\\.")
        .replace("$DOMAIN", "([^/]+)");
    var hostMatch = sourceHost.match(sourceHostMatcher);
    var targetHost;

    if (hostMatch) {
        targetHost = hostMatch[1];
    }
    else {
        console.trace("Warning: could not construct URL: request host " + sourceHost + " should match " + sourceBaseUrlPattern + "; falling back to c9.io");

        targetHost = "c9.io";
    }

    return replaceDomain(targetBaseUrlPattern, targetHost)
        .replace(/\/$/, "");
}

function replaceDomains(settings, domains) {
    domains = Array.isArray(domains) ? domains : domains.split(",");
    var primaryDomain = domains[0];
    settings.domains = domains;
    settings.primaryDomain = replaceDomain(settings.primaryDomain || "$DOMAIN", primaryDomain);
    settings.primaryBaseUrl = replaceDomain(settings.primaryBaseUrl || "https://$DOMAIN", primaryDomain);
    for (var s in settings) {
        if (!settings[s])
            continue;
        if (settings[s].baseUrl)
            settings[s].baseUrl = replaceDomain(settings[s].baseUrl, primaryDomain);
        if (settings[s].internalBaseUrl)
            settings[s].internalBaseUrl = replaceDomain(settings[s].internalBaseUrl, primaryDomain);
        if (settings[s].primaryBaseUrl)
            settings[s].primaryBaseUrl = replaceDomain(settings[s].primaryBaseUrl, primaryDomain);
        if (settings[s].baseUrls) {
            assert(settings[s].baseUrls.length === 1);
            settings[s].baseUrls = domains.map(function(d) {
                return replaceDomain(settings[s].baseUrls[0], d);
            });
        }
    }
}

function replaceDomain(url, domain) {
    return url.replace("$DOMAIN", domain);
}

module.exports = {
    replaceDomains: replaceDomains,
    getBaseUrl: getBaseUrl,
    splitDomain: splitDomain,
    getHost: getHost
};