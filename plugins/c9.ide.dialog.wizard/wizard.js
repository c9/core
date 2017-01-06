define(function(require, module, exports) {
    main.consumes = ["Plugin", "ui", "Dialog"];
    main.provides = ["Wizard", "WizardPage"];
    return main;
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var Dialog = imports.Dialog;
        var ui = imports.ui;
        
        /***** Initialization *****/
        
        function Wizard(developer, deps, options) {
            var plugin = new Dialog(developer, deps.concat(main.consumes), {
                name: "dialog.wizard",
                allowClose: options.allowClose || false,
                class: "wizard " + (options.class || ""),
                height: options.height,
                width: options.width,
                resizable: options.resizable,
                title: options.title,
                modal: options.modal === undefined ? true : options.modal,
                custom: true,
                elements: [
                    { type: "button", id: "cancel", caption: "Cancel", visible: false, onclick: cancel },
                    { type: "filler" },
                    { type: "button", id: "previous", caption: "Previous", visible: false, onclick: previous },
                    { type: "button", id: "next", caption: "Next", color: "green", "default": true, onclick: next },
                    { type: "button", id: "finish", caption: "Finish", visible: false, onclick: finish }
                ]
            });
            
            var emit = plugin.getEmitter();
            
            var path = [];
            var current = -1;
            var body, startPage, lastPage;
            
            var drawn = false;
            function draw(options) {
                if (drawn) return;
                drawn = true;
                
                body = { html: document.createElement("div") };
                options.html.parentNode.replaceChild(body.html, options.html);
            }
            
            /***** Methods *****/
            
            function cancel() {
                emit("cancel", { activePage: lastPage });
            }
            
            function previous() {
                current--;
                activate(path[current]);
                emit("previous", {
                    activePage: path[current]
                });
            }
            
            function next() {
                path.splice(current + 1);
                
                plugin.update([
                    { id: "previous", visible: true }, 
                    { id: "next", visible: true }
                ]);
                
                var page = emit("next", { 
                    activePage: path[path.length - 1] 
                });
                current = path.push(page) - 1;
                
                activate(page, true);
            }
            
            function gotoPage(page) {
                current = path.push(page) - 1;
                activate(page, true);
            }
            
            function finish() {
                plugin.hide(); 
                emit("finish", { activePage: lastPage });
            }
            
            function activate(page, noButtons) {
                var idx = path.indexOf(page);
                if (idx == -1) throw new Error();
                
                if (!noButtons) {
                    plugin.update([
                        { id: "previous", visible: idx > 0 }, 
                        { id: "next", visible: true }
                    ]);
                }
                
                if (lastPage)
                    lastPage.hide();
                page.show(body);
                
                lastPage = page;
            }
            
            function show(reset) {
                return plugin.queue(function() {
                    if (reset || current == -1) {
                        path = [startPage];
                        current = 0;
                        activate(startPage);
                    }
                        
                }, true);
            }
            
            /***** Lifecycle *****/
            
            plugin.on("draw", function(options) {
                draw(options);
            });
            
            /***** Register and define API *****/
            
            plugin.freezePublicAPI.baseclass();
            
            /**
             * 
             */
            plugin.freezePublicAPI({
                /**
                 * 
                 */
                get activePage() { return path[current]; },
                
                /**
                 *
                 */
                get startPage() { return startPage; },
                set startPage(v) { startPage = v; },
                
                /**
                 * 
                 */
                get showPrevious() { 
                    return plugin.getElement("previous").visible;
                },
                set showPrevious(value) {
                    plugin.update([
                        { id: "previous", visible: value }
                    ]);
                },
                
                /**
                 * 
                 */
                get showNext() { 
                    return plugin.getElement("next").visible;
                },
                set showNext(value) {
                    plugin.update([
                        { id: "next", visible: value }
                    ]);
                },
                /**
                 * 
                 */
                get showCancel() { 
                    return plugin.getElement("cancel").visible;
                },
                set showCancel(value) {
                    plugin.update([
                        { id: "cancel", visible: value }
                    ]);
                },
                
                /**
                 * 
                 */
                get showFinish() { 
                    return plugin.getElement("finish").visible;
                },
                set showFinish(value) {
                    plugin.update([
                        { id: "finish", visible: value }
                    ]);
                },
                
                _events: [
                    /**
                     * @event cancel
                     */
                    "cancel",
                    /**
                     * @event previous
                     */
                    "previous",
                    /**
                     * @event next
                     */
                    "next",
                    /**
                     * @event finish
                     */
                    "finish"
                ],
                
                /**
                 * 
                 */
                show: show,
                
                /**
                 * 
                 */
                cancel: cancel,
                
                /**
                 * 
                 */
                previous: previous,
                
                /**
                 * 
                 */
                next: next,
                
                /**
                 * 
                 */
                finish: finish,
                
                /**
                 * 
                 */
                gotoPage: gotoPage
            });
            
            return plugin;
        }
        
        function WizardPage(options, forPlugin) {
            var plugin = new Plugin("Ajax.org", main.consumes);
            var emit = plugin.getEmitter();
            
            var name = options.name;
            var container;
            
            if (forPlugin)
                forPlugin.addOther(function() { plugin.unload(); });
            
            var drawn;
            function draw() {
                if (drawn) return;
                drawn = true;
                
                container = document.createElement("div");
                plugin.addOther(function() {
                    container.parentNode.removeChild(container);
                });
                
                emit.sticky("draw", { html: container });
            }
            
            /***** Methods *****/
            
            function hide() {
                container.parentNode.removeChild(container);
                emit("hide");
            }
            
            function show(options) {
                draw();
                options && options.html.appendChild(container);
                emit("show");
            }
            
            /***** Register and define API *****/
            
            plugin.freezePublicAPI.baseclass();
            
            /**
             * 
             */
            plugin.freezePublicAPI({
                /**
                 * 
                 */
                get name() { return name; },
                
                /**
                 * 
                 */
                get container() { return container; },
                
                _events: [
                    /**
                     * @event hide
                     */
                    "hide",
                    /**
                     * @event show
                     */
                    "show"
                ],
                
                /**
                 * 
                 */
                show: show,
                
                /**
                 * 
                 */
                hide: hide
            });
            
            return plugin;
        }
        
        register("", {
            "Wizard": Wizard,
            "WizardPage": WizardPage,
        });
    }
});