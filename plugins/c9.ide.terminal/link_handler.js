define(function(require, exports, module) {
    main.consumes = [
        "terminal", "menus", "fs", "tabbehavior", "commands",
        "c9", "tabManager", "dialog.error", "Plugin", "Menu", "MenuItem", 
        "Divider", "util"
    ];
    main.provides = ["openPath"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var Plugin = imports.Plugin;
        var terminal = imports.terminal;
        var commands = imports.commands;
        var tabbehavior = imports.tabbehavior;
        var fs = imports.fs;
        var util = imports.util;
        var tabManager = imports.tabManager;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var Divider = imports.Divider;
        var HoverLink = require("./aceterm/hover_link").HoverLink;
        
        var normalize = require("path").normalize;
        var join = require("path").join;
        var basename = require("path").basename;
        var dirname = require("path").dirname;
        
        var VFSROOT = terminal.VFSROOT;
        var BASEPATH = options.previewUrl;
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var menuPath, lastLink;
        
        var reHome = new RegExp("^" + util.escapeRegExp(c9.home));
        
        /***** Initialization *****/
        
        terminal.on("create", function(e) {
            var ace = e.editor.ace;
            if (!ace) return;
                
            ace.hoverLink = new HoverLink(ace);
            ace.hoverLink.on("open", showMenu);
        }, plugin);
        
        function createMenu() {
            if (menuPath)
                return;
            
            var submenu = new Menu({
                items: [
                    new MenuItem({ value: "path", caption: "Copy Path" }),
                    new MenuItem({ value: "directory", caption: "Copy Directory" }),
                    new MenuItem({ value: "name", caption: "Copy Name" }),
                    new MenuItem({ value: "preview", caption: "Copy Preview URL" })
                    // new MenuItem({ value: "github", caption: "Copy GitHub URL" })
                ],
                onitemclick: function(e) {
                    var info = buildPath(lastLink);
                    info.path = info.path.split(":")[0];
                    
                    if (e.value == "path")
                        commands.exec("copy", null, { data: abs(info) });
                    else if (e.value == "directory")
                        commands.exec("copy", null, { data: dirname(abs(info)) });
                    else if (e.value == "name")
                        commands.exec("copy", null, { data: basename(info.path) });
                    else if (e.value == "preview") {
                        commands.exec("copy", null, { data: info.abs 
                            ? "Unable to access via preview" 
                            : BASEPATH + info.path });
                    }
                }
            }, plugin);
            
            var menuItems = [
                new MenuItem({ value: "gitadd", caption: "git add" }),
                new MenuItem({ value: "gitcheckout", caption: "git checkout" }),
                new MenuItem({ value: "gitdiff", caption: "git diff" }),
                new MenuItem({ value: "gitrm", caption: "git rm" }),
                new MenuItem({ value: "gitreset", caption: "git reset" }),
                new Divider(),
                
                new MenuItem({ value: "open", caption: "Open" }),
                new MenuItem({ value: "copy", caption: "Copy" }),
                new MenuItem({ value: "paste", caption: "Paste In This Terminal" }),
                new Divider(),
                new MenuItem({ caption: "Copy Special", submenu: submenu }),
                new Divider(),
                new MenuItem({ value: "reveal", caption: "Reveal in File Tree" })
            ];
            
            menuPath = new Menu({
                items: menuItems,
                onitemclick: function(e) {
                    var info = buildPath(lastLink);
                    
                    if (e.value == "open")
                        open(lastLink);
                    else if (e.value == "copy")
                        commands.exec("copy", null, { data: abs(info) });
                    else if (e.value == "paste")
                        lastLink.editor.onPaste(abs(info).split(":")[0]);
                    else if (e.value == "reveal")
                        tabbehavior.revealtab({ path: info.path.split(":")[0] });
                    else if (e.value === "gitadd")
                        lastLink.editor.onPaste("git add " + lastLink.value + "\n");
                    else if (e.value === "gitcheckout")
                        lastLink.editor.onPaste("git checkout -- " + lastLink.value);
                    else if (e.value === "gitdiff")
                        lastLink.editor.onPaste("git diff " + lastLink.value + "\n");
                    else if (e.value === "gitrm")
                        lastLink.editor.onPaste("git rm " + lastLink.value + "\n");
                    else if (e.value === "gitreset")
                        lastLink.editor.onPaste("git reset " + lastLink.value + "\n");
                }
            }, plugin);
        }
        
        var menuLink;
        function createLinkMenu() {
            menuLink = new Menu({
                items: [
                    new MenuItem({ value: "open", caption: "Open" }),
                    new MenuItem({ value: "open-in-preview", caption: "Open In Preview" }),
                    new MenuItem({ value: "copy", caption: "Copy" }),
                ],
                onitemclick: function(e) {
                    if (e.value == "open")
                        openLink(lastLink.value);
                    if (e.value == "open-in-preview")
                        openLink(lastLink.value, true);
                    else if (e.value == "copy")
                        commands.exec("copy", null, { data: lastLink.value });
                }
            }, plugin);
        }
            
        /***** Methods *****/
        
        function showMenu(e) {
            if (e.action == "open")
                return open(e);
            
            lastLink = e;
            
            var menu;
            if (e.type == "link" && (tabManager.focussedTab || 0).editorType) {
                createLinkMenu();
                menu = menuLink;
            }
            else {
                createMenu();
                menuPath.once("show", function() {
                    var isGit = e && e.command === "git";
                    var items = menuPath.items;
                    for (var i = 0; i < 6; i++) {
                        items[i].aml.visible = -1;
                        items[i][isGit ? "show" : "hide"]();
                    }
                });
                
                var ace = e.editor;
                menuPath.once("hide", function() {
                    ace.selection.clearSelection();
                });
                
                menu = menuPath;
            }
            
            menu.show(e.x, e.y, "context");
        }
        
        function openLink(href, inPreview) {
            if (!/^(https?|ftp|file):/.test(href)) {
                href = "http://" + href;
            }
            href = href.replace(/(^https?:\/\/)(0.0.0.0|localhost)(?=:|\/|$)/, function(_, protocol, host) {
                host = c9.hostname || window.location.host;
                return protocol + host.replace(/:\d+/, "");
            });
            
            if (inPreview)
                commands.exec("preview", null, { path: href });
            else
                util.openNewWindow(href);
        }
        
        function open(e) {
            if (e.type == "link") 
                return openLink(e.value);
                
            var info = buildPath(e);
            var path = info.path;
            
            var m = /:(\d*)(?::(\d*))?$/.exec(path);
            var jump = {};
            if (m) {
                if (m[1])
                    jump.row = parseInt(m[1], 10) - 1;
                if (m[2])
                    jump.column = parseInt(m[2], 10);
                path = path.slice(0, m.index);
            }
            
            // Make sure home dir is marked correctly
            path = util.normalizePath(path);
            
            fs.stat(path, function(err, stat) {
                if (err) {
                    return commands.exec("navigate", null, { keyword: path });
                }
                if (stat.linkStat)
                    stat = stat.linkStat;
                if (/directory/.test(stat.mime)) {
                    return tabbehavior.revealtab({ path: path });
                }
                tabManager.open({
                    path: path,
                    focus: true,
                    document: {
                        ace: {
                            jump: jump
                        }
                    }
                }, function() {});
            });
        }
        
        function buildPath(e) {
            var path = e.path || e.value;
            var abs = false;
            
            if (c9.platform == "win32") {
                path = path.replace(/\\/g, "/");
                VFSROOT = VFSROOT.replace(/\\/g, "/");
                if (/^\/cygdrive^\//.test(path))
                    path = path.replace(/^\/cygdrive/, "");
                if (VFSROOT == "/")
                    path = path.replace(/^\/(\w)\//, "/$1:/");
                if (/\w:\//.test(path))
                    abs = true;
            }
            
            if (e.basePath && !/^[~\/]/.test(path) && !abs) {
                path = join(e.basePath, path);
                abs = true;
            }
            
            path = normalize(path); 
            
            if (path[0] == "~" && path[1] == "/") {
                path = c9.home + path.substr(1);
                abs = true;
            }
            
            if (path.toLowerCase().lastIndexOf(VFSROOT.toLowerCase(), 0) === 0) {
                path = path.substr(VFSROOT.length);
                abs = false;
            }
            else if (path.toLowerCase().lastIndexOf(c9.home.toLowerCase(), 0) === 0) {
                path = c9.home + "/" + path.substr(c9.home.length);
                abs = true;
            }
            else
                abs = true;
            
            if (path[0] != "/" && !abs)
                path = "/" + path;
            
            return {
                path: path,
                abs: abs
            };
        }
       
        function abs(info) {
           return info.abs ? info.path : join(VFSROOT, info.path);
        }
            
        /***** Lifecycle *****/
        
        plugin.freezePublicAPI({
            open: open
        });
        
        /***** Register and define API *****/
        register(null, {
            "openPath": plugin
        });
    }
});
