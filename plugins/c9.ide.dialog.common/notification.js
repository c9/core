define(function(require, exports, module) {
    "use strict";

    main.consumes = ["Plugin", "ui", "layout", "anims"];
    main.provides = ["dialog.notification"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var layout = imports.layout;
        var anims = imports.anims;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        var count = 0;
        var HEIGHT = 30;
        var container, logo;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            ui.insertCss(require("text!./notification.css"), 
                options.staticPrefix, plugin);
            
            container = layout.findParent(plugin);
            logo = document.querySelector(".c9-mbar-round");
        }
        
        /***** Methods *****/
        
        function show(html, showCloseButton, timeout) {
            var hide, timer;
            
            count++;
            
            // Error message container
            var div = container.$int.appendChild(document.createElement("div"));
            
            if (showCloseButton) {
                div.appendChild(document.createElement("U")).className = "close";
                div.className = "notificationlabel";
                div.addEventListener("mouseup", function(e) {
                    if (e.target.tagName == "U")
                        hide();
                });
            }
            
            ui.insertHtml(div, html, plugin);
            container.show();
            div.style.display = "none";
            
            function show(){
                div.style.display = "block";
                var toHeight = calculateHeight();
                container.setHeight(toHeight - div.offsetHeight);
                
                div.style.zIndex = 10000 - count;
                div.style.marginTop = (-1 * div.offsetHeight) + "px";
                
                anims.animate(div, {
                    marginTop: 0,
                    duration: 0.2,
                    timingFunction: "linear"
                });
                anims.animate(logo, {
                    top: toHeight + "px",
                    duration: 0.2,
                    timingFunction: "linear"
                }, function(){});
                anims.animateSplitBoxNode(container, {
                    height: toHeight + "px",
                    duration: 0.22,
                    timingFunction: "linear"
                }, function(){});
            }
            
            if (timeout) 
                timer = setTimeout(show, timeout);
            else
                show();
            
            hide = _hide.bind(null, div, timer);
            hide.hasClosed = function(){ return !div.parentNode; };
            
            return hide;
        }
        
        function _hide(div, timer, callback) {
            clearTimeout(timer);
            
            if (!div || !div.parentNode)
                return callback && callback();
            
            var toHeight = calculateHeight() - div.scrollHeight;
            anims.animate(div, {
                marginTop: (-1 * div.offsetHeight) + "px",
                duration: 0.2,
                timingFunction: "linear"
            });
            anims.animate(logo, {
                top: toHeight + "px",
                duration: 0.2,
                timingFunction: "linear"
            }, function(){});
            anims.animateSplitBoxNode(container, {
                height: toHeight + "px",
                duration: 0.2,
                timingFunction: "linear"
            }, function(){
                div.parentNode.removeChild(div);
                callback && callback();
                
                if (!count)
                    container.hide();
            });
        }
        
        function calculateHeight(){
            var nodes = container.$ext.childNodes;
            var total = 0;
            for (var i = 0; i < nodes.length; i++) {
                if (nodes[i].nodeType == 1)
                    total += nodes[i].scrollHeight;
            }
            return total;
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        
        /***** Register and define API *****/
        
        /**
         * Show notifications to the user
         * 
         * This plugin provides a way to display error messages to the user.
         * 
         * @singleton
         **/
        plugin.freezePublicAPI({
            /**
             * Displays an error message in the main error reporting UI.
             * @param {String} message  The message to display.
             */
            show: show
        });
        
        register(null, { "dialog.notification" : plugin });
    }
});