"use strict";
"use server";

require("c9/inline-mocha")(module);
require("amd-loader");

var assert = require('assert-diff');
var Section = require('../frontdoor').Section;
var Url = require('url');



var mock = {
    req: function( method, uri) {
        var parsedUrl = Url.parse(uri||'', true);

        return {
            method: method || 'get',
            parsedUrl: parsedUrl,
            pathname: parsedUrl.pathname,
        }

    }
};

it('Defines params on section level', function(done) {
    var testParams = {
        int: {
            type: 'int',
            source: 'url'
        },
        string: 'string',
        alphanum: {
            type: /[a-z0-9]+/,
            source: 'url'
        },
    };

    var cases = [
        {
            label: 'Match a simple string param',
            path: '/test/:string',
            url: '/test/foo',
            params: {
                string: 'foo',
            }
        },
        {
            label: 'Match a simple number param',
            path: '/test/:int',
            url: '/test/123',
            params: {
                int: 123,
            }
        },
        {
            label: 'Match multiple params',
            path: '/test/:int/:string',
            url: '/test/123/hello',
            params: {
                string: 'hello',
                int: 123,
            }
        },
        {
            label: 'Match multiple params 3x',
            path: '/test/:string/:int/:alphanum',
            url: '/test/hello/123/baz123',
            params: {
                string: 'hello',
                int: 123,
                alphanum: 'baz123'
            }
        },
        {
            label: 'Check ordered params',
            path: '/test/:string/:int/:alphanum',
            url: '/test/123/hello/baz123',
            err: true,
        },
        {
            label: 'Must match type int param',
            path: '/test/:int',
            url: '/test/test',
            err: true,
        },
        {
            label: 'Must match optinal type int',
            path: '/test/:int',
            url: '/test',
            err: true,
        },
        {
            label: 'Match an optional param',
            path: '/test/:optional',
            url: '/test',
            err: true,
        },
        {
            label: 'Match an implied url param',
            path: '/test/:implied',
            url: '/test/ok',
            params: {
                implied: 'ok',                
            },
        },
        {
            label: 'Query params can be passed along',
            path: '/test/:string/:int/:alphanum',
            url: '/test/hello/123/baz123?q=123',
            options: {
                params: {
                    q: {
                        type: 'int',
                        optional: false,
                        source: 'query',
                    }
                }
            },
            params: {
                string: 'hello',
                int: 123,
                alphanum: 'baz123',
                q: 123
            }
        },
        {
            label: 'Required query params must be passed',
            path: '/test/:string/:int/:alphanum',
            url: '/test/hello/123/baz123',
            err: true,
            options: {
                params: {
                    q: {
                        type: 'int',
                        optional: false,
                        source: 'query',
                    }
                }
            },
        },
    ];

    cases.forEach(function(testCase) {
        var req = mock.req('get', testCase.url),
            api = new Section('test');
            
        api.params = testParams;
        
        var handled = false;

        api.get( testCase.path, testCase.options || {}, function(req, res, next){
            handled = true;

            assert.deepEqual( req.params, testCase.params, testCase.label );            
        });

        api.handle( req.pathname, req, {}, function(err) {
            if ( testCase.err ) {
                assert.ok( 'OK: route not matched: ' + testCase.label );
                return;
            }
            assert.ok(handled);
            assert.fail( 'route not matched: ' + testCase.label );                
        });
    });
    
    done();
});
