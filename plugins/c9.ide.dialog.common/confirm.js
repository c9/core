define(function(require, module, exports) {
    main.consumes = ["Dialog", "util"];
    main.provides = ["dialog.confirm"];
    return main;
    
    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var util = imports.util;
        
        /***** Initialization *****/
        
        var plugin = new Dialog("Ajax.org", main.consumes, {
            name: "dialog.confirm",
            allowClose: false,
            modal: true,
            elements: [
                { type: "button", id: "cancel", caption: "Cancel", hotkey: "ESC", onclick: function(){ plugin.hide() } },
                { type: "button", id: "ok", caption: "OK", color: "green", "default": true, onclick: function(){ plugin.hide() } }
            ]
        });
        
        /***** Methods *****/
        
        function show(title, header, msg, onconfirm, oncancel) {
            return plugin.queue(function(){
                plugin.title = title;
                plugin.heading = util.escapeXml(header);
                plugin.body = util.escapeXml(msg);
                
                plugin.update([
                    { id: "ok", onclick: function(){ plugin.hide(); onconfirm(); } },
                    { id: "cancel", onclick: function(){ plugin.hide(); oncancel && oncancel(); } },
                ]);
            });
        }
        
        /***** Register *****/
        
        plugin.freezePublicAPI({
            show: show
        });
        
        register("", {
            "dialog.confirm": plugin
        });
    }
});