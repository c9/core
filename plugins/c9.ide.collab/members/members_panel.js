define(function(require, exports, module) {
"use strict";

    main.consumes = [
        "Plugin", "ui", "util", "apf", "Menu", "MenuItem", "Divider",
        "collab.workspace", "info", "dialog.error", "dialog.confirm",
        "accessControl", "collab"
    ];
    main.provides = ["MembersPanel"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var c9Util = imports.util;
        var apf = imports.apf;
        var Menu = imports.Menu;
        var Divider = imports.Divider;
        var MenuItem = imports.MenuItem;
        var workspace = imports["collab.workspace"];
        var info = imports.info;
        var showError = imports["dialog.error"].show;
        var confirm = imports["dialog.confirm"].show;
        var accessControl = imports.accessControl;
        var collab = imports.collab;
        
        var cloneObject = c9Util.cloneObject;
        var Tree = require("ace_tree/tree");
        var TreeData = require("./membersdp");
        var mnuCtxTreeEl;

        var ROLE_ADMIN = "a";

        function MembersPanel(developer, deps, options) {
            // Editor extends ext.Plugin
            var plugin = new Plugin(developer, deps);
            // var emit = plugin.getEmitter();

            var membersTree, membersDataProvider, parent;

            var drawn = false;
            function draw(options) {
                if (drawn) return;
                drawn = true;

                parent = options.aml;

                // Members panel
                membersTree = new Tree(parent.$int);
                membersDataProvider = new TreeData();
                membersTree.renderer.setTheme({ cssClass: "memberstree" });
                membersTree.renderer.setScrollMargin(0, 10);
                // Assign the dataprovider
                membersTree.setDataProvider(membersDataProvider);

                membersTree.on("mousedown", function(e) {
                    var domTarget = e.domEvent.target;
                    var node = e.getNode();
                    if (!node || !domTarget || e.domEvent.button)
                        return;

                    var className = domTarget.classList;
                    membersDataProvider.selection.selectNode(node);
                    if (className.contains("access_control")) {
                        if (className.contains("rw")) {
                            className.remove("rw");
                            className.add("r");
                        }
                        else {
                            className.remove("r");
                            className.add("rw");
                        }
                    }
                });
                membersTree.on("mouseup", function(e) {
                    var domTarget = e.domEvent.target;
                    var node = e.getNode();
                    
                    if (!node || !domTarget || e.domEvent.button)
                        return;
                    if (e.editor.$mouseHandler.isMousePressed)
                        return;

                    var className = domTarget.classList;
                    membersDataProvider.selection.selectNode(node);
                    if (className.contains("access_control"))
                        updateAccess(node.acl == "rw" ? "r" : "rw");
                    else if (className == "kickout")
                        removeMember();
                });
                
                membersTree.on("dblclick", function(e) {
                    var domTarget = e.domEvent.target;
                    var node = e.getNode();
                    if (!node || !domTarget)
                        return;
                    if (domTarget.classList.contains("ace_tree_cells")) {
                        if (node.type == "file") {
                            e.stop();
                            revealUser();
                        }
                    }
                });
                
                membersDataProvider.loadChildren = function(node, cb) {
                    if (node.clientId) {
                        if (node.client)
                            node.client.status = "loading";
                        node.children.status = "loading";
                        collab.listOpenFiles(node.clientId, function() {
                            cb && cb();
                            node.children.status = "loaded";
                            onWorkspaceSync();
                        });
                    }
                };
                

                var mnuCtxTree = new Menu({
                    id: "mnuMembers",
                    items: [
                        new MenuItem({
                            caption: "Request Read+Write Access",
                            match: function(item, node) {
                                item.setAttribute("visible", !workspace.accessInfo.member);
                            },
                            onclick: accessControl.requestAccess
                        }),
                        new MenuItem({
                            caption: "Leave workspace",
                            match: function(item, node) {
                                item.setAttribute("visible", !workspace.accessInfo.admin);
                                return node.name == "You";
                            },
                            onclick: removeMember.bind(null, "rw")
                        }),
                        new MenuItem({
                            caption: "Grant Read+Write Access",
                            match: function(item, node) {
                                item.setAttribute("visible", workspace.accessInfo.admin);
                                return node.acl == "r";
                            },
                            onclick: updateAccess.bind(null, "rw")
                        }),
                        new MenuItem({
                            caption: "Revoke Write Access",
                            match: function(item, node) {
                                item.setAttribute("visible", workspace.accessInfo.admin);
                                return node.acl == "rw" && !node.isAdmin;
                            },
                            onclick: updateAccess.bind(null, "r")
                        }),
                        new MenuItem({
                            caption: "Revoke Access",
                            match: function(item, node) {
                                item.setAttribute("visible", workspace.accessInfo.admin);
                                return !node.isAdmin;
                            },
                            onclick: removeMember
                        }),
                        new Divider(),
                        new MenuItem({
                            caption: "Show Location",
                            match: "online",
                            onclick: revealUser
                        })
                    ]
                }, plugin);

                mnuCtxTreeEl = mnuCtxTree.aml;

                mnuCtxTree.on("show", function() {
                    var node = getSelectedMember() || {};
                    if (!node.uid)
                        return mnuCtxTreeEl.hide();
                    mnuCtxTreeEl.childNodes.forEach(function(item) {
                        var match = item.match;
                        var disabled = false;
                        if (match == "online") {
                            disabled = !node.clientId;
                        } else if (typeof match == "function") {
                            disabled = match(item, node) == false;
                        }
                        item.setAttribute("disabled", disabled);
                    });
                });
                parent.setAttribute("contextmenu", mnuCtxTreeEl);
                
                window.addEventListener('resize', resize, true);
                parent.on("resize", resize);
                
                membersTree.container.style.position = "relative";
                membersTree.container.style.top = "0px";
            }
            
            function hide() {
                workspace.off("sync", onWorkspaceSync);
            }
            
            function alertIfError(err) {
               err && showError("Error", "Members Panel Error", err.message);
            }

            function show() {
                workspace.loadMembers(alertIfError);
                workspace.off("sync", onWorkspaceSync);
                workspace.on("sync", onWorkspaceSync);
                setTimeout(resize);
            }

            function resize() {
                var next = parent;
                var h = 0;
                if (!parent.parentNode || !parent.parentNode.visible)
                    return;
                
                if (!options.autoSize || parent.tagName != "frame")
                    return membersTree.resize();
                
                var m1 = next.state[0] == "m";
                next = next.nextSibling;
                var m2 = next && next.state[0] == "m";
                next = next && next.nextSibling;
                var m3 = next && next.state[0] == "m";
                if (m1) return;
                if (m2 && m3) {
                    membersTree.renderer.setOption("maxLines", 0);
                    h = parent.$ext.parentNode.clientHeight - 3 * parent.$ext.firstElementChild.clientHeight;
                }
                
                var rowHeight = membersTree.provider.rowHeight;
                var maxLines = Math.max(h || (window.innerHeight / 2 - 60), 60)
                    / rowHeight;
                membersTree.renderer.setOption("maxLines", maxLines);
                membersTree.resize();
            }

            function updateAccess(acl) {
                var node = getSelectedMember();
                var uid = node.uid;
                workspace.updateAccess(uid, acl, alertIfError);
            }

            function removeMember() {
                var node = getSelectedMember();
                var isPublic = workspace.accessInfo.private === false;
                confirm(
                    "Remove Member?",
                    "Are you sure you want to " 
                        + (node.name == "You" ? "leave " : "remove '" + node.name + "' out of your ")
                        + "workspace '" + info.getWorkspace().name + "'?",
                    "People who are not members of a workspace, can not "
                        + (isPublic ? "" : "read, ") + "write or collaborate on that workspace ",
                    function() { // Yes
                        var uid = node.uid;
                        workspace.removeMember(uid, alertIfError);
                    },
                    function() { /* No */ },
                    {
                        yes: node.name == "You" ? "Leave" : "Remove Member",
                        no: "Cancel"
                    }
                );
            }
            
            function revealUser() {
                var node = getSelectedMember();
                var clientId = node && node.clientId;
                if (!clientId)
                    return;
                collab.revealUser(clientId, node.tabId);
            }
            
            function loadUserState() {
                var node = getSelectedMember();
                return node;
            }

            function getSelectedMember() {
                return membersTree.selection.getCursor();
            }

            function onWorkspaceSync() {
                var me = info.getUser();
                var membersById = membersDataProvider.byId || (membersDataProvider.byId = {});
                var members = { r: [], rw: []};
                var myRow = {};
                var myClientId = workspace.myClientId;

                var cachedMembers = workspace.members;
                var users = workspace.users;
                
                if (!cachedMembers.length) { // We're visiting a public workspace
                    cachedMembers = [{
                        acl: "r",
                        name: "You",
                        pending: false,
                        role: "v",
                        uid: me.id,
                        email: me.email
                    }];
                    membersDataProvider.byId = null;
                }
                
                cachedMembers.forEach(function(newM) {
                    var m = membersById[newM.uid] || (membersById[newM.uid] = {});
                    for (var i in newM)
                        m[i] = newM[i];
                    
                    m.isAdmin = m.role == ROLE_ADMIN;
                    m.color = workspace.getUserColor(m.uid);
                    m.onlineStatus = workspace.getUserState(m.uid);
                    if (!m.md5Email)
                        m.md5Email = m.email ? apf.crypto.MD5.hex_md5(m.email.trim().toLowerCase()) : "";
                    members[m.acl == "rw" ? "rw" : "r"].push(m);
                    
                    var user = users[m.uid];
                    var clientIds = user && user.clients;
                    m.children = clientIds && clientIds.length && clientIds.map(function(k, i) {
                        var children = null, client;
                        if (options.showTabs) {
                            client = clientIds[k];
                            if (client) {
                                if (!client.status)
                                    client.status = "pending";
                                children = client.documents.map(function(x, i) {
                                    return {
                                        type: "file",
                                        name: x,
                                        tabId: x,
                                        className: i == client.active ? "active" : "",
                                        id: k + "::" + x,
                                        clientId: k
                                    };
                                });
                                client.status = client.status || "pending";
                            } else if (user.online) {
                                children = [];
                                children.status = "pending";
                            }
                        }
                        return {
                            type: "ide",
                            pending: true,
                            clientId: k,
                            name: "Ide instance " + i,
                            user: m,
                            children: children,
                            id: k
                        };
                    });
                    
                    if (m.uid == me.id) {
                        m.name = "0000"; // top in every sort
                        m.status = "online";
                        myRow = m;
                        
                        m.clientId = myClientId;
                        m.client = null;
                        if (m.children) {
                            m.children = m.children.filter(function(ide) {
                                return ide.clientId !== myClientId;
                            });
                            if (!m.children.length) {
                                m.children = null;
                            }
                        }
                    } else {
                        m.clientId = clientIds && clientIds[0];
                        m.client = clientIds && clientIds[m.clientId];
                        if (m.children && m.children.length == 1) {
                            m.pending = true;
                            m.children = m.children[0].children;
                        }
                    }
                    
                });

                function memberCompartor (m1, m2) {
                    return m1.name > m2.name;
                }

                members.r.sort(memberCompartor);
                members.rw.sort(memberCompartor);
                myRow.name = "You";
                
                membersDataProvider.iAmAdmin = myRow.isAdmin;
                var root = membersDataProvider.root;
                if (!root.rw) {
                    root.rw = {
                        name: "Read+Write",
                        children: members.rw,
                        noSelect: true,
                        clickAction: "toggle",
                        className: "caption",
                        isOpen: true
                    };
                    root.r = {
                        name: "Read Only",
                        noSelect: true,
                        clickAction: "toggle",
                        className: "caption",
                        isOpen: true
                    };
                }
                root.rw.children = members.rw;
                root.r.children = members.r;
                root.children = [root.rw, root.r].filter(function(x) {
                    return x.children.length;
                });
                membersDataProvider.setRoot(root);
            }

             /***** Register and define API *****/

            plugin.freezePublicAPI.baseclass();

            /**
             * Members panel base class for the {@link members}.
             *
             * A members panel is a section of the collab that shows the members of a workspace
             * with thier access rights, collaborator colors
             *
             * @class MembersPanel
             * @extends Plugin
             */
            /**
             * @constructor
             * Creates a new MembersPanel instance.
             * @param {String}   developer   The name of the developer of the plugin
             * @param {String[]} deps        A list of dependencies for this
             *   plugin. In most cases it's a reference to `main.consumes`.
             * @param {Object}   options     The options for the members panel
             */
            plugin.freezePublicAPI({
                /**
                 * Draw the members panel on a parent element
                 * 
                 * @param {AMLElement} options.aml
                 */
                draw: draw,
                /**
                 * Trigger a resize of the members tree
                 */
                resize: resize,
                /**
                 * Load workspace members, render the tree and set update listeners
                 */
                show: show,
                /**
                 * Hide the members tree and unset update listeners
                 */
                hide: hide
            });

            return plugin;
        }

        register(null, {
            MembersPanel: MembersPanel
        });
    }
});
