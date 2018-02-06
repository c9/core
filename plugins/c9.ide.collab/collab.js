define(function(require, exports, module) {
"use strict";

    main.consumes = [
        "Panel", "tabManager", "fs", "metadata", "ui", "apf", "settings", 
        "preferences", "ace", "util", "collab.connect", "collab.workspace", 
        "timeslider", "OTDocument", "notification.bubble", "dialog.error", "dialog.alert",
        "collab.util", "error_handler", "layout", "menus", "installer", "c9"
    ];
    main.provides = ["collab"];
    return main;

    function main(options, imports, register) {
        var Panel = imports.Panel;
        var tabManager = imports.tabManager;
        var fs = imports.fs;
        var c9 = imports.c9;
        var metadata = imports.metadata;
        var installer = imports.installer;
        var ui = imports.ui;
        var apf = imports.apf;
        var ace = imports.ace;
        var util = imports.util;
        var collabUtil = imports["collab.util"];
        var settings = imports.settings;
        var prefs = imports.preferences;
        var connect = imports["collab.connect"];
        var workspace = imports["collab.workspace"];
        var bubble = imports["notification.bubble"];
        var timeslider = imports.timeslider;
        var OTDocument = imports.OTDocument;
        var showAlert = imports["dialog.alert"].show;
        var showError = imports["dialog.error"].show;
        var errorHandler = imports.error_handler;
        var layout = imports.layout;
        var menus = imports.menus;

        var css = require("text!./collab.css");

        var plugin = new Panel("Ajax.org", main.consumes, {
            index: 45,
            width: 250,
            caption: "Collaborate",
            buttonCSSClass: "collab",
            panelCSSClass: "collab-bar",
            minWidth: 130,
            where: "right"
        });
        var emit = plugin.getEmitter();

        // open collab documents
        var documents = Object.create(null);
        var openFallbackTimeouts = Object.create(null);
        var saveFallbackTimeouts = Object.create(null);
        var usersLeaving = Object.create(null);
        var failedSaveAttempts = 0;
        var OPEN_FILESYSTEM_FALLBACK_TIMEOUT = 6000;
        var SAVE_FILESYSTEM_FALLBACK_TIMEOUT = 30000;
        var SAVE_FILESYSTEM_FALLBACK_TIMEOUT_REPEATED = 15000;
        
        // Check that all the dependencies are installed
        installer.createSession("c9.ide.collab", require("./install"));

        var loaded = false;
        function load() {
            if (loaded) return;
            loaded = true;

            connect.on("message", onMessage);
            connect.on("connecting", onConnecting);
            connect.on("connect", onConnectMsg);
            connect.on("disconnect", onDisconnect);

            metadata.on("beforeReadFile", beforeReadFile, plugin);
            fs.on("afterReadFile", afterReadFile, plugin);
            fs.on("beforeWriteFile", beforeWriteFile, plugin);

            ace.on("initAceSession", function(e) {
                var doc = e.doc;
                var path = doc.tab.path;
                var otDoc = documents[path];
                if (otDoc && !otDoc.session)
                    otDoc.setSession(doc.getSession().session);
            });

            tabManager.on("focusSync", function(e) {
                var tab = e.tab;
                var otDoc = documents[tab.path];
                if (otDoc && !otDoc.session) {
                    var doc = tab.document;
                    var docSession = doc.getSession();
                    docSession && otDoc.setSession(docSession.session);
                }
            });
            
            tabManager.on("focus", function(e) {
                var tab = e.tab;
                if (tab && tab.editor) {
                    var id = getTabId(tab);
                    id && connect.send("MESSAGE", {
                        action: "focus",
                        clientId: workspace.myClientId,
                        userId: workspace.myUserId,
                        tabId: id
                    });
                }
            });
            
            plugin.on("userMessage", function(e) {
                if (e.action == "focus") {
                    workspace.updateOpenDocs(e, "activate");
                }
            });
            
            ui.insertCss(css, null, plugin);

            window.addEventListener("unload", function() {
                leaveAll();
            }, false);
            
            tabManager.on("open", function(e) {
                var tab = e.tab;
                tab.on("setPath", function(e) {
                    onSetPath(tab, e.oldpath, e.path);
                });
            });

            tabManager.on("tabDestroy", function(e) {
                leaveDocument(e.tab.path);
            }, plugin);

            // Author layer settings
            var showAuthorInfoKey = "user/collab/@show-author-info";
            prefs.add({
                "General": {
                    "Collaboration": {
                        "Show Authorship Info": {
                            type: "checkbox",
                            position: 8000,
                            path: showAuthorInfoKey
                        }
                    }
                }
            }, plugin);

            settings.on("read", function () {
                settings.setDefaults("user/collab", [["show-author-info", true]]);
                refreshActiveDocuments();
            }, plugin);

            settings.on("user/collab", function () {
                refreshActiveDocuments();
            }, plugin);
            
            workspace.on("sync", scheduleUpdateUserBadges);
            scheduleUpdateUserBadges();
        }

        var drawn = false;
        function draw(options) {
            if (drawn) return;
            drawn = true;

            var bar = options.aml;
            var html = bar.$int;
            emit.sticky("drawPanels", { html: html, aml: bar });
        }

        function onDisconnect() {
            for (var docId in documents) {
                var doc = documents[docId];
                doc.disconnect();
            }
            // bubbleNotification("Collab disconnected");
            emit("disconnect");
        }

        function onConnecting () {
            // bubbleNotification("Collab connecting");
        }

        function onConnectMsg(msg) {
            workspace.syncWorkspace(msg.data);

            for (var docId in documents)
                documents[docId].load();

            // bubbleNotification(msg.err || "Collab connected");
            emit("connect");
        }

        function onMessage(msg) {
            var data = msg.data || {};
            var user = data && data.userId && workspace.getUser(data.userId);
            var type = msg.type;
            var docId = data.docId;
            if (docId && "/~".indexOf(docId[0]) === -1)
                docId = data.docId = "/" + docId;
            var doc = documents[docId];

            if (!connect.connected && type !== "CONNECT")
                return console.warn("[OT] Not connected - ignoring:", msg);

            if (data.clientId && data.clientId === workspace.myOldClientId)
                return console.warn("[OT] Skipping my own 'away' disconnection notifications");

            switch (type) {
                case "CHAT_MESSAGE":
                    data.increment = true;
                    emit("chatMessage", data);
                    break;
                case "USER_JOIN":
                    user = data.user;
                    if (!user)
                        break;
                    workspace.joinClient(user, data.clientId);
                    notifyUserOnline(user);
                    break;
                case "USER_LEAVE":
                    workspace.leaveClient(data.userId, data.clientId);
                    notifyUserOffline(user);
                    break;
                case "LEAVE_DOC":
                    workspace.updateOpenDocs(data, "leave");
                    doc && doc.clientLeave(data.clientId);
                    break;
                case "JOIN_DOC":
                    workspace.updateOpenDocs(data, "join");
                    if (workspace.myClientId !== data.clientId)
                        return;
                    if (!doc)
                        return console.warn("[OT] Received msg for file that is not open - docId:", docId, "open docs:", Object.keys(documents));
                    doc.joinData(data);
                    break;
                case "RESOLVE_CONFLICT":
                    emit("resolveConflict", { path: docId });
                    break;
                case "LARGE_DOC":
                    doc && doc.leave();
                    doc && reportLargeDocument(doc, !msg.data.response);
                    delete documents[docId];
                    break;
                case "DOC_CHANGED_ON_DISK":
                    reportDocChangedOnDisk(docId);
                    break;
                case "DOC_HAS_PENDING_CHANGES":
                    reportDocHasPendingChanges(docId);
                    break;
                    
                case "USER_STATE":
                    workspace.updateUserState(data.userId, data.state);
                    break;
                case "CLEAR_CHAT":
                    emit("chatClear", data);
                    break;
                case "MESSAGE":
                    if (emit("userMessage", data) !== false)
                        handleUserMessage(data);
                    break;
                case "ERROR":
                    errorHandler.log(
                        data.err || new Error("Collab error"), 
                        util.extend({}, { users: workspace.users, userId: workspace.myUserId, clientId: workspace.myClientId }, data)
                    );
                    break;
                case "POST_PROCESSOR_ERROR":
                    emit("postProcessorError", data);
                    return;
                case "RESET_DB":
                    showAlert("Uh oh!",
                        "Workspace issue encountered",
                        "Your workspace encountered an issue, but don’t worry, we’ve resolved it. " +
                        "Your data is still intact, however your file revision history may have been lost. " +
                        "Give us just a moment to complete the recovery so you can get back to your project. ", 
                        function() { 
                            setTimeout(function() { 
                                window.location.reload();
                            }, 1000); 
                        }
                    ); 
                    break;
                default:
                    if (!doc)
                        return console.warn("[OT] Received msg for file that is not open", docId, msg);
                    if (doc.loaded)
                        doc.handleMessage(msg);
                    else
                        console.warn("[OT] Doc ", docId, " not yet inited - MSG:", msg);
            }
        }
        
        function notifyUserOffline(user) {
            clearTimeout(usersLeaving[user.fullname]);
            usersLeaving[user.fullname] = setTimeout(function() {
                if (!user.online)
                    bubbleNotification("went offline", user);
                delete usersLeaving[user.fullname];
            }, 4000);
        }
        
        function notifyUserOnline(user) {
            if (usersLeaving[user.fullname]) {
                // User left for like 4 seconds, don't notify
                clearTimeout(usersLeaving[user.fullname]);
                return;
            }
            if (user.online <= 1)
                bubbleNotification("came online", user);
        }

        /**
         * Join a document and report progress and on-load contents
         * @param {String} docId
         * @param {Document} doc
         * @param {Function} [progress]
         */
        function joinDocument(docId, doc, progress) {
            console.log("[OT] Join", docId);
            var docSession = doc.getSession();
            var aceSession = docSession && docSession.session;
            if (!aceSession)
                console.warn("[OT] Ace session not ready for:", docId, "- will setSession when ready!");

            var otDoc = documents[docId] || new OTDocument(docId, doc);

            if (aceSession)
                otDoc.setSession(aceSession);

            if (progress)
                setupProgressCallback(otDoc, progress);

            if (documents[docId])
                return console.warn("[OT] Document previously joined -", docId,
                "STATE: loading:", otDoc.loading, "loaded:", otDoc.loaded, "inited:", otDoc.inited);

            documents[docId] = otDoc;

            // test late join - document syncing - best effort
            if (connect.connected)
                otDoc.load();

            return otDoc;
        }

        function setupProgressCallback(otDoc, progress) {
            otDoc.on("joinProgress", function(e) {
                progress && progress(e.loaded, e.total, e.complete);
            });
        }

        function leaveDocument(docId) {
            if (!docId || !documents[docId] || !connect.connected)
                return;
            console.log("[OT] Leave", docId);
            var doc = documents[docId];
            doc.leave(); // will also dispose
            delete documents[docId];
        }
        
        function reportLargeDocument(doc, forceReadonly) {
            var docId = doc.id;
            delete documents[doc.id];
            if (workspace.isAdmin && !forceReadonly) {
                if (workspace.onlineCount === 1)
                    return console.log("File is very large, collaborative editing disabled: " + docId);
                return showError("File is very large, collaborative editing disabled: " + docId, 5000);
            }
            showError("File is very large. Collaborative editing disabled: " + docId, 5000);
            var tab = tabManager.findTab(docId);
            if (!tab || !tab.editor)
                return;
            tab.classList.add("error");
            if (doc.readonly)
                return;
            doc.readonly = true;
        }
        
        function reportDocChangedOnDisk(path) {
            emit("change", {
                path: path,
                type: "change",
            });
        }
        
        function reportDocHasPendingChanges(path) {
            var tab = tabManager.findTab(path);
            if (tab) {
                setTimeout(function() {
                    // Make the tab show as unsaved
                    tab.document.undoManager.bookmark(-2);
                }, 50);
            }
        }

        function saveDocument(docId, fallbackFn, fallbackArgs, callback) {
            var doc = documents[docId];
            var joinError;
            clearTimeout(saveFallbackTimeouts[docId]);

            saveFallbackTimeouts[docId] = setTimeout(function() {
                console.warn("[OT] collab saveFallbackTimeout while trying to save file", docId, "- trying fallback approach instead");
                fsSaveFallback();
                doc.off("saved", onSaved);
                failedSaveAttempts++;
                emit("saveFallbackStart", { path: docId });
            }, SAVE_FILESYSTEM_FALLBACK_TIMEOUT * Math.pow(2, -Math.min(failedSaveAttempts, 5)));
            
            function onSaved(e) {
                doc.off("saved", onSaved);
                clearTimeout(saveFallbackTimeouts[docId]);
                if (e.err) {
                    if ((e.code == "ETIMEOUT" || e.code == "EMISMATCH") && fallbackFn) {
                        // The vfs socket is probably dead ot stale
                        console.warn("[OT] collab error:", e.code, "trying to save file", docId, "- trying fallback approach instead");
                        return fsSaveFallback({ code: e.code, err: e.err });
                    } else {
                        sendSaveError({ code: e.code, err: e.err }, "Collab saving failed on unexpected error");
                    }
                } else {
                    failedSaveAttempts = 0;
                }
                callback(e.err);
            }

            function fsSaveFallback(attempt) {
                var message = doc && doc.loaded
                    ? "Warning: using fallback saving on loaded document"
                    : "Warning: using fallback saving on unloaded document";
                if (doc && doc.saveStateDebugging) {
                    message = "Warning: using fallback saving due to save timeout";
                }

                console.warn(message, attempt);

                fallbackFn.apply(null, fallbackArgs);
            }
            
            function sendSaveError(attempt, message) {
                errorHandler.reportError(new Error(message), {
                    docId: docId,
                    loading: doc && doc.loading,
                    loaded: doc && doc.loaded,
                    inited: doc && doc.inited,
                    rejoinReason: doc && doc.rejoinReason,
                    state: doc && doc.state,
                    stateWhenSaveCalled: doc && doc.stateWhenSaveCalled,
                    saveStateDebugging: doc && doc.saveStateDebugging,
                    joinError: joinError,
                    connected: connect.connected,
                    attempt: attempt,
                    failedSaveAttempts: failedSaveAttempts
                }, ["collab"]);
            }

            if (!doc.loaded || !connect.connected) {
                if (connect.connected && !doc.loaded && !doc.loading) {
                    // broken state we are not joined and not trying to join
                    clearTimeout(saveFallbackTimeouts[docId]);
                    fsSaveFallback("document not joined and not trying to join");
                    return;
                }
                doc.once("joined", function(e) {
                    joinError = e && e.err;
                    if (e && !e.err)
                        doCollabSave();
                });
            } 
            else {
                doCollabSave();
            }

            function doCollabSave() {
                doc.on("saved", onSaved);
                doc.save();
            }
        }

        function leaveAll() {
            Object.keys(documents).forEach(function(docId) {
                leaveDocument(docId);
            });
        }

        function refreshActiveDocuments() {
            for (var docId in documents) {
                var doc = documents[docId];
                var tab = doc.original.tab;
                if (tab.pane.activeTab === tab && doc.inited)
                    doc.authorLayer.refresh();
            }
        }

        /*
        function getDocumentsWithinPath(path) {
            var docIds = Object.keys(documents);
            var docs = [];
            for (var i = 0, l = docIds.length; i < l; ++i) {
                var doc = documents[docIds[i]];
                if (doc.id.indexOf(path) === 0)
                    docs.push(doc);
            }
            return docs;
        };
        */

        /**
         * Start a Collab session with each metadata read.
         *
         * e.path
         * e.tab
         * e.callback
         * e.progress
         */
        function beforeReadFile(e) {
            var path = e.path;
            var progress = e.progress;
            var callback = e.callback;
            if (!path || e.tab.editorType != "ace")
                return;
            var otDoc = documents[path];
            if (!otDoc)
                otDoc = documents[path] = joinDocument(path, e.tab.document, progress);
            else
                setupProgressCallback(otDoc, progress);

            otDoc.on("joined", onJoined);
            otDoc.on("largeDocument", reportLargeDocument.bind(null, otDoc));
            otDoc.on("joinProgress", startWatchDog);
            otDoc.on("beforeSave", function(e) {
                emit("beforeSave", e);
            });
            
            // Load using XHR while collab not connected
            if (!connect.connected) {
                // Someone else listening to beforeReadFile
                // will have to call our callback
                callback = null;
                return;
            }
            
            startWatchDog();

            var fallbackXhrAbort;
            return {
                abort: function() {
                    if (fallbackXhrAbort)
                        fallbackXhrAbort();
                    else
                        console.log("TODO: [OT] abort joining a document");
                }   
            };

            function startWatchDog() {
                clearTimeout(openFallbackTimeouts[path]);
                openFallbackTimeouts[path] = setTimeout(function() {
                    console.warn("[OT] JOIN_DOC timed out:", path, "- fallback to filesystem, but don't abort");
                    fsOpenFallback();
                    otDoc.off("joined", onJoined);
                }, OPEN_FILESYSTEM_FALLBACK_TIMEOUT);
            }

            function onJoined(e) {
                otDoc.off("joined", onJoined);
                clearTimeout(openFallbackTimeouts[path]);
                openFallbackTimeouts[path] = null;
                if (e.err) {
                    if (e.err.code != "ENOENT" && e.err.code != "ELARGE")
                        console.warn("[OT] JOIN_DOC failed:", path, "- fallback to filesystem");
                    return fsOpenFallback();
                }
                console.log("[OT] Joined", otDoc.id);
                callback && callback(e.err, e.contents, e.metadata);
            }

            function fsOpenFallback() {
                var xhr = fs.readFileWithMetadata(path, "utf8", callback || function() {}, progress) || {};
                fallbackXhrAbort = ((xhr && xhr.abort) || function() {}).bind(xhr);
            }
        }

        /**
         * Normalize tab contents after file read.
         */
        function afterReadFile(e) {
            var path = e.path;
            var tab = tabManager.findTab(path);
            var doc = documents[path];
            if (!tab || !doc || doc.loaded)
                return;
            var httpLoadedValue = tab.document.value;
            var normHttpValue = collabUtil.normalizeTextLT(httpLoadedValue);
            if (httpLoadedValue !== normHttpValue)
                tab.document.value = normHttpValue;
        }

        /**
         * Save using collab server for OT-enabled documents.
         * Overrides the normal file writing behavior.
         */
        function beforeWriteFile(e) {
            var path = e.path;
            var tab = tabManager.findTab(path);
            var doc = documents[path];

            // Fall back to default writeFile if not applicable
            if (!doc || !tab)
                return;
            if (timeslider.visible)
                return false;

            // Override default writeFile
            var args = e.args.slice();
            var progress = args.pop();
            var callback = args.pop();
            var defaultWriteFile = e.fn;
            saveDocument(path, defaultWriteFile, e.args, callback);
            return false;
        }

        function onSetPath(tab, oldpath, path) {
            console.log("[OT] detected rename/save as from", oldpath, "to", path);
            leaveDocument(oldpath);
            joinDocument(path, tab.document);
            // TODO this is flaky, there should be rename command in the server
            documents[path].once("joined", function(e) {
                if (e.err) {
                    leaveDocument(oldpath);
                    setTimeout(joinDocument(path, tab.document), SAVE_FILESYSTEM_FALLBACK_TIMEOUT_REPEATED);
                }
            });
        }

        function bubbleNotification(msg, user) {
            if (!user)
                return bubble.popup(msg);

            var md5Email = user.md5Email;
            console.log("Collab:", user.fullname, msg);
            bubble.popup([
                ["img", { width: 26, height: 26, class: "gravatar-image",
                    src: "https://secure.gravatar.com/avatar/" + md5Email + "?s=26&d=retro" }],
                ["span", null, user.fullname, ["span", { class: "notification_sub" }, msg]]
            ]);
        }
        
        /***** sync tabs *****/
        function getTabState(tabId) {
            var tab;
            if (tabId) {
                tabManager.getTabs().some(function(t) {
                    if (getTabId(t) == tabId) {
                        return (tab = t);
                    }
                });
            } else {
                tab = tabManager.focussedTab;
            }
            if (!tab) return;
            var state = tab.getState();
            var doc = state.document;
            if (doc) {
                doc.value = doc.undoManager = doc.meta = undefined;
                if (doc.ace) {
                    // doc.ace.folds = doc.ace.options = undefined;
                    doc.ace = { selection: doc.ace.selection };
                }
            }
            state.className = undefined;
            return state;
        }
        
        function getTabId(tab) {
            if (!tab || !tab.document)
                return;
            var meta = tab.document.meta;
            if (meta.preview || meta.newfile)
                return;
            if (tab.editorType == "terminal")
                return "terminal:" + (tab.document.getState().terminal || {}).id;
            if (tab.editorType == "output") {
                var state = tab.document.getState().output;
                var config = state.config || {};
                return "run-config:" + (config.name || state.id);
            }
            if (tab.editorType == "preview")
                return tab.name;
            if (tab.path)
                return tab.path;
        }
        
        var lastJump;
        function revealUser(clientId, tabId) {
            if (clientId == workspace.myClientId) {
                handleUserMessage({
                    action: "open",
                    target: clientId,
                    tabState: lastJump
                });
            } else {
                connect.send("MESSAGE", {
                    source: workspace.myClientId,
                    target: clientId,
                    action: "getTab",
                    tabId: tabId
                });
            }
        }
        
        function listOpenFiles(clientId) {
            connect.send("MESSAGE", {
                source: workspace.myClientId,
                target: clientId,
                action: "listOpenFiles"
            });
        }
        
        function handleUserMessage(data) {
            if (data.action == "getTab") {
                if (data.target == workspace.myClientId) {
                    connect.send("MESSAGE", {
                        source: workspace.myClientId,
                        target: data.source,
                        action: "open",
                        tabState: getTabState(data.tabId),
                    });
                }
            } else if (data.action == "open") {
                if (data.target == workspace.myClientId) {
                    if (data.tabState) {
                        var tabState = getTabState() || {};
                        if (shouldUpdateLastJump(lastJump, tabState, data.tabState))
                            lastJump = tabState;
                        data.tabState.focus = true;
                        if (data.tabState.document)
                            delete data.tabState.document.filter;
                        tabManager.open(data.tabState);
                    }
                }
            } else if (data.action == "listOpenFiles") {
                if (data.fileList) {
                    workspace.updateOpenDocs({
                        clientId: data.source,
                        userId: data.userId,
                        fileList: data.fileList
                    }, "set");
                } else if (data.target == workspace.myClientId) {
                    var openFiles = tabManager.getTabs().map(function(tab) {
                        return getTabId(tab);
                    }).filter(Boolean);
                    var active = openFiles.indexOf(getTabId(tabManager.focussedTab));
                    connect.send("MESSAGE", {
                        userId: workspace.myUserId,
                        source: workspace.myClientId,
                        target: data.source,
                        action: "listOpenFiles",
                        fileList: {
                            active: active,
                            documents: openFiles
                        }
                    });
                }
            }
        }
        
        function shouldUpdateLastJump(prevState, state, newState) {
            function getSelection(s) {
                return s && s.document && s.document.ace && s.document.ace.selection;
            }
            if (!prevState) return true;
            if (!newState.name) return false;
            var prevSel = JSON.stringify(getSelection(prevState));
            var sel = JSON.stringify(getSelection(state));
            var newSel = JSON.stringify(getSelection(newState));
            if (prevState.name == state.name && newSel == sel) {
                return false;
            }
            if (state.name == newState.name && newSel == sel)
                return false;
            return true;
        }
        
        function scheduleUpdateUserBadges() {
            if (scheduleUpdateUserBadges.timer) return;
            scheduleUpdateUserBadges.timer = setTimeout(function() {
                scheduleUpdateUserBadges.timer = null;
                updateUserBadges();
            }, 10);
        }
        
        function updateUserBadges() {
            var users = workspace.users;
            var myId = workspace.myUserId;
            Object.keys(users).forEach(function(id) {
                if (id == myId) return;
                var user = users[id];
                if (!user.online)
                    return menus.remove("user_" + id);
                if (menus.getMenuId("user_" + id)) 
                    return;
                addButton(id, user.fullname, user.md5Email);
            });
            
            function addButton(uid, name, md5Email) {
                menus.remove("user_" + uid);
                var parent = layout.getElement("barExtras");
                
                // Create Menu
                var mnuUser = new ui.menu();
                plugin.addElement(mnuUser);
                
                // Add named button
                var icon = util.getGravatarUrl(md5Email, 32, "");
                menus.addItemByPath("user_" + uid + "/", mnuUser, 110000, plugin);
                
                // Add sub menu items
                var c = 500;
                menus.addItemByPath("user_" + uid + "/Open Active File", new ui.item({
                    onclick: function() {
                        var user = workspace.users[uid];
                        revealUser(user.clients[0]);
                    }
                }), c += 100, plugin);
                
                var button = menus.get("user_" + uid).item;
                button.setAttribute("class", "btnName");
                button.setAttribute("icon", icon);
                button.setAttribute("iconsize", "16px 16px");
                button.setAttribute("tooltip", name);
                if (options.showFullNameInMenuBar) {
                    button.setAttribute("caption", name);
                }
                if (button.$ext)
                    button.$ext.style.color = collabUtil.formatColor(workspace.colorPool[uid]);
                ui.insertByIndex(parent, button, 550, plugin);
            }
        }

        
        /***** Lifecycle *****/
        plugin.on("newListener", function(event, listener) {
            if (event == "connect" && connect.connected)
                listener();
        });
        plugin.on("load", function() {
            load();
        });
        plugin.on("draw", function(e) {
            draw(e);
        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = true;
        });

        /**
         * @singleton
         */
        plugin.freezePublicAPI({
            _events: [
                /**
                 * Fires when the collab panel is first drawn to enable sub-collab-panels to listen and render correctly
                 * @event drawPanels
                 * @param {Object}   e
                 * @param {HTMLElement}   e.html  the html element to build collan panels on top of
                 * @param {AMLElement}    e.aml   the apf element to build collan panels on top of
                 */
                "drawPanels",
                /**
                 * Fires when the collab is connected and the collab workspace is synced
                 * @event connect
                 */
                "connect",
                /**
                 * Fires when a chat message arrives (the chat plugin should listen to it to get chat messages)
                 * @event chatMessage
                 * @param {Object}   e
                 * @param {String}   e.userId     the chat message author user id
                 * @param {String}   e.text       the chat text to diaplay
                 * @param {Boolean}  e.increment  should the chat counter be incremented (not yet implemented)
                 */
                "chatMessage",
                
                "beforeSave",
                
                "message"
            ],
            /**
             * Get a clone of open collab documents
             * @property {Object} documents
             */
            get documents() { return util.cloneObject(documents); },
            /**
             * Specifies whether the collab is connected or not
             * @property {Boolean} connected
             */
            get connected() { return connect.connected; },
            /**
             * Specifies whether the collab debug is enabled or not
             * @property {Boolean} debug
             */
            get debug() { return connect.debug; },
            /**
             * Get the open collab document with path
             * @param  {String}     path the file path of the document
             * @return {OTDocument} the collab document open with this path
             */
            getDocument: function (path) { return documents[path]; },
            /**
             * Send a message to the collab server
             * @param  {String}     type    the type of the message
             * @param  {Object}     message the message body to send
             */
            send: function(type, message) { connect.send(type, message); },
            /**
             * @ignore
             */
            revealUser: revealUser,
            listOpenFiles: listOpenFiles,
            leaveDocument: leaveDocument,
            joinDocument: joinDocument,
            
        });

        register(null, {
            "collab": plugin
        });
    }
});
