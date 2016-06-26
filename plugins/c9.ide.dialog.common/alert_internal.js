define(function(require, module, exports) {
    main.consumes = ["Dialog", "util", "dialog.alert", "metrics"];
    main.provides = ["dialog.alert_internal"];
    return main;
    
    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var util = imports.util;
        var metrics = imports.metrics;
        var alertWrapper = imports["dialog.alert"];
        
        /***** Initialization *****/
        
        var plugin = new Dialog("Ajax.org", main.consumes, {
            name: "dialog.alert_internal",
            allowClose: true,
            modal: true,
            elements: [
                { type: "checkbox", id: "dontshow", caption: "Don't show again", visible: false },
                { type: "filler" },
                { type: "button", id: "ok", caption: "OK", "default": true, onclick: function(){ plugin.hide() } }
            ]
        });
        alertWrapper.alertInternal = plugin;
        
        /***** Methods *****/
        
        function show(title, header, msg, onhide, options) {
            options = options || {};
            
            metrics.increment("dialog.error");
            
            return plugin.queue(function(){
                if (header === undefined) {
                    plugin.title = "Notice";
                    header = title;
                    msg = msg || "";
                }
                else {
                    plugin.title = title;
                }
                plugin.heading = options.isHTML ? header : util.escapeXml(header);
                plugin.body = options.isHTML ? msg : (util.escapeXml(msg) || "")
                    .replace(/\n/g, "<br />")
                    .replace(/(https?:\/\/[^\s]*\b)/g, "<a href='$1' target='_blank'>$1</a>");
                
                plugin.getElement("ok").setCaption(options.yes || "OK");
                
                plugin.update([
                    { id: "dontshow", visible: options.showDontShow }
                ]);
                
                plugin.once("hide", function(){
                    onhide && onhide();
                });
            });
        }
        
        /***** Register *****/
        
        /**
         * @internal Use dialog.alert instead
         * @ignore
         */
        plugin.freezePublicAPI({
            /**
             * @readonly
             */
            get dontShow(){ 
                return plugin.getElement("dontshow").value;
            },
            
            /**
             * Show an alert dialog.
             * 
             * @param {String} [title]     The title to display
             * @param {String} header      The header to display
             * @param {String} [msg]       The message to display
             * @param {Function} [onhide]  The function to call after it's closed.
             */
            show: show
        });
        
        register("", {
            "dialog.alert_internal": plugin
        });
    }
});