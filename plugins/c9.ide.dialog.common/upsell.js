define(function(require, module, exports) {
    main.consumes = ["Dialog", "util"];
    main.provides = ["dialog.upsell"];
    return main;
    
    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var util = imports.util;
        
        /***** Initialization *****/
        
        var plugin = new Dialog("Ajax.org", main.consumes, {
            name: "dialog.upsell",
            allowClose: true,
            modal: true,
            elements: [
                { type: "filler" },
                { type: "button", id: "no", caption: "Cancel", hotkey: "ESC", skin: "c9-simple-btn", margin: "7 10 0 0" },
                { type: "button", id: "yes", caption: "Go Premium!", color: "green", "default": true, hotkey: "Y" }
            ]
        });
        
        /***** Methods *****/
        
        function show(onYes, onNo, title, header, msg, options) {
            if (!options)
                options = {isHTML: true};
                
            return plugin.queue(function(){
                var all = options.all;
                var cancel = options.cancel;
                var showDontAsk = options.showDontAsk;
                var metadata = options.metadata;
                
                title = title || "This is a Premium feature";
                header = header || "Get Premium Support Now!";
                msg = msg || 'Help is just a few clicks away. Check out our <a href="https://c9.io/pricing" target="_blank">amazing premium plans</a>.'
                
                plugin.title = title;
                plugin.heading = options && options.isHTML ? header : util.escapeXml(header);
                plugin.body = options && options.isHTML ? msg : util.escapeXml(msg).replace(/\n/g, "<br>");
                
                plugin.getElement("yes").setCaption(options.yes || "Go Premium!");
                plugin.getElement("no").setCaption(options.no || "Cancel");

                plugin.allowClose = cancel;
                
                var gotYesNo = false;
                plugin.once("hide", function(){
                    !gotYesNo && cancel && onNo(false, true, metadata);
                });
                
                plugin.update([
                    { id: "yes", onclick: function(){ 
                        gotYesNo = true; 
                        plugin.hide(); 
                        onYes(false, metadata); 
                    }},
                    { id: "no", onclick: function(){ 
                        gotYesNo = true;
                        plugin.hide(); 
                        onNo(false, false, metadata); 
                    }}
                ]);
            }, options.queue === false);
        }
        
        /***** Register *****/
        
        /**
         *
         */
        plugin.freezePublicAPI({
            
            /**
             * 
             */
            show: show
        });
        
        register("", {
            "dialog.upsell": plugin
        });
    }
});