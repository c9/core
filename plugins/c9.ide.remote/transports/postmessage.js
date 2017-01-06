define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "commands", "c9"
    ];
    main.provides = ["remote.PostMessage"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var commands = imports.commands;
        var c9 = imports.c9;
        
        var previewBaseUrl = options.previewBaseUrl;
        
        var counter = 0;
        
        function PostMessage(iframe, sessionId) {
            /***** Initialization *****/
            
            var plugin = new Plugin("Ajax.org", main.consumes);
            var emit = plugin.getEmitter();
            
            var windows = [];
            var styleSheets, scripts, html;
            var enableHighlighting = true;
            
            var loaded = false;
            function load() {
                if (loaded) return false;
                loaded = true;
                
                var onMessage = function(e) {
                    if (c9.hosted && e.origin !== previewBaseUrl)
                        return;
                    
                    if (sessionId != e.data.id)
                        return;
                    
                    if (e.data.message == "exec") {
                        commands.exec(e.data.command);
                    }
                    else if (e.data.message == "callback") {
                        var cb = callbacks[e.data.cb];
                        if (cb) {
                            cb(e.data.data);
                            delete callbacks[e.data.cb];
                        }
                    }
                    else if (e.data.message == "focus") {
                        emit("focus");
                    }
                    else if (e.data.message == "html.ready") {
                        var data = e.data.data;
                        styleSheets = data.styles.map(toPath);
                        scripts = data.scripts.map(toPath);
                        html = toPath(data.href);
                        
                        if (windows.indexOf(e.source) == -1)
                            windows.push(e.source);
                        
                        // Send available keys
                        e.source.postMessage({
                            id: sessionId,
                            type: "keys",
                            keys: commands.getExceptionBindings()
                        }, "*");
                        
                        // todo: should this emit e, so that init messages are 
                        // sent only to newly added page?
                        emit("ready");
                    }
                };
                
                window.addEventListener("message", onMessage, false);
                plugin.addOther(function() {
                    window.removeEventListener("message", onMessage, false);
                });
                
                setInterval(function gc() {
                    if (getWindows().length)
                        return;
                    clearInterval(gc);
                    emit("empty");
                }, 5000);
            }
            
            /***** Methods *****/
            
            function toPath(href) {
                href = unescape(href);
                return c9.hosted
                    ? href.replace(new RegExp("^/" + c9.workspaceId), "")
                    : href;
            }
            
            var callbacks = [];
            function wrapCallback(callback) {
                return callbacks.push(callback) - 1;
            }
            
            function getSources(callback) {
                return callback(null, {
                    styleSheets: styleSheets,
                    scripts: scripts,
                    html: html
                });
            }
            
            function getWindows() {
                windows = windows.filter(function(w) {
                    return w && !w.closed;
                });
                return windows;
            }
            
            function send(message) {
                getWindows().forEach(function(w) {
                    w.postMessage(message, "*");
                });
            }
            
            function getStyleSheet() {
                
            }
            
            function getHTMLDocument(callback) {
                var message = {
                    id: sessionId,
                    type: "simpledom",
                    cb: wrapCallback(callback)
                };
                send(message);
            }
            
            function initHTMLDocument(dom) {
                var message = {
                    id: sessionId,
                    type: "initdom",
                    dom: dom
                };
                send(message);
            }
            
            function getScript() {
                
            }
            
            function updateStyleSheet(path, value) {
                var message = {
                    id: sessionId,
                    type: "updatecss",
                    path: path,
                    data: value
                };
                send(message);
            }
            
            function updateStyleRule(url, rule) {
                var message = {
                    id: sessionId,
                    type: "stylerule",
                    url: url,
                    rule: rule
                };
                send(message);
            }
            
            function processDOMChanges(edits) {
                var message = {
                    id: sessionId,
                    type: "domedits",
                    edits: edits
                };
                send(message);
            }
            
            function updateScript() {
                
            }
            
            function deleteStyleSheet(url) {
                var message = {
                    id: sessionId,
                    type: "update",
                    url: url,
                    del: true
                };
                send(message);
            }
            
            function deleteScript() {
                
            }
            
            function reload() {
                var message = {
                    id: sessionId,
                    type: "reload"
                };
                send(message);
            }
            
            var lastQuery;
            function highlightCSSQuery(query, force) {
                if (!force && lastQuery == query || !enableHighlighting) 
                    return;
                    
                lastQuery = query;
                
                var message = {
                    id: sessionId,
                    type: "highlight",
                    query: query
                };
                send(message);
            }
            
            function reveal(query) {
                var message = {
                    id: sessionId,
                    type: "reveal",
                    query: query || lastQuery
                };
                send(message);
            }
            
            /***** Lifecycle *****/
            
            plugin.on("load", function() {
                load();
            });
            plugin.on("enable", function() {
                
            });
            plugin.on("disable", function() {
                
            });
            plugin.on("unload", function() {
                loaded = false;
            });
            
            /***** Register and define API *****/
            
            /**
             * 
             **/
            plugin.freezePublicAPI({
                /**
                 * 
                 */
                get enableHighlighting() { return enableHighlighting; },
                set enableHighlighting(v) { 
                    if (!v) highlightCSSQuery();
                    enableHighlighting = v;
                },
                
                _events: [
                    /**
                     * @event draw
                     */
                    "draw",
                    "empty"
                ],
                
                getWindows: getWindows,
                
                /**
                 * 
                 */
                reload: reload,
                
                /**
                 * 
                 */
                getSources: getSources,
                
                /**
                 * 
                 */
                getStyleSheet: getStyleSheet,
                
                /**
                 * 
                 */
                getHTMLDocument: getHTMLDocument,
                
                /**
                 * 
                 */
                initHTMLDocument: initHTMLDocument,
                
                /**
                 * 
                 */
                getScript: getScript,
                
                /**
                 * 
                 */
                updateStyleSheet: updateStyleSheet,
                
                /**
                 * 
                 */
                updateStyleRule: updateStyleRule,
                
                /**
                 * 
                 */
                processDOMChanges: processDOMChanges,
                
                /**
                 * 
                 */
                updateScript: updateScript,
                
                /**
                 * 
                 */
                deleteStyleSheet: deleteStyleSheet,
                
                /**
                 * 
                 */
                deleteScript: deleteScript,
                
                /**
                 * 
                 */
                highlightCSSQuery: highlightCSSQuery,
                
                /**
                 * 
                 */
                reveal: reveal
            });
            
            plugin.load(null, "postmessage");
            
            return plugin;
        }
        
        register(null, {
            "remote.PostMessage": PostMessage
        });
    }
});