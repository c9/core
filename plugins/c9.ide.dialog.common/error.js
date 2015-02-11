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
        
        var topPx = 0;
        var error, hideTimeout;
        var lastCookie = 0;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            ui.insertCss(require("text!./error.css"), 
                options.staticPrefix, plugin);
        }
        
        /***** Methods *****/

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
                    
                error.style.display = "block";
                error.style.top = (-1 * error.offsetHeight - 10 + topPx) + "px";
                
                // Start anim
                setTimeout(function() {
                    error.className = "errorlabel anim";
                    error.style.top = topPx + "px";
                }, 10);
                
                clearTimeout(hideTimeout);
                if (!(timeout < 0))
                    setTimeout(hide, timeout || 15000);
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
            
            error.className = "errorlabel anim";
            error.style.top = (-1 * error.offsetHeight - 10 + topPx) + "px";
            setTimeout(function() {
                error.style.display = "none";
                callback && callback();
            }, 220);
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
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