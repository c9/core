define(function(require, module, exports) {
    main.consumes = ["Plugin"];
    main.provides = ["dialog.alert"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var alertInternal;
        
        function show(title, header, msg, onhide, options) {
            if (alertInternal)
                return alertInternal.show(title, header, msg, onhide, options);
            
            alert(title
                + (header ? "\n\n" + header : "")
                + (msg ? "\n\n" + msg : ""));
            onhide && onhide();
        }
        
        function hide() {
            if (alertInternal)
                alertInternal.hide.apply(alertInternal, arguments);
        }
        
        /***** Register *****/
        
        /**
         *
         */
        plugin.freezePublicAPI({
            /**
             * @readonly
             */
            get dontShow(){ 
                return alertInternal && alertInternal.dontShow;
            },
            
            get aml(){
                return alertInternal && alertInternal.aml;
            },
            
            /**
             * Show an alert dialog.
             * 
             * @param {String} [title]     The title to display
             * @param {String} header      The header to display
             * @param {String} [msg]       The message to display
             * @param {Function} [onhide]  The function to call after it's closed.
             */
            show: show,
            
            /**
             * Hide an alert dialog.
             */
            hide: hide,
            
            /**
             * @internal
             */
            get alertInternal() { return alertInternal; },
            
            /**
             * @internal
             */
            set alertInternal(value) {
                alertInternal = value;
                alertInternal.on("show", function(e) {
                    emit("show", e)
                });
                alertInternal.on("hide", function(e) {
                    emit("hide", e)
                });
                alertInternal.on("draw", function(e) {
                    emit.sticky("draw", e)
                });
            },
                
            _events: [
                /**
                 * Fires when the form is drawn.
                 * @event draw
                 */
                "draw",
                /**
                 * Fires when the form becomes visible. This happens when
                 * it's attached to an HTML element using the {@link #attachTo}
                 * method, or by calling the {@link #method-show} method.
                 * @event show
                 */
                "show",
                /**
                 * Fires when the form becomes hidden. This happens when
                 * it's detached from an HTML element using the {@link #detach}
                 * method, or by calling the {@link #method-hide} method.
                 * @event hide
                 */
                "hide"
            ],
        });
        
        register("", {
            "dialog.alert": plugin
        });
    }
});