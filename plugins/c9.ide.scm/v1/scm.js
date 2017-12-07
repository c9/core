define(function(require, exports, module) {
    main.consumes = [
        "Panel", "Menu", "MenuItem", "Divider", "settings", "ui", "c9", 
        "watcher", "panels", "util", "save", "preferences", "commands", "Tree",
        "Datagrid", "tabManager", "layout", "preferences.experimental"
    ];
    main.provides = ["scm"];
    return main;
    
    /*
        LEGEND:
            * = done (item should be removed)
            / = half done
            - = not done
    
        # LOW HANGING FRUIT 
            - conflicts
                - save
            - tree
                - add watcher to .git/HEAD
            - fix errors with added/removed files
        
        # TODO
            - commit
                - do dry-run 
                    - add status message for ammend 
                    - display branch to commit to 
                - amend doesnt work
            - pull
                - pull --rebase
            - detail    
                - afterChoose should stage/unstage files instead of opening diff view
                - drag to staged doesnt work sometimes (rowheight issue?)
            - conflicts
                - add commands? detect, next, prev, use 1/ 2 
            - branches
                - Harutyun: Resize properly when expanding/collapsing
                - Harutyun: scrollMargin for left, right and bottom doesn't work (same for log, detail)
                - Use icon
            - log
                - Setting indent to 0 doesn't work
                - Remove arrow in title
            - add discard changes to context menu
            - resize issues
            - hotkeys should show bars in dialog
            - conflicts
                - dark theme (Ruben)
            - toolbar
                / pull (or fetch - split button
                    / add fetch dialog (Ruben)
                        / dropdown for remotes
                        - output
                    - Merge doesn't work (no UI for merge message)
                    - Handle error states
                    - Change to splitbutton with form only shown on arrow
                    - reload of log doesn't work after pull
                / push button - split button
                    / add push dialog (Ruben) 
                        / dropdown for remotes/branches
                        - output
                    - Handle error states
                    - Change to splitbutton with form only shown on arrow
                    - reload of log doesn't work after push
        
        # LATER
            # Ruben
                - Choose Git Path - use file dialog
                    - support multiple git roots
                - Add setting to collapse tree to only see roots
            - tree
                - solve edge line cases
            - Compare view
                - save the right file (use ace session clone)
                - git add the left file 
                - undo doesn't work 
                - scrolling doesn't work well. It should scroll the sides as 
                    slowly as the side with most lines would go when scrolling there
            - conflicts
                - automatically add to staging on save
                - dialog for one deleted and one saved file 
                - undo
            - branches
                - When updating, only do a partial update (maintain selection, expanded state - see test/data/data.js)
                - make a datagrid?
    */
    
    function main(options, imports, register) {
        var Panel = imports.Panel;
        var Tree = imports.Tree;
        var Menu = imports.Menu;
        var Datagrid = imports.Datagrid;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        var settings = imports.settings;
        var ui = imports.ui;
        var c9 = imports.c9;
        var tabs = imports.tabManager;
        var watcher = imports.watcher;
        var panels = imports.panels;
        var util = imports.util;
        var save = imports.save;
        var layout = imports.layout;
        var prefs = imports.preferences;
        var commands = imports.commands;
        var experimental = imports["preferences.experimental"];
        
        // var Tooltip = require("ace_tree/tooltip");
        var DataProvider = require("ace_tree/data_provider");
        var escapeHTML = require("ace/lib/lang").escapeHTML;
        
        /***** Initialization *****/
        
        var ENABLED = experimental.addExperiment("git", !c9.hosted, "Panels/Changes Panel");
        
        if (!ENABLED) {
            return register(null, {
                "scm": {}
            });
        }
        
        var plugin = new Panel("Ajax.org", main.consumes, {
            index: options.index || 350,
            caption: "Changes",
            buttonCSSClass: "changes",
            minWidth: 130,
            autohide: true,
            where: options.where || "left"
        });
        var emit = plugin.getEmitter();
        
        var tree, commitBox, toolbar, ammendCb, commitBtn;
        var mnuBranches, branchesTree, btnBranches;
        
        var scms = {};
        var scm;
        
        var mnuCommit, btnCommit, mnuExecute, barCommit, mnuSettings;
        var btnSettings, container, btnPush, barPush, pushBtn;
        var barPull, btnPull, activeDialog;
        
        var locationBar, locationBox, locationRefreshButton;
        
        var workspaceDir = c9.workspaceDir; // + "/plugins/c9.ide.scm/mock/git";
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            plugin.setCommand({
                name: "changes",
                hint: "Changed Files",
                bindKey: { mac: "", win: "" },
                extra: function(editor, args, e) {
                    
                }
            });
            
            commands.addCommand({
                name: "blame",
                group: "scm",
                exec: function() {
                    var tab = tabs.focussedTab || tabs.getPanes()[0].activeTab;
                    if (!tab || !tab.path || tab.editorType != "ace")
                        return;
                    var blameAnnotation, err, data;
                    var ace = tab.editor.ace;
                    var session = ace.session;
                    require(["../blame"], function(blameModule) {
                        if (ace.session != session)
                            return;
                        blameAnnotation = blameModule.annotate(ace);
                        done();
                    });
                    
                    var path = tab.path;
                    scm.getBlame(path, function(err, blameInfo) {
                        if (err) return console.error(err);
                        data = blameInfo;
                        done();
                    });
                    
                    function done() {
                        if (!blameAnnotation) return;
                        if (data === null) return;
                        
                        blameAnnotation.setData(data);
                    }
                },
                isAvailable: function() {
                    var tab = tabs.focussedTab || tabs.getPanes()[0].activeTab;
                    if (!tab || !tab.path || tab.editorType != "ace")
                        return false;
                    return true;
                }
            }, plugin);
            
            commands.addCommand({
                name: "addall",
                group: "scm",
                exec: function() { addAll(); }
            }, plugin);
            
            commands.addCommand({
                name: "unstageall",
                group: "scm",
                exec: function() { unstageAll(); }
            }, plugin);
            
            commands.addCommand({
                name: "fetch",
                group: "scm",
                exec: function() { fetch(); }
            }, plugin);
            
            commands.addCommand({
                name: "push",
                group: "scm",
                exec: function() { push({}); }
            }, plugin);
            
            commands.addCommand({
                name: "pull",
                group: "scm",
                exec: function() { pull({}); }
            }, plugin);
            
            commands.addCommand({
                name: "commit",
                group: "scm",
                exec: function(editor, args) { 
                    if (args.message) commit(args.message, args.amend);
                    else {
                        panels.activate("changes");
                        barCommit.show();
                    }
                }
            }, plugin);
        }
        
        var drawn = false;
        function draw(opts) {
            if (drawn) return;
            drawn = true;
            
            // Import CSS
            ui.insertCss(require("text!./style.css"), plugin);
            
            // Splitbox
            var vbox = opts.aml.appendChild(new ui.vbox({ 
                anchors: "0 0 0 0" 
            }));
            
            // LocationBar
            locationBar = vbox.appendChild(new ui.bar({
                skin: "toolbar-top",
                class: "fakehbox aligncenter debugger_buttons basic changes",
                style: "white-space:nowrap !important;",
                height: 30
            }));
            plugin.addElement();

            ui.insertByIndex(locationBar, new ui.hsplitbox({
                height: 30,
                childNodes: [
                    locationBox = new ui.textbox({
                        skinset: "default",
                        skin: "codebox",
                        class: "tb_textbox",
                        value: "/",
                        onkeyup: function(event) {
                            if (event.keyCode === 13) {
                                refreshWorkspace();
                            }
                        }
                    }),
                    locationRefreshButton = new ui.button({
                        caption: "Refresh",
                        skinset: "default",
                        skin: "c9-menu-btn",
                        class: "single-button",
                        style: "text-align: center",
                        width: 60,
                        onclick: function() {
                            refreshWorkspace();
                        }
                    })
                ]
            }), 1, plugin);
            
            // Toolbar
            toolbar = vbox.appendChild(new ui.bar({
                skin: "toolbar-top",
                class: "fakehbox aligncenter debugger_buttons basic changes",
                style: "white-space:nowrap !important;"
            }));
            plugin.addElement(toolbar);
            
            barCommit = vbox.appendChild(new ui.bar({
                class: "form-bar",
                visible: false,
                childNodes: [
                    commitBox = new apf.codebox({}),
                    new ui.hbox({
                        padding: 5,
                        childNodes: [
                            ammendCb = new ui.checkbox({ 
                                label: "amend",
                                skin: "checkbox_black",
                                margin: "5 0 0 0"
                            }),
                            new ui.filler(),
                            commitBtn = new ui.button({
                                caption: "Commit",
                                skin: "btn-default-css3",
                                class: "btn-green",
                                margin: "5 0 0 0",
                                onclick: function() {
                                    commitBtn.disable();
                                    commit(commitBox.ace.getValue(), ammendCb.checked, function(err) {
                                        commitBtn.enable();
                                        if (err) return console.error(err);
                                        
                                        ammendCb.uncheck();
                                        commitBox.ace.setValue("");
                                        barCommit.hide();
                                    });
                                }
                            })
                        ]
                    })
                ]
            }));
            
            commitBox.on("DOMNodeInsertedIntoDocument", function() {
                commitBox.ace.setOption("minLines", 2);
                commitBox.ace.commands.addCommand({
                    bindKey: "Esc",
                    exec: function() {
                        btnCommit.hideMenu();
                    }
                });
                commitBox.ace.commands.addCommand({
                    bindKey: "Ctrl-Enter|Cmd-Enter",
                    name: "commit",
                    exec: function(editor) {
                        commands.exec("commit", null, {
                            message: commitBox.ace.getValue(),
                            ammend: ammendCb.checked
                        });
                    }
                });
            });
            
            mnuCommit = new Menu({ items: [
                new MenuItem({ caption: "Add All", command: "addall", tooltip: "git add -u" }, plugin),
                new MenuItem({ caption: "Unstage All", command: "unstageall", tooltip: "git add -u" }, plugin)
            ]});

            btnCommit = ui.insertByIndex(toolbar, new ui.splitbutton({
                caption: "Commit",
                skinset: "default",
                skin: "c9-menu-btn",
                submenu: mnuCommit.aml,
            }), 100, plugin);
            btnCommit.$button1.setAttribute("state", true);
            link(btnCommit.$button1, barCommit, commitBox);
            
            var forceCb, branchBox;
            barPush = vbox.appendChild(new ui.bar({
                class: "form-bar",
                visible: false,
                childNodes: [
                    new ui.hsplitbox({
                        height: 30,
                        align: "center",
                        padding: 3,
                        childNodes: [
                            new ui.label({ caption: "Branch", width: 70, margin: "5 0 0 0" }),
                            branchBox = new apf.codebox()
                        ]
                    }),
                    new ui.hbox({
                        padding: 3,
                        childNodes: [
                            forceCb = new ui.checkbox({ 
                                label: "force",
                                skin: "checkbox_black",
                                margin: "5 0 0 0"
                            }),
                            new ui.filler(),
                            pushBtn = new ui.button({
                                caption: "Push",
                                skin: "btn-default-css3",
                                class: "btn-green",
                                margin: "5 0 0 0",
                                onclick: function() {
                                    pushBtn.disable();
                                    push({
                                        branch: branchBox.ace.getValue(), 
                                        force: forceCb.checked
                                    }, function(err) {
                                        pushBtn.enable();
                                        if (err) return console.error(err);
                                        
                                        // TODO stream output
                                        barPush.hide();
                                    });
                                }
                            })
                        ]
                    })
                ]
            }));
            
            btnPush = ui.insertByIndex(toolbar, new ui.button({
                caption: "Push",
                skinset: "default",
                skin: "c9-menu-btn",
                class: "single-button",
                state: true,
            }), 100, plugin);
            link(btnPush, barPush);
            
            var pruneCb, branchBoxPull, pullBtn, fetchBtn;
            barPull = vbox.appendChild(new ui.bar({
                class: "form-bar",
                visible: false,
                childNodes: [
                    new ui.hsplitbox({
                        height: 30,
                        align: "center",
                        padding: 3,
                        childNodes: [
                            new ui.label({ caption: "Branch", width: 70, margin: "5 0 0 0" }),
                            branchBoxPull = new apf.codebox()
                        ]
                    }),
                    new ui.hbox({
                        padding: 3,
                        childNodes: [
                            pruneCb = new ui.checkbox({ 
                                label: "prune",
                                skin: "checkbox_black",
                                margin: "5 0 0 0"
                            }),
                            new ui.filler(),
                            fetchBtn = new ui.button({
                                caption: "Fetch",
                                skin: "btn-default-css3",
                                class: "btn-green",
                                margin: "5 0 0 0",
                                onclick: function() {
                                    pullBtn.disable();
                                    fetchBtn.disable();
                                    fetch({
                                        branch: branchBoxPull.ace.getValue(), 
                                        prune: pruneCb.checked
                                    }, function(err) {
                                        pullBtn.enable();
                                        fetchBtn.enable();
                                        if (err) return console.error(err);
                                        
                                        // TODO stream output
                                        barPull.hide();
                                    });
                                }
                            }),
                            pullBtn = new ui.button({
                                caption: "Pull",
                                skin: "btn-default-css3",
                                class: "btn-green",
                                margin: "5 0 0 0",
                                onclick: function() {
                                    pullBtn.disable();
                                    fetchBtn.disable();
                                    pull({
                                        branch: branchBoxPull.ace.getValue(), 
                                        prune: pruneCb.checked
                                    }, function(err) {
                                        pullBtn.enable();
                                        fetchBtn.enable();
                                        if (err) return console.error(err);
                                        
                                        // TODO stream output
                                        barPull.hide();
                                    });
                                }
                            })
                        ]
                    })
                ]
            }));
            
            btnPull = ui.insertByIndex(toolbar, new ui.button({
                caption: "Pull",
                skinset: "default",
                skin: "c9-menu-btn",
                class: "single-button",
                state: true
            }), 100, plugin);
            link(btnPull, barPull);
            
            function link(btn, bar, main) {
                btn.bar = bar;
                bar.button = btn;
                btn.onclick = function() {
                    if (bar.visible) {
                        bar.hide();
                    }
                    else {
                        bar.show();
                        if (main) main.focus();
                    }
                };
                bar.on("prop.visible", updateActiveDialog);
            }
            function updateActiveDialog(e) {
                if (e.value) {
                    if (activeDialog && activeDialog != this)
                        activeDialog.hide();
                    activeDialog = this;
                } else if (activeDialog == this) {
                    activeDialog = null;
                }
                this.button.setAttribute("value", e.value);
            }
            
            mnuBranches = new ui.menu({ width: 500, style: "padding:0" });
            mnuBranches.on("prop.visible", function(e) {
                if (e.value) {
                    if (!branchesTree) {
                        branchesTree = new Datagrid({
                            container: mnuBranches.$int,
                            scrollMargin: [0, 0],
                            theme: "blackdg",
                            isLoading: function() {},
    
                            getEmptyMessage: function() {
                                if (!this.keyword)
                                    return this.isLoading()
                                        ? "Loading file list. One moment please..."
                                        : "No files found.";
                                else
                                    return "No files found that match '" + this.keyword + "'";
                            }
                        }, plugin);
                        branchesTree.columns = [
                            {
                                caption: "Name",
                                value: "name",
                                width: "40%",
                                type: "tree"
                            },
                            {
                                caption: "Last Author",
                                value: "authorname",
                                width: "20%",
                            },
                            {
                                caption: "Last Commit",
                                value: "subject",
                                width: "40%",
                            },
                            /* upstream, type, subject, authoremail, committerdate,*/
                            
                        ];
                        var idMixin = function () {
                            this.expandedList = Object.create(null);
                            this.selectedList = Object.create(null);
                            this.setOpen = function(node, val) {
                                if (val)
                                    this.expandedList[node.path] = val;
                                else
                                    delete this.expandedList[node.path];
                            };
                            this.isOpen = function(node) {
                                return this.expandedList[node.path];
                            };
                            this.isSelected = function(node) {
                                return this.selectedList[node.path];
                            };
                            this.setSelected = function(node, val) {
                                if (val)
                                    this.selectedList[node.path] = !!val;
                                else
                                    delete this.selectedList[node.path];
                            };
                        };
                        idMixin.call(branchesTree.model);
                        branchesTree.model.expandedList["refs/remotes/"] = true;
                        
                        branchesTree.container.style.margin = "0 0px 0 0";
                    }
                    branchesTree.minLines = 3;
                    branchesTree.maxLines = Math.floor((window.innerHeight - 100) / branchesTree.rowHeight);
                    branchesTree.emptyMessage = "loading...";
                    scm.listAllRefs(function(err, data) {
                        if (err) {
                            branchesTree.emptyMessage = "Error while loading\n" + escapeHTML(err.message);
                            return console.error(err);
                        }
                        
                        var root = { path: "" };
                        data.forEach(function(x) {
                            x.path = x.name;
                            var parts = x.name.split("/");
                            x.name = parts.pop();
                            var node = root;
                            parts.forEach(function(p) {
                                var map = node.map || (node.map = {});
                                node = map[p] || (map[p] = {
                                    label: p,
                                    path: node.path + p + "/"
                                });
                            });
                            var map = node.map || (node.map = {});
                            map[x.name] = x;
                        });
                        branchesTree.setRoot(root.map.refs);
                        branchesTree.resize();
                    });
                }
            });
            
            btnBranches = ui.insertByIndex(toolbar, new ui.button({
                caption: "Branches",
                skinset: "default",
                skin: "c9-menu-btn",
                style: "float:right",
                submenu: mnuBranches
            }), 200, plugin);
            
            mnuExecute = new Menu({ items: [
                new MenuItem({ caption: "Refresh", onclick: refresh }, plugin)
            ]}, plugin);
            
            // btnExecute = ui.insertByIndex(toolbar, new ui.button({
            //     caption: "Execute",
            //     skinset: "default",
            //     skin: "c9-menu-btn",
            //     command: "cleartestresults",
            //     submenu: mnuExecute.aml
            // }), 300, plugin);
            
            mnuSettings = mnuExecute; /*new Menu({ items: [
                
            ]}, plugin);*/
            
            btnSettings = opts.aml.appendChild(new ui.button({
                skin: "header-btn",
                class: "panel-settings changes",
                submenu: mnuSettings.aml
            }));
            
            // Container
            container = vbox.appendChild(new ui.bar({
                style: "flex:1;display:flex;flex-direction: column;"
            }));
            
            // Mark Dirty
            plugin.on("show", function() {
                save.on("afterSave", markDirty);
                watcher.on("change", markDirty);
            });
            plugin.on("hide", function() {
                clearTimeout(timer);
                save.off("afterSave", markDirty);
                watcher.off("change", markDirty);
            });
            
            watcher.watch(util.normalizePath(workspaceDir) + "/.git");
            
            var timer = null;
            function markDirty(e) {
                clearTimeout(timer);
                timer = setTimeout(function() {
                    if (tree && tree.meta.options && !tree.meta.options.hash) {
                        tree.meta.options.force = true;
                        emit("reload", tree.meta.options);
                    }
                }, 800);
            }
            
            emit.sticky("drawPanels", { html: container.$int, aml: container });
        }
        
        /***** Methods *****/
        
        function registerSCM(name, scmPlugin) {
            scms[name] = scmPlugin;
            if (!scm) scm = scmPlugin;
            
            emit("register", { plugin: scmPlugin });
        }
        
        function unregisterSCM(name, scmPlugin) {
            delete scms[name];
            
            emit("unregister", { plugin: scmPlugin });
        }
        
        function refreshWorkspace() {
            var location = locationBox.getValue().trim();

            if (location[0] === "/") {
                location = location.slice(1);
            }

            workspaceDir = c9.workspaceDir + "/" + location;

            emit("workspaceDir", {
                workspaceDir: workspaceDir
            });

            refresh();
        }

        function refresh() {
            getLog();
            emit("reload");
        }
        
        function resize() {
            emit("resize");
        }
        
        function getLog() {
            scm.getLog({}, function(err, root) {
                if (err) return console.error(err);
                
                emit("log", root);
            });
        }
        
        function commit(message, amend, callback) {
            scm.commit({ 
                message: message,
                amend: amend
            }, function(err) {
                if (err) return console.error(err);
                
                emit("reload");
                getLog();
                
                callback && callback();
            });
        }
        
        function unstage(nodes) {
            // model.root.staging;
            if (!Array.isArray(nodes))
                nodes = [nodes];
            var paths = nodes.map(function(node) {
                return node.path;
            }).filter(Boolean);
            
            scm.unstage(paths, function(err) {
                if (err) return console.error(err);
                emit("reload");
            });
        }
        
        function addFileToStaging(nodes) {
            // model.root.staging;
            if (!Array.isArray(nodes))
                nodes = [nodes];
            var paths = nodes.map(function(node) {
                return node.path;
            }).filter(Boolean);
            
            scm.addFileToStaging(paths, function(err) {
                if (err) return console.error(err);
                emit("reload");
            });
        }
        
        function addAll() {
            scm.addAll(function(err) {
                if (err) return console.error(err);
                emit("reload");
            });
        }
        function unstageAll() {
            scm.unstageAll(function(err) {
                if (err) return console.error(err);
                emit("reload");
            });
        }
        function fetch(options, callback) {
            scm.fetch(options, function(err) {
                if (err) return console.error(err);
                emit("reload");
                callback && callback();
            });
        }
        function pull(options, callback) {
            scm.pull(options, function(err) {
                if (err) return console.error(err);
                emit("reload");
                callback && callback();
            });
        }
        function push(options, callback) {
            scm.push(options, function(err) {
                if (err) return callback(err);
                emit("reload");
                callback && callback();
            });
        }
        function loadDiff(options, callback) {
            return scm.loadDiff(options, function(err, result) {
                // if (err) return console.error(err);
                // emit("reload");
                callback(err, result);
            });
        }
        function getStatus(options, callback) {
            scm.getStatus(options, callback);
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
        plugin.on("show", function onShow(e) {
            if (!scm) return plugin.once("register", onShow);
            
            emit("reload", { force: true });
            getLog();
        });
        plugin.on("hide", function(e) {
            
        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
        });
        
        /***** Register and define API *****/
        
        plugin.freezePublicAPI({
            /**
             * 
             */
            register: registerSCM,
            
            /**
             * 
             */
            unregister: unregisterSCM,
            
            /**
             * 
             */
            addFileToStaging: addFileToStaging,
            
            /**
             * 
             */
            loadDiff: loadDiff,
            
            /**
             * 
             */
            unstage: unstage,
            
            /**
             * 
             */
            getStatus: getStatus,
            
            /**
             * 
             */
            resize: resize
            
            // TODO all other functions
        });
        
        register(null, {
            "scm": plugin
        });
    }
});
