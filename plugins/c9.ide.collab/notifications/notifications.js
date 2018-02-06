/*global window apf console*/
define(function(require, exports, module) {
"use strict";

    main.consumes = ["CollabPanel", "ui", "api", "dialog.alert", "dialog.error", "c9", "panels", "collab.workspace"];
    main.provides = ["notifications"];
    return main;

    function main(options, imports, register) {
        var CollabPanel = imports.CollabPanel;
        var c9 = imports.c9;
        var ui = imports.ui;
        var api = imports.api;
        var panels = imports.panels;
        var alert = imports["dialog.alert"].show;
        var showError = imports["dialog.error"].show;
        var workspace = imports["collab.workspace"];

        var css = require("text!./notifications.css");

        var oop = require("ace/lib/oop");
        var Tree = require("ace_tree/tree");
        var TreeData = require("./notificationsdp");

        var plugin = new CollabPanel("Ajax.org", main.consumes, {
            name: "notifications",
            index: 150,
            caption: "Notifications",
            height: "20%"
        });
        
        // var emit = plugin.getEmitter();

        // added notification types as classes below
        var NOTIFICATION_TYPES = {};

        var notificationsParent, notificationsTree, notificationsDataProvider;
        var frame, panelButton, bubble;
        // var visible = false;

        var loaded = false;
        function load() {
            if (loaded) return;
            loaded = true;

            // Needed now for bubble
            ui.insertCss(css, null, plugin);
            
            notificationsDataProvider = new TreeData();

            c9.once("ready", function() {
                setTimeout(loadNotifications, 10000);
            });

            if (!options.hosted && c9.debug) {
                // standalone version test
                addNotifications([
                    { name: "Bas de Wachter", uid: 8, email: "bas@c9.io", type: "access_request" },
                    { name: "Mostafa Eweda", uid: 1, email: "mostafa@c9.io", type: "access_request" },
                    { name: "Lennart Kats", uid: 5, email: "lennart@c9.io", type: "access_request" },
                    { name: "Ruben Daniels", uid: 2, email: "ruben@ajax.org", type: "access_request" },
                    { name: "Fabian Jakobs", uid: 4, email: "fabian@ajax.org", type: "access_request" }
                ]);
            }
            
            workspace.on("notification", function(notif) {
                addNotifications(notif);
                postLoadedNotifications();
                if (!isOpen()) {
                    var sound = document.getElementById("chatNotif");
                    sound && sound.play();
                }
            });
        }

        var drawn = false;
        function draw(options) {
            if (drawn) return;
            drawn = true;

            notificationsParent = options.html;

            frame = options.aml;
            
            // Notifications panel
            notificationsTree = new Tree(notificationsParent);
            notificationsTree.renderer.setScrollMargin(0, 10);
            notificationsTree.renderer.setTheme({ cssClass: "notificationstree" });
            notificationsTree.setOption("maxLines", 3);
            // Assign the dataprovider
            notificationsTree.setDataProvider(notificationsDataProvider);

            notificationsTree.on("mousedown", function(e) {
                var domTarget = e.domEvent.target;

                var pos = e.getDocumentPosition();
                var notif = notificationsDataProvider.findItemAtOffset(pos.y);
                if (!notif || !domTarget)
                    return;

                notif.handleMouseDown(e);
            });
            
            notificationsTree.on("mouseup", function(e) {
                var domTarget = e.domEvent.target;

                var pos = e.getDocumentPosition();
                var notif = notificationsDataProvider.findItemAtOffset(pos.y);
                if (!notif || !domTarget)
                    return;

                notif.handleMouseUp(e);
            });
            
            plugin.on("hide", function(e) {
                notificationsTree.renderer.freeze();
            });
            plugin.on("show", function(e) {
                notificationsTree.renderer.unfreeze();
                notificationsTree.renderer.$loop.schedule(notificationsTree.renderer.CHANGE_FULL);
            });
            
            // onNotificationsLoaded();
            // notificationsDataProvider.emptyMessage = "Loading Notifications ...";
            // loadNotifications();
            if (!cachedNotifications.length)
                frame.minimize();
            postLoadedNotifications();
            frame.on("resize", resize);
            setTimeout(resize, 150); // HACK around apf layout bug
        }

        var cachedNotifications = [];
        function loadNotifications() {
            if (!options.isAdmin || !options.hosted)
                return postLoadedNotifications();

            api.collab.get("members/list?pending=1", function (err, members) {
                if (err && (err.code === 0 || err.code === 503)) {
                    // Server still starting or CORS error; retry
                    return setTimeout(loadNotifications, 20000);
                }
                
                if (err) return showError(err);

                if (Array.isArray(members)) {
                    var notifs = members.map(function(m) {
                        m.type = "access_request";
                        return m;
                    });
                    cachedNotifications = [];
                    addNotifications(notifs);
                    postLoadedNotifications();
                }
            });
        }

        function resize() {
            var count = cachedNotifications.length;
            
            if (!bubble) {
                // Make sure collab panel is enabled if we have notifications
                if (!panels.panels.collab.enabled && count)
                    panels.enablePanel("collab");
                
                // Notification Bubble
                panelButton = document.querySelector(".panelsbutton.collab");
                if (panelButton) {
                    bubble = panelButton.appendChild(document.createElement("div"));
                    bubble.className = "newnotifs";
                }
            }
            
            if (bubble) {
                if (count) {
                    bubble.textContent = count;
                    bubble.style.display = "block";
                    bubble.className = "newnotifs size" + String(count).length;
                } else {
                    bubble.style.display = "none";
                }
            }
            
            if (drawn) {
                if (frame.state[0] != "m") {
                    frame.$ext.style.height = count
                        ? Math.min(count, 3) * 50 + 22 + "px"
                        : 50 + "px";
                    notificationsTree.resize();
                } else {
                    frame.$ext.style.height = "0";
                }
            }
        }
        
        function postLoadedNotifications() {
            resize();
            if (!drawn)
                return;
            notificationsDataProvider.emptyMessage = "No pending notifications";
            frame.setAttribute("caption", 
                "Notifications (" + cachedNotifications.length + ")");
            
            onNotificationsLoaded();
        }

        function addNotifications(notifs) {
            if (!Array.isArray(notifs))
                notifs = [notifs];
                
            if (frame)
                frame.restore();
                
            notifs.forEach(function(notif) {
                var NotifConstructor = NOTIFICATION_TYPES[notif.type];
                if (!NotifConstructor)
                    console.error("Invalid notification type:", notif.type);
                cachedNotifications.push(new NotifConstructor(notif));
            });
            if (notificationsDataProvider)
                notificationsDataProvider.setRoot(cachedNotifications);
        }

        function onNotificationsLoaded() {
            if (frame && cachedNotifications.length)
                frame.restore();
        }
        
        
        function isOpen() {
            return panels.isActive("collab") && frame && frame.state[0] != "m";
        }

        /***** Notification Object *****/
        
        function Notification(datarow) {
            this.datarow = datarow;
        }

        (function () {
            this.getHTML = function (datarow) {
                throw new Error("No impl found - getHTML");
            };

            this.handleMouseDown = function () {
                throw new Error("No impl found - handleMouseDown");
            };

            this.remove = function () {
                var _self = this;
                cachedNotifications = cachedNotifications.filter(function (notif) {
                    return notif !== _self;
                });
                notificationsDataProvider.setRoot(cachedNotifications);
                postLoadedNotifications();
            };
        }).call(Notification.prototype);

        function AccessRequestNotification(datarow) {
            datarow.md5Email = datarow.email ? apf.crypto.MD5.hex_md5(datarow.email.trim().toLowerCase()) : "";
            this.datarow = datarow;
        }

        oop.inherits(AccessRequestNotification, Notification);

        (function () {
            this.getHTML = function () {
                var datarow = this.datarow;
                var avatarImg = '<img class="gravatar-image" src="https://secure.gravatar.com/avatar/' +
                    datarow.md5Email + '?s=37&d=retro" />';
                var html = [
                    "<span class='avatar'>", avatarImg, "</span>",
                    "<span class='body'>", "<span class='caption'>", datarow.name, "</span>", 
                    " requests access to this workspace</span>",
                    "<span class='actions access_request'>",
                        '<div class="standalone access_control rw">',
                            '<div class="readbutton">R</div><div class="writebutton">RW</div>',
                        '</div>',
                        '<div class="btn-default-css3 btn-green grant">',
                            '<div class="caption">Grant</div>',
                        '</div>',
                        '<div class="btn-default-css3 btn-red deny">',
                            '<div class="caption">Deny</div>',
                        '</div>',
                    "</span>"
                ];

                return html.join("");
            };

            this.acceptRequest = function (access) {
                var _self = this;
                if (!options.hosted)
                    return requestAccepted();
                    
                var datarow = this.datarow;
                var uid = datarow.uid;
                api.collab.post("accept_request", {
                    body: {
                        uid: uid,
                        access: access
                    }
                }, function (err, data, res) {
                    if (err) {
                        var message = err.message || err;
                        var user = workspace.getUser(uid);
                        if (user && !user.pending || / isn't a pending workspace member/.test(message)) {
                            return _self.remove(); // it was already handled ignore
                        }
                        return alert("Error", message);
                    }
                    requestAccepted();
                });
                function requestAccepted() {
                    datarow.acl = access;
                    workspace.addMemberNonPubSub(datarow);
                    _self.remove();
                }
            };

            this.denyRequest = function () {
                var _self = this;
                if (!options.hosted)
                    return requestDenied();
                    
                var uid = this.datarow.uid;
                api.collab.post("deny_request", {
                    body: {
                        uid: uid
                    }
                }, function (err, data, res) {
                    if (err) {
                        var message = err.message || err;
                        var user = workspace.getUser(uid);
                        if (!user || / isn't a member of project /.test(message)) {
                            return _self.remove(); // it was already handled ignore
                        }
                        return alert("Error", message);
                    }
                    requestDenied();
                });
                function requestDenied() {
                    _self.remove();
                }
            };

            this.handleMouseDown = function (e) {
                var target = e.domEvent.target;
                if (e.domEvent.button)
                    return;
                var className = target.classList;
                if (className.contains("access_control")) {
                    var actionArr = className.contains("rw") ? ["rw", "r"] : ["r", "rw"];
                    className.remove(actionArr[0]);
                    className.add(actionArr[1]);
                    return;
                }
            };
            
            this.handleMouseUp = function (e) {
                var target = e.domEvent.target;
                var className = target.classList;
                if (e.domEvent.button)
                    return;
                if (e.editor.$mouseHandler.isMousePressed)
                    return;
                if (className.contains("grant")) {
                    var rwClassName = target.previousSibling.classList;
                    var access = rwClassName.contains("rw") ? "rw" : "r";
                    this.acceptRequest(access);
                }
                else if (className.contains("deny")) {
                    this.denyRequest();
                }
            };
        }).call(AccessRequestNotification.prototype);

        NOTIFICATION_TYPES["access_request"] = AccessRequestNotification;
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
            plugin.once("draw", draw);
        });
        plugin.on("enable", function() {

        });
        plugin.on("disable", function() {
        });

        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
            cachedNotifications = [];
            if (notificationsTree)
                notificationsTree.destroy();
            notificationsDataProvider = null;
            notificationsTree = null;
            notificationsParent = null;
            frame = null;
            panelButton = null;
            bubble = null;
        });

        /***** Register and define API *****/

        /**
         * Adds File->New File and File->New Folder menu items as well as the
         * commands for opening a new file as well as an API.
         * @singleton
         **/
        plugin.freezePublicAPI({
            addNotifications: addNotifications
        });

        register(null, {
            notifications: plugin
        });
    }

});