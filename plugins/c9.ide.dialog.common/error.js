define(function(require, exports, module) {
    "use strict";

    main.consumes = ["Plugin", "ui"];
    main.provides = ["dialog.error"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var topPx = 0;
        var lastCookie = 0;
        var offset = 0;
        var error, hideTimeout, disconnect;
        
        var DISCONNECTDELAY = 1000;
        
        function load() {
            ui.insertCss(require("text!./error.css"), 
                options.staticPrefix, plugin);
        }
        
        function initDisconnectEvents(vfs){
            var timer;
            
            vfs.once("connect", function(){
                vfs.connection.on("reconnectDelay", function(e){
                    clearInterval(timer);
                    
                    var delay = e.delay;
                    if (delay > 999) {
                        timer = setInterval(function(){
                            if (vfs.connected)
                                return clearInterval(timer);
                            
                            delay -= 1000;
                            showDisconnect({ delay: delay });
                            
                            if (delay <= 0)
                                clearInterval(timer);
                        }, 1000);
                    }
                    
                    showDisconnect(e);
                });
            });
            vfs.on("away", function(){
            });
            vfs.on("back", function(){
                hideDisconnect();
            });
            vfs.on("connect", function(){
                hideDisconnect();
            });
            vfs.on("disconnect", function(){
                // setTimeout(function(){
                //     showDisconnect();
                // }, DISCONNECTDELAY);
            });
            vfs.on("connecting", function(){
                showDisconnect({ connecting: true });
            });
            plugin.on("retryConnect", function(){
                vfs.connection.reconnect(0);
            });
        }
        
        /***** Methods *****/

        function getCenterX(){
            var bartools = document.querySelector(".bartools");
            if (!bartools) return 0; // For testing
            
            var b1 = bartools.getBoundingClientRect();
            var b2 = bartools.nextSibling.getBoundingClientRect();
            
            return b1.left + b1.width + ((b2.left - b1.left - b1.width)/2);
        }

        function show(message, timeout) {
            // Error message container
            if (!error) {
                error = document.body.appendChild(document.createElement("div"));
                error.className = "errorlabel";
                error.addEventListener("mouseup", function(e) {
                    if (e.target.tagName == "U")
                        hide();
                });
            }
            
            if (!message) {
                console.trace();
                return console.error("empty error message", message);
            }
            
            console.error("Error:", 
                message.stack || message.html || message.message || message);
            
            hide(function () {
                var messageString;
                if (typeof message == "string") {
                    messageString = apf.escapeXML(message);
                }
                else {
                    if (message.message)
                        messageString = apf.escapeXML(message.message);
                    else if (message.html)
                        messageString = message.html;
                    else
                        messageString = "Error: " + message.toString();
                }
                error.innerHTML = "<div><u class='close'></u>" 
                    + messageString + "</div>";
                    
                error.style.opacity = 0;
                error.style.display = "block";
                error.style.top = (offset - (error.offsetHeight - 10 + topPx)) + "px";
                error.firstChild.style.marginLeft = Math.max(0, (getCenterX() - (error.firstChild.offsetWidth / 2))) + "px";
                
                // Start anim
                setTimeout(function() {
                    error.className = "errorlabel anim " + (offset > 0 ? "fade-in" : "");
                    error.style.top = (offset + topPx) + "px";
                    error.style.opacity = 1;
                }, 10);
                
                clearTimeout(hideTimeout);
                if (!(timeout < 0))
                    hideTimeout = setTimeout(hide, timeout || 15000);
            });
            
            return ++lastCookie;
        }
        
        function hide(cookie, callback) {
            if (typeof cookie === "function")
                return hide(null, cookie);
            
            if (cookie && lastCookie !== cookie)
                return callback && callback();            
            if (!error || error.style.display === "none")
                return callback && callback();
            
            error.className = "errorlabel anim " + (offset > 0 ? "fade-in" : "");
            if (offset > 0)
                error.style.opacity = 0;
            else
                error.style.top = (-1 * error.offsetHeight - 10 + topPx) + "px";
            
            setTimeout(function() {
                error.style.display = "none";
                callback && callback();
            }, 220);
        }
        
        function showDisconnect(options){
            // Error message container
            if (!disconnect) {
                disconnect = document.body.appendChild(document.createElement("div"));
                disconnect.className = "disconnectlabel";
                disconnect.addEventListener("mouseup", function(e) {
                    if (e.target.tagName == "U")
                        emit("retryConnect");
                });
            }
                
            var message;
            if (!options || options.delay < 1000 || options.connecting)
                message = "Reconnecting...";
            else if (options.delay)
                message = "Reconnecting in " + Math.ceil(options.delay/1000) 
                    + " seconds." 
                    + (options.delay < 2001 ? "" : " <u>Retry Now.</u>");
            else
                message = "Reconnecting...";
            
            disconnect.innerHTML = "<div>" + message + "</div>";
            disconnect.firstChild.style.marginLeft 
                = Math.max(0, (getCenterX() - 150)) + "px";
            
            if (disconnect.style.display == "block")
                return;
                
            disconnect.style.display = "block";
            disconnect.style.top = (-1 * disconnect.offsetHeight - 10 + topPx) + "px";
            
            // Start anim
            setTimeout(function() {
                disconnect.className = "disconnectlabel anim";
                disconnect.style.top = (topPx) + "px";
            }, 10);
            
            offset = 28;
            
            // document.querySelector(".c9-offline").addEventListener("click", function(){
            //     alert("Offline Notication", "You are currently offline.", 
            //       "This indicator notifies you that Cloud9 is unable to reach "
            //       + "the server. This usually happens because you are offline. "
            //       + "Some features will be disabled until the "
            //       + "network connection becomes available again. "
            //       + "This notication could also show when the server is "
            //       + "unreachable due to other reasons. Sometimes a refresh of "
            //       + "the tab will fix an issue. Please e-mail "
            //       + "support@c9.io for further problem resolution.");
            // }, false);
        }
        
        function hideDisconnect(cookie, callback) {
            if (!disconnect || disconnect.style.display === "none")
                return callback && callback();
            
            disconnect.className = "disconnectlabel anim";
            disconnect.style.top = (-1 * disconnect.offsetHeight - 10 + topPx) + "px";
            setTimeout(function() {
                disconnect.style.display = "none";
                callback && callback();
            }, 220);
            
            offset = 0;
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            topPx = 0;
            lastCookie = 0;
            offset = 0;
            error = null;
            hideTimeout = null;
            disconnect = null;
        });
        
        /***** Register and define API *****/
        
        /**
         * Show error messages to the user
         * 
         * This plugin provides a way to display error messages to the user.
         * 
         * @singleton
         **/
        plugin.freezePublicAPI({
            get top(){ return topPx; },
            set top(value){ topPx = value; },
            
            get vfs(){ throw new Error("Permission Denied"); },
            set vfs(v){ initDisconnectEvents(v); },
            
            /**
             * 
             */
            showDisconnect: showDisconnect,
            
            /**
             * 
             */
            hideDisconnect: hideDisconnect,
            
            /**
             * Displays an error message in the main error reporting UI.
             * @param {String} message  The message to display.
             */
            show: show,
            
            /**
             * Hides the main error reporting UI.
             */
            hide: hide,
        });
        
        register(null, { "dialog.error" : plugin });
    }
});