define(function(require, module, exports) {
    main.consumes = ["Dialog", "util"];
    main.provides = ["dialog.filechange"];
    return main;
    
    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var util = imports.util;
        
        /***** Initialization *****/
        
        var plugin = new Dialog("Ajax.org", main.consumes, {
            name: "dialog.filechange",
            title: "File changed",
            body: "<p>You or a collaborator has changed this file.</p>"
                           + "Which version would you like to use?",
            allowClose: false,
            modal: false,
            width: 600,
            elements: [
                { type: "checkbox", id: "applyall", caption: "Apply to all changed files" },
                { type: "filler" },
                { type: "button", id: "keepmine", caption: "Keep Mine", color: "blue" },
                { type: "button", id: "useremote", caption: "Use Remote", color: "blue" },
                { type: "button", id: "mergeboth", caption: "Merge Both", color: "green", "default": true },
            ]
        });
        
        /***** Methods *****/
        
        function show(title, header, body, onlocal, onremote, onmerge, options) {
            options = options || {};
            return plugin.queue(function() {
                plugin.title = title;
                plugin.heading = util.escapeXml(header);
                if (body) plugin.body = util.escapeXml(body);
                
                var cb = plugin.getElement("applyall");
                cb.uncheck();
                cb.setAttribute("visible", options.all !== false);
                
                if (options.merge) {
                    var mergeBoth = plugin.getElement("mergeboth");
                    if (options.merge.caption) mergeBoth.setAttribute("caption", options.merge.caption);
                }
                
                
                plugin.update([
                    { id: "keepmine", onclick: function() { plugin.hide(); onlocal(cb.value); } },
                    { id: "useremote", onclick: function() { plugin.hide(); onremote(cb.value); } },
                    { id: "mergeboth", visible: !!options.merge, onclick: function() { plugin.hide(); onmerge(cb.value); } }
                ]);
            });
        }
        
        /***** Register *****/
        
        plugin.freezePublicAPI({
            /**
             * 
             */
            set all(value) {
                plugin.update([
                    { id: "applyall", visible: value }
                ]);
            },
            
            /**
             * 
             */
            show: show
        });
        
        register("", {
            "dialog.filechange": plugin,
        });
    }
});