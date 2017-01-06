define(function(require, module, exports) {
    main.consumes = [
        "Plugin", "test", "Form", "preferences", "proc", "watcher", "util", 
        "c9", "fs", "test.all", "dialog.error"
    ];
    main.provides = ["TestRunner"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var Form = imports.Form;
        var test = imports.test;
        var proc = imports.proc;
        var util = imports.util;
        var c9 = imports.c9;
        var fs = imports.fs;
        var showError = imports["dialog.error"].show;
        var prefs = imports.preferences;
        var all = imports["test.all"];
        
        var Node = test.Node;
        var File = test.File;
        
        var basename = require("path").basename;
        var dirname = require("path").dirname;
        var async = require("async");

        function TestRunner(developer, deps, options) {
            var plugin = new Plugin(developer, deps);
            var emit = plugin.getEmitter();

            var caption = options.caption;
            var formOptions = options.options || [];
            var index = options.index || 100;
            var watcher = imports.watcher;
            var query = options.query;
            var getName = options.getName;
            var defaultParallel = options.defaultParallel || false;
            var defaultParallelConcurrency = options.defaultParallelConcurrency || 4;
            var meta = {};
            var form;
            
            var DEFAULTSCRIPT = query ? JSON.stringify(query.def, " ", 4) : "";
            
            var update;
            
            /*
                query: {
                    id: "mocha",
                    label: "Mocha Test Runner",
                    def: {
                        match: {
                            content: ["^\\s*describe\\("],
                            filename: [".js$"]
                        },
                        exclude: {
                            dir: ["node_modules"],
                            file: []
                        },
                        search: "*"
                    }
                    {
                        "match": {
                            "content": ["\"use server\"", "\"use mocha\""],
                            "filename": [".js$"]
                        },
                        "exclude": {
                            "dir": ["node_modules", "build", "plugins/c9.fs/mock", "plugins/c9.ide.plugins/mock", "plugins/c9.profile/node_modules", "plugins/c9.ide.plugins/templates"],
                            "file": []
                        },
                        "search": "*"
                    }
                },
            */
            
            plugin.on("load", function() {
                test.register(plugin);
                
                if (!query) return;
                
                var prefDef = {
                    "Test": {
                        position: 1000,
                    }
                };
                prefDef.Test[query.label] = {
                    position: query.position || 1000,
                    "Config To Fetch All Test Files In The Workspace": {
                       name: "txtTest",
                       type: "textarea-row",
                       fixedFont: true,
                       width: 600,
                       height: 200,
                       rowheight: 250,
                       position: 1000
                   },
                };
                prefs.add(prefDef, plugin);
                
                plugin.getElement("txtTest", function(txtTest) {
                    var ta = txtTest.lastChild;
                    
                    ta.on("blur", function(e) {
                        if (test.config[query.id] == ta.value) return;
                        
                        // Validate
                        try { JSON.parse(ta.value); }
                        catch (e) { 
                            showError("Invalid JSON " + e.message); 
                            return;
                        }
                        
                        test.config[query.id] = ta.value;
                        test.saveConfig(function() {
                            update(function() {
                                all.refresh();
                            });
                        });
                    });
                    
                    test.on("ready", function() {
                        ta.setValue(test.config[query.id] || DEFAULTSCRIPT);
                    }, plugin);
                    test.on("updateConfig", function() {
                        ta.setValue(test.config[query.id] || DEFAULTSCRIPT);
                    }, plugin);
                }, plugin);
                
                function addFile(path, value) {
                    if (isTest(path, value) && !all.findFileByPath(path)) {
                        createFile(path);
                        all.refresh();
                    }
                }
                
                function removeTestFile(path) {
                    var fileNode = all.findFileByPath(path);
                    if (fileNode) {
                        plugin.root.items.remove(fileNode);
                        all.refresh();
                    }
                }
                
                function rmdir(path) {
                    plugin.root.findAllNodes("file").forEach(function(fileNode) {
                        if (fileNode.path.indexOf(path) === 0) {
                            plugin.root.items.remove(fileNode);
                        }
                    });
                    all.refresh();
                }
                
                fs.on("afterWriteFile", function(e) {
                    addFile(e.path, e.args[1]);
                }, plugin);
                fs.on("afterUnlink", function(e) {
                    removeTestFile(e.path);
                }, plugin);
                fs.on("afterRmfile", function(e) {
                    removeTestFile(e.path);
                }, plugin);
                fs.on("afterRmdir", function(e) {
                    rmdir(e.path);
                }, plugin);
                fs.on("afterCopy", function(e) {
                    var fromPath = e.args[0];
                    var toPath = e.args[1];
                    
                    plugin.root.findAllNodes("file").forEach(function(fileNode) {
                        if (fileNode.path.indexOf(fromPath) === 0) {
                            createFile(fileNode.path.replace(fromPath, toPath));
                        }
                    });
                    all.refresh();
                }, plugin);
                fs.on("afterRename", function(e) {
                    var fromPath = e.args[0];
                    var toPath = e.args[1];
                    
                    plugin.root.findAllNodes("file").forEach(function(fileNode) {
                        if (fileNode.path.indexOf(fromPath) === 0) {
                            fileNode.path = fileNode.path.replace(fromPath, toPath);
                            fileNode.label = fileNode.path.substr(1);
                        }
                    });
                    all.refresh();
                }, plugin);
                
                watcher.on("delete", function(e) {
                    rmdir(e.path);
                }, plugin);
                watcher.on("directory", function(e) {
                    // TODO: Run fetch() in this directory to get the new tests
                    // all.refresh();
                }, plugin);
                watcher.on("change", function(e) {
                    var fileNode = all.findFileByPath(e.path);
                    if (fileNode && fileNode.status == "pending") {
                        plugin.update(fileNode, function(err) {
                            if (!err) all.refresh();
                        });
                    }
                }, plugin);
            });
            
            plugin.on("unload", function() {
                test.unregister(plugin);
            });

            /***** Methods *****/
            
            function getForm() {
                if (!formOptions.length) return false;
                if (form) return form;
                
                form = new Form({ 
                    form: formOptions,
                    rowheight: 45,
                    colwidth: 100,
                    style: "width:320px"
                }, plugin);
                
                return form;
            }
            
            function parseScript(def) {
                var script = ["grep -lsRi"];
                
                if ((def.match || 0).content) 
                    def.match.content.forEach(function(q) {
                        script.push("-E " + makeArg(q));
                    });
                
                if ((def.exclude || 0).dir)
                    def.exclude.dir.forEach(function(q) {
                        script.push("--exclude-dir " + makeArg(q));
                    });
                    
                if ((def.exclude || 0).file)
                    def.exclude.file.forEach(function(q) {
                        script.push("--exclude " + makeArg(q));
                    });
                
                script.push(def.search);
                
                if ((def.match || 0).filename) 
                    def.match.filename.forEach(function(q) {
                        if (q.charAt(0) == "-")
                            script.push("| grep -v " + makeArg(q.substr(1)));
                        else
                            script.push("| grep " + makeArg(q));
                    });
                
                return script.join(" ");
            }
            
            function makeArg(str) {
                return "'" + str.replace(/'/g, "\\'") + "'";
            }
            
            function createFile(path, items) {
                var file = new File({
                    label: getName ? getName(path) : path,
                    path: path
                });
                
                (items || plugin.root.items).push(file);
                
                return file;
            }
            
            function getConfig() {
                try {
                    return test.config && test.config[query.id] 
                        ? JSON.parse(test.config[query.id]) 
                        : query.def;
                } catch (e) {
                    return query.def;
                }
            }
            
            function fetchFromCache(callback) {
                fs.readFile("~/.c9/cache/" + plugin.name, function(err, data) {
                    if (err)
                        return callback(err);
                    
                    try { callback(null, JSON.parse(data)); }
                    catch (e) { callback(); }
                });
            }
            
            function writeToCache(cache, callback) {
                fs.writeFile("~/.c9/cache/" + plugin.name + "/index", cache, function(err) {
                    callback && callback(err);
                });
            }
            
            function fetch(callback) {
                if (!query) 
                    return callback(new Error("Invalid Plugin Definition. Missing query"));
                
                var script = parseScript(getConfig());
                
                if (c9.platform == "win32" && /grep/.test(script))
                    return callback(null, ""); // TODO DEFAULTSCRIPT is broken on windows
                
                proc.spawn("bash", {
                    args: ["-l", "-c", script],
                    cwd: c9.workspaceDir
                }, function(err, p) {
                    if (err) return callback(err);
                    
                    var stdout = "", stderr = "";
                    p.stdout.on("data", function(c) {
                        stdout += c;
                    });
                    p.stderr.on("data", function(c) {
                        stderr += c;
                    });
                    p.on("exit", function() {
                        callback(null, stdout);
                    });
                });
            }
            
            function init(filter, callback) {
                /* 
                    Set hooks to update list
                    - Strategies:
                        - Periodically
                        * Based on fs/watcher events
                        * Based on opening the test panel
                        * Refresh button
                    
                    Do initial populate
                */
                
                var isUpdating, initialUpdate = true;
                update = function(otherCallback) {
                    if (isUpdating) return fsUpdate(null, 10000);
                    
                    isUpdating = true;
                    
                    async.parallel({
                        cache: function(cb) {
                            if (initialUpdate) {
                                initialUpdate = false; // Only fetch cache at startup
                                
                                fetchFromCache(function(err, nodes) {
                                    if (!nodes || err) return cb();
                                    
                                    nodes.forEach(function(node) {
                                        if (!node.label) {
                                            node.label = getName(node.path);
                                            node.status = "pending";
                                        }
                                    });
                                    
                                    plugin.root.importItems(nodes);
                                    callback(null, plugin.root.items);
                                    
                                    cb(null, nodes);
                                });
                            }
                            else {
                                callback();
                                cb();
                            }
                        },
                        recent: function(callback) {
                            plugin.fetch(function(err, list) {
                                isUpdating = false;
                                
                                if (err) return callback(err);
                                
                                var items = [];
                                var newCache = [];
                                
                                list.split("\n").forEach(function(name) {
                                    var path = "/" + name;
                                    if (!name || filter(path)) return;
                                    
                                    newCache.push(path);
                                    
                                    items.push({
                                        label: getName ? getName(path) : path,
                                        path: path,
                                        type: "file"
                                    });
                                });
                                
                                writeToCache(newCache.join("\n"));
                                
                                callback(null, items);
                            });
                        }
                    }, function(err, data) {
                        otherCallback && otherCallback();
                        if (err) return callback(err);
                        
                        plugin.root.importItems(data.recent);
                        callback(null, plugin.root.items);
                    });
                };
                
                var timer;
                function fsUpdate(e, time) {
                    clearTimeout(timer);
                    timer = setTimeout(update, time || 1000);
                }
                
                emit("init");
                
                // Initial Fetch
                update();
            }
            
            /*
                query: {
                    id: "mocha",
                    label: "Mocha Test Runner",
                    def: {
                        match: {
                            content: ["^\\s*describe\\("],
                            filename: [".js$"]
                        },
                        exclude: {
                            dir: ["node_modules"],
                            file: []
                        },
                        search: "*"
                    }
                },
            */
            
            function isTest(path, value) {
                var def = getConfig();
                
                var reSearch = util.escapeRegExp(def.search)
                    .replace(/\\\*/g, ".*")
                    .replace(/\\\?/g, ".");
                
                if (!path.match(reSearch)) return false;
                
                if (((def.match || 0).content || 0).length) {
                    if (!def.match.content.some(function(q) {
                        return (value || "").match(new RegExp(q));
                    })) return false;
                }
                
                var filename = basename(path);
                if (((def.match || 0).filename || 0).length) {
                    if (!def.match.filename.some(function(q) {
                        if (q.charAt(0) == "-")
                            return !filename.match(new RegExp(q.substr(1)));
                        else
                            return filename.match(new RegExp(q));
                    })) return false;
                }
                
                var dirpath = dirname(path);
                if (((def.exclude || 0).dir || 0).length) {
                    if (def.exclude.dir.some(function(q) {
                        return dirpath.match(new RegExp(q));
                    })) return false;
                }
                    
                if (((def.exclude || 0).file || 0).length) {
                    if (def.exclude.file.some(function(q) {
                        return filename.match(new RegExp(q));
                    })) return false;
                }
                
                return true;
            }

            /***** Register and define API *****/
            
            plugin.freezePublicAPI.baseclass();

            plugin.freezePublicAPI({
                /**
                 * @property {String} caption
                 */
                get caption() { return caption; },
                
                /**
                 * @property {Array} options
                 */
                get form() { return getForm(); },
                
                /**
                 * 
                 */
                get meta() { return meta; },
                
                /**
                 * 
                 */
                get update() { return update; },
                
                /**
                 * 
                 */
                get defaultParallel() { return defaultParallel; },
                set defaultParallel(v) { defaultParallel = v; },
                
                /**
                 * 
                 */
                get defaultParallelConcurrency() { return defaultParallelConcurrency; },
                set defaultParallelConcurrency(v) { defaultParallelConcurrency = v; },
                
                /**
                 * 
                 */
                createFile: createFile,
                
                /**
                 * 
                 */
                isTest: isTest,
                
                /**
                 * 
                 */
                init: init,
                
                /**
                 * 
                 */
                fetch: fetch,
                
                /**
                 * @property {Object} root
                 */
                root: new Node({
                    label: caption,
                    index: index,
                    runner: plugin,
                    type: "runner"
                })
            });

            return plugin;
        }

        /***** Register and define API *****/

        register(null, {
            TestRunner: TestRunner
        });
    }
});
