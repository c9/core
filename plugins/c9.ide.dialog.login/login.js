define(function(require, module, exports) {
    main.consumes = [
        "Plugin", "ui", "util", "Dialog"
    ];
    main.provides = ["dialog.login"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var plugin = new Plugin("Ajax.org", main.consumes);
        var ui = imports.ui;
        var util = imports.util;
        
        var emit = plugin.getEmitter();
        
        var dialog, btnChoose, btnCancel;
        var txtUsername, txtPassword, lblExplanation;
        
        var loaded;
        function load() {
            if (loaded) return;
            loaded = true;
        }
    
        var drawn = false;
        function draw(htmlNode) {
            if (drawn) return;
            drawn = true;
            
            // Markup
            ui.insertMarkup(null, require("text!./login.xml"), plugin);
            
            // CSS
            ui.insertCss(require("text!./login.css"), plugin);
            
            dialog = plugin.getElement("window");
            btnChoose = plugin.getElement("btnChoose");
            btnCancel = plugin.getElement("btnCancel");
            txtUsername = plugin.getElement("txtUsername");
            txtPassword = plugin.getElement("txtPassword");
            lblExplanation = plugin.getElement("lblExplanation");
            
            dialog.on("prop.visible", function(e) {
                if (e.value) emit("show");
                else emit("hide");
            });
            
            emit.sticky("draw");
        }
        
        function show(title, description, onChoose, onCancel, options) {
            draw();
            
            lblExplanation.$ext.textContent = description;
            plugin.title = title || "Please Sign In";
            
            var chosen;
            btnChoose.onclick = function() {
                chosen = true;
                
                dialog.disable();
                
                onChoose(txtUsername.value, txtPassword.value, function(success) {
                    dialog.enable();
                    
                    if (success)
                        plugin.hide();
                });
            };
            btnCancel.onclick = function() {
                plugin.hide();
            };
            
            plugin.once("hide", function() {
                if (!chosen && onCancel)
                    onCancel();
            });
            
            // Show UI
            dialog.show();
        }
        
        function hide() {
            dialog && dialog.hide();
        }
        
        /***** Register and define API *****/
        
        /**
         * 
         */
        plugin.freezePublicAPI({
            
            /**
             * 
             */
            get title() { },
            set title(value) {
                if (drawn)
                    dialog.setAttribute("title", value);
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

            /**
             * Show the form. This requires the form to be 
             * {@link #attachTo attached} to an HTML element.
             * @fires show
             */
            show: show,

            /**
             * Hide the form.
             * @fires hide
             */
            hide: hide
        });
        
        register("", {
            "dialog.login": plugin
        });
    }
});