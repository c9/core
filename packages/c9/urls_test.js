/*global describe it beforeEach afterEach*/
"use strict";
"use server";
"use mocha";

require("c9/inline-mocha")(module);
if (typeof define === "undefined") {
    require("amd-loader");
    require("./setup_paths");
}

var assert = require("assert-diff");
var urls = require("./urls");
var url = require("url");
var sinon = require("sinon");

describe("urls", function() {
    
    this.timeout(15000);
    
    it("can do basic domain substitution in settings", function() {
        var settings = {
            domains: ["c9.io"],
            preview: {
                baseUrl: "https://preview.$DOMAIN"
            },
            ide: {
                baseUrlPattern: "https://ide.$DOMAIN"
            }
        };
        urls.replaceDomains(settings, "cloud9beta.com");
        assert.equal(settings.primaryDomain, "cloud9beta.com");
        assert.equal(settings.preview.baseUrl, "https://preview.cloud9beta.com");
        assert.equal(settings.ide.baseUrlPattern, "https://ide.$DOMAIN");
    });
    
    it("can do basic domain substitution in settings a list of domains", function() {
        var settings = {
            domains: ["c9.io"],
            preview: {
                baseUrl: "https://preview.$DOMAIN"
            },
            ide: {
                baseUrlPattern: "https://ide.$DOMAIN"
            }
        };
        urls.replaceDomains(settings, "cloud9beta.com,cs50.me");
        assert.equal(settings.primaryDomain, "cloud9beta.com");
        assert.deepEqual(settings.domains, ["cloud9beta.com", "cs50.me"]);
        assert.equal(settings.preview.baseUrl, "https://preview.cloud9beta.com");
        assert.equal(settings.ide.baseUrlPattern, "https://ide.$DOMAIN");
    });
    
    it("can get the base url for a request", function() {
        var mockRequest = {
            host: "preview.c9.io"
        };
        var baseUrl = urls.getBaseUrl(mockRequest, "https://preview.$DOMAIN", "https://ide.$DOMAIN");
        assert.equal(baseUrl, "https://ide.c9.io");
    });
    
    it("can get the base url for a request with root domain source", function() {
        var mockRequest = {
            host: "c9.io"
        };
        var baseUrl = urls.getBaseUrl(mockRequest, "https://$DOMAIN", "https://ide.$DOMAIN");
        assert.equal(baseUrl, "https://ide.c9.io");
    });
    
    it("can get the base url for a request with root domain target", function() {
        var mockRequest = {
            host: "preview.cloud9beta.com"
        };
        var baseUrl = urls.getBaseUrl(mockRequest, "https://preview.$DOMAIN", "https://$DOMAIN");
        assert.equal(baseUrl, "https://cloud9beta.com");
    });
    
    it("gracefully copes with source domain mismatch", function() {
        var mockRequest = {
            host: "preview.cloud9beta.com"
        };
        var baseUrl = urls.getBaseUrl(mockRequest, "https://ide.$DOMAIN", "https://$DOMAIN");
        assert.equal(baseUrl, "https://c9.io");
    });
    
    it("can get the base url in dogfooding mode", function() {
        var mockRequest = {
            host: "newclient-lennartcl.c9.io"
        };
        var baseUrl = urls.getBaseUrl(mockRequest, "https://$DOMAIN", "https://ide.$DOMAIN");
        assert.equal(baseUrl, "https://ide.newclient-lennartcl.c9.io");
    });
    
    it("can get the base url in dogfooding mode (2)", function() {
        var mockRequest = {
            host: "preview.newclient-lennartcl.c9.io"
        };
        var baseUrl = urls.getBaseUrl(mockRequest, "https://preview.$DOMAIN", "https://ide.$DOMAIN");
        assert.equal(baseUrl, "https://ide.newclient-lennartcl.c9.io");
    });
    
    it("even works with URL objects", function() {
        var input = url.parse("https://preview.newclient-lennartcl.c9.io");
        var baseUrl = urls.getBaseUrl(input, "https://preview.$DOMAIN", "https://ide.$DOMAIN");
        assert.equal(baseUrl, "https://ide.newclient-lennartcl.c9.io");
    });
    
    it("even works with strings", function() {
        var input = "https://preview.newclient-lennartcl.c9.io";
        var baseUrl = urls.getBaseUrl(input, "https://preview.$DOMAIN", "https://ide.$DOMAIN");
        assert.equal(baseUrl, "https://ide.newclient-lennartcl.c9.io");
    });
    
    it("targetBaseUrlPattern is optional", function() {
        var input = "https://preview.newclient-lennartcl.c9.io";
        var baseUrl = urls.getBaseUrl(input, "https://preview.$DOMAIN");
        assert.equal(baseUrl, "https://preview.newclient-lennartcl.c9.io");
    });
    
    it("should split domains", function() {
        var domains = ["c9.io", "c9users.io", "cs50.io"];
        assert.deepEqual(urls.splitDomain("fjakobs-ace.c9.io", domains), {
            domainName: "c9.io",
            subDomains: "fjakobs-ace",
            port: ""
        });
        assert.deepEqual(urls.splitDomain("preview.c9users.io", domains), {
            domainName: "c9users.io",
            subDomains: "preview",
            port: ""
        });
        assert.deepEqual(urls.splitDomain("fjakobs.ace.cs50.io", domains), {
            domainName: "cs50.io",
            subDomains: "fjakobs.ace",
            port: ""
        });
        assert.deepEqual(urls.splitDomain("fjakobs.ace.cs50.io:8081", domains), {
            domainName: "cs50.io",
            subDomains: "fjakobs.ace",
            port: "8081"
        });
    });
});