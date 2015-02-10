define(function(require, module, exports) {
    main.consumes = ["Dialog", "util"];
    main.provides = ["dialog.fileoverwrite"];
    return main;
    
    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var util = imports.util;
        
        /***** Initialization *****/
        
        // @todo think about merging this with question.
        
        var plugin = new Dialog("Ajax.org", main.consumes, {
            name: "dialog.fileoverwrite",
            allowClose: false,
            modal: true,
            elements: [
                { type: "button", id: "yestoall", caption: "Overwrite All", color: "green", visible: false },
                { type: "button", id: "notoall", caption: "Skip All", color: "red", "default": true, visible: false },
                { type: "filler" },
                { type: "button", id: "yes", caption: "Overwrite", color: "green", "default": true, hotkey: "Y" },
                { type: "button", id: "no", caption: "Skip", color: "red", hotkey: "N" },
                { type: "button", id: "cancel", caption: "Cancel", visible: false, hotkey: "ESC" }
            ]
        });
        
        /***** Methods *****/
        
        function show(title, header, msg, onOverwrite, onSkip, options) {
            return plugin.queue(function(){
                var all = options.all;
                var cancel = options.cancel;
                var metadata = options.metadata;
                
                plugin.title = title;
                plugin.heading = util.escapeXml(header);
                plugin.body = util.escapeXml(msg);
                
                plugin.allowClose = cancel;
                
                var gotYes = false;
                plugin.once("hide", function(){
                    !gotYes && cancel && onSkip(false, true, metadata);
                });
                
                plugin.update([
                    { id: "cancel", visible: cancel, onclick: function(){ plugin.hide(); } },
                    { id: "yestoall", visible: all, onclick: function(){ 
                        gotYes = true; 
                        plugin.hide(); 
                        onOverwrite(true, metadata); 
                    }},
                    { id: "notoall", visible: all, onclick: function(){ 
                        plugin.hide(); 
                        onSkip(true, false, metadata); 
                    }},
                    { id: "yes", onclick: function(){ 
                        gotYes = true; 
                        plugin.hide(); 
                        onOverwrite(false, metadata); 
                    }},
                    { id: "no", onclick: function(){ 
                        plugin.hide(); 
                        onSkip(false, false, metadata); 
                    }}
                ]);
            });
        }
        
        /***** Register *****/
        
        plugin.freezePublicAPI({
            show: show
        })
        
        register("", {
            "dialog.fileoverwrite": plugin
        });
    }
});