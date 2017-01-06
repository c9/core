define(function(require, module, exports) {
    main.consumes = ["Dialog", "util"];
    main.provides = ["dialog.localchanges"];
    return main;
    
    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var util = imports.util;
        
        /***** Initialization *****/
        
        var plugin = new Dialog("Ajax.org", main.consumes, {
            name: "dialog.localchanges",
            title: "Local changes detected",
            heading: "There are local changes that have not yet been committed.",
            body: "Would you like to stash them for later use, discard them or cancel?",
            allowClose: true,
            modal: false,
            width: 475,
            elements: [
                { type: "filler" },
                { type: "button", id: "stash", caption: "Stash", color: "green" },
                { type: "button", id: "discard", caption: "Discard", color: "red" },
                { type: "button", id: "cancel", caption: "Cancel", "default": true },
            ]
        });
        
        /***** Methods *****/
        
        function show(changes, onstash, ondiscard, oncancel, options) {
            options = options || {};
            return plugin.queue(function() {
                if (changes) {
                    plugin.body = "These files have been changes\n" 
                        + util.escapeXml(changes)
                        + "Would you like to stash them for later use, discard them or cancel?";
                }
                
                plugin.update([
                    { id: "cancel", onclick: function() {
                        plugin.hide(); 
                        oncancel();
                    } },
                    { id: "discard", onclick: function() {
                        plugin.hide(); 
                        ondiscard();
                    } }, 
                    { id: "stash", onclick: function() {
                        plugin.hide(); 
                        onstash();
                    } }
                ]);
            });
        }
        
        /***** Register *****/
        
        plugin.freezePublicAPI({
            /**
             * 
             */
            show: show
        });
        
        register("", {
            "dialog.localchanges": plugin,
        });
    }
});