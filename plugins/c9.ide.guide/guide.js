define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "commands", "menus", "settings", "info", 
        "c9.analytics", "c9"
    ];
    main.provides = ["guide"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var menus = imports.menus;
        var commands = imports.commands;
        var settings = imports.settings;
        var c9 = imports.c9;
        var info = imports.info;
        var analytics = imports["c9.analytics"];
        
        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var RIGHT = 1 << 1;
        var LEFT = 1 << 2;
        var BOTTOM = 1 << 3;
        var TOP = 1 << 4;
        
        var THINGY_MARGIN = 0;
        var THINGY_SIZE = 10;
        var POPUP_MARGIN = 17;
        
        var thingies, popup, showing, currentPopup;
        var timer, listen;

        function load() {
            menus.addItemByPath("Support/Show Guided Tour", new ui.item({
                onclick: show,
            }), 150, plugin);
        }

        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;

            // Insert CSS
            ui.insertCss(require("text!./style.css"), options.staticPrefix, plugin);

            // Draw the thingies
            thingies.forEach(drawThingy);

            emit("draw");
        }

        /***** Methods *****/
        
        function add(t) {
            if (!(t instanceof Array))
                t = [t];
            
            if (!thingies)
                thingies = t;
            else {
                t.forEach(function(i) { 
                    thingies.push(i); 
                    if (!drawn)
                        drawThingy(i);
                });
            }
        }
        
        function setPosition(htmlNode, pos, def, width, height, margin, isThingy, isUpdate) {
            htmlNode.style.right = 
            htmlNode.style.left = 
            htmlNode.style.top = 
            htmlNode.style.bottom = "";
            
            function right() { return window.innerWidth - pos.left - pos.width; }
            function bottom() { return window.innerHeight - pos.top - pos.height; }
            
            var offsetW = isThingy ? width / 2 : 0;
            var offsetH = isThingy ? height / 2 : 0;
            var corW = isThingy ? 0 : width;
            var corH = isThingy ? 0 : height;
            var maxW = window.innerWidth - corW - margin;
            var maxH = window.innerHeight - corH - margin;
            
            var where = isThingy ? def.where : def.wherePopup || def.where;
            
            if (where & LEFT) {
                if (def.attachment & RIGHT)
                    htmlNode.style.right = (right() + pos.width - offsetW + margin) + "px";
                else
                    htmlNode.style.left = (pos.left - corW - offsetW - margin) + "px";
            }
            else if (where & RIGHT) {
                if (def.attachment & RIGHT)
                    htmlNode.style.right = (right() + pos.width + margin - offsetW) + "px";
                else
                    htmlNode.style.left = (pos.left + pos.width + margin - offsetW) + "px";
            }
            else {
                if (def.attachment & RIGHT)
                    htmlNode.style.right = Math.max(margin, (right() + ((pos.width - width) / 2))) + "px";
                else
                    htmlNode.style.left = Math.min(maxW, Math.max(margin, (pos.left + ((pos.width - width) / 2)))) + "px";
            }
            
            if (where & TOP) {
                if (def.attachment & BOTTOM)
                    htmlNode.style.bottom = (bottom() + pos.height - offsetH + margin) + "px";
                else
                    htmlNode.style.top = (pos.top - corH - offsetH - margin) + "px";
            }
            else if (where & BOTTOM) {
                if (def.attachment & BOTTOM)
                    htmlNode.style.bottom = (bottom() + pos.height + margin - offsetH) + "px";
                else
                    htmlNode.style.top = (pos.top + pos.height + margin - offsetH) + "px";
            }
            else {
                if (def.attachment & BOTTOM)
                    htmlNode.style.bottom = Math.max(margin, (bottom() + ((pos.height - height) / 2))) + "px";
                else
                    htmlNode.style.top = Math.min(maxH, Math.max(margin, (pos.top + ((pos.height - height) / 2)))) + "px";
            }
            
            if (!isThingy) updateBalloon(htmlNode, def);
        }
        
        function updateBalloon(htmlNode, def) {
            var h;
            
            htmlNode.classList.remove("balloon-right", "balloon-left", 
                "balloon-top", "balloon-bottom");
            
            var where = def.wherePopup || def.where;
            
            if (where & LEFT) htmlNode.classList.add("balloon-right"), h = 0;
            else if (where & RIGHT) htmlNode.classList.add("balloon-left"), h = 0;
            if (where & BOTTOM) htmlNode.classList.add("balloon-top"), h = 1;
            else if (where & TOP) htmlNode.classList.add("balloon-bottom"), h = 1;
            
            var balloon = popup.firstElementChild;
            balloon.style.left =
            balloon.style.top = "";
            
            if (!(where & BOTTOM))
                balloon.classList.add("white");
            else
                balloon.classList.remove("white");
            
            if (htmlNode.className.match(/balloon/g).length == 2) 
                return;
            
            if (h == 0) {
                balloon.style.top = (def.thingy.offsetTop - htmlNode.offsetTop - THINGY_SIZE - 1) + "px";
            }
            else {
                balloon.style.left = (def.thingy.offsetLeft - htmlNode.offsetLeft - THINGY_SIZE - 1) + "px";
            }
        }

        function drawThingy(def) {
            var el = typeof def.query === "function"
                ? def.query()
                : document.querySelector(def.query);
            
            if (!el) return;
            
            var thingy = document.body.appendChild(document.createElement("div"));
            thingy.className = "thingy";
                
            var pos = el.getBoundingClientRect();
            setPosition(thingy, pos, def, THINGY_SIZE, THINGY_SIZE, THINGY_MARGIN, true);
            
            thingy.onclick = function() { togglePopup(def); };
            
            def.body = def.body.replace(/\$\{key:([a-zA-Z]+)\}/g, function(match, name) {
                var key = commands.getHotkey(name);
                if (commands.platform == "mac")
                    key = apf.hotkeys.toMacNotation(key);
               return key;
            });
            
            def.el = el;
            def.thingy = thingy;
        }
        
        function togglePopup(def) {
            if (popup && currentPopup === def) {
                hidePopup(true);
                return;
            }
            showPopup(def);
        }
        
        function showPopup(def) {
            analytics.track("Showed Guide Popup", { title: def.name });
            if (!popup) {
                popup = document.body.appendChild(document.createElement("div"));
                popup.className = "thingy-popup";
                // popup.title = def.title;
                
                popup.innerHTML = "<div class='balloon'></div>"
                    + "<span class='close'></span>" 
                    + "<span class='title'></span>" 
                    + "<p></p>"
                    + "<div class='tourButtons'>"
                        + "<a href='javascript:void(0)' class='skip' title='Reopen the tour via the Help menu'>End Tour</a>"
                    + "</div>";
                
                var buttons = popup.querySelector(".tourButtons");
                popup.querySelector(".skip").onclick = function() { hide(); };
                var btnDone = new ui.button({
                    htmlNode: buttons,
                    skin: "btn-default-css3",
                    style: "display:inline-block;",
                    "class": "btn-green",
                    onclick: function() {
                        var idx = thingies.indexOf(currentPopup);
                        
                        while (thingies[++idx] && !thingies[idx].thingy) {}
                        if (!thingies[idx]) {
                            idx = -1;
                            while (thingies[++idx] && !thingies[idx].thingy) {}
                        }
                        if (!thingies[idx] || thingies[idx].thingy.style.display == "none") {
                            return hidePopup();
                        }
                        
                        showPopup(thingies[idx]);
                    }
                });
                btnDone.oCaption.parentNode.innerHTML = "Next <span class='arrow'>&#x21E5;</span>";
                
                popup.querySelector(".close").onclick = function() {
                    hidePopup();
                };
            }
            else {
                hidePopup();
            }
            
            popup.style.transition = "";
            popup.classList.remove("green", "blue", "orange");
            popup.classList.add(def.color);
            if (def.width)
                popup.style.width = def.width + "px";
            
            popup.querySelector("span.title").innerHTML = def.title;
            popup.querySelector("p").innerHTML = def.body;
            
            if (!def.thingy) return;
            
            var thingy = def.thingy;
            var pos = thingy.getBoundingClientRect();
            
            popup.style.display = "block";
            thingy.classList.add("active");
            setPosition(popup, pos, def, popup.offsetWidth, popup.offsetHeight, POPUP_MARGIN);
            
            if (def.onshow)
                def.onshow();
            
            currentPopup = def;
        }
        
        function hidePopup(onlyCurrent) {
            if (currentPopup) {
                if (!onlyCurrent) {
                    currentPopup.thingy.style.display = "none";
                    currentPopup.shown = true;
                }
                currentPopup.thingy.classList.remove("active");
                
                if (!onlyCurrent)
                    emit("close", currentPopup);
                    
                currentPopup = null;
            }
            
            popup.style.display = "none";
        }
        
        function enable() {
            timer = setInterval(check, 1000);
            document.body.addEventListener("mouseup", delayCheck);
        }
        
        function disable() {
            clearInterval(timer);
            document.body.removeEventListener("mouseup", delayCheck);
        }
        
        function check() {
            thingies.forEach(function(def) {
                if (def.shown) return;
                
                if (!def.thingy) {
                    drawThingy(def);
                    
                    if (def.thingy && !currentPopup)
                        showPopup(def);
                }
                else if (def.el && !def.el.offsetHeight && !def.el.offsetWidth) {
                    if (currentPopup == def)
                        hidePopup();
                        
                    def.thingy.parentNode.removeChild(def.thingy);
                    def.thingy = def.el = null;
                }
                else {
                    // [NO] This was breaking IDE in the cs50 workspace.
                    if (!def || !def.el) return;
                    
                    var pos = def.el.getBoundingClientRect();
                    setPosition(def.thingy, pos, def, 
                        THINGY_SIZE, THINGY_SIZE, THINGY_MARGIN, true);
                    
                    if (currentPopup == def) {
                        var p = def.thingy.getBoundingClientRect();
                        pos = { 
                            left: parseFloat(def.thingy.style.left) || p.left, 
                            width: p.width,
                            top: parseFloat(def.thingy.style.top) || p.top, 
                            height: p.height 
                        };
                        
                        popup.style.transition = "0.5s";
                        
                        setPosition(popup, pos, def, popup.offsetWidth, 
                            popup.offsetHeight, POPUP_MARGIN, false, true);
                    }
                }
            });
        }
        function delayCheck() {
            setTimeout(check, 500);
        }

        function show(list) {
            if (!c9.isReady) 
                return c9.on("ready", function() { 
                    setTimeout(function() { show(list); }); 
                });
            
            draw();

            thingies.forEach(function(def) {
                if (!def.thingy || list && list[def.name]) {
                    if (def.thingy)
                        def.thingy.style.display = "none";
                    return;
                }
                
                if (!def.el)
                    drawThingy(def);
                
                else if (!def.el.offsetWidth && !def.el.offsetHeight) {
                    delete def.el;
                    return;
                }
                
                def.thingy.style.display = "block";
                def.shown = false;
            });

            emit("show");
            showing = true;
            
            enable();
        }

        function hide() {
            if (!drawn) return;

            thingies.forEach(function(def) {
                if (!def.thingy) return;
                
                def.thingy.style.display = "none";
                def.thingy.classList.remove("active");
                delete def.shown;
            });
            hidePopup();

            currentPopup = null;

            emit("hide");
            showing = false;
            
            disable();
        }

        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            drawn = false;
            showing = false;
            thingies = null;
            popup = null;
            showing = null;
            currentPopup = null;
            timer = null;
            listen = null;
        });

        /***** Register and define API *****/

        /**
         * This is an example of an implementation of a plugin.
         * @singleton
         */
        plugin.freezePublicAPI({
            /**
             * @property showing whether this plugin is being shown
             */
            get showing() {
                return showing;
            },

            _events: [
                /**
                 * @event show The plugin is shown
                 */
                "show",

                /**
                 * @event hide The plugin is hidden
                 */
                "hide"
            ],

            /**
             * Add Bubbles
             */
            add: add,

            /**
             * Show the plugin
             */
            show: show,

            /**
             * Hide the plugin
             */
            hide: hide,
        });

        register(null, {
            "guide": plugin
        });
    }
});