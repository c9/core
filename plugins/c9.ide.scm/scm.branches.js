define(function(require, exports, module) {
    main.consumes = [
        "Panel", "Menu", "MenuItem", "Divider", "settings", "ui", "c9", 
        "watcher", "panels", "util", "save", "preferences", "commands", "Tree",
        "tabManager", "layout", "preferences.experimental", "scm", "util",
        "dialog.alert", "dialog.confirm", "dialog.localchanges", "console"
    ];
    main.provides = ["scm.branches"];
    return main;
    
    function main(options, imports, register) {
        var Panel = imports.Panel;
        var Tree = imports.Tree;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        var settings = imports.settings;
        var ui = imports.ui;
        var c9 = imports.c9;
        var tabManager = imports.tabManager;
        var cnsl = imports.console;
        // var watcher = imports.watcher;
        var util = imports.util;
        // var panels = imports.panels;
        // var util = imports.util;
        // var save = imports.save;
        // var layout = imports.layout;
        var scmProvider = imports.scm;
        // var prefs = imports.preferences;
        // var commands = imports.commands;
        var experimental = imports["preferences.experimental"];
        var alert = imports["dialog.alert"].show;
        var confirm = imports["dialog.confirm"].show;
        var showLocalChanges = imports["dialog.localchanges"].show;
        
        var async = require("async");
        var timeago = require("timeago");
        var escapeHTML = require("ace/lib/lang").escapeHTML;
        
        /*
            TODO:
            - Add loading state when doing actions on branches
            - Sort current branch to the top of the list
            - Sort current user to the top of the list
            - Do not rename remote branches (single click)
            - Check out remote branches should show locally
            - 
        */
        
        /***** Initialization *****/
        
        var ENABLED = experimental.addExperiment("git", !c9.hosted, "Panels/Source Control Management");
        if (!ENABLED)
            return register(null, { "scm.branches": {}});
        
        var plugin = new Panel("Ajax.org", main.consumes, {
            index: options.index || 350,
            caption: "Branches",
            minWidth: 130,
            where: options.where || "left"
        });
        var emit = plugin.getEmitter();
        
        var RECENT_THRESHOLD = 14 * 24 * 60 * 60 * 1000; // 2 weeks ago
        var ITEM_THRESHOLD_LOCAL = 5;
        var ITEM_THRESHOLD_REMOTE = 10;
        
        var ICON_PERSON = require("text!./icons/person.svg");
        var ICON_BRANCH = require("text!./icons/git-branch.svg");
        var ICON_PULLREQUEST = require("text!./icons/git-pull-request.svg");
        var ICON_TAG = require("text!./icons/git-tag.svg");
        var REMOTES = {};
        var CURBRANCH;
        
        var branchesTree, lastData;
        var displayMode = "branches";
        var mnuSettings, btnSettings;
        // var workspaceDir = c9.workspaceDir; // + "/plugins/c9.ide.scm/mock/git";
        var ready, scm;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            plugin.setCommand({
                name: "branches",
                hint: "Version Branches",
                bindKey: { mac: "", win: "" },
                extra: function(editor, args, e) {
                    
                }
            });
            
            settings.on("read", function() {
                settings.setDefaults("project/scm", [["primary", '["origin/master"]']]);
                settings.setDefaults("user/scm", [["showauthor", [false]]]); // TODO this doesn't actually work
                settings.setDefaults("state/scm", [["branches-display-mode", "branches"]]);
                
                displayMode = settings.get("state/scm/@branches-display-mode");
            });
            
            settings.on("user/scm/@showauthor", function() {
                plugin.on("draw", function() {
                    var showAuthor = settings.getBool("user/scm/@showauthor");
                    
                    branchesTree.container.className = 
                        branchesTree.container.className.replace(/ showAuthorName/, "");
                        
                    if (showAuthor) 
                        branchesTree.container.className += " showAuthorName";
                });
            });
            
            scmProvider.on("scm", function(implementation) {
                scm = implementation;
                
                if (plugin.active) 
                    refresh();
            }, plugin);
            
            plugin.once("show", function() {
                if (!ready) refresh();
            });
        }
        
        var drawn = false;
        function draw(opts) {
            if (drawn) return;
            drawn = true;
            
            var mnuFilter = Menu({ items: [
                new MenuItem({ type: "radio", caption: "Branches", value: "branches", selected: displayMode == "branches" }),
                new MenuItem({ type: "radio", caption: "Committer", value: "committer", selected: displayMode == "committer" })
            ]}, plugin);
            mnuFilter.on("itemclick", function(e) {
                settings.set("state/scm/@branches-display-mode", e.value);
                
                button.$caption.innerHTML = (e.value == "branches"
                    ? ICON_BRANCH
                    : ICON_PERSON) + e.item.caption + "<span> </span>";
                displayMode = e.item.value;
                
                if (displayMode == "branches")
                    showBranches();
                else
                    showCommitters();
            });
            
            var codebox = new ui.codebox({
                realtime: "true",
                skin: "codebox",
                class: "branch-filter",
                "initial-message": "Filter Branches",
                clearbutton: "true",
                focusselect: "true",
                singleline: "true",
                style: "flex:1"
            });
            var container = new ui.bar({ 
                style: "position:absolute;left:0;right:0;bottom:0;top:47px;"
            });
            var button = new ui.button({
                caption: "Branches",
                skin: "btn-switcher",
                submenu: mnuFilter.aml
            });
            var hbox = new ui.hbox({
                height: 27,
                left: 10,
                top: 10,
                right: 10,
                childNodes: [codebox, button]
            });
            
            opts.aml.appendChild(hbox);
            opts.aml.appendChild(container);
            
            button.$caption = button.oCaption.parentNode;
            button.$caption.innerHTML = (displayMode == "branches"
                ? ICON_BRANCH
                : ICON_PERSON) + displayMode.uCaseFirst() + "<span> </span>";
            
            var mnuContext = new Menu({ items: [
                new MenuItem({ caption: "Checkout...", onclick: function() {
                    checkout(branchesTree.selectedNode);
                }, isAvailable: function() {
                    return branchesTree.selectedNodes.length == 1
                        && branchesTree.selectedNode.hash;
                } }),
                new MenuItem({ caption: "Delete", onclick: function() {
                    var nodes = branchesTree.selectedNodes;
                    removeBranches(nodes);
                }, isAvailable: function() {
                    var node = branchesTree.selectedNode;
                    return node 
                        && (node.hash && node.path !== CURBRANCH
                        || node.parent.isRemote ? true : false);
                } }),
                new MenuItem({ caption: "Rename", onclick: function() {
                    branchesTree.startRename(branchesTree.selectedNode);
                }, isAvailable: function() {
                    var node = branchesTree.selectedNode;
                    return branchesTree.selectedNodes.length == 1
                      && node.path && node.path.match(/^refs\/heads/);
                } }),
                new Divider(),
                new MenuItem({ caption: "Create Branch", onclick: function() {
                    newBranch(branchesTree.selectedNode);
                }, isAvailable: function() {
                    return branchesTree.selectedNodes.length == 1
                        && branchesTree.selectedNode.hash;
                } }),
                // new MenuItem({ caption: "Create Pull Request" }),
                new MenuItem({ caption: "Create Workspace", onclick: function() {
                    
                }, isAvailable: function() {
                    return branchesTree.selectedNodes.length == 1
                        && branchesTree.selectedNode.hash;
                } }),
                new Divider(),
                new MenuItem({ caption: "Show In Version Log", onclick: function() {
                    showBranchInLog(branchesTree.selectedNode);
                }, isAvailable: function() {
                    return branchesTree.selectedNodes.length == 1
                        && branchesTree.selectedNode.hash;
                } }),
                new MenuItem({ caption: "Compare", onclick: function() {
                    showCompareView(branchesTree.selectedNode.path);
                }, isAvailable: function() {
                    return branchesTree.selectedNodes.length == 1
                        && branchesTree.selectedNode.hash;
                } })
                // new Divider(),
                // new MenuItem({ caption: "Merge Into Current Branch" })
            ]}, plugin);
            container.setAttribute("contextmenu", mnuContext.aml);

            branchesTree = new Tree({
                container: container.$int,
                scrollMargin: [0, 10],
                theme: "filetree branches"
                    + (settings.getBool("user/scm/@showauthor") ? " showAuthorName" : ""),
                enableRename: true,
                enableVariableHeight: true,
                    
                isLoading: function() {},
                
                getIconHTML: function(node) {
                    if (node.isFolder || !node.path || !node.subject) return "";
                    
                    if (node.status == "loading")
                        return "<span class='filetree-icon'></span>";
                    
                    var icon;
                    if (node.path.indexOf("refs/tags/") === 0)
                        icon = ICON_TAG;
                    else if (node.parent.parent == pullRequests)
                        icon = ICON_PULLREQUEST;
                    else
                        icon = ICON_BRANCH; // todo diff between local, remote, stash
                    
                    return "<span class='filetree-icon'>" + icon + "</span>";
                },
                
                getCaptionHTML: function(node) {
                    var name;
                    if (branchesTree.filterKeyword && node.path && !node.parent.parent 
                      || node.path && displayMode == "committer")
                        name = node.path.replace(/^refs\//, "");
                    else
                        name = node.label || node.name;
                    
                    if (node.type == "user")
                        return "<img src='" 
                            + util.getGravatarUrl(node.email.replace(/[<>]/g, ""), 32, "") 
                            + "' width='16' height='16' />" 
                            + escapeHTML(node.label) 
                            + " (" + node.children.length + ")";
                    
                    if (node.isRemote) {
                        return "remotes <span class='remote-button'>Add Remote</span>";
                    }
                    
                    if (node.parent.isRemote) {
                        return escapeHTML(name) + " [" 
                            + (REMOTES[name] || "") + "]";
                    }
                    
                    if (node.authorname) {
                        return escapeHTML(name)
                            + "<span class='author'><img src='" 
                            + util.getGravatarUrl(node.authoremail.replace(/[<>]/g, ""), 32, "") 
                            + "' width='16' height='16' />" 
                            + escapeHTML(node.authorname) + "</span>"
                            + "<span class='extrainfo'> - " 
                            + (node.date ? timeago(node.date) : "") + "</span>";
                    }
                    
                    return escapeHTML(name);
                },
                
                getTooltipText: function(node) {
                    return node.authorname
                        ? "[" + node.hash + "] " + node.authorname + " - " + node.subject
                        : "";
                },
                
                getRowIndent: function(node) {
                    return displayMode == "committer" //branchesTree.filterKeyword || 
                        ? node.$depth
                        : node.$depth ? node.$depth - 1 : 0;
                },
                
                getItemHeight: function(node, index) {
                    if (node.className == "heading first") return 27;
                    if (node.className == "heading") return 35;
                    return this.rowHeight;
                },
                
                getEmptyMessage: function() {
                    return branchesTree.filterKeyword
                        ? "No branches found for '" + branchesTree.filterKeyword + "'"
                        : (branchesTree.emptyMessage || "Loading...");
                },
                
                getClassName: function(node) {
                    return (node.className || "") 
                        + (node.path == CURBRANCH ? " current" : "")
                        + (node.status == "loading" ? " loading" : "");
                },
                
                sort: function(children) {
                    if (!children.length)
                        return;
                    
                    var compare = branchesTree.model.alphanumCompare;
                    
                    if (children[0].type == "user")
                        return children.sort(function(a, b) {
                            if (a.label == "[None]") return 1;
                            if (b.label == "[None]") return -1;
                            return compare(a.label + "", b.label + "");
                        });
                    
                    return children.sort(function(a, b) {
                        if (a.isFolder) return 0;
                        
                        if (a.path == CURBRANCH) return -1;
                        if (b.path == CURBRANCH) return 1;
                        
                        if (a.authorname && !b.authorname)
                            return -1;
                        if (b.authorname && !a.authorname)
                            return 1;
                
                        return a.date - b.date;
                    });
                }
            }, plugin);
            
            branchesTree.renderer.scrollBarV.$minWidth = 10;
            
            branchesTree.on("afterChoose", function(e) {
                var node = branchesTree.selectedNode;
                if (!node) return;
                
                if (node.showall) {
                    expand(node.parent);
                }
                else if (node.showall === false) {
                    collapse(node.parent);
                }
                else if (node.path) {
                    showBranchInLog(node);
                    // showCompareView(node.path);
                }
            });
            
            branchesTree.on("beforeRename", function(e) {
                if (!e.node.path || !e.node.path.match(/^refs\/(?:heads|remotes)/) 
                  || e.node.path == CURBRANCH)
                    return e.preventDefault();
            });
            branchesTree.on("afterRename", function(e) {
                // TODO Test if branch exists. If it does, warn user and do nothing
                // TODO Check for illegal characters
                
                var base = e.node.path.match(/^refs\/(?:remotes\/[^\/]+|heads)/)[0];
                var newPath = base + "/" + e.value;
                
                scm.renameBranch(e.node.path, newPath, function(err) {
                    if (err) return;
                    
                    e.node.name =
                    e.node.label = e.value;
                    e.node.path = newPath;
                    branchesTree.refresh();
                });
            });
            
            var remoteName, remoteURI;
            var remoteMenu = new ui.menu({
                width: 400,
                height: 86,
                style: "padding:0",
                childNodes: [
                    new ui.hsplitbox({
                        height: 20,
                        edge: 10,
                        padding: 10,
                        childNodes: [
                            remoteName = new ui.textbox({ width: "100", "initial-message": "Name" }),
                            remoteURI = new ui.textbox({ "initial-message": "URL" })
                        ]
                    }),
                    new ui.button({
                        caption: "Add Remote",
                        skin: "btn-default-css3",
                        class: "btn-green",
                        right: 10,
                        bottom: 10,
                        onclick: function() {
                            if (!remoteName.getValue() || !remoteURI.getValue() || REMOTES[name])
                                return;
                            
                            remoteMenu.disable();
                            
                            var name = remoteName.getValue();
                            var url = remoteURI.getValue();
                            
                            scm.addRemote(name, url, function(err) {
                                remoteMenu.enable();
                                
                                if (err) {
                                    return alert("Could Not Add Remote",
                                        "Received Error While Adding Remote",
                                        err.message || err);
                                }
                                
                                REMOTES[name] = url;
                                
                                remoteName.clear();
                                remoteURI.clear();
                                remoteMenu.hide();
                                
                                var node = nodeRemote.map[name] = {
                                    label: name,
                                    path: "remotes/" + name
                                };
                                nodeRemote.children.push(node);
                                branchesTree.refresh();
                                
                                refresh();
                            });
                        }
                    })
                ]
            });
            
            container.$int.addEventListener("click", function(e) {
                if (e.target.className == "remote-button") {
                    var b = e.target.getBoundingClientRect();
                    remoteMenu.display(b.left, b.top + b.height);
                }
            });
            
            function forwardToTree() {
                branchesTree.execCommand(this.name);
            }
            codebox.ace.on("input", function() {
                 branchesTree.filterKeyword = codebox.ace.getValue();
            });
            codebox.ace.commands.addCommands([
                "centerselection",
                "goToStart",
                "goToEnd",
                "pageup",
                "gotopageup",
                "pagedown",
                "gotopageDown",
                "scrollup",
                "scrolldown",
                "goUp",
                "goDown",
                "selectUp",
                "selectDown",
                "selectMoreUp",
                "selectMoreDown"
            ].map(function(name) {
                var command = branchesTree.commands.byName[name];
                return {
                    name: command.name,
                    bindKey: command.editorKey || command.bindKey,
                    exec: forwardToTree
                };
            }));
            
            refresh();
            
            mnuSettings = new Menu({ items: [
                new MenuItem({ caption: "Refresh", onclick: refresh }, plugin),
                new Divider(),
                new MenuItem({ caption: "Remove Local Merged Branches", onclick: function() {
                    scm.removeAllLocalMerged(function() {
                        refresh();
                    });
                } }, plugin),
                new Divider(),
                new MenuItem({ caption: "Show Author Name", type: "check", checked: "user/scm/@showauthor" }, plugin)
            ]}, plugin);
            
            btnSettings = opts.aml.appendChild(new ui.button({
                skin: "header-btn",
                class: "panel-settings changes",
                submenu: mnuSettings.aml
            }));
            
            // Mark Dirty
            // plugin.on("show", function() {
            //     save.on("afterSave", markDirty);
            //     watcher.on("change", markDirty);
            // });
            // plugin.on("hide", function() {
            //     clearTimeout(timer);
            //     save.off("afterSave", markDirty);
            //     watcher.off("change", markDirty);
            // });
            
            // watcher.watch(util.normalizePath(workspaceDir) + "/.git");
            
            // var timer = null;
            // function markDirty(e) {
            //     clearTimeout(timer);
            //     timer = setTimeout(function() {
            //         if (tree && tree.meta.options && !tree.meta.options.hash) {
            //             tree.meta.options.force = true;
            //             emit("reload", tree.meta.options);
            //         }
            //     }, 800);
            // }
        }
        
        /***** Methods *****/
        
        var recentLocal = {
            label: "recent local branches",
            className: "heading first",
            children: [],
            isOpen: true,
            isFolder: true,
            noSelect: true,
            $sorted: true
        };
        var primaryRemote = {
            label: "primary remote branches",
            className: "heading",
            children: [],
            isOpen: true,
            isFolder: true,
            noSelect: true,
            $sorted: true
        };
        var pullRequests = {
            label: "pull requests",
            className: "heading",
            isPR: true,
            children: [
                {
                    label: "Open",
                    children: [],
                    isOpen: true,
                    isFolder: true
                },
                {
                    label: "Closed",
                    children: [],
                    isOpen: false,
                    isFolder: true
                }
            ],
            isOpen: true,
            isFolder: true,
            map: {},
            noSelect: true,
            $sorted: true
        };
        var recentActive = {
            label: "recently active",
            className: "heading",
            children: [],
            isOpen: true,
            isFolder: true,
            map: {},
            noSelect: true,
            $sorted: true
        };
        var all = {
            label: "all",
            className: "heading",
            children: [],
            isOpen: true,
            isFolder: true,
            noSelect: true,
            $sorted: true
        };
        var branchesRoot = { 
            path: "",
            children: [recentLocal, primaryRemote, pullRequests, recentActive, all]
        };
        var committersRoot = { 
            path: "",
            children: []
        };
        
        var nodeRemote;
        function loadBranches(data) {
            if (!data || data.length == 1 && !data[0].hash) 
                return purgeTree();
            
            var root = branchesRoot;
            root.children.forEach(function(n) {
                if (n.isPR) {
                    n.children[0].children.length = 0;
                    n.children[1].children.length = 0;
                    n.children[0].map = {};
                    n.children[1].map = {};
                }
                else {
                    n.children.length = 0;
                    n.map = {};
                }
            });
            root.map = {};
            
            // Store all branches in all
            data.forEach(function(x) {
                var parts = parseRawBranch(x);
                addToAll(parts, x);
            });
            
            // Check for empty remotes
            if (!nodeRemote) {
                nodeRemote = { label: "remotes", isOpen: true, map: {}, children: []};
                all.children.push(nodeRemote);
                all.map["remotes"] = nodeRemote;
            }   
            
            for (var name in REMOTES) {
                if (!nodeRemote.map[name]) {
                    var node = nodeRemote.map[name] = {
                        label: name,
                        path: "remotes/" + name
                    };
                    nodeRemote.children.push(node);
                }
            }
            
            // Sort by date
            data.sort(function(a, b) { return b.date - a.date; });
            
            var local = [], remote = [], threshold = Date.now() - RECENT_THRESHOLD;
            for (var i = 0, l = data.length; i < l; i++) {
                var x = data[i];
                if (x.date < threshold) continue;
                if (x.path.indexOf("refs/remotes") === 0 && !isPrimary(x.path))
                    remote.push(copyNode(x));
                else if (x.path.indexOf("refs/heads") === 0)
                    local.push(copyNode(x));
            }
            
            // TODO add current branch to top of recent local and make bold
            // TODO in committers view move current user to the top and auto expand, show current branch in bold
            
            recentLocal.limit = ITEM_THRESHOLD_LOCAL;
            recentLocal.cache = local;
            local.sort(function(a, b) { return b.date - a.date; });
            
            recentActive.limit = ITEM_THRESHOLD_REMOTE;
            recentActive.cache = remote;
            remote.sort(function(a, b) { return b.date - a.date; });
            
            updateTreeState();
        }
        
        function isPrimary(path) {
            var primary = ["origin/master"]; //TODO settings.getJson("project/scm/@primary");
            return ~primary.indexOf(path.replace(/^refs\/remotes\//, ""));
        }
        
        function copyNode(x) {
            var y = util.extend({ className: "root-branch" }, x);
            y.name = x.path.replace(/^refs\/(?:(?:remotes|tags|heads)\/)?/, "");
            return y;
        }
        
        function parseRawBranch(x) {
            x.date = parseInt(x.committerdate) * 1000;
            x.path = x.name;
            
            var parts = x.path.replace(/^refs\//, "").split("/");
            x.name = parts.pop(); // disregard the name
            
            if (parts[0] == "remotes") {
                if (isPrimary(x.path))
                    primaryRemote.children.push(copyNode(x));
            }
            
            return parts;
        }
        
        function addToAll(parts, x) {
            var node = all;
            parts.forEach(function(p) {
                var items = node.children || (node.children = []);
                var map = node.map || (node.map = {});
                if (map[p]) node = map[p];
                else {
                    node = map[p] = {
                        label: p,
                        path: (node.path || "") + p + "/"
                    };
                    if (p == "remotes") {
                        node.isOpen = true;
                        node.isRemote = true;
                        nodeRemote = node;
                    }
                    items.push(node);
                }
            });
            var items = node.children || (node.children = []);
            var map = node.map || (node.map = {});
            map[x.name] = x;
            items.push(x);
        }
        
        function updateTreeState() {
            var n, cur, isOpen, isOverflow, local, remote;
            
            local = recentLocal.cache;
            cur = recentLocal.children;
            isOpen = cur.length && cur[cur.length - 1].showall === false;
            isOverflow = local.length > ITEM_THRESHOLD_LOCAL;
            
            if (!isOverflow) 
                recentLocal.children = local.slice();
            else if (isOpen) {
                n = { showall: false, label: "Show Less..." };
                recentLocal.children = local.slice();
                recentLocal.children.push(n);
            }
            else {
                n = { showall: true, label: "Show All (" + local.length + ")..." };
                recentLocal.children = local.slice(0, ITEM_THRESHOLD_LOCAL);
                recentLocal.children.push(n);
            }
            
            remote = recentActive.cache;
            cur = recentActive.children;
            isOpen = cur.length && cur[cur.length - 1].showall === false;
            isOverflow = remote.length > ITEM_THRESHOLD_REMOTE;
            
            if (!isOverflow) 
                recentActive.children = remote.slice();
            else if (isOpen) {
                n = { showall: false, label: "Show Less..." };
                recentActive.children = remote.slice();
                recentActive.children.push(n);
            }
            else {
                n = { showall: true, label: "Show All (" + remote.length + ")..." };
                recentActive.children = remote.slice(0, ITEM_THRESHOLD_REMOTE);
                recentActive.children.push(n);
            }
            
            // Remove empty blocks
            purgeTree();
            
            // Reset committers root
            committersRoot.children.length = 0;
        }
        
        function purgeTree() {
            branchesRoot.children = branchesRoot.children.filter(function(n) {
                if (n == all) return true;
                if (n.isPR) return n.children[0].length + n.children[1].length;
                return n.children.length;
            });
        }
        
        function showBranches() {
            branchesTree.filterProperty = "path";
            branchesTree.filterRoot = lastData;
            branchesTree.setRoot(branchesRoot.children);
        }
        function showCommitters() {
            if (!ready) return plugin.once("ready", showCommitters);
            
            if (!committersRoot.children.length) {
                var data = lastData;
                var users = {}, emails = {};
                data.forEach(function(x) {
                    var user = x.authorname || "[None]";
                    if (!emails[user]) emails[user] = x.authoremail;
                    (users[user] || (users[user] = [])).push(x);
                });
                for (var user in users) {
                    committersRoot.children.push({
                        label: user,
                        authorname: user,
                        email: emails[user],
                        type: "user",
                        children: users[user],
                        clone: function() { 
                            var x = function() {};
                            x.prototype = this;
                            var y = new x();
                            y.keepChildren = true;
                            y.isOpen = true;
                            return y;
                        }
                    });
                }
            }
            
            branchesTree.filterProperty = "authorname";
            branchesTree.filterRoot = committersRoot.children;
            branchesTree.setRoot(committersRoot.children);
        }
        
        function refresh() {
            if (!scm) {
                branchesTree.setRoot(null);
                branchesTree.emptyMessage = "No repository detected";
                return;
            }
            
            async.parallel([
                function (next) {
                    scm.listAllRefs(function(err, data) {
                        lastData = data;
                        next(err);
                    });
                },
                function (next) {
                    scm.getRemotes(function(err, remotes) {
                        if (!err) REMOTES = remotes;
                        next();
                    });
                },
                function (next) {
                    scm.getCurrentBranch(function(err, branch) {
                        if (!err) CURBRANCH = "refs/heads/" + branch;
                        next();
                    });
                }
            ], function(err) {
                // if (!REMOTES["test"]) debugger;
                
                if (err) {
                    branchesTree.emptyMessage = "Error while loading\n" + escapeHTML(err.message);
                    branchesTree.setRoot(null);
                    return console.error(err);
                }
                
                ready = true;
                loadBranches(lastData);
                
                if (displayMode == "branches")
                    showBranches();
                else
                    showCommitters();
                    
                emit("ready");
            });
        }
        
        function resolveLocalChanges(callback, onCancel) {
            showLocalChanges(null, 
                // Stash
                function() {
                    scm.stash(function(err) {
                        if (err) {
                            onCancel();
                            return alert("Could Not Stash Branch",
                                "Received Error While Stashing Changes",
                                err.message || err);
                        }
                        
                        callback();
                    });
                }, 
                // Discard
                function() {
                    scm.resetHard(function(err) {
                        if (err) {
                            onCancel();
                            return alert("Could Not Discard Changes",
                                "Received Error While Discarding Changes",
                                err.message || err);
                        }
                        
                        callback();
                    });
                }, 
                // Cancel
                function() {
                    // Do Nothing
                    onCancel();
                });
        }
        
        function checkout(node) {
            setLoading(node);
            
            scm.checkout(node.path, function cb(err) {
                if (err && err.code == scm.errors.LOCALCHANGES) {
                    resolveLocalChanges(function() {
                        scm.checkout(node.path, cb);
                    }, function() {
                        clearLoading(node);
                    });
                    return;
                }
                
                clearLoading(node);
                
                if (err) {
                    return alert("Could Not Checkout Branch",
                        "Received Error While Checking out Branch",
                        err.message || err);
                }
                
                CURBRANCH = node.path;
                
                branchesTree.refresh();
            });
        }
        
        function removeBranches(nodes) {
            nodes.forEach(function(node) {
                if (node.path == CURBRANCH) return;
                
                if (node.parent.isRemote)
                    return removeRemote(node);
                
                confirm("Delete Branch",
                    "Are you sure you want to delete '" + node.name + "'",
                    "Click OK to delete this branch or click Cancel to cancel this action.",
                    function() {
                        setLoading(node);
                        scm.removeBranch(node.path, function(err) {
                            clearLoading(node);
                            
                            if (err) {
                                return alert("Could Not Remove Branch",
                                    "Received Error While Removing Branch",
                                    err.message || err);
                            }
                            
                            if (node.parent.map)
                                delete node.parent.map[node.label];
                            if (node.parent.cache)
                                node.parent.cache.remove(node);
                            node.parent.children.remove(node);
                            
                            updateTreeState();
                            
                            branchesTree.refresh();
                        });
                    }, 
                    function() {});
            });
        }
        
        function findNewName(c) {
            var name = "refs/heads/newbranche" + (c || "");
            if (all.map.heads.children.some(function(n) { return n.path == name; }))
                return findNewName(2);
            return name;
        }
        
        function newBranch(node) {
            var name = findNewName();
            
            setLoading(node);
            scm.addBranch(name, node.path, function(err) {
                if (err) {
                    clearLoading(node);
                    return alert("Could Not Add Branch",
                        "Received Error While Adding Branch",
                        err.message || err);
                }
                
                updateBranch(name, null, function(err, newNode) {
                    clearLoading(node);
                    
                    if (err) console.error(err); // TODO
                    
                    if (recentLocal.children.indexOf(newNode) == -1)
                        expand(recentLocal);
                    
                    // Select New Branch
                    branchesTree.select(newNode);
                    
                    // Start renaming New Branch
                    branchesTree.startRename();
                });
            });
        }
        
        function updateBranch(name, node, callback) {
            scm.listRef(name, function(err, data) {
                if (err) return callback(err);
                
                var parts = parseRawBranch(data);
                
                // Existing branch
                if (node) {
                    for (var prop in data) {
                        node[prop] = data[prop];
                    }
                }
                // New branch
                else {
                    // Add to all
                    addToAll(parts, data);
                    
                    if (data.date > Date.now() - RECENT_THRESHOLD) {
                        if (data.path.indexOf("refs/remotes") === 0 && !isPrimary(data.path)) {
                            recentActive.cache.push(node = copyNode(data));
                            recentActive.cache.sort(function(a, b) { return b.date - a.date; });
                        }
                        else if (data.path.indexOf("refs/heads") === 0) {
                            recentLocal.cache.push(node = copyNode(data));
                            recentLocal.cache.sort(function(a, b) { return b.date - a.date; });
                        }
                    }
                    
                    updateTreeState();
                }
                
                branchesTree.refresh();
                
                callback(null, node || data);
            });
        }
        
        function removeRemote(node) {
            confirm("Delete Remote",
                "Are you sure you want to delete '" + node.label + "'",
                "Click OK to delete this remote or click Cancel to cancel this action.",
                function() {
                    setLoading(node);
                    scm.removeRemote(node.label, function(err) {
                        clearLoading(node);
                        
                        if (err) {
                            return alert("Could Not Remove Remote",
                                "Received Error While Removing Remote",
                                err.message || err);
                        }
                        
                        delete REMOTES[name];
                        
                        if (node.parent.map)
                            delete node.parent.map[node.label];
                        node.parent.children.remove(node);
                        branchesTree.refresh();
                    });
                }, 
                function() {});
        }
        
        function expand(node) {
            var more = node.children[node.children.length - 1];
            if (!more || !more.hasOwnProperty("showall")) return;
            node.children = node.cache.slice();
            node.children.push(more);
            more.showall = false;
            more.label = "Show Less...";
            branchesTree.refresh();
        }
        
        function collapse(node) {
            var more = node.children[node.children.length - 1];
            if (!more || !more.hasOwnProperty("showall")) return;
            node.children = node.cache.slice(0, node.limit);
            node.children.push(more);
            more.showall = true;
            more.label = "Show All (" + node.cache.length + ")...";
            branchesTree.refresh();
        }
        
        function openLog(callback) {
            var tabs = tabManager.getTabs();
            var tab;
            if (tabs.some(function(t) { return (tab = t).editorType == "scmlog"; }))
                return callback(null, tabManager.focusTab(tab));
            
            cnsl.show();
            tabManager.open({
                editorType: "scmlog", 
                focus: true,
                pane: cnsl.getPanes()[0]
            }, function(err, tab) {
                callback(err, tab);
            });
        }
        
        function showBranchInLog(node) {
            setLoading(node);
            
            openLog(function(err, tab) {
                if (err) return clearLoading(node);
                
                var editor = tab.editor;
                editor.on("ready", function() {
                    clearLoading(node);
                    editor.showBranch(node.hash);
                });
            });
        }
        
        // function openSelection(opts) {
        //     if (!c9.has(c9.STORAGE))
        //         return;
            
        //     var node = tree.selectedNode;
        //     if (!node || node.isFolder)
        //         return;
            
        //     if (node.parent == conflicts)
        //         return openConflictView(node);
            
        //     var options = tree.meta.options;
        //     var oldPath = node.path;
        //     var newPath = node.originalPath || node.path;
            
        //     var hash = options.hash
        //         ? options.hash + ":"
        //         : (node.parent == staged ? "STAGED:" : "MODIFIED:");
            
        //     var base = options.base
        //         ? options.base + ":"
        //         : (node.parent == staged ? "HEAD:" : "PREVIOUS:");
            
        //     var diffview = {
        //         oldPath: base + oldPath,
        //         newPath: hash + newPath
        //     };
            
        //     var tab = findOpenDiffview(diffview);
        //     if (tab && !(opts && opts.preview)) {
        //         if (tab.document.meta.preview)
        //             tabManager.preview({ cancel: true, keep: true });
        //         else {
        //             opts && opts.preview
        //                 ? tabManager.activateTab(tab)
        //                 : tabManager.focusTab(tab);
        //         }
        //         return;
        //     }
            
        //     tabManager[opts && opts.preview ? "preview" : "open"]({
        //         editorType: "diffview",
        //         focus: true,
        //         document: {
        //             diffview: diffview
        //         }
        //     }, function(){});
        // }
        
        function showCompareView(path) {
            scmProvider.openDiff({
                branch: path,
                compareBranch: "refs/remotes/origin/master"
            });
        }
        
        function setLoading(node) {
            node.status = "loading";
            branchesTree.refresh();
        }
        function clearLoading(node) {
            node.status = "loaded";
            branchesTree.refresh();
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("draw", function(e) {
            draw(e);
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("resize", function() {
            branchesTree && branchesTree.resize();
        });
        plugin.on("show", function onShow(e) {
            branchesTree && setTimeout(branchesTree.resize);
        });
        plugin.on("hide", function(e) {
            
        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
            ready = false;
            nodeRemote = null;
            branchesTree = null;
            lastData = null;
            displayMode = null;
            mnuSettings = null;
            btnSettings = null;
            // workspaceDir = c9.workspaceDir;
        });
        
        /***** Register and define API *****/
        
        plugin.freezePublicAPI({
            get tree() { return branchesTree; }
        });
        
        register(null, {
            "scm.branches": plugin
        });
    }
});