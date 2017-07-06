define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "remote", "watcher", "fs"
    ];
    main.provides = ["CSSDocument"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var remote = imports.remote;
        var watcher = imports.watcher;
        var fs = imports.fs;
        
        var style = document.createElement("style");
        document.documentElement.appendChild(style);
        
        function CSSDocument(path) {
            var exists = remote.findDocument(path);
            if (exists) return exists;
            
            /***** Initialization *****/
            
            var plugin = new Plugin("Ajax.org", main.consumes);
            // var emit = plugin.getEmitter();
            
            var transports = [];
            var tab, doc;
            
            var loaded = false;
            function load() {
                if (loaded) return false;
                loaded = true;
                
                remote.register(plugin);
            }
            
            /***** Methods *****/
            
            function addTransport(transport) {
                if (transports.indexOf(transport) == -1) {
                    transports.push(transport);
                    
                    transport.addOther(function() {
                        var idx = transports.indexOf(transport);
                        if (~idx) {
                            transports.splice(idx, 1);
                            
                            if (transports.length === 0)
                                plugin.unload();
                        }
                    });
                }
                
                if (tab && tab.isActive())
                    updateHighlight(true);
                
                if (doc && doc.changed)
                    update();
                
                return plugin;
            }
            
            function initTab(t) {
                if (!t) {
                    doc = null;
                    if (tab) {
                        fs.readFile(path, function(err, data) {
                            update(null, data);
                        });
                    }
                    tab = null;
                    return;
                }
                
                tab = t;
                doc = tab.document;
                
                tab.on("activate", function() { updateHighlight(); }, plugin);
                tab.on("deactivate", function() { updateHighlight(false); }, plugin);
                
                var c9session = doc.getSession();
                c9session.once("init", function(e) {
                    // Listen for change in the document
                    e.session.on("change", function(e) { update(e.data); });
                    
                    // Listen for cursor position change
                    e.session.selection.on("changeCursor", updateHighlight);
                });
                
                // Listen for a tab close event
                tab.on("close", function() { watcher.watch(path); }, plugin);
            }
            
            var lastQuery;
            var reCssQuery = /(^|.*\})(.*)\{|\}/;
            function updateHighlight(e) {
                var query;
                
                if (tab && e !== false) {
                    var session = doc.getSession().session;
                    if (!session) return;
                    
                    var lines = session.doc.$lines;
                    var cursor = session.selection.lead;
                    
                    if (!lines[cursor.row]) {
                        return; //@todo
                    }
                    
                    var line = lines[cursor.row].substr(0, cursor.column);
                    
                    var started = false;
                    if (line.match(reCssQuery)) {
                        query = RegExp.$2;
                        started = true;
                    }
                    
                    if (!started || query) {
                        for (var i = cursor.row - 1; i >= 0; i--) {
                            if (started) {
                                if (lines[i].match(/[\}\;]/))
                                    break;
                                else
                                    query = lines[i] + " " + query;
                            }
                            else if (lines[i].match(reCssQuery)) {
                                query = RegExp.$2;
                                if (!query) break;
                                started = true;
                            }
                        }
                    }
                }
                else {
                    query = false;
                }
                
                var rules = style.sheet.cssRules || style.sheet.rules;
                if (query && rules.length) {
                    style.textContent = query + "{}";
                    query = rules[0].selectorText;
                }
                
                // Remember the last query
                lastQuery = query;
                
                // Send the highlight command
                transports.forEach(function(transport) {
                    transport.highlightCSSQuery(query, e === true);
                });
            }
            
            function remove() {
                transports.forEach(function(transport) {
                    transport.deleteStyleSheet(path);
                });
            }
            
            // var timer, lastValue;
            // function updateDelayed(changes, value) {
            //     if (!timer) {
            //         timer = setTimeout(function(){
            //             timer = null;
            //             update(null, lastValue);
            //         }, 30);
            //     }
            //     else {
            //         lastValue = value;
            //     }
            // }
            
            function update(changes, value) {
                // single line
                // {
                // action: "insertText" | "removeText"
                // text: "string"
                // range: {start, end}
                // }
                // multiline
                // {
                // action: "insertLines" | "removeLines"
                // lines: ["string", ...]
                // range: {start, end}
                // }
                
                var range = changes && changes.range;
                if (changes && lastQuery && changes.text && range.start.row == range.end.row 
                  && (changes.text != "insertText" || changes.text.indexOf(";") == -1)) {
                    var session = doc.getSession().session;
                    var line = session.doc.$lines[range.end.row];
                    var section = changes.action == "insertText"
                        ? line.substr(range.start.column, range.end.column - range.start.column) //changes.text
                        : "";
                    var idx = section.indexOf(";");
                    
                    // Only allow a single rule edit
                    if (idx == -1 || idx == section.length - 1) {
                        var char;
                        if (idx == -1) {
                            for (var i = range.end.column; i < line.length; i++) {
                                char = line.charAt(i);
                                if (char == ";") break;
                                section += char;
                            }
                        }
                        var start = range.start.column - 1 
                            + (changes.action == "removeText" ? changes.text.length : 0);
                        for (var i = start; i >= 0; i--) {
                            char = line.charAt(i);
                            if (char == ";") break;
                            section = char + section;
                        }
                        
                        var parts = section.split(":");
                        var key = parts[0].trim();
                        var css = (parts[1] || "").trim();
                        if (key) {
                            var rule = {
                                selector: lastQuery,
                                key: key,
                                value: css
                            };
                            
                            transports.forEach(function(transport) {
                                transport.updateStyleRule(path, rule);
                            });
                        
                            return;
                        }
                    }
                }
                
                if (value == undefined)
                    value = doc && doc.value || "";
                transports.forEach(function(transport) {
                    transport.updateStyleSheet(path, value);
                });
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
                get path() { return path; },
                
                /**
                 * 
                 */
                get tab() { return tab; },
                
                /**
                 * 
                 */
                set tab(tab) { initTab(tab); },
                
                _events: [
                    /**
                     * @event draw
                     */
                    "draw"
                ],
                
                /**
                 * 
                 */
                addTransport: addTransport,
                
                /**
                 * 
                 */
                remove: remove,
                
                /**
                 * 
                 */
                update: update
            });
            
            plugin.load(null, "cssdocument");
            
            return plugin;
        }
        
        register(null, {
            CSSDocument: CSSDocument
        });
    }
});