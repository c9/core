/*global apf*/
define(function(require, exports, module) {
    main.consumes = ["Plugin", "ui"];
    main.provides = ["tooltip"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        /***** Methods *****/
        
        function create(options, oHtml) {
            var div;
    
            if (!options.tooltip) {
                div = document.body.appendChild(document.createElement("div"));
                div.className = "menu-bk downward menu-bkFocus c9-tooltip";
                if (options.width)
                    div.style.width = options.width;
                div.style.position = "absolute";
                div.innerHTML = "<div></div>";
    
                var arrow = div.appendChild(document.createElement("div"));
                arrow.className = "arrow revisionsInfoArrow";
    
                options.tooltip = div;
            }
            else {
                div = options.tooltip;
            }
    
            div.addEventListener("mouseover", ttmouseover);
            div.addEventListener("mouseout", ttmouseout);
    
            div.companion = oHtml;
        }
    
        function add(oHtml, options, plugin) {
            if (oHtml.nodeFunc)
                oHtml = oHtml.$ext;
    
            oHtml.addEventListener("mouseover", mouseover);
            oHtml.addEventListener("mouseout", mouseout);
            oHtml.addEventListener("mousedown", mousedown);
    
            if (options.timeout === undefined)
                options.timeout = 500;
    
            oHtml.c9tooltipOptions = options;
            
            plugin.addOther(function() {
                destroy(oHtml);
            });
            
            return oHtml;
        }
    
        function destroy(oHtml) {
            var options = oHtml.c9tooltipOptions;
            var tooltip = options.tooltip;
    
            if (!tooltip)
                return;
            
            if (tooltip.parentNode)
                tooltip.parentNode.removeChild(tooltip);
            if (tooltip.htmlNodes) {
                tooltip.htmlNodes.forEach(function(oHtml) {
                    oHtml.removeEventListener("mouseover", mouseover);
                    oHtml.removeEventListener("mouseout", mouseout);
                    oHtml.removeEventListener("mousedown", mousedown);
                }, this);
            }
        }
    
        function ttmouseover() {
            var oHtml = this.companion;
            var options = oHtml.c9tooltipOptions;
    
            clearTimeout(options.timer);
            if (options.control)
                options.control.stop();
    
            this.style.display = "none";
        }
    
        function ttmouseout(e) {
            //if (apf.isChildOf(this, e.target, true))
            //  return;
    
            mouseout.call(this.companion);
        }
    
        function mouseover(e) {
            var options = this.c9tooltipOptions;
    
            clearTimeout(options.timer);
            if (options.tooltip)
                clearTimeout(options.tooltip.timer);
    
            if (options.isAvailable && options.isAvailable() === false)
                return;
    
            var _self = this;
            options.timer = setTimeout(function() {
                if (options.control)
                    options.control.stop();
    
                create(options, _self);
    
                options.tooltip.style.display = "block";
    
                var pos;
                if (options.getPosition)
                    pos = options.getPosition();
                else {
                    var p = ui.getAbsolutePosition(_self);
                    pos = [(p[0] - ((options.tooltip.offsetWidth - _self.offsetWidth) / 2)),
                           (p[1])];
                }
                options.tooltip.style.left = pos[0] + "px";
                options.tooltip.style.top = pos[1] + "px";
    
                if (options.message)
                    (options.tooltip.firstElementChild || options.tooltip).innerHTML = options.message;
    
                if (options.animate !== false) {
                    apf.tween.single(options.tooltip,
                        { type: "fade", from: 0, to: 1, steps: 10, interval: 0,
                         control: options.control = {}});
                }
                else {
                    options.tooltip.style.opacity = 1;
                }
            }, options.timeout);
        }
    
        function mouseout(e) {
            var options = this.c9tooltipOptions;
    
            clearTimeout(options.timer);
    
            if (!options.tooltip || options.tooltip.style.display != "block")
                return;
    
            options.timer = options.tooltip.timer = setTimeout(function() {
                if (options.control)
                    options.control.stop();
    
    //            if (options.animate !== false) {
                    apf.tween.single(options.tooltip, {
                        type: "fade", 
                        from: 1, 
                        to: 0, 
                        steps: 10, 
                        interval: 0,
                        control: options.control = {},
                        onfinish: function() { 
                            options.tooltip.style.display = "none";
                        }
                    });
    //            }
    //            else {
    //                options.tooltip.style.display = "none";
    //            }
            }, 200);
        }
    
        function mousedown(e) {
            var options = this.c9tooltipOptions;
    
            clearTimeout(options.timer);
            if (options.tooltip && options.hideonclick) {
                if (options.control)
                    options.control.stop();
    
                options.tooltip.style.display = "none";
            }
        }
        
        /***** Register and define API *****/
        
        /**
         * Adds HTML/CSS stylable tooltips to HTMLElements. 
         * 
         * You can find these tooltips throughout Cloud9. For instance the 
         * {@link findreplace} and {@link findinfiles} plugins use it to display
         * help messages when hovering over the options buttons. The 
         * {@link autosave} plugin uses a tooltip to 
         * explain to the user why the save button no longer works.
         * 
         * This example shows how to add a tooltip to a div that shows
         * after 1 second:
         * 
         *     tooltip.add(someDiv, {
         *         width       : "100px",
         *         timeout     : 1000,
         *         hideonclick : true,
         *         message     : "Use <span style='color:red'>HTML</span> in "
         *             + "this message."
         *     });
         * 
         * This example shows how to add your own HTMLElement as a tooltip to
         * another div that is shown immediately when a user hovers over it. The
         * placement of the tooltip is calculated in the getPosition method.
         * 
         *     tooltip.add(someDiv, {
         *         message : "Some Message",
         *         width   : "auto",
         *         timeout : 0,
         *         tooltip : myTooltipDiv,
         *         animate : false,
         *         getPosition : function(){
         *             var left = 100;
         *             var top = 100;
         *             return [left, top];
         *         }
         *     });
         * 
         * @singleton
         */
        plugin.freezePublicAPI({
            /**
             * Adds a tooltip to an HTMLElement.
             * @param {HTMLElement}  htmlElement              The HTMLElement that a user can hover over to see the tooltip.
             * @param {Object}       options
             * @param {Function}     [options.isAvailable]    Called to determine whether the tooltip should be displayed.
             * @param {Number}       [options.width="200px"]  Specify a CSS string that sets the width. Set to "auto" to automatically size the tooltip.
             * @param {Number}       [options.timeout]        The time in milliseconds the user should hover the `htmlElement` until the tooltip displays.
             * @param {Boolean}      [options.hideonclick]    Specifies whether the tooltip should dissapear when the user clicks on it.
             * @param {String}       [options.message]        The message displayed in the tooltip. This can be any valid HTML string.
             * @param {HTMLElement}  [options.tooltip]        An HTMLElement that is used to display the message. If this option is not specified, an HTMLElement is created automatically.
             * @param {Boolean}      [options.animate=true]   Set to false to turn off the fading animation of the tooltip.
             * @param {Function}     [options.getPosition]    Override the default positioning of the tooltip by returning an array with the left and top position as integers in an Array (e.g [100, 200]).
             * @param {Plugin}       plugin                   The plugin responsible for creating this tooltip. This is necessary for cleanup during the unload phase of the plugin.
             * @return {HTMLElement}
             */
            add: add,
            
            /**
             * Remove a previously created tooltip
             * @param {HTMLElement} htmlElement  The `htmlElement` returned by {@link tooltip#add}.
             */
            destroy: destroy
        });
        
        register(null, {
            tooltip: plugin
        });
    }
});