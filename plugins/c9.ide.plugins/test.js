/* global requirejs */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "plugin.debug", "c9", "menus", "ui", "ext", "preview",
        "preview.browser"
    ];
    main.provides = ["plugin.test"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var c9 = imports.c9;
        var menus = imports.menus;
        var preview = imports.preview;
        var ext = imports.ext;
        var ui = imports.ui;
        var debug = imports["plugin.debug"];
        var browser = imports["preview.browser"];
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var chai, mocha, iframe, architect;
        
        var ENABLED = c9.location.indexOf("debug=2") > -1;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            if (!ENABLED) return;
            
            debug.once("ready", function() {
                menus.addItemByPath("Tools/Developer/Tests", null, 200, plugin);
                
                debug.plugins.forEach(function(name, i) {
                    menus.addItemByPath("Tools/Developer/Tests/" + name.replace(/\//g, "\\/"), new ui.item({
                        onclick: function() {
                            run(name, function(err) {
                                if (err) console.error(err);
                            });
                        }
                    }), i + 1, plugin);
                });
            });
            
            ext.on("register", function() {
                // TODO
            }, plugin);
            ext.on("unregister", function() {
                // TODO
            }, plugin);
            
            var reloading;
            function loadPreview(url, session) {
                var idx = url.indexOf(options.staticPrefix);
                if (!reloading && idx > -1) {
                    reloading = true;
                    
                    var name = session.doc.meta.pluginName;
                    run(name, function(err) {
                        if (err) console.error(err);
                    });
                    
                    reloading = false;
                }
            }
            
            browser.on("reload", function(e) {
                loadPreview(e.session.path, e.session);
            });
        }
        
        /***** Methods *****/
        
        function setReferences(c, m) {
            chai = c;
            mocha = m;
            
            emit("ready");
        }
        
        function loadIframe(pluginName, callback) {
            var url = options.staticPrefix + "/test.html";
            if (url.indexOf("http") !== 0)
                url = location.origin + url;
            
            var tab = preview.openPreview(url, null, true);
            iframe = tab.document.getSession().iframe;
            iframe.addEventListener("load", handle);
            iframe.addEventListener("error", onError);
            
            function handle(err) {
                iframe.removeEventListener("load", handle);
                iframe.removeEventListener("error", onError);
                callback(err instanceof Error ? err : null, tab);
            }
            
            function onError(e) {
                debugger; // e.??
                handle(new Error());
            }
            
            tab.document.meta.ignoreState = true;
            tab.document.meta.pluginName = pluginName;
        }
        
        function loadTestSuite(name, callback) {
            // Clear require cache
            requirejs.undef("plugins/" + name + "_test"); // global
            
            // Load plugin
            architect.loadAdditionalPlugins([{
                packagePath: "plugins/" + name + "_test"
            }], function(err) {
                callback(err);
            });
        }
        
        function run(pluginName, callback) {
            // Load test runner
            loadIframe(pluginName, function(err, tab) {
                if (err) return callback(err);
                
                tab.editor.setLocation("test://" + pluginName);
                
                // Wait until iframe is loaded
                plugin.once("ready", function() {
                    
                    // Load the test for the plugin
                    loadTestSuite(pluginName, function(err) {
                        if (err) return callback(err);
                        
                        // Run the test
                        mocha.run(function() {
                            
                            // Done
                            callback();
                        });
                    });
                    
                });
                
                // Load iframe with new test runner frame
                iframe.contentWindow.start(plugin);
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            loaded = false;
            chai = null;
            mocha = null;
            iframe = null;
            architect = null;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            get architect() { throw new Error(); },
            set architect(v) { architect = v; },
            
            /**
             * 
             */
            get describe() { return mocha.describe; },
            /**
             * 
             */
            get it() { return mocha.it; },
            /**
             * 
             */
            get before() { return mocha.before; },
            /**
             * 
             */
            get after() { return mocha.after; },
            /**
             * 
             */
            get beforeEach() { return mocha.beforeEach; },
            /**
             * 
             */
            get afterEach() { return mocha.afterEach; },
            /**
             * 
             */
            get assert() { return chai.assert; },
            /**
             * 
             */
            get expect() { return chai.expect; },
            
            /**
             * 
             */
            setReferences: setReferences,
            
            /**
             * 
             */
            run: run
        });
        
        register(null, {
            "plugin.test": plugin
        });
    }
});

//@TODO look at jasmine instead

// require(["lib/architect/architect", "lib/chai/chai", "/vfs-root"], function() {

// mocha.setup('bdd');
//         mocha.bail(false);
//         mocha.ignoreLeaks(true);
// mocha.run(done)
// /*global Mocha, mocha*/
//         mocha.reporter(function(runner) {
//             Mocha.reporters.Base.call(this, runner);
//             Mocha.reporters.HTML.call(this, runner);
            
//             var tests = [];
//             var stats = this.stats;
//             mocha.report = { stats: stats, tests: tests };
        
//             runner.on('test end', function(test) {
//                 stats.percent = stats.tests / runner.total * 100 | 0;
//                 tests.push(clean(test));
//             });

//             runner.on('end', function() {
//                 console.log(JSON.stringify(mocha.report, null, 4));
//             });
            
//             function parseError(err) {
//                 var str = err.stack || err.toString();
    
//                 // FF / Opera do not add the message
//                 if (!~str.indexOf(err.message)) {
//                     str = err.message + '\n' + str;
//                 }
    
//                 // <=IE7 stringifies to [Object Error]. Since it can be overloaded, we
//                 // check for the result of the stringifying.
//                 if ('[object Error]' == str) str = err.message;
    
//                 // Safari doesn't give you a stack. Let's at least provide a source line.
//                 if (!err.stack && err.sourceURL && err.line !== undefined) {
//                     str += "\n(" + err.sourceURL + ":" + err.line + ")";
//                 }
//                 return str;
//             }
//             function clean(test) {
//                 return {
//                     title: test.title,
//                     duration: test.duration,
//                     error: test.err && parseError(test.err),
//                     speed: test.speed,
//                     state: test.state
//                 };
//             }
//         });