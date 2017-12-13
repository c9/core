"use strict";

/* global phantom */

var TEST_SUITE_URL = "http://localhost:8080/static/test.html?noui=true";

var page = require("webpage").create();
var system = require("system");
var pageErrors = [];
var hadError = 0;

var address = system.args[1];
var filter  = system.args[2];
var branch  = system.args[3];

var logAll = true;
if (!address) console.log("# No address, running against: ", TEST_SUITE_URL);
if (filter) console.log("# Filter tests by ", filter);
if (!address) address = TEST_SUITE_URL;

page.onConsoleMessage = function(msg) {
    if (!/^PHANTOMJS:/.test(msg)) {
        if (logAll) console.log(msg);
        return;
    }
    
    msg = msg.replace(/^PHANTOMJS: /, "");

    if (/^exit/.test(msg)) {
        showPageErrors();
        phantom.exit(hadError ? 1 : 0);
    }
    
    if (/^screenshot/.test(msg)) {
        var title = "out/cferror_" + /\w*$/m.exec(msg)[0] + ".png";
        return page.render(title);
    }
    
    if (/^error #/.test(msg)) {
        msg = linkifyErrorStack(msg);
    }
    
    if (/^not ok/.test(msg)) {
        hadError = true;
    }

    console.log(msg);
};

function linkifyErrorStack(msg) {
    function toGithubUrl(path) {
        if (!branch) return path;
        return path.replace(/\/?([^:]+):(\d+)/g, function(_, path, line) {
            return "https://github.com/c9/newclient/blob/" + branch + "/" + path + "#L" + line;
        });
    }
    // change phantomjs stack to chrome format
    msg = msg
        .replace(/^(\s*)(?:([^@:\s]+)@|(https?:))/gm, "$1at $2 $3")
        .replace(/^/gm, "\t\t").slice(1);
    msg = msg.replace(/https?:\/\/[^/]+\/static(\/[^:]+[:\d]+)/g, function(_, path) {
        if (/^\/plugins\//.test(path)) path = path;
        else if (/^lib\/(events|path)/.test(path)) path = "plugins/c9.nodeapi" + path.slice(4);
        else if (/^\/lib\/(ace|mocha)/.test(path)) path = "/node_modules" + path.slice(4);
        else if (/^\/engine.io\/engine.io.js/.test(path)) path = "/node_modules" + path.replace(/engine.io/, "$&-client");
        else if (/^\/(vfs-socket|smith)\//.test(path)) path = "/node_modules" + path;
        else if (/^\/(kaefer)\//.test(path)) path = "/node_modules" + path.replace("kaefer", "$&/lib");
        else return _;
        
        return toGithubUrl(path);
    });
    
    return msg;
}

function showError(msg, trace) {
    var msgStack = [msg];
    if (trace && trace.length) {
        trace.forEach(function(t) {
            msgStack.push((t.file || t.sourceURL) + ':' + t.line + (t.function ? ' (in function ' + t.function +')' : ''));
        });
    }
    console.log(linkifyErrorStack(msgStack.join('\n')));
}

page.onError = function(msg, trace) {
    pageErrors.push({
        msg: msg,
        trace: trace
    });
    if (logAll)
        showError(msg, trace);
};

function showPageErrors() {
    var re = /--debug/;
    if (system.args.some(re.test.bind(re)))
        console.error(JSON.stringify(pageErrors, null, 2));
}

phantom.onError = function(msg, trace) {
    showError(msg, trace);
    phantom.exit(1);
};

page.open(address, function(status) {
    if (status !== 'success') {
        console.log('FAIL to load the address');
        phantom.exit(1);
    }
    
    
    page.evaluate(function(filterStr) {
        var GLOBAL_TIMEOUT = 60 * 1000;
        
        function format(tpl) {
            var values = Array.prototype.slice.call(arguments, 1);
            return tpl.replace(/(%s)/g, values.shift.bind(values));
        }
        
        function takeScreenshot(name) {
            log("screenshot %s", name.replace(/[^\w]/g, "_"));
        }

        function log(msg) {
            console.log("PHANTOMJS:", format.apply(null, arguments));
        }

        function each(things, runner, done) {
            if (!things.length) return done();
            var thing = things.shift();

            runner(thing, function(err) {
                if (err) return done(err);
                each(things, runner, done);
            });
        }
        
        function filterTests(tests, filter) {
            if (!filter) return tests;
            var re = new RegExp(filter);
            return tests.filter(re.test.bind(re));
        }
        
        function fail(count, test) {
            log("not ok %s %s", count, test.title);
            log("error # %s", test.error || "test.error is missing");
        }
        
        window.c9Test.onReady = function() {
            log("# starting c9 tests");
            
            var count = 0;
            var failCount = 0;
            var timeout = null;
            var suites = 0;

            function runTest(name, next) {
                suites++;
                var subtests = 0;
                var failed = false;
                
                window.mocha._onSubTest = function(test) {
                    subtests++;
                    if (test.state == "failed") {
                        failed = true;
                        takeScreenshot(name + "_" + subtests);
                    }
                };
                
                watchForTimeout(name);
                
                log("# %s", name);
                window.c9Test.run(name, function(errors, out) {
                    if (errors) console.error(errors);
                    if (!out.tests || !out.tests.length) {
                        out.tests = [{
                            state: "failed",
                            error: "test didn't complete"
                        }];
                    }

                    out.tests.forEach(function(test, i) {
                        count++;
                        var index = suites + "." + i;
                        if (test.state === "passed") return log("ok %s %s", index, test.title);
                        if (test.state === "failed") return fail(index, test);
                        log("ok %s # SKIP %s", index, test.title);
                    });
                    
                    if (failed) {
                        takeScreenshot(name + "_after");
                        failCount++;
                    }
                    
                    done();
                });
                
                function done() {
                    if (!timeout) return; // Don't call next twice, if timeout isn't set done has already been called
                    clearTimeout(timeout);
                    timeout = null;
                    next();
                }
                
                function watchForTimeout(name) {
                    timeout = window.setTimeout(function() {
                        count++;
                        fail(count, {
                            title: name, 
                            error: "test file " + name + " timed out after " + (GLOBAL_TIMEOUT / 1000) + "s"
                        });
                        failed = true;
                        done();
                    }, GLOBAL_TIMEOUT);
                }
            }

            each(filterTests(window.c9Test.allFiles, filterStr), runTest, function() {
                if (!count) log("not ok %s %s", count, "test found");
                console.log("%s..%s..%s", window.c9Test.allFiles.length, count, failCount);
                log("exit");
            });

        };
    }, filter);
    
});