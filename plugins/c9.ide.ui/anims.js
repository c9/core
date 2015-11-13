/*global Firmin */
 
define(function(require, exports, module) {
    main.consumes = ["Plugin", "settings", "util"];
    main.provides = ["anims"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var util = imports.util;
        
        require("./lib_firmin");
                
        var EventEmitter = require("events").EventEmitter;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var animating = false;
        
        /***** Methods *****/
        
        var pfx = apf.isWebkit ? "webkit" : (apf.isIE ? "MS" : "");
        function cssAnimate(el, options, finish) {
            if (options.splitbox)
                return util.nextFrame($cssAnimate.bind(null, el, options, finish));
            // todo using $cssAnimate instead of firmin displays spurious animations when dragging tabs
            Firmin.animate(el, options, options && options.duration || 0.2, function() {
                el.style[apf.CSSPREFIX + "Transition"] = "";
                finish && finish();
            });
        }
        
        function $cssAnimate(el, options, finish) {
            // Duration
            var duration = options.duration || "0.2s";
            if (typeof duration == "string") {
                duration = parseFloat(duration) 
                    * (duration[duration.length - 2] == "m" ? 1 : 0.001);
            }
            el.style[apf.CSSPREFIX + "TransitionDuration"] = duration + "s";
            
            // Delay
            var delay = options.delay || "0s";
            el.style[apf.CSSPREFIX + "TransitionDelay"] = 
                typeof delay == "string" ? delay : delay + "s";
            
            // Timing Function
            var timingFunction = options.timingFunction || 'linear';
            if (timingFunction)
                el.style[apf.CSSPREFIX + "TransitionTimingFunction"] = 
                    timingFunction;
            
            // Properties
            var props = [];
            for (var prop in options){
                if (/duration|delay|timingFunction|immediate/.test(prop)) continue;
                props.push(prop);
            }
            el.style[apf.CSSPREFIX + "TransitionProperty"] = props.join(",");
            
            var eventName = pfx ? pfx + "TransitionEnd" : "transitionend";
            var wait = el.wait = function(e) {
                if (!wait) return;
                el.removeEventListener(eventName, wait, false);
                el.style[apf.CSSPREFIX + "Transition"] = "";
                if (el.wait !== wait)
                    return;
                wait = el.wait = null;
                finish && finish();
            };
            el.addEventListener(eventName, wait, false);
            // fallback in case there is no event
            setTimeout(function() {
                wait && wait();
            }, duration * 1000 + 10);

            props.forEach(function(name){ el.style[name] = options[name] });
        }
        
        function animateMultiple(tweens, finish) {
            var shouldAnimate = settings.getBool("user/general/@animateui");
    
            if (shouldAnimate) {
                animating = true;
                
                var duration = 0, called;
                tweens.forEach(function(options) {
                    var node = options.node;
                    cssAnimate(node.$ext || node, options, function() {
                        if (options.duration == duration && !called) {
                            called = true;
                            finish && finish();
                        }
                        animating = false;
                    });
                    duration = Math.max(duration, options.duration || 0.2);
                });
            }
            else {
                //@todo set value
    
                finish && finish();
            }
        }
    
        function animate(aNode, options, finish) {
            var shouldAnimate = settings.getBool("user/general/@animateui");
    
            if (shouldAnimate) {
                animating = true;
                
                cssAnimate(aNode.$ext || aNode, options, function() {
                    finish && finish(); //setTimeout(finish, 30);
                    
                    animating = false;
                });
            }
            else {
                var htmlNode = aNode.$ext || aNode;
                for (var prop in options) {
                    if (prop == "duration" || prop == "timingFunction")
                        continue;
                    htmlNode.style[prop] = options[prop];
                }
                
                //@todo set value
                finish && finish();
            }
        }
    
        function animateSplitBoxNode(aNode, options, finish) {
            var shouldAnimate = settings.getBool("user/general/@animateui");
    
            var pNode = aNode.parentNode;
            if (!pNode.$box) return oNode && animate(oNode, options, finish);
            
            var firstChild = pNode.getFirstChild();
            var lastChild = pNode.getSecondChild();
            var isFirst, oNode = (isFirst = aNode == firstChild) ? lastChild : firstChild;
            if (oNode == aNode || !oNode.visible)
                throw new Error("animating object that has no partner");
    
            var to2 = { 
                timingFunction : options.timingFunction,
                duration: options.duration
            };
            if (pNode.$vbox) {
                if (isFirst)
                    to2.top = (parseInt(options.height, 10) + pNode.$edge[0] + pNode.padding) + "px";
                else
                    to2.bottom = (parseInt(options.height, 10) + pNode.$edge[2] + pNode.padding) + "px";
            }
            else {
                if (isFirst)
                    to2.left = (parseInt(options.width, 10) + pNode.$edge[3] + pNode.padding) + "px";
                else
                    to2.right = (parseInt(options.width, 10) + pNode.$edge[1] + pNode.padding) + "px";
            }
            
            // Create Event Object
            var e = new EventEmitter();
            e.type = "splitbox";
            e.which = aNode;
            e.other = oNode;
            e.options = options;
            e.options2 = to2;
            e.duration = options.duration || 0.2;
            
            // Emit animate event
            emit("animate", e);

            if (shouldAnimate && !options.immediate) {
                animating = true;

                options.splitbox = to2.splitbox = true;
                cssAnimate(aNode.$ext, options);
                cssAnimate(oNode.$ext, to2, function(){
                    if (aNode.parentNode) {
                        if (pNode.$vbox)
                            aNode.setHeight(parseInt(options.height, 10));
                        else
                            aNode.setWidth(parseInt(options.width, 10));
                    }
                    
                    finish && finish();
                    e.emit("finish");
    
                    animating = false;
                });
            }
            else {
                var dir;
                if (pNode.$vbox) {
                    aNode.setHeight(options.height);
                    dir = isFirst ? "top" : "bottom";
                }
                else {
                    aNode.setWidth(options.width);
                    dir = isFirst ? "left" : "right";
                }
                oNode.$ext.style[dir] = to2[dir];
                
                finish && finish();
                e.emit("finish");
            }
        }
        
        function emitAnimate(e) {
            emit("animate", e);
        }
        
        /***** Register and define API *****/
        
        /**
         * Animation API for Cloud9. Use this object to animate HTML 
         * elements and APF elements. The implementation uses CSS animations
         * to animate the HTML elements.
         * 
         *     anims.animate(someDiv, { 
         *         width    : "200px", 
         *         duration : 0.2 
         *     }, function(){
         *         console.log("done");
         *     });
         * 
         * @singleton
         **/
        plugin.freezePublicAPI({
            /**
             * Specifies whether at least one animationg is running at this moment.
             * @property {Boolean} animating
             */
            get animating(){ return animating; },
            
            _events: [
                /**
                 * Fires when an animation starts
                 * @event animate
                 * @param {Object}                 e
                 * @param {String}                 e.type             The animation type. Possible values are "splitbox", and others.
                 * @param {HTMLElement/AMLElement} e.which            The element that is animated
                 * @param {HTMLElement/AMLElement} e.other            This is only relevant for a splitbox resize, where there is a 2nd element that is animated.
                 * @param {Object}                 e.options          The options passed to the {@link #method-animate} method.
                 * @param {Object}                 e.options2         This is only relevant for a splitbox resize. There are the options for the 2nd animation.
                 * @param {Number}                 [e.duration=0.2]   The duration of the animation expressed in seconds
                 */
                "animate"
            ],
            
            /**
             * Animate multiple elements and/or multiple properties at the
             * same time. Note that each tween object can specify multiple 
             * css properties by adding the names of the css property as a key
             * and the value as it's value.
             * 
             * Example:
             * 
             *     anims.animateMultiple([{
             *         node   : someDiv,
             *         width  : "200px",
             *         height : "300px"
             *     }, {
             *         node   : anotherDiv,
             *         width  : "100px",
             *         height : "100px"
             *     }], function(){});
             * 
             * @param {Array}                  tweens                   Array of tween elements.
             * @param {HTMLElement/AMLElement} tweens.node              The element that is animated
             * @param {Number}                 [tweens.duration=0.2]    The duration of the animation expressed in seconds.
             * @param {String}                 [tweens.timingFunction]  The [CSS timing function](https://developer.mozilla.org/en-US/docs/Web/CSS/timing-function).
             * @param {Function}               finish                   Called when all animations have completed.
             */
            animateMultiple: animateMultiple,
            
            /**
             * Animates a single element and one or more properties.
             * Note that the tween object can contain multiple 
             * css properties by adding the names of the css property as a key
             * and the value as it's value.
             * 
             * Example:
             * 
             *     anims.animateMultiple({
             *         node   : someDiv,
             *         width  : "200px",
             *         height : "300px"
             *     }, function(){});
             * 
             * @param {HTMLElement/AMLElement} node                    The element that is animated
             * @param {Object}                 tween
             * @param {Number}                 [tween.duration=0.2]    The duration of the animation expressed in seconds.
             * @param {String}                 [tween.timingFunction]  The [CSS timing function](https://developer.mozilla.org/en-US/docs/Web/CSS/timing-function).
             * @param {Function}               finish                  Called when all animations have completed.
             */
            animate: animate,
            
            /**
             * This method is dedicated to animating APF Elements that are
             * part of a splitbox layout element. A splitbox is a box that can 
             * be split in 2 by adding 2 children to it. If you are using a
             * splitbox in your UI and need to animate a child element, then 
             * use this function.
             *
             * Note that the tween object can contain multiple 
             * css properties by adding the names of the css property as a key
             * and the value as it's value.
             * 
             * Example:
             * 
             *     anims.animateSplitBoxNode(panel, {
             *         duration : 0.5,
             *         width    : "200px"
             *     }, function(){})
             * 
             * @param {AMLElement} node                    The element that is animated
             * @param {Object}     tween
             * @param {Number}     [tween.duration=0.2]    The duration of the animation expressed in seconds.
             * @param {String}     [tween.timingFunction]  The [CSS timing function](https://developer.mozilla.org/en-US/docs/Web/CSS/timing-function).
             * @param {Function}   finish                  Called when all animations have completed.
             */
            animateSplitBoxNode: animateSplitBoxNode,
            
            /**
             * Emits the animate event, forcing a resize amongst editors.
             * @param {Object} e
             * @private
             */
            emitAnimate: emitAnimate
        });
        
        register(null, {
            anims: plugin
        });
    }
});