define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "tabManager"
    ];
    main.provides = ["terminal.monitor.message_view"];
    return main;

    function main(options, imports, register) {
        var ui = imports.ui;
        var Plugin = imports.Plugin;
        var tabManager = imports.tabManager;
        
        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var handleEmit = plugin.getEmitter();
        var css = require("text!./message_view.css");
        var html = require("text!./message_view.html");
        
        var messageStack = [];

        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            // Load CSS
            ui.insertCss(css, null, plugin);
            
            tabManager.on("tabAfterActivateSync", function() {
                toggleMessages();
            });
            tabManager.on("tabAfterClose", function(e) {
                messageStack = messageStack.filter(function(msg) {
                    if (e.tab !== msg.tab)
                        return true;
                    hide(msg, true);
                    return false;
                });
            });
        }
        
        function handleClick(e) {
            switch (e.target.getAttribute("data-type")) {
                case "preview": 
                    handlePreview(e);
                default:
                    messageStack.some(function(msg) {
                        if (msg.domNode.contains(e.target)) hide(msg);
                    });
            }
        }
        
        function handlePreview(e) {
            e.preventDefault();
            tabManager.open({
                editorType: "preview",
                active: true,
                document: {
                    preview: {
                        path: e.target.innerText
                    }
                }
            }, function(err, tab) {});
        }
        
        function isAlreadyShowingMessage(messages, text) {
            return messages.some(function(message) {
                return message.text == text;
            });
        }
        
        function toggleMessages() {
            messageStack.forEach(function(message) {
                if (message.tab.active) {
                    message.domNode.style.display = 'table';
                } else {
                    message.domNode.style.display = 'none';
                }
            });
        }
        
        function showMessage(message) {
            var messageNode = message.domNode;
            var referenceNode = message.tab.editor.container;
            var messageContainer = createMessageContainer(referenceNode);
            messageContainer.insertBefore(messageNode, messageContainer.firstChild);
            message.timeStamp = Date.now();
            
            messageNode.style.display = message.tab.active ? 'table' : 'none';
            setTimeout(function() {
                messageNode.style.opacity = 1;
            });
        }
        
        function createMessageContainer(referenceNode) {
            var messageContainer = referenceNode.querySelector('.ace_editor>.terminal_monitor_messageContainer');
            if (messageContainer) 
                return messageContainer;
            
            messageContainer = document.createElement('div');
            messageContainer.className = 'terminal_monitor_messageContainer';
            var aceContainer = referenceNode.querySelector('.ace_editor');
            aceContainer.addEventListener('keydown', function onKeydown(e) {
                var lastMessage;
                for (var i = messageStack.length; i--;) {
                    var message = messageStack[i];
                    if (message.domNode.parentNode == messageContainer && message.tab.active) {
                        lastMessage = message;
                        break;
                    }
                }
                if (!lastMessage)
                    return;
                if (e.keyCode == 27 || e.timeStamp - lastMessage.timeStamp > 30000) {
                    hide(lastMessage);
                    messageStack = messageStack.filter(function(msg) {
                        return msg.domNode.parentNode;
                    });
                }
                if (!messageContainer.children.length) {
                    aceContainer.removeEventListener('keydown', onKeydown, true);
                    messageContainer.parentNode.removeChild(messageContainer);
                }
            }, true);
            aceContainer.appendChild(messageContainer);
            return messageContainer;
        }
        
        function createMessageNode(text) {
            var messageNode = ui.insertHtml(null, html, plugin)[0];
            var contentNode = messageNode.querySelector(".message");
            contentNode.innerHTML = text;
            contentNode.onclick = handleClick;
            return messageNode;
        }
        
        function setupMessageAction(message, action) {
            if (!action)
                return;
            
            var actionNode = message.domNode.querySelector(".cmd");
            var caption = message.domNode.querySelector(".caption");
            caption.innerHTML = action.label;
            actionNode.style.display = 'table';
            actionNode.onclick = function() {
                caption.innerHTML = "Please wait...";
                handleEmit('action', action.cmd, message);
            };
        }
        
        function setupCloseHandler(message) {
            var closeNode = message.domNode.querySelector('.close');
            closeNode.onclick = function() {
                hide(message);
            };
        }
        
        function repositionMessages(tab) {
            var messages = messageStack.filter(function(message) {
                return message.tab == tab;
            });
            
            messages.forEach(function(message) {
                showMessage(message);
            });
        }
        
        function show(text, action, tab) {
            if (!tab)
                return;
                
            var messages = messageStack.filter(function(message) {
                return message.tab == tab;
            });
            
            if (isAlreadyShowingMessage(messages, text))
                return;
                
            var message = {
                tab: tab,
                domNode: createMessageNode(text),
                action: action,
                text: text
            };
            
            setupMessageAction(message, action);
            setupCloseHandler(message);
            showMessage(message);
            
            messageStack.push(message);
        }
        
        function hide(message, batch) {
            var domNode = message.domNode;
            if (domNode.parentNode)
                domNode.parentNode.removeChild(domNode);
            
            if (batch) return;
            messageStack = messageStack.filter(function(msg) {
                return msg.domNode != message.domNode;
            });
        }
        
        plugin.on("load", function() {
            load();
        });
        
        plugin.freezePublicAPI({
            show: show,
            hide: hide,
            repositionMessages: repositionMessages
        });

        register(null, {
            "terminal.monitor.message_view": plugin
        });
    }
});
