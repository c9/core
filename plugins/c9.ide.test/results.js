define(function(require, exports, module) {
    main.consumes = [
        "TestPanel", "ui", "Tree", "settings", "panels", "commands", "test.all",
        "util", "test", "Menu", "MenuItem", "Divider", "preferences", "layout"
    ];
    main.provides = ["test.results"];
    return main;

    function main(options, imports, register) {
        var TestPanel = imports.TestPanel;
        var settings = imports.settings;
        var panels = imports.panels;
        var ui = imports.ui;
        var util = imports.util;
        var prefs = imports.preferences;
        var Tree = imports.Tree;
        var test = imports.test;
        var commands = imports.commands;
        var layout = imports.layout;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        var all = imports["test.all"];
        
        var Node = test.Node;
        
        // var async = require("async");
        var basename = require("path").basename;
        var dirname = require("path").dirname;
        var escapeHTML = require("ace/lib/lang").escapeHTML;

        /***** Initialization *****/

        var plugin = new TestPanel("Ajax.org", main.consumes, {
            caption: "Test Results",
            index: 100,
            height: 150,
            class: "top-test-panel"
        });
        // var emit = plugin.getEmitter();
        
        var tree, failNode, passNode, skipNode, errNode, rootNode, termNode;
        var state = {};
        
        function load() {
            if (test.inactive)
                return;
            // plugin.setCommand({
            //     name: "test",
            //     hint: "search for a command and execute it",
            //     bindKey: { mac: "Command-.", win: "Ctrl-." }
            // });
            
            panels.on("afterAnimate", function() {
                if (panels.isActive("test"))
                    tree && tree.resize();
            });
            
            // Menus
            // menus.addItemByPath("Run/Test", new ui.item({ 
            //     command: "commands" 
            // }), 250, plugin);
            
            settings.on("read", function() {
                settings.setDefaults("user/test", [["collapsegroups", false]]);
            }, plugin);
            
            prefs.add({
                "Test": {
                    position: 1000,
                    "Test Runner": {
                        position: 100,
                        "Collapse Passed and Skipped Groups": {
                            type: "checkbox",
                            position: 200,
                            setting: "user/test/@collapsegroups"
                        }
                    }
                }
            }, plugin);
        }
        
        var drawn = false;
        function draw(opts) {
            if (drawn) return;
            drawn = true;
            
            tree = new Tree({
                container: opts.html,
                maxLines: 50,
                scrollMargin: [10, 10],
                theme: "filetree",
            
                getCaptionHTML: function(node) {
                   if (node.type == "file") {
                        var path = dirname(node.label);
                        if (path == ".") return escapeHTML(node.label);
                        return basename(path) + "/" + basename(node.label) 
                            + "<span class='extrainfo'> - " + dirname(path) + "</span>";
                   }
                   else if (node.type == "all") {
                       return escapeHTML(node.label) + " (" + node.items.length + ")";
                   }
                   else if (node.type == "testset") {
                       return "<span style='opacity:0.5;'>" + escapeHTML(node.label) + "</span>";
                   }
                   else if (node.kind == "it") {
                       return "it " + escapeHTML(node.label);
                   }
                   else if (node.type == "result") {
                       return escapeHTML(node.label) + " <span style='font-size:11px'>(" 
                            + node.items.length + ")</span>";
                   }
                   
                   return escapeHTML(node.label);
                },
            
                getIconHTML: function(node) {
                    var icon = "default";
                    
                    if (node.status === "loading") icon = "loading";
                    else if (node.status === "running") icon = "test-in-progress";
                    else if (node.passed === 1) icon = "test-passed";
                    else if (node.passed === 0) icon = "test-failed";
                    else if (node.passed === 2) icon = "test-error";
                    else if (node.passed === 3) icon = "test-terminated";
                    else if (node.skip) icon = "test-ignored";
                    else if (node.type == "testset") icon = "test-set";
                    else if (node.type == "file") icon = "test-file";
                    else if (node.type == "runner") icon = "test-file";
                    else if (node.type == "prepare") icon = "test-prepare";
                    else if (node.type == "test") icon = "test-notran";
                    
                    return "<span class='ace_tree-icon filetree-icon " + icon + "'></span>";
                },
                
                getClassName: function(node) {
                    return (node.className || "") 
                        + (node.status == "loading" ? " loading" : "")
                        + (node.status == "running" ? " loading" : ""); // TODO different running icon
                },
                
                getRowIndent: function(node) {
                    return node.$depth ? node.$depth - 1 : 0;
                }
            }, plugin);
            
            tree.container.style.position = "absolute";
            tree.container.style.left = "0";
            tree.container.style.top = "0";
            tree.container.style.right = "10px";
            tree.container.style.bottom = "0";
            tree.container.style.height = "";
            
            failNode = new Node({
                label: "failed",
                isOpen: true,
                passed: 0,
                type: "result",
                className: "heading",
                noSelect: true,
                $sorted: true,
            });
            passNode = new Node({
                label: "passed",
                isOpen: true,
                passed: 1,
                type: "result",
                className: "heading",
                noSelect: true,
                $sorted: true
            });
            termNode = new Node({
                label: "terminated",
                isOpen: true,
                passed: 3,
                type: "result",
                className: "heading",
                noSelect: true,
                $sorted: true
            });
            skipNode = new Node({
                label: "skipped",
                isOpen: true,
                passed: 4,
                type: "result",
                className: "heading",
                noSelect: true,
                $sorted: true
            });
            errNode = new Node({
                label: "error",
                isOpen: true,
                passed: 2,
                type: "result",
                className: "heading",
                noSelect: true,
                $sorted: true
            });
            
            tree.setRoot(rootNode = new Node({
                label: "root",
                tree: tree
            }));
            
            tree.commands.bindKey("Space", function(e) {
                openTestFile();
            });
            
            tree.commands.bindKey("Enter", function(e) {
                commands.exec("runtest");
            });
            
            tree.on("focus", function() {
                test.focussedPanel = plugin;
            });
            
            tree.on("select", function() {
                openTestFile([tree.selectedNode], true);
            });
            
            tree.on("afterChoose", function() {
                if (tree.selectedNode && !tree.model.hasChildren(tree.selectedNode))
                    openTestFile([tree.selectedNode], false);
            });
            
            tree.on("afterRender", recalc);
            
            layout.on("eachTheme", function(e) {
                var height = parseInt(ui.getStyleRule(".filetree .tree-row", "height"), 10) || 22;
                tree.rowHeightInner = height;
                tree.rowHeight = height;
                
                if (e.changed && tree) tree.resize(true);
            });
            
            all.on("draw", function() {
                // Menu
                opts.aml.setAttribute("contextmenu", all.contextMenu.aml);
            }, plugin);
            
            // Hook clear
            test.on("clear", function() {
                clear();
            }, plugin);
            
            plugin.hide();
            
            // Process Result
            all.on("result", function(e) { handleResult(e.node); }, plugin);
            all.on("clearResult", function(e) { clearResult(e.node); }, plugin);
            
            (function _(node) {
                node.items.forEach(function(node) {
                    if (node.type == "file") {
                        if (node.passed !== undefined)
                            handleResult(node);
                    }
                    else _(node);
                });
            })(all.root);
            
            settings.on("read", function() {
                test.settingsMenu.append(new MenuItem({ 
                    caption: "Collapse Passed and Skipped Groups", 
                    checked: "user/test/@collapsegroups",
                    type: "check",
                    position: 300
                }));
            }, plugin);
            
            settings.on("user/test/@collapsegroups", function(value) {
                if (plugin.visible) {
                    skipNode.isOpen = !value;
                    passNode.isOpen = !value;
                    tree.refresh();
                }
            }, plugin);
        }
        
        /***** Methods *****/
        
        function openTestFile(nodes, onlyWhenOpen) {
            all.openTestFile(nodes || tree.selectedNodes, onlyWhenOpen);
        }
        
        function skip(nodes, callback) {
            if (typeof nodes == "function")
                callback = nodes, nodes = null;
            
            if (!nodes) nodes = tree.selectedNodes;
            
            all.skip(nodes, callback);
        }
        
        function remove(nodes, callback) {
            if (typeof nodes == "function")
                callback = nodes, nodes = null;
            
            if (!nodes) nodes = tree.selectedNodes;
            
            all.remove(nodes, callback);
        }
        
        function clear() {
            plugin.hide();
            
            failNode.items.length = 0;
            passNode.items.length = 0;
            errNode.items.length = 0;
            skipNode.items.length = 0;
            
            state = {};
            tree.refresh();
        }
        
        function recalc() {
            var maxHeight = Math.round(test.aml.getHeight() * 0.6);
            var cells = tree.container.querySelector(".ace_tree_cells").lastChild;
            
            var newHeight = Math.min(maxHeight, cells.scrollHeight 
                + tree.container.parentNode.offsetTop + 20);
            
            if (newHeight != plugin.height) {
                plugin.height = newHeight;
                test.resize();
            }
        }
        
        // Calculate the index of the 
        function calcIndex(group, node) {
            var pitems = node.parent.items;
            var idx = pitems.indexOf(node);
            var pass = node.passed;
            // if (node.label.indexOf("without") > -1) debugger;
            var found = 0;
            for (var i = idx; i >= 0; i--) {
                if (pitems[i].passed != pass) continue;
                
                group.some(function(n, j) { 
                    if (n.label == pitems[i].label) {
                        found = j + 1;
                        return true; 
                    }
                });
                if (found) return found;
            }
            return found;
        }
        
        function clearResult(node) {
            (function _(items) {
                for (var i = items.length - 1; i >= 0; i--) {
                    if (items[i].label == node.label)
                        items.splice(i, 1);
                    else if (items[i].items)
                        _(items[i].items);
                }
            })(tree.root.items);
            
            tree.refresh();
        }
        
        function handleResult(node) {
            var nodes = [failNode, passNode, errNode, termNode, skipNode];
            var results = [failNode.items, passNode.items, errNode.items, termNode.items, skipNode.items];
            
            node.fixParents();
            
            clearResult(node);
            importResultsToTree(node, results);
            
            var hasFail = results[0].length || results[2].length;
            
            rootNode.items.length = 0;
            [0, 2, 3, 1, 4].forEach(function(i) {
                if (results[i].length) {
                    rootNode.items.push(nodes[i]);
                    
                    if (settings.getBool("user/test/@collapsegroups") && (i === 1 || i === 4))
                        nodes[i].isOpen = !hasFail;
                }
            });
            
            if (rootNode.items.length)
                plugin.show();
                
            tree.refresh();
        }
        
        function importResultsToTree(node, results, force) {
            if (!results.found) results.found = 0;
            
            if (node.type == "test" || node.type == "prepare" || force) {
                if (node.passed === undefined) return;
                
                var group = results[node.passed];
                results.found++;
                
                var loop = node, parentList = [node];
                while (loop.type != "file") {
                    loop = loop.parent;
                    parentList.push(loop);
                }
                
                (function recur(pNode, group, name) {
                    if (!pNode) return;
                    
                    var groupNode;
                    if (!group.some(function(n) {
                        if (n.label == pNode.label) {
                            groupNode = n;
                            return true;
                        }
                    })) {
                        groupNode = pNode.clone(true);
                        
                        if (groupNode.type == "file") {
                            group.unshift(groupNode);
                            groupNode.runner = pNode.runner || pNode.parent 
                                && pNode.parent.runner;
                        }
                        else
                            group.splice(calcIndex(group, pNode), 0, groupNode);
                        
                        groupNode.children =
                        groupNode.items = [];
                        
                        if (groupNode.type == "file")
                            groupNode.isOpen = !(node.passed === 1 || node.passed === 4);
                    }
                    else {
                        var items = groupNode.items;
                        var isOpen = groupNode.isOpen;
                        util.extend(groupNode.data, pNode.data);
                        
                        groupNode.isOpen = isOpen;
                        groupNode.children = 
                        groupNode.items = items;
                    }
                    
                    // delete groupNode.isSelected;
                    groupNode.passed = node.passed;
                    
                    if (groupNode.type == "test" || groupNode.type == "prepare") {
                        var cachedNode = state[name + " " + groupNode.label];
                        if (cachedNode && cachedNode.passed != groupNode.passed) {
                            do {
                                if (!cachedNode.parent) break;
                                cachedNode.parent.items.remove(cachedNode);
                                cachedNode = cachedNode.parent;
                            } while (!cachedNode.items.length && cachedNode.type != "result");
                        }
                        state[name + " " + groupNode.label] = groupNode;
                    }
                    
                    recur(parentList.pop(), groupNode.items, (name ? name + " " : "") + groupNode.label);
                })(parentList.pop(), group, "");
            }
            else {
                node.items.forEach(function(n) {
                    importResultsToTree(n, results);
                });
                
                if (node.type == "file" && node.ownPassed && !results.found)
                    importResultsToTree(node, results, true);
            }
        }
        
        function run(nodes, options, callback) {
            if (nodes && !Array.isArray(nodes))
                callback = options, options = nodes, nodes = null;
            
            if (typeof options == "function")
                callback = options, options = null;
            
            if (!nodes)
                nodes = tree.selectedNodes;
            
            all.run(nodes, options, callback);
        }
        
        function stop(callback) {
            all.stop(callback);
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("draw", function(e) {
            draw(e);
        });
        plugin.on("show", function(e) {
            test.resize();
        });
        plugin.on("hide", function(e) {
            test.resize();
        });
        plugin.on("unload", function() {
            drawn = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * This is an example of an implementation of a plugin. Check out [the source](source/template.html)
         * for more information.
         * 
         * @class Template
         * @extends Plugin
         * @singleton
         */
        plugin.freezePublicAPI({
            /**
             * @property {Object}  The tree implementation
             * @private
             */
            get tree() { return tree; },
            
            /**
             * 
             */
            run: run,
            
            /**
             * 
             */
            stop: stop,
            
            /**
             * 
             */
            clear: clear,
            
            /**
             * 
             */
            skip: skip,
            
            /**
             * 
             */
            remove: remove,
            
            /**
             * 
             */
            findFileByPath: all.findFileByPath
        });
        
        register(null, {
            "test.results": plugin
        });
    }
});