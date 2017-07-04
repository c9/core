define(function(require, module, exports) {
    main.consumes = [
        "Plugin", "c9", "commands", "menus", "ui", "layout", "dialog.alert",
        "MembersPanel", "info", "collab.workspace", "Menu", "MenuItem",
        "clipboard", "settings", "api", "dialog.question"
    ];
    main.provides = ["dialog.share"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var c9 = imports.c9;
        var MembersPanel = imports.MembersPanel;
        var commands = imports.commands;
        var settings = imports.settings;
        var menus = imports.menus;
        var clipboard = imports.clipboard;
        var ui = imports.ui;
        var api = imports.api;
        var alert = imports["dialog.alert"].show;
        var layout = imports.layout;
        var workspace = imports["collab.workspace"];
        var question = imports["dialog.question"];
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;

        var markup = require("text!./share.xml");
        var css = require("text!./share.css");

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        var dialog, btnInvite, btnDone, txtUsername, membersParent, accessButton;
        var membersPanel, shareLinkEditor, shareLinkApp, shareLinkPreview;
        var publicApp, publicPreview, publicEditor, cbNotify;

        var loaded = false;
        function load() {
            if (loaded) return;
            loaded = true;

            if (!c9.isAdmin)
                return;

            commands.addCommand({
                name: "sharedialog",
                hint: "Share the workspace",
                group: "General",
                exec: show
            }, plugin);

            var btn = new ui.button({
                "skin": "c9-menu-btn",
                "caption": "Share",
                "class": "c9-share",
                "tooltip": "Share this workspace",
                // "width"   : 80,
                "command": "sharedialog"
            });

            menus.addItemByPath("Window/~", new ui.divider(), 35, plugin);
            menus.addItemByPath("Window/Share...", new ui.item({
                command: "sharedialog"
            }), 36, plugin);

            ui.insertByIndex(layout.findParent({
                name: "preferences"
            }), btn, 875, plugin);

            settings.on("read", function() {
                settings.setDefaults("project/share", [
                    ["preview", false],
                    ["app", false],
                    ["useOwnerSettings", false],
                ]);
            }, plugin);
        }

        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;

            ui.insertCss(css, plugin);
            ui.insertMarkup(null, markup, plugin);
            
            commands.addCommand({
                name: plugin.name,
                bindKey: { mac: "ESC", win: "ESC" },
                group: "ignore",
                isAvailable: function() {
                    return dialog.visible;
                },
                exec: function() {
                    dialog.dispatchEvent("keydown", { keyCode: 27 });
                }
            }, plugin);

            dialog = plugin.getElement("window");
            btnInvite = plugin.getElement("btnInvite");
            btnDone = plugin.getElement("btnDone");
            cbNotify = plugin.getElement("cbNotify");
            txtUsername = plugin.getElement("txtUsername");
            shareLinkEditor = plugin.getElement("shareLinkEditor").$int;
            shareLinkApp = plugin.getElement("shareLinkApp").$int;
            shareLinkPreview = plugin.getElement("shareLinkPreview").$int;
            membersParent = plugin.getElement("members");
            publicApp = plugin.getElement("publicApp");
            publicPreview = plugin.getElement("publicPreview");
            publicEditor = plugin.getElement("publicEditor");
            accessButton = plugin.getElement("access").$int;

            if (options.silent) {
                cbNotify.uncheck();
                cbNotify.$ext.style.visibility = "hidden";
            }

            var mnuLink = new Menu({
                zindex: 500000,
                items: [
                    new MenuItem({ caption: "Open", onclick: function() {
                        window.open(mnuLink.meta.linkText);
                    } }),
                    new MenuItem({ caption: "Copy", onclick: function() {
                        clipboard.copy(false, mnuLink.meta.linkText);
                    } })
                ]
            }, plugin);

            var port = (options.local ? ":" + (c9.port || "8080") : "");
            if (!options.local) {
                var l = location;
                shareLinkEditor.textContent = l.protocol + "//" + l.host + l.pathname;
            }
            else {
                shareLinkEditor.textContent = "https://ide.c9.io/" + c9.workspaceId;
            }
            
            shareLinkApp.textContent = (c9.hostname 
                ? "https://" + c9.hostname
                : "http://localhost") + port;
            shareLinkPreview.textContent = options.previewUrl;
            
            [shareLinkEditor, shareLinkApp, shareLinkPreview].forEach(function(div) {
                div.addEventListener("click", function(e) {
                    mnuLink.meta.linkText = this.textContent;
                    mnuLink.show(e.clientX + 1, e.clientY);
                });
                div.addEventListener("contextmenu", function(e) {
                    var sel = window.getSelection();
                    var r = new Range();
                    r.selectNode(e.currentTarget);
                    sel.removeAllRanges();
                    sel.addRange(r);
                });
            });

            accessButton.addEventListener("click", function () {
                var className = accessButton.classList;
                var actionArr = className.contains("rw") ? ["rw", "r"] : ["r", "rw"];
                className.remove(actionArr[0]);
                className.add(actionArr[1]);
            });

            var words = {
                "visibility": ["this workspace"],
                "app": ["the running application"],
                "preview": ["the preview of workspace files"]
            };

            function updateAccess(field, value, cb, callback) {
                var to = value ? "public" : "private";
                
                question.show(
                    "Change Access To " + to.uCaseFirst(),
                    (field == "visibility"
                        ? (value
                            ? "Make this workspace available to the whole world?"
                            : "Close this workspace to everyone but the listed users?")
                        : (value
                            ? "Make " + words[field][0] + " available to anyone with the url?"
                            : "Close " + words[field][0] + " to everyone but the listed users?")),
                    (value
                        ? "Are you sure you want to make this change? Anyone with "
                            + "the url will have read-only access to " + words[field] + ". "
                            + "Only users that you authorize have write access."
                        : "Are you sure you want to make this change? Only users "
                            + "with read-only or read-write access will be able to "
                            + "access " + words[field] + "."),
                    function() { // Yes
                        cb.disable();
                        var key = field == "visibility" ? field : field + "Access";
                        var body = {};
                        body[key] = to;
                        
                        api.project.patch("", {
                            body: body,
                            contentType: "application/json"
                        }, function(err) {
                            cb.enable();
                            
                            if (callback)
                                callback(err);
                            
                            if (err) {
                                cb[value ? "uncheck" : "check"]();
                                
                                // Forbidden
                                if (err.message == "Administrator rights required!") {
                                    alert("Forbidden",
                                        "You are not allowed to change this setting.",
                                        "Only the owner of this workspace can change "
                                          + "this setting. Please contact the owner "
                                          + "about this.");
                                }
                                // Payment Required
                                else if (err.code == 402) {
                                    alert("Maximum Private Workspaces Reached",
                                        "It seems you have reached the maximum number "
                                          + "of workspaces under your account",
                                        "Please go to the dashboard or contact support "
                                          + "to increase the number of private workspaces.");
                                }
                                // Other Errors
                                else {
                                    alert("Failed updating public status",
                                        "The server returned an error",
                                        err.message || "");
                                }
                            }
                        });
                    },
                    function() { // No
                        cb[value ? "uncheck" : "check"]();
                    }
                );
            }
            
            publicEditor.on("afterchange", function(e) {
                updateAccess("visibility", e.value, publicEditor, function(err) {
                    syncPermissions();
                });
            });
            publicApp.on("afterchange", function(e) {
                updateAccess("app", e.value, publicApp);
            });
            publicPreview.on("afterchange", function(e) {
                updateAccess("preview", e.value, publicPreview);
            });
            
            btnDone.on("click", hide);
            btnInvite.on("click", inviteUser);

            txtUsername.on("keydown", function(e) {
                if (e.keyCode == 13) {
                    inviteUser();
                    e.returnValue = false;
                    return false;
                }
                else if (e.keyCode === 27) {
                    hide();
                }
            });

            membersPanel = new MembersPanel("Ajax.org", main.consumes, {});
            membersPanel.draw({ aml: membersParent });
            
            syncPermissions();

            emit.sticky("draw");
        }
        
        function syncPermissions() {
            api.collab.get("access_info", function (err, info) {
                if (err) return;
                
                publicEditor[info.private ? "uncheck" : "check"]();
                publicApp[info.appPublic || !info.private ? "check" : "uncheck"]();
                publicPreview[info.previewPublic || !info.private ? "check" : "uncheck"]();
                
                publicApp[!info.private ? "disable" : "enable"]();
                publicPreview[!info.private ? "disable" : "enable"]();
            });
        }

        /***** Methods *****/

        function inviteUser() {
            var username = txtUsername.value;
            // remove whitespace and surrounding < > from email
            username = username.replace(/^\s*(<\s*)?|\s*(>\s*)?$/g, "");
            var access = accessButton.classList.contains("rw") ? "rw" : "r";
            var accessString = access === "rw" ? "Read+Write" : "Read-Only";
            btnInvite.disable();
            
            var options = { silent: !cbNotify.checked };
            workspace.addMember(username, access, options, function(err, member) {
                btnInvite.enable();
                
                if (err)
                    return alert("Error", "Error adding workspace member", err.message);
                
                txtUsername.setValue("");
                alert("Invitation Sent",
                    "Workspace Member Added",
                    "You have granted " + member.name + " " + accessString
                        + " access to this workspace!");
            });
        }

        function show() {
            draw();
            dialog.show();
            membersPanel.show();
            txtUsername.setValue("");
            txtUsername.blur();
            // shareLink.focus();
            // shareLink.select();
        }

        function hide() {
            dialog && dialog.hide();
        }

        plugin.on("load", function() {
            load();
        });

        /***** Register and define API *****/

        /**
         * The Share dialog - allowing users to share the workspace with other cloud9 users
         * @singleton
         */
        plugin.freezePublicAPI({
        });

        register(null, {
            "dialog.share": plugin
        });
    }
});