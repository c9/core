define(function(require, exports, module) {
"use strict";

    main.consumes = [
        "CollabPanel", "ui", "panels", "collab.util", "collab.workspace", 
        "collab", "Menu", "MenuItem"
    ];
    main.provides = ["chat"];
    return main;

    function main(options, imports, register) {
        var CollabPanel = imports.CollabPanel;
        var ui = imports.ui;
        var panels = imports.panels;
        var util = imports["collab.util"];
        var workspace = imports["collab.workspace"];
        var collab = imports.collab;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;

        var html = require("text!./chat.html");
        var css = require("text!./chat.css");
        var timeago = require("timeago");
        var staticPrefix = options.staticPrefix;

        var toDeleteMessage;

        var ROLE_NONE = "n";
        var ROLE_VISITOR = "v";
        var ROLE_COLLABORATOR = "c";
        var ROLE_ADMIN = "a";

        var plugin = new CollabPanel("Ajax.org", main.consumes, {
            name: "chat",
            index: 200,
            caption: "Group Chat",
            textselect: true,
            style: "flex:1;"
        });

        // var emit = plugin.getEmitter();
        var emoji = require("./my_emoji");

        // panel-relared UI elements
        var chatInput, chatText, mnuCtxTreeEl, parent;
        // non-panel related UI elements
        var chatThrob, chatCounter, chatNotif;

        function $(id) {
            return document.getElementById(id);
        }

        var loaded = false;
        function load() {
            if (loaded) return;
            loaded = true;

            collab.on("chatMessage", onChatMessage);
            collab.on("chatClear", onChatClear);
        }

        var drawn = false;
        function draw(options) {
            if (drawn) return;
            drawn = true;

            drawNonPanelElements();

            parent = options.aml;
            var parentExt = parent.$int;
            parentExt.className += " chatContainer";

            chatText = parentExt.appendChild(document.createElement("div"));
            chatText.setAttribute("class", "chatText");

            chatInput = new apf.codebox({
                htmlNode: parentExt,
                skin: "codebox",
                "initial-message": "Enter your message here",
                // clearbutton      : "true",
                focusselect: "true"
            });
            
            chatInput.$ext.classList.remove("ace_searchbox");
            chatInput.ace.setOptions({
                wrap: "free",
                indentedSoftWrap: false,
                maxLines: 5,
                minLines: 2,
                fontFamily: "inherit"
            });
            chatInput.ace.session.$setFontMetrics(chatInput.ace.renderer.$fontMetrics);

            plugin.addElement(chatInput);

            function onWorkspaceSync() {
                var accessInfo = workspace.accessInfo;
                if (accessInfo.private && (!accessInfo.member || accessInfo.pending))
                    return console.warn("Don't have read access - You can't use chat");
                var chatHistory = workspace.chatHistory || [];
                chatHistory.forEach(addMessage);
                scrollDown();
                chatCounter.textContent = chatHistory.length;
            }

            chatInput.ace.commands.addCommands([
                {
                    bindKey: "ESC",
                    exec: function() {
                        if (chatInput.getValue())
                            chatInput.setValue("");
                        else
                            collab.hide();
                    }
                }, {
                    bindKey: "Enter",
                    exec: send
                }
            ]);

            function listenWorkspaceSync() {
                workspace.off("sync", onWorkspaceSync);
                workspace.on("sync", onWorkspaceSync);
            }

            if (panels.isActive("collab"))
                listenWorkspaceSync();

            collab.on("show", function() {
                chatInput.focus();
                listenWorkspaceSync();
            });

            collab.on("hide", function() {
                workspace.off("sync", onWorkspaceSync);
            });

            var deleteMsgItem = new MenuItem({
                caption: "Delete Message",
                match: "rw",
                onclick: clearChatMessage,
                disabled: true
            });

            var clearHistoryItem = new MenuItem({
                caption: "Clear history",
                match: "rw",
                onclick: clearChatHistory,
                disabled: true
            });

            var mnuCtxTree = new Menu({
                id: "mnuChat",
                items: [
                    deleteMsgItem,
                    clearHistoryItem
                ]
            }, plugin);

            mnuCtxTreeEl = mnuCtxTree.aml;

            parent.setAttribute("contextmenu", mnuCtxTreeEl);

            mnuCtxTree.on("show", function() {
                setTimeout(function() {
                    var hasReadWrite = workspace.fs === "rw";
                    var collabConnected = collab.connected;
                    clearHistoryItem.disabled = !hasReadWrite || !collabConnected || !chatText.firstChild;
                    toDeleteMessage = findMessageToDelete(hasReadWrite);
                    deleteMsgItem.disabled = !toDeleteMessage || !collabConnected;
                }, 10);
            });
            
            parent.on("resize", function() {
                if (isOpen()) {
                    pending.forEach(addMessage);
                    pending = [];
                    updateCaption();
                }
            });
        }

        function findMessageToDelete(hasReadWrite) {
            var menuRect = mnuCtxTreeEl.$int.getBoundingClientRect();
            var msg;
            [].slice.apply(chatText.getElementsByTagName("p")).forEach(function(msgP) {
                var rect = msgP.getBoundingClientRect();
                if (rect.left < menuRect.left && (rect.left + rect.width) > menuRect.left
                    && rect.top < menuRect.top && (rect.top + rect.height) > menuRect.top
                    && (hasReadWrite || msgP.userId == workspace.myUserId))
                    msg = msgP;
            });
            return msg;
        }

        function clearChatMessage() {
            if (!toDeleteMessage || !toDeleteMessage.id)
                return console.error("[OT] Chat: no message found to delete!");
            var msgId = toDeleteMessage.id.match(/ot_chat_(\d+)/)[1];
            collab.send("CLEAR_CHAT", { id: msgId });
        }

        function clearChatHistory() {
            collab.send("CLEAR_CHAT", { clear: true });
        }

        var seenMsgs = {};
        var pending = [];
        var throbTimeout;

        function scrollDown() {
            chatText.scrollTop = chatText.scrollHeight;
        }

        function isOpen() {
            return panels.isActive("collab") && parent.state[0] != "m";
        }

        function send() {
            var text = chatInput.getValue().trim();
            if (!text)
                return;
            text = emoji.toEmojiUnicode(text);
            collab.send("CHAT_MESSAGE", { text: text });
            chatInput.setValue("");
        }

        function getAuthorName(userId) {
            if (userId == workspace.myUserId)
                return "You";

            var user = workspace.users[userId];
            return util.escapeHTML(user.fullname);
        }

        function getAuthorColor(userId) {
            var color = workspace.colorPool[userId];
            return util.formatColor(color);
        }

        function formatMessageText(text) {
            text = util.escapeHtmlWithClickableLinks(text.trim(), "_blank");
            text = text.replace(/\n/g, "<br/>");
            text = emoji.emoji(text, staticPrefix);
            return text;
        }

        function onChatMessage(msg) {
            drawNonPanelElements();
            workspace.addChatMessage(msg);
            if (isOpen()) {
                addMessage(msg);
            }
            else {
                pending.push(msg);
                updateCaption();
                
                var throbText = "<b>" + getAuthorName(msg.userId) + "</b> ";
                var text = formatMessageText(msg.text);
                var notif = msg.notification;
                if (notif) {
                    throbText += text + " " + notif.linkText;
                } else {
                     throbText += ": " + text;
                }

                chatThrob.innerHTML = throbText;
                chatThrob.style.display = "block";
                clearTimeout(throbTimeout);
                throbTimeout = setTimeout(function () {
                    chatThrob.style.display = "none";
                }, 5000);
            }

            if (msg.increment) {
                var count = Number(chatCounter.textContent);
                chatCounter.textContent = count + 1;
            }

            var inputFocussed = chatInput && chatInput.ace.isFocused();
            if (!inputFocussed)
                chatNotif.play();
            
        }

        function onChatClear(data) {
            if (data.clear) {
                // fast way to delete all children - not innerHtml = ''
                while (chatText.firstChild)
                    chatText.removeChild(chatText.firstChild);
                seenMsgs = {}; // sql truncate table would lead to same msg ids
                workspace.chatHistory = [];
            }
            else if (data.id) {
                var msgHtml = $("ot_chat_" + data.id);
                msgHtml && msgHtml.parentNode.removeChild(msgHtml);
            }
        }

        function addMessage(msg) {
            if (seenMsgs[msg.id])
                return;
            seenMsgs[msg.id] = true;
            // correct the time
            // msg.timestamp += clientTimeOffset;
            var msgDate = new Date(msg.timestamp);

            // create the time string
            var text = formatMessageText(msg.text);
            var authorName = getAuthorName(msg.userId);
            var authorColor = getAuthorColor(msg.userId);

            var authorNameEl = document.createElement("a");
            authorNameEl.href = "javascript:void(0)";
            authorNameEl.className = "authorName";
            authorNameEl.innerHTML = "<b>" + authorName + "</b>";
            // authorNameEl.addEventListener("click", function () {
            // });

            var html = document.createElement("p");
            html.id = "ot_chat_" + msg.id;
            html.userId = msg.userId;
            
            if (msg.userId == workspace.myUserId)
                html.className = "you";

            var borderEl = document.createElement("span");
            html.appendChild(borderEl);
            borderEl.className = "chatBorder";
            borderEl.style.borderLeftColor = authorColor;

            html.appendChild(authorNameEl);
            var textEl = document.createElement("span");
            textEl.className = "chatmessage";
            textEl.innerHTML = text + "<br/>";
            html.appendChild(textEl);
            var timeEl = document.createElement("span");
            timeEl.className = "chattime";
            timeEl.title = msgDate.toISOString();
            timeEl.innerHTML = msgDate;
            timeago(timeEl);
            html.appendChild(timeEl);

            chatText.appendChild(html);
            scrollDown();
        }
        
        function updateCaption() {
            var caption = "Group Chat";
            if (pending.length) 
                caption += "(" + pending.length + ")";
            if (parent)
                parent.setAttribute("caption", caption);
        }

        var nonPanelDrawn = false;
        function drawNonPanelElements () {
            if (nonPanelDrawn) return;
            nonPanelDrawn = true;

            ui.insertHtml(null, html, plugin);
            ui.insertCss(css, staticPrefix, plugin);

            chatThrob = $("chatThrob");
            chatCounter = $("chatCounter");
            chatNotif = $("chatNotif");
            chatNotif.src = staticPrefix + "/sounds/chat_notif.mp3";

            chatThrob.addEventListener("click", function () {
                chatThrob.style.display = "none";
                plugin.show();
            });
        }

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
            drawn = nonPanelDrawn = false;
        });

        /***** Register and define API *****/

        /**
         * Adds File->New File and File->New Folder menu items as well as the
         * commands for opening a new file as well as an API.
         * @singleton
         **/
        plugin.freezePublicAPI({
        });

        register(null, {
            chat: plugin
        });
    }

});
