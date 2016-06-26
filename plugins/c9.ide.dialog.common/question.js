define(function(require, module, exports) {
    main.consumes = ["Dialog", "util"];
    main.provides = ["dialog.question"];
    return main;
    
    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var util = imports.util;
        
        /***** Initialization *****/
        
        var plugin = new Dialog("Ajax.org", main.consumes, {
            name: "dialog.question",
            allowClose: false,
            modal: true,
            elements: [
                { type: "checkbox", id: "dontask", caption: "Don't ask again", visible: false },
                { type: "button", id: "yestoall", caption: "Yes to All", color: "green", visible: false },
                { type: "button", id: "notoall", caption: "No to All", color: "red", "default": true, visible: false },
                { type: "filler" },
                { type: "button", id: "yes", caption: "Yes", color: "green", "default": true, hotkey: "Y" },
                { type: "button", id: "no", caption: "No", color: "red", hotkey: "N" },
                { type: "button", id: "cancel", caption: "Cancel", visible: false, hotkey: "ESC" }
            ]
        });
        
        /***** Methods *****/
        
        function show(title, header, msg, onYes, onNo, options) {
            if (onYes && typeof onYes !== "function")
                return show(title, header, msg, null, null, onYes);
            if (onNo && typeof onNo !== "function")
                return show(title, header, msg, onYes, null, onNo);
            
            if (!options)
                options = {};
                
            return plugin.queue(function(){
                var all = options.all;
                var cancel = options.cancel;
                var showDontAsk = options.showDontAsk;
                var metadata = options.metadata;
                
                plugin.title = title;
                plugin.heading = options && options.isHTML ? header : util.escapeXml(header);
                plugin.body = options && options.isHTML ? msg : util.escapeXml(msg).replace(/\n/g, "<br>");
                
                plugin.getElement("yes").setCaption(options.yes || "Yes");
                plugin.getElement("no").setCaption(options.no || "No");
                plugin.getElement("yestoall").setCaption(options.yestoall || "Yes to All");
                plugin.getElement("notoall").setCaption(options.notoall || "No to All");
                
                plugin.allowClose = cancel;
                
                var gotYesNo = false;
                plugin.once("hide", function(){
                    !gotYesNo && cancel && onNo && onNo(false, true, metadata);
                });
                
                plugin.update([
                    { id: "cancel", visible: cancel, onclick: function(){ plugin.hide(); } },
                    { id: "dontask", visible: showDontAsk }, 
                    { id: "yestoall", visible: all, onclick: function(){ 
                        gotYesNo = true; 
                        plugin.hide(); 
                        onYes && onYes(true, metadata); 
                    }},
                    { id: "notoall", visible: all, onclick: function(){ 
                        gotYesNo = true;
                        plugin.hide(); 
                        onNo && onNo(true, false, metadata); 
                    }},
                    { id: "yes", onclick: function(){ 
                        gotYesNo = true; 
                        plugin.hide(); 
                        onYes && onYes(false, metadata); 
                    }},
                    { id: "no", onclick: function(){ 
                        gotYesNo = true;
                        plugin.hide(); 
                        onNo && onNo(false, false, metadata); 
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
            get all(){ return undefined },
            set all(value) {
                plugin.update([
                    { id: "yestoall", visible: value},
                    { id: "notoall", visible: value}
                ]);
            },
            
            /**
             * 
             */
            get cancel(){ return undefined },
            set cancel(value) {
                plugin.allowClose = value;
                plugin.update([
                    { id: "cancel", visible: value }
                ]);
            },
            
            /**
             * 
             */
            get showDontAsk(){ 
                return plugin.getElement("dontask").visible;
            },
            set showDontAsk(value) {
                plugin.update([
                    { id: "dontask", visible: value }
                ]);
            },
            
            /**
             * @readonly
             */
            get dontAsk(){ 
                return plugin.getElement("dontask").value;
            },
            
            /**
             * 
             */
            show: show
        });
        
        register("", {
            "dialog.question": plugin
        });
    }
});