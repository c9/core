define(function(require, exports, module) {
    main.consumes = [
        "Previewer", "preview", "vfs", "tabManager", "remote.PostMessage", "c9",
        "CSSDocument", "HTMLDocument", "JSDocument", "MenuItem", "commands", "util"
    ];
    main.provides = ["preview.browser"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var util = imports.util;
        var Previewer = imports.Previewer;
        var tabManager = imports.tabManager;
        var preview = imports.preview;
        var PostMessage = imports["remote.PostMessage"];
        var CSSDocument = imports.CSSDocument;
        var HTMLDocument = imports.HTMLDocument;
        var JSDocument = imports.JSDocument;
        var MenuItem = imports.MenuItem;
        var commands = imports.commands;
        
        // var join = require("path").join;
        // var dirname = require("path").dirname;
        
        /***** Initialization *****/
        
        var plugin = new Previewer("Ajax.org", main.consumes, {
            caption: "Browser",
            index: 10,
            divider: true,
            selector: function(path) {
                return /\.(?:html|htm|xhtml|pdf|svg|mov|mp[34g]|ogg|webm|wma)$|^https?\:\/\//.test(path);
            }
        });
        
        var BASEPATH = preview.previewUrl;
        var counter = 0;
        
        /***** Methods *****/
        
        function calcRootedPath(url) {
            if (url.startsWith(BASEPATH))
                return url.substr(BASEPATH.length);
            return url;
        }
        
        function getIframeSrc(iframe) {
            var src;
            try { src = iframe.contentWindow.location.href; }
            catch (e) { src = iframe.src; }
            if (src == "about:blank")
                src = "";
            return src;
        }
        
        function cleanIframeSrc(src) {
            return src
                .replace(/([&?])_c9_id=\w+\&_c9_host=[^&#]+/g, "$1")
                .replace(/[\?\&]$/, "");
        }
        
        function calcAbsolutepath(url) {
            if (url[0] == "/") return BASEPATH + url;
            return url;
        }
        
        function loadPreviewSession(session, allowAutoFocus) {
            var iframe = session.iframe;
            
            session.suspended = false;
            
            var tab = session.tab;
            tab.classList.add("loading");
            
            if (!allowAutoFocus) {
                window.addEventListener("blur", function onblur(x) {
                    window.removeEventListener("blur", onblur, false);
                    if (document.activeElement == iframe)
                        setTimeout(function() { window.focus(); });
                }, false);
            }
            var url = calcAbsolutepath(session.url);
            
            if (!session.disableInjection && !/^(data|blob):/.test(url)) {
                var parts = url.split("#");
                url = parts[0] + (~parts[0].indexOf("?") ? "&" : "?")
                    + "_c9_id=" + session.id
                    + "&_c9_host=" + (options.local ? "local" : location.origin)
                    + (parts.length > 1 ? "#" + parts.slice(1).join("") : "");
            }
            
            var mainPath = url.match(/^[^?#]*/)[0];
            var noSandbox = /\.(pdf)$/.test(mainPath);
            
            // dissallow top navigation
            if (!options.local) {
                if (noSandbox) {
                    iframe.removeAttribute("sandbox");
                } else {
                    iframe.setAttribute("sandbox", "allow-forms allow-pointer-lock allow-popups"
                        + " allow-same-origin allow-scripts allow-modals allow-popups-to-escape-sandbox");
                }
            }
            
            if (!options.local && window.location.protocol == "https:" && url.startsWith("http://"))
                url = options.staticPrefix + "/nohttps.html#" + url;
            
            iframe.src = url;
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            commands.addCommand({
                name: "scrollPreviewElementIntoView",
                displayName: "Preview:scroll element into view",
                bindKey: { win: "Ctrl-I", mac: "Ctrl-I" },
                exec: function(editor) {
                    if (editor.type == "preview")
                        plugin.activeSession.transport.reveal();
                    else
                        editor.ace.session.htmldocument.scrollIntoView();
                },
                isAvailable: function(editor) {
                    return editor 
                        && (editor.ace && editor.ace.session.htmldocument
                        || editor.type == "preview");
                }
            }, plugin);
            
            var item = new MenuItem({
                caption: "Enable Highlighting", 
                type: "check",
                onclick: function() {
                    var session = plugin.activeSession;
                    (session.transport || 0).enableHighlighting = item.checked;
                },
                isAvailable: function() {
                    item.checked = ((plugin.activeSession || 0).transport || 0).enableHighlighting;
                    return true;
                }
            }, plugin);
            preview.settingsMenu.append(item);
            
            var item2 = new MenuItem({
                caption: "Disable Live Preview Injection", 
                type: "check",
                onclick: function() {
                    var session = plugin.activeSession || 0;
                    session.disableInjection = item2.checked;
                    plugin.navigate({ url: session.path });
                },
                isAvailable: function() {
                    item2.checked = (plugin.activeSession || 0).disableInjection;
                    return true;
                }
            }, plugin);
            preview.settingsMenu.append(item2);
            
            preview.settingsMenu.append(new MenuItem({ 
                caption: "Scroll Preview Element Into View", 
                command: "scrollPreviewElementIntoView"
            }, plugin));
        });
        
        plugin.on("sessionStart", function(e) {
            var doc = e.doc;
            var session = e.session;
            var tab = e.tab;
            var editor = e.editor;
            
            if (session.iframe) {
                session.editor = editor;
                editor.container.appendChild(session.iframe);
                return;
            }
            
            // do not restore untrusted tabs at startup, since they may contain infinite loops
            if (!tabManager.isReady && session.trustedPath != session.initPath)
                session.suspended = true;
            
            var iframe = document.createElement("iframe");
            iframe.setAttribute("nwfaketop", true);
            iframe.setAttribute("nwdisable", true);
            
            iframe.style.width = "100%";
            iframe.style.height = "100%";
            iframe.style.border = 0;
            iframe.style.backgroundColor = "rgba(255, 255, 255, 0.88)";
            
            iframe.addEventListener("load", function() {
                if (!iframe.src) return;
                
                var src = getIframeSrc(iframe);
                var path = calcRootedPath(cleanIframeSrc(src));
                
                tab.title = 
                tab.tooltip = "[B] " + path;
                session.lastSrc = src;
                
                if (options.local) {
                    var url = cleanIframeSrc(getIframeSrc(iframe));
                    if (url.indexOf("data:") === 0) {
                        editor.setLocation(path);
                    }
                    else {
                        editor.setLocation(url);
                        session.currentLocation = url;
                    }
                    
                    iframe.contentWindow.postMessage("start-c9-livecss", "*");
                }
                else if (!~path.indexOf(options.staticPrefix)) {
                    editor.setLocation(path);
                }
                
                tab.classList.remove("loading");
            });
            
            session.id = "livepreview" + counter++;
            session.iframe = iframe;
            session.editor = editor;
            session.transport = new PostMessage(iframe, session.id);
            
            session.transport.on("ready", function() {
                session.transport.getSources(function(err, sources) {
                    session.styleSheets = sources.styleSheets.map(function(path) {
                        return new CSSDocument(path).addTransport(session.transport);
                    });
                    session.scripts = sources.scripts.map(function(path) {
                        return new JSDocument(path).addTransport(session.transport);
                    });
                    session.html = new HTMLDocument(sources.html)
                        .addTransport(session.transport);
                });
            }, doc);
            session.transport.on("focus", function() {
                tabManager.focusTab(doc.tab);
            }, doc);
            
            session.destroy = function() {
                if (session.transport)
                    session.transport.unload();
                delete session.editor;
                delete session.transport;
                delete session.iframe;
                delete session.id;
            };
            
            // Lets only destroy when the doc is destroyed
            doc.addOther(function() { session.destroy(); });
            
            doc.on("canUnload", function(e) {
                if (!session.transport) return;
                
                var count = session.transport.getWindows().length;
                if (count <= 1) return true;
                
                session.transport.once("empty", function() {
                    doc.unload();
                });
                
                return false;
            }, session);
            
            editor.container.appendChild(session.iframe);
        });
        plugin.on("sessionEnd", function(e) {
            var tab = e.tab;
            var session = e.session;
            var iframe = session.iframe;
            
            iframe.remove();
            tab.classList.remove("loading");
        });
        plugin.on("sessionActivate", function(e) {
            var session = e.session;
            var path = calcRootedPath(session.url || session.path || session.initPath);
            
            if (/^https?:/.test(path))
                session.disableInjection = true;
            
            session.iframe.style.display = "block";
            session.editor.setLocation(path, true);
            session.editor.setButtonStyle("Browser", "page_white.png");
        });
        plugin.on("sessionDeactivate", function(e) {
            var session = e.session;
            session.iframe.style.display = "none";
        });
        plugin.on("navigate", function navigate(e) {
            var tab = plugin.activeDocument.tab;
            var session = plugin.activeSession;
            
            var iframe = session.iframe;
            if (!iframe) // happens when save is called from collab see also previewer navigate
                return;
            
            var nurl = e.url.replace(/^~/, c9.home);
            var url = nurl.match(/^[a-z]\w{1,4}\:/)
                ? nurl
                : BASEPATH + nurl;
            
            var base = (session.url || "").split("#")[0];
            if (url.indexOf(base + "#") == -1 && url != base)
                tab.classList.add("loading");
            session.url = url;
            
            var path = calcRootedPath(url);
            tab.title = 
            tab.tooltip = "[B] " + path;
            
            plugin.activeSession.editor.setLocation(path, true);
            
            if (session.suspended) {
                var staticPrefix = options.staticPrefix;
                if (staticPrefix.indexOf("https://") !== 0)
                    staticPrefix = location.protocol + "//" + location.host + staticPrefix;
                
                iframe.contentDocument.body.innerHTML = require("text!./suspended.html")
                    .replace(/\{\{staticPrefix\}\}/g, staticPrefix);
                    
                iframe.contentWindow.onclick = function() {
                    session.suspended = false;
                    loadPreviewSession(session);
                };
                session.suspended = false;
            } else {
                loadPreviewSession(session);
            }
        });
        plugin.on("update", function(e) {
            
            // var iframe = plugin.activeSession.iframe;
            // if (e.saved)
            //     iframe.src = iframe.src;
        });
        plugin.on("reload", function() {
            var session = plugin.activeSession;
            loadPreviewSession(session, tabManager.focussedTab == session.tab);
        });
        plugin.on("popout", function() {
            var src = getIframeSrc(plugin.activeSession.iframe);
            if (!src)
                src = plugin.activeSession.url;
            if (!plugin.activeSession.disableInjection)
                window.open(src);
            else
                util.openNewWindow(src);
        });
        plugin.on("getState", function(e) {
            var session = e.doc.getSession();
            var state = e.state;
            
            state.currentLocation = session.currentLocation;
            state.disableInjection = session.disableInjection;
            state.trustedPath = session.trustedPath;
        });
        plugin.on("setState", function(e) {
            var session = e.doc.getSession();
            var state = e.state;
            
            if (state.currentLocation) {
                if (session.initPath)
                    session.initPath = state.currentLocation;
                // else
                //     plugin.navigate({ url: state.currentLocation, doc: e.doc });
            }
            session.disableInjection = state.disableInjection;
        });
        plugin.on("unload", function() {
        });
        
        /***** Register and define API *****/
        
        /**
         * Previewer for content that the browser can display natively.
         **/
        plugin.freezePublicAPI({
            
        });
        
        register(null, {
            "preview.browser": plugin
        });
    }
});