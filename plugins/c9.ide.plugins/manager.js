/*global requirejs*/
define(function(require, exports, module) {
    main.consumes = [
        "PreferencePanel", "settings", "ui", "util", "ext", "c9", "Plugin",
        "dialog.alert", "dialog.confirm", "layout", "proc", "menus", "commands",
        "dialog.error", "dialog.info", "tree.favorites", "fs", "tree",
        "preferences.experimental", "apf", "hub", "dialog.notification"
    ];
    main.provides = ["pluginManager", "plugin.manager", "plugin.debug"];
    return main;


    function main(options, imports, register) {
        var PreferencePanel = imports.PreferencePanel;
        var settings = imports.settings;
        var layout = imports.layout;
        var commands = imports.commands;
        var menus = imports.menus;
        var ui = imports.ui;
        var c9 = imports.c9;
        var fs = imports.fs;
        var ext = imports.ext;
        var tree = imports.tree;
        var proc = imports.proc;
        var Plugin = imports.Plugin;
        var util = imports.util;
        var qs = require("querystring");
        var apf = imports.apf;
        var alert = imports["dialog.alert"].show;
        var confirm = imports["dialog.confirm"].show;
        var showError = imports["dialog.error"].show;
        var showInfo = imports["dialog.info"].show;
        var notify = imports["dialog.notification"].show;
        var favs = imports["tree.favorites"];
        var experimental = imports["preferences.experimental"];
        var architectApp = imports.hub.app;

        var search = require("../c9.ide.navigate/search");
        var Tree = require("ace_tree/tree");
        var TreeData = require("./managerdp");
        var join = require("path").join;
        var basename = require("path").basename;
        var dirname = require("path").dirname;
        
        var escapeHTML = require("ace/lib/lang").escapeHTML;

        var staticPrefix = options.staticPrefix;

        var CORE = {};
        var TEMPLATES = {
            "plugin.simple": "Empty Plugin",
            "plugin.default": "Full Plugin",
            "plugin.installer": "Installer Plugin",
            "plugin.bundle": "Cloud9 Bundle"
        };

        var STATE_ENABLED = 1;
        var STATE_PARTIAL = 2;
        var STATE_MISSING_DEPS = 3;
        var STATE_DISABLED = 4;

        /***** Initialization *****/

        var DEBUG = c9.location.indexOf("debug=2") > -1;
        var ENABLED = DEBUG || experimental.addExperiment(
            "plugin-manager",
            options.devel,
            "SDK/Plugin Manager"
        );

        var plugin = new PreferencePanel("Ajax.org", main.consumes, {
            caption: "Plugin Explorer",
            className: "plugins",
            form: false,
            noscroll: true,
            index: 200,
            visible: ENABLED,
        });
        // var emit = plugin.getEmitter();

        var model, datagrid, filterbox;
        var btnUninstall, btnServices, btnReadme, btnReload;
        var btnReloadLast;
        var localPlugins;
        var api;

        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            
            menus.addItemByPath("Tools/~", new ui.divider(), 100000, plugin);
            menus.addItemByPath("Tools/Developer", null, 100100, plugin);

            if (!ENABLED) {
                menus.addItemByPath("Tools/Developer/Start in Debug Mode", new ui.item({
                    onclick: function() {
                        var url = location.href + (location.href.indexOf("?") > -1
                          ? "&debug=2"
                          : "?debug=2");
                        util.openNewWindow(url);
                    }
                }), 900, plugin);
                return;
            }

            commands.addCommand({
                name: "openPluginManager",
                group: "Plugins",
                exec: function() { 
                    commands.exec("openpreferences", null, { panel: plugin });
                }
            }, plugin);
            
            menus.addItemByPath("Tools/Developer/Open Plugin Manager", new ui.item({
                command: "openPluginManager"
            }), 1100, plugin);
            
            if (DEBUG) {
                notify("<div class='c9-readonly'>You are in <span style='color:rgb(245, 234, 15)'>Debug</span> Mode. "
                    + "<button id='.pm_btn1'>Open Plugin Manager</button>"
                    + "<button id='.pm_btn2' style='float:right'>Reload last Plugin</button>",
                    false);
                
                document.getElementById(".pm_btn1").onclick = function() { commands.exec("openPluginManager") };
                btnReloadLast = document.getElementById(".pm_btn2");
                btnReloadLast.onclick = function() { commands.exec("reloadLastPlugin") };
                updateReloadLastButton();
                
                readAvailablePlugins();
                    
                commands.addCommand({
                    name: "reloadLastPlugin",
                    bindKey: { mac: "F4", win: "F4" },
                    hint: "reload plugin last reloaded in plugin manager",
                    exec: function() {
                        var name = getLastReloaded();
                        if (!name)
                            return commands.exec("openPluginManager", null, { panel: plugin });
                        reload(name);
                    }
                }, plugin);
                
                menus.addItemByPath("Tools/Developer/Reload All Custom Plugins", new ui.item({
                    command: "reloadAllCustomPlugins"
                }), 1200, plugin);
                
                menus.addItemByPath("Tools/Developer/Reload Last Plugin", new ui.item({
                    command: "reloadLastPlugin",
                    isAvailable: getLastReloaded
                }), 1300, plugin);
                
                commands.addCommand({
                    name: "reloadAllCustomPlugins",
                    group: "Plugins",
                    bindKey: { 
                        mac: "Command-Enter", 
                        win: "Ctrl-Enter" 
                    },
                    exec: function() { 
                        reloadAllCustomPlugins();
                    }
                }, plugin);
            }

            menus.addItemByPath("File/New Plugin", null, 210, plugin);
            Object.keys(TEMPLATES).forEach(function(name) {
                menus.addItemByPath("File/New Plugin/" + TEMPLATES[name], new ui.item({
                    onclick: function() {
                        createNewPlugin(name);
                    }
                }), 210, plugin);
            });
            
            ext.on("register", function() {
                setTimeout(reloadModel);
            });
        }

        var drawn;
        function draw(e) {
            if (drawn) return;
            drawn = true;
            
            ui.insertCss(require("text!./style.css"), plugin);

            model = new TreeData();
            model.emptyMessage = "No plugins found";

            model.columns = [{
                caption: "Name",
                value: "name",
                // getText: function(p) {
                //     return p.name + " (" + p.items.length + ")";
                // },
                width: "250",
                type: "tree"
            }, {
                caption: "Startup Time",
                // value: "time",
                width: "100",
                getText: function(p) {
                    if (p.time !== undefined)
                        return (p.time || 0) + "ms";

                    var total = 0;
                    function recur(p) {
                        if (p.time != undefined)
                            return total += p.time;
                        if (p.items)
                            p.items.forEach(recur);
                    }
                    recur(p);
                    return (p.time = total) + "ms";
                }
            }, {
                caption: "Enabled",
                value: "enabled",
                width: "100"
            }];
            model.columns = null;

            layout.on("eachTheme", function(e) {
                var height = parseInt(ui.getStyleRule(".bar-preferences .blackdg .tree-row", "height"), 10) || 24;
                model.rowHeightInner = height;
                model.rowHeight = height;

                if (e.changed) datagrid.resize(true);
            });

            architectApp.on("ready-additional", function() {
                reloadModel();
            });
            reloadModel();

            var hbox = new ui.hbox({
                htmlNode: e.html,
                padding: 5,
                edge: "10 10 0 10",
                childNodes: [
                    filterbox = new apf.codebox({
                        realtime: true,
                        skin: "codebox",
                        "class": "dark",
                        clearbutton: true,
                        focusselect: true,
                        height: 27,
                        width: 250,
                        singleline: true,
                        clearbutton: true,
                        "initial-message": "Search installed plugins"
                    }),
                    btnReadme = new ui.button({
                        skin: "c9-toolbarbutton-glossy",
                        caption: "Readme",
                        class: "serviceButton",
                        onclick: function() {
                            mode = "readme";
                            window.requestAnimationFrame(renderDetails);
                        }
                    }),
                    btnServices = new ui.button({
                        skin: "c9-toolbarbutton-glossy",
                        caption: "services",
                        class: "serviceButton",
                        onclick: function() {
                            mode = "services";
                            window.requestAnimationFrame(renderDetails);
                        }
                    }),
                    new ui.filler({}),
                    btnUninstall = new ui.button({
                        skin: "c9-toolbarbutton-glossy",
                        caption: "Disable",
                        class: "btn-red",
                        onclick: function() {
                            var item = datagrid.selection.getCursor();
                            unloadPackage({ path: item.path });
                        }
                    }),
                    btnReload = new ui.button({
                        skin: "c9-toolbarbutton-glossy",
                        caption: "Reload",
                        onclick: function() {
                            var item = datagrid.selection.getCursor();
                            if (item.enabled && item.name)
                                reload(item.name);
                        }
                    })
                ]
            });
            var treeBar;
            var descriptionBar;
            var hboxInner = new ui.hsplitbox({
                anchor: "0 0 0 0",
                htmlNode: e.html,
                class: "bar-preferences",
                splitter: true,
                childNodes: [
                    treeBar = new ui.bar({ width: 250 }),
                    descriptionBar = new ui.bar({ textselect: true }),
                ]
            });

            var div = treeBar.$ext.appendChild(document.createElement("div"));
            div.style.position = "absolute";
            div.style.left = "0px";
            div.style.right = "0px";
            div.style.bottom = "0px";
            div.style.top = "0px";
            hboxInner.$ext.style.position = "absolute";
            hboxInner.$ext.style.left = "10px";
            hboxInner.$ext.style.right = "10px";
            hboxInner.$ext.style.bottom = "10px";
            hboxInner.$ext.style.top = "50px";

            datagrid = new Tree(div);
            datagrid.setTheme({ cssClass: "blackdg" });
            datagrid.setDataProvider(model);

            layout.on("resize", function() { datagrid.resize() }, plugin);

            function setTheme(e) {
                filterbox.setAttribute("class",
                    e.theme.indexOf("dark") > -1 ? "dark" : "");
            }
            layout.on("themeChange", setTheme);
            setTheme({ theme: settings.get("user/general/@skin") });

            filterbox.ace.commands.addCommands([
                {
                    bindKey: "Enter",
                    exec: function() { }
                }, {
                    bindKey: "Esc",
                    exec: function(ace) { ace.setValue(""); }
                }
            ]);

            filterbox.ace.on("input", function(e) {
                applyFilter();
            });

            // when tab is restored datagrids size might be wrong
            // todo: remove this when apf bug is fixed
            datagrid.once("mousemove", function() {
                datagrid.resize(true);
            });

            datagrid.on("changeSelection", function(e) {
                window.requestAnimationFrame(renderDetails);
            });
            model.on("change", function(e) {
                window.requestAnimationFrame(renderDetails);
            });
            
            model.getCheckboxHTML = function(node) {
                var enabled = node.enabled;
                if (enabled == null || node.isGroup) return "";
                return "<span class='checkbox " 
                    + (enabled == -1 
                        ? "half-checked " 
                        : (enabled ? "checked " : ""))
                    + "'></span>";
            };
            
            var mode = "services";
            var readmeCache = {};
            function renderDetails() {
                var items = datagrid.selection.getSelectedNodes();
                var enabled = items.every(function(x) {
                    return x.enabled == 1;
                });
                if (enabled) {
                    btnReload.enable();
                    btnUninstall.setCaption("Disable");
                }
                else {
                    btnReload.disable();
                    btnUninstall.setCaption("Enable");
                }
                if (mode == "services") {
                    renderServiceDetails(items);
                    btnServices.$ext.classList.add("serviceButtonActive");
                    btnReadme.$ext.classList.remove("serviceButtonActive");
                }
                else if (mode == "readme") {
                    renderReadmeDetails(items);
                    btnReadme.$ext.classList.add("serviceButtonActive");
                    btnServices.$ext.classList.remove("serviceButtonActive");
                }
                else {
                    descriptionBar.$ext.innerHTML = "";
                    btnReadme.$ext.classList.remove("serviceButtonActive");
                    btnServices.$ext.classList.remove("serviceButtonActive");
                }
            }
            
            function renderReadmeDetails(items) {
                if (items.length > 1) {
                    descriptionBar.$ext.textContent = "Multipe items selected.";
                    return;
                }
                var item = items[0];
                while (item && !item.readme) {
                    item = item.parent;
                }
                if (!item) {
                    descriptionBar.$ext.textContent = "Readme is not available.";
                    return;
                }
                
                if (readmeCache[item.readme]) {
                    descriptionBar.$ext.textContent = readmeCache[item.readme];
                    return;
                }
                descriptionBar.$ext.textContent = "Loading...";
                // fs.readFile()
            }
            
            function renderServiceDetails(items) {
                function addUnique(item, array) { 
                    if (array.indexOf(item) == -1) array.push(item); 
                }
                
                var provided = [];
                
                items.forEach(function addProvides(x) {
                    if (x.map) {
                        Object.keys(x.map).forEach(function(n) {
                            addProvides(x.map[n]);
                        });
                    }
                    if (x.provides) {
                        x.provides.forEach(function(p) {
                            addUnique(p, provided);
                        });
                    }
                });
                
                var consumedMap = Object.create(null);
                provided.forEach(function(service) {
                    consumedMap[service] = 0;
                });
                addAllProviders(consumedMap);
                var consumedList = Object.keys(consumedMap);
                var consumedGroups = splitToGroups(consumedList, consumedMap);
                
                var dependents = Object.create(null);
                provided.forEach(function(service) {
                    dependents[service] = 0;
                });
                addAllDependents(dependents);
                var depList = Object.keys(dependents);
                var depGroups = splitToGroups(depList, dependents);
                
                function splitToGroups(list, map) {
                    var groups = [];
                    list.forEach(function(n) {
                        var level = Math.abs(map[n]);
                        if (!groups[level])
                            groups[level] = [];
                        groups[level].push(n);
                    });
                    groups = groups.filter(Boolean).slice(1);
                    return groups;
                }
                
                function formatServices(list, style) {
                    return "[" + list.map(function(x) {
                        return '<span class="serviceButton">' + escapeHTML(x) + '</span>';
                    }).join(", ") + "]";
                }
                
                descriptionBar.$ext.style.overflow = "auto";
                descriptionBar.$ext.innerHTML = '<div class="basic intro" \
                    style="padding:12px 0 12px 12px;white-space:pre-line">\
                    <p>' + (items.length == 1 
                        ? '<span class="serviceButton">' + escapeHTML(items[0].path) + '</span>'
                        : (items.length || "no") + " plugins selected") + '</p>\
                    <hr></hr>\
                    <h1>Provided services [' + provided.length + ']</h1>\
                    <p type="provided">' + (provided.length ? formatServices(provided) : "") + '</p>\
                    <h1>Consumed services [' + (consumedList.length - provided.length) + ']</h1>\
                    <p type="consumed">' + consumedGroups.map(formatServices).join("<br/>") + '</p>\
                    <h1>Dependent services [' + (depList.length - provided.length) + ']</h1>\
                    <p type="dependent">' + depGroups.map(formatServices).join("<br/>") + '</p>\
                    <br/>\
                </div>';
                
            }
            descriptionBar.$ext.addEventListener("click", function(e) {
                if (e.button) return;
                var el = e.target;
                var isButton = el.classList.contains("serviceButton");
                var text = el.textContent;
                var serviceToPlugin = architectApp.serviceToPlugin;
                if (e.detail == 1 && isButton && text) {
                    var path = serviceToPlugin[text] ? serviceToPlugin[text].packagePath : text;
                    var node = function search(node) {
                        if (node.path == path)
                            return node;
                        if (node.items) {
                            for (var i = 0; i < node.items.length; i++) {
                                var result = search(node.items[i]);
                                if (result) 
                                    return result;
                            }
                        }
                    }(model.cachedRoot);
                    
                    if (node)
                        datagrid.reveal(node);
                }
            });
            var hoverDetails = { hovered: "", highlighted: "" };
            descriptionBar.$ext.addEventListener("mousemove", function(e) {
                if (e.button) return;
                var el = e.target;
                var isButton = el.classList.contains("serviceButton");
                var text = el.textContent;
                hoverDetails.parent = el.parentNode;
                hoverDetails.hovered = isButton ? text : "";
                hoverDetails.type = isButton ? el.parentNode.getAttribute("type") : "";
                if (hoverDetails.hovered != hoverDetails.highlighted)
                    requestAnimationFrame(updateHighlights);
            });
            function updateHighlights() {
                if (hoverDetails.hovered == hoverDetails.highlighted) return;
                var serviceToPlugin = architectApp.serviceToPlugin;
                if (!serviceToPlugin) return;
                
                var nodes = descriptionBar.$ext.querySelectorAll(".serviceButton");
                
                var deps = Object.create(null);
                deps[hoverDetails.hovered] = 0;
                addAllDependents(deps);
                addAllProviders(deps);
                
                for (var i = 0; i < nodes.length; i++) {
                    var node = nodes[i];
                    var val = node.textContent;
                    var highlight1 = false;
                    var highlight2 = false;
                    if (hoverDetails.type == "dependent") {
                        if (hoverDetails.parent == node.parentNode || node.parentNode.getAttribute("type") == "provided") {
                            highlight1 = deps[val] < 0;
                            highlight2 = deps[val] > 0;
                        }
                    } else if (hoverDetails.type == "consumed") {
                        if (hoverDetails.parent == node.parentNode || node.parentNode.getAttribute("type") == "provided") {
                            highlight1 = deps[val] > 0;
                            highlight2 = deps[val] < 0;
                        }
                    }
                    
                    nodes[i].style.borderBottom = highlight1 ? "1px solid" : "";
                    if (!highlight1) {
                        nodes[i].style.borderBottom = highlight2 ? "1px dashed rgba(125, 125, 125, 0.9)" : "";
                    }
                }
                hoverDetails.highlighted = hoverDetails.hovered;
            }
            window.requestAnimationFrame(renderDetails);
        }
        

        /***** Methods *****/
        
        function readAvailablePlugins(callback) {
            fs.readdir("~/.c9/plugins", function(err, list) {
                if (err) return callback && callback(err);
                
                var available = [];
                list.forEach(function(stat) {
                    var name = stat.name;
                    if (!/(directory|folder)$/.test(stat.mime)) return;
                    if (!/[._]/.test(name[0])) available.push(name);
                });
                localPlugins = available.concat();
                reloadModel();
                callback && callback(null, available);
            });
        }

        function reloadModel() {
            if (!model) return;
            
            if (!CORE.pluginManager) {
                CORE.pluginManager = 1;
                addAllProviders(CORE);
                Object.keys(CORE).forEach(function(n) {
                    if (architectApp.serviceToPlugin[n])
                        CORE[architectApp.serviceToPlugin[n].packagePath] = 1;
                });
            }

            var GROUPS = {
                "changed": "Recently Changed",
                "remote": "Remote Plugins",
                "vfs": "Locally Installed Plugins",
                "pre": "Pre-installed Plugins",
                "core": "Core Plugins",
            };
            
            var groups = model.groups || Object.create(null);
            if (!model.groups) {
                var root = [];
                model.cachedRoot = { items: root };
                model.groups = groups;
                Object.keys(GROUPS).forEach(function(name) {
                    root.push(groups[name] = {
                        map: Object.create(null),
                        isOpen: name != "runtime",
                        className: "group",
                        isGroup: true,
                        isType: name,
                        noSelect: true,
                        name: GROUPS[name]
                    });
                });
            }
            
            architectApp.config.forEach(function(plugin) {
                if (plugin.packagePath) {
                    var parts = plugin.packagePath.split("/");
                    
                    var path = parts.shift();
                    var node = CORE[plugin.packagePath] ? groups.core : groups.pre;
                    parts.forEach(function(p, i) {
                        path = path + "/" + p;
                        if (!node.map)
                            node.map = Object.create(null);
                        if (!node.map[p]) {
                            node.map[p] = {
                                path: path,
                                parent: node,
                            };
                        }
                        node.map[p].name = p;
                        if (i == parts.length - 1) {
                            var enabled = 1;
                            node.map[p].provides = plugin.provides;
                            node.map[p].time = plugin.provides.reduce(function(sum, x) {
                                var service = architectApp.services[x];
                                if (!service || (!service.loaded && service.unload)) {
                                    enabled = 0;
                                }
                                return sum + (service && service.time || 0);
                            }, 0);
                            node.map[p].enabled = enabled;
                        }
                        node = node.map[p];
                    });
                }
            });
            
            if (localPlugins) {
                groups.pre.map = groups.pre.map || Object.create(null);
                localPlugins.forEach(function(x) {
                    groups.vfs.map[x] = {
                        name: x,
                        enabled: 0
                    };
                });
            }
            
            function flatten(node, index) {
                if (node.map) {
                    node.items = node.children = Object.keys(node.map).map(function(x) {
                        return node.map[x];
                    });
                }
                if (node.items) {
                    node.items.forEach(flatten);
                    if (node.items.length == 1) {
                        var other = node.items[0];
                        if (node.parent && node.parent.items[index] == node) {
                            node.parent.items[index] = other;
                            other.name = node.name + "/" + other.name;
                        }
                    }
                    if (!node.isGroup) {
                        node.items.some(function(i) {
                            if (node.enabled == null) {
                                node.enabled = i.enabled;
                            }
                            if (i.enabled != node.enabled) {
                                node.enabled = -1;
                                return true;
                            }
                        });
                    }
                }
            }
            
            flatten(model.cachedRoot);

            applyFilter();
        }

        function applyFilter() {
            model.keyword = filterbox && filterbox.getValue();

            if (!model.keyword) {
                model.reKeyword = null;
                model.setRoot(model.cachedRoot);

                // model.isOpen = function(node) { return node.isOpen; }
            }
            else {
                model.reKeyword = new RegExp("("
                    + util.escapeRegExp(model.keyword) + ")", 'i');
                var root = search.treeSearch(model.cachedRoot.items, model.keyword, true);
                model.setRoot(root);

                // model.isOpen = function(node) { return true; };
            }
        }

        function createNewPlugin(template) {
            if (!template)
                template = "c9.ide.default";

            var url = staticPrefix + "/" + join("templates", template + ".tar.gz");
            if (!url.match(/^http/))
                url = location.origin + url;

            function getPath(callback, i) {
                i = i || 0;
                var path = join("~", ".c9/plugins/", template + (i ? "." + i : ""));
                fs.exists(path, function(exists) {
                    if (exists) return getPath(callback, i + 1);
                    callback(null, path);
                });
            }

            function handleError(err) {
                showError("Could not create plugin.");
                console.error(err);
            }

            getPath(function(err, path) {
                if (err)
                    return handleError(err);

                var pluginsDir = join("~", ".c9/plugins/_/");
                var pluginsDirAbsolute = pluginsDir.replace(/^~/, c9.home);
                var tarPath = join(pluginsDir, template + ".tar.gz");
                var tarPathAbsolute = tarPath.replace(/^~/, c9.home);

                // Download tar file with template for plugin
                proc.execFile("bash", {
                    args: ["-c", [
                        // using mkdirp since "--create-dirs" is broken on windows
                        "mkdir", "-p", util.escapeShell(dirname(tarPathAbsolute)), ";",
                        "curl", "-L", util.escapeShell(url), "-o", util.escapeShell(tarPathAbsolute)].join(" ")
                    ]
                }, function(err, stderr, stdout) {
                    if (err)
                        return handleError(err);

                    // Untar tar file
                    proc.execFile("bash", {
                        args: ["-c", ["tar", "-zxvf", util.escapeShell(tarPath), "-C", util.escapeShell(pluginsDirAbsolute)].join(" ")]
                    }, function(err, stderr, stdout) {
                        if (err)
                            return handleError(err);

                        // Move template to the right folder
                        var dirPath = join(dirname(tarPath), template);
                        fs.rename(dirPath, path, function(err) {
                            if (err)
                                return handleError(err);

                            // Remove .tar.gz
                            fs.unlink(tarPath, function() {

                                // Add plugin to favorites
                                favs.addFavorite(dirname(pluginsDir), "plugins");

                                // Select and expand the folder of the plugin
                                tree.expandAndSelect(path);
                            });
                        });
                    });
                });
            });
        }

        function reload(name) {
            showReloadTip(name);
            
            var href = document.location.href.replace(/[?&]reload=[^&]+/, "");
            href += (href.match(/\?/) ? "&" : "?") + "reload=" + name;
            window.history.replaceState(window.history.state, null, href);
            
            for (var plugin in architectApp.lut) {
                if (architectApp.lut[plugin].provides.indexOf(name) < 0)
                    continue;

                reloadPackage(plugin);
                return;
            }
            updateReloadLastButton();
        }
        
        function updateReloadLastButton() {
            var last = getLastReloaded();
            if (last) {
                btnReloadLast.visible = true;
                btnReloadLast.textContent = "Reload " + last;
            } else {
                btnReloadLast.visible = false;
            }
        }
        
        function loadVFSExtension(callback) {
            if (api)
                return callback(null, api);
            ext.loadRemotePlugin("pluginLoader", {
                code: c9.standalone ? undefined : require("text!./vfs.package.reader.js"),
                file: c9.standalone ? "c9.ide.plugins/vfs.package.reader.js" : undefined,
                redefine: true
            }, function(err, remote) {
                if (err)
                    return callback(err);

                api = remote;
                return callback(null, api);
            });
        }
        
        function reloadPackage(path) {
            var unloaded = [];
            
            function recurUnload(name) {
                var plugin = architectApp.services[name];
                unloaded.push(name);
                
                // Find all the dependencies
                var deps = ext.getDependents(plugin.name);
                
                // Unload all the dependencies (and their deps)
                deps.forEach(function(name) {
                    recurUnload(name);
                });
                
                // Unload plugin
                plugin.unload();
            }
            
            // Recursively unload plugin
            var p = architectApp.lut[path];
            if (p.provides) { // Plugin might not been initialized all the way
                p.provides.forEach(function(name) {
                    recurUnload(name);
                });
            }
            
            // create reverse lookup table
            var rlut = {};
            for (var packagePath in architectApp.lut) {
                var provides = architectApp.lut[packagePath].provides;
                if (provides) { // Plugin might not been initialized all the way
                    provides.forEach(function(name) {
                        rlut[name] = packagePath;
                    });
                }
            }
            
            // Build config of unloaded plugins
            var config = [], done = {};
            unloaded.forEach(function(name) {
                var packagePath = rlut[name];
                
                // Make sure we include each plugin only once
                if (done[packagePath]) return;
                done[packagePath] = true;
                
                var options = architectApp.lut[packagePath];
                delete options.provides;
                delete options.consumes;
                delete options.setup;
                
                config.push(options);
                
                // Clear require cache
                requirejs.undef(options.packagePath); // global
            });
            
            // Load all plugins again
            architectApp.loadAdditionalPlugins(config, function(err) {
                if (err) console.error(err);
            });
        }
        
        function reloadAllCustomPlugins() {
            var list = [];
            Object.keys(architectApp.serviceToPlugin).forEach(function(name) {
                if (architectApp.serviceToPlugin[name].isAdditionalMode)
                    list.push(architectApp.serviceToPlugin[name].path);
            });
            
            var path = list[list.length - 1];
            reloadPackage(path.replace(/^~\/\.c9\//, ""));
            
            // Avoid confusion with "Reload Last Plugin"
            var href = document.location.href.replace(/[?&]reload=[^&]+/, "");
            window.history.replaceState(window.history.state, null, href);
            showInfo("Reloaded " + path + ".", 1000);
        }
        
        function showReloadTip(name) {
            if (options.devel) {
                var key = commands.getHotkey("reloadLastPlugin");
                if (commands.platform == "mac")
                    key = apf.hotkeys.toMacNotation(key);
                if (!getLastReloaded()) {
                    showInfo("Reloaded " + name + ". Press " + key + " to reload again.", 3000);
                    return;
                }
            }
            showInfo("Reloaded " + name + ".", 1000);
        }
        
        function getLastReloaded() {
            return qs.parse(document.location.search.substr(1)).reload;
        }
        
        function addAllDependents(packages) {
            var config = architectApp.config;
            var level = 0;
            do {
                level++;
                var changed = false;
                var packageNames = Object.keys(packages);
                config.forEach(function(x) {
                    packageNames.forEach(function(p) {
                        if (x.consumes.indexOf(p) != -1) {
                            x.provides.forEach(function(name) {
                                if (packages[name] == null) {
                                    changed = true;
                                    packages[name] = level;
                                }
                            });
                        }
                    });
                });
            } while (changed);
            return packages;
        }
        
        function addAllProviders(packages) {
            var serviceToPlugin = architectApp.serviceToPlugin;
            var level = 0;
            do {
                level--;
                var changed = false;
                var packageNames = Object.keys(packages);
                packageNames.forEach(function(p) {
                    var service = serviceToPlugin[p];
                    if (service && service.consumes) {
                        service.consumes.forEach(function(name) {
                            if (packages[name] == null) {
                                changed = true;
                                packages[name] = level;
                            }
                        });
                    }
                });
            } while (changed);
            return packages;
        }
        
        function unloadPackage(options, callback) {
            var toUnload = Object.create(null);
            var config = architectApp.config;
            function addPath(path) {
                config.forEach(function(p) {
                    if (!p.packagePath) return;
                    if (p.packagePath.startsWith(path)) {
                        p.provides.forEach(function(name) {
                            toUnload[name] = 0;
                        });
                    }
                });
            }
            if (options.path) {
                addPath(options.path);
            }
            if (options.paths) {
                options.path.forEach(addPath);
            }
            if (options.services) {
                options.services.forEach(function(name) {
                    toUnload[name] = 0;
                });
            }
            
            addAllDependents(toUnload);
            
            var services = architectApp.services;
            var serviceToPlugin = architectApp.serviceToPlugin;
            Object.keys(toUnload).forEach(function(name) {
                recurUnload(name);
            });
            
            function recurUnload(name) {
                var service = services[name];
                
                if (!service || !service.loaded)
                    return;
                
                // Find all the dependencies
                var deps = ext.getDependents(service.name);
                
                // Unload all the dependencies (and their deps)
                deps.forEach(function(name) {
                    recurUnload(name);
                });
                
                console.log(name);
                
                // Unload plugin
                service.unload();
                
                var pluginConfig = serviceToPlugin[name];
                if (pluginConfig && toUnload[name] == 0)
                    pluginConfig.__userDisabled = true;
            }
            
            reloadModel();
        }
        
        function loadPackage(options, callback) {
            // 1 {url, }
            // 2 
            var paths = {};
            paths[options.id] = options.staticPrefix;

            requirejs.config({ paths: paths });
            requirejs.undef(options.id, true);

            require([options.url], function(installed) {
                var plugins = require(options.id + "/package.json.js");

                var architectConfig = plugins.map(function(plugin) {
                    if (typeof plugin == "string")
                        plugin = { packagePath: plugin };
                    return plugin;
                });
                architectApp.loadAdditionalPlugins(architectConfig, function(err) {
                    callback && callback(err);
                });

            }, function(err) {
                callback && callback(err);
            });
        }
        
        function cleanupCache(packagePath) {
            var options = architectApp.pathToPackage[packagePath];
            var url = require.toUrl(options.packagePath, ".js");
            if (!define.fetchedUrls[url]) return false;
            
            delete options.provides;
            delete options.consumes;
            delete options.setup;
            
            requirejs.undef(options.packagePath);
            return true;
        }
        
        function addStaticPlugin(type, pluginName, filename, data, plugin) {
            var services = architectApp.services;
            var path = "plugins/" + pluginName + "/" 
                + (type == "installer" ? "" : type + "/") 
                + filename.replace(/\.js$/, "");
            
            switch (type) {
                case "builders":
                    data = util.safeParseJson(data, function() {});
                    if (!data) return;
                    if (!services.build.addBuilder) return;
                    
                    services.build.addBuilder(filename, data, plugin);
                    break;
                case "keymaps":
                    data = util.safeParseJson(data, function() {});
                    if (!data) return;
                    if (!services["preferences.keybindings"].addCustomKeymap) return;
                    
                    services["preferences.keybindings"].addCustomKeymap(filename, data, plugin);
                    break;
                case "modes":
                    if (!services.ace) return;
                    var mode = {};
                    var firstLine = data.split("\n", 1)[0].replace(/\/\*|\*\//g, "").trim();
                    firstLine.split(";").forEach(function(n) {
                        if (!n) return;
                        var info = n.split(":");
                        mode[info[0].trim()] = info[1].trim();
                    });
                    
                    services.ace.defineSyntax({
                        name: path,
                        caption: mode.caption,
                        extensions: (mode.extensions || "").trim()
                            .replace(/\s*,\s*/g, "|").replace(/(^|\|)\./g, "$1")
                    });
                    break;
                case "outline":
                    if (!data) return;
                    if (!services.outline.addOutlinePlugin) return;
                    
                    services.outline.addOutlinePlugin(path, data, plugin);
                    break;
                case "runners":
                    data = util.safeParseJson(data, function() {});
                    if (!data) return;
                    
                    services.run.addRunner(data.caption || filename, data, plugin);
                    break;
                case "snippets":
                    services["language.complete"].addSnippet(data, plugin);
                    break;
                case "themes":
                    services.ace.addTheme(data, plugin);
                    break;
                case "templates":
                    services.newresource.addFileTemplate(data, plugin);
                    break;
                case "installer":
                    console.error("Installer is not supported.");
                default:
                    console.error("Unsupported type", type);
            }
        }


        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });
        plugin.on("draw", function(e) {
            draw(e);
        });
        plugin.on("activate", function(e) {
            datagrid && datagrid.resize();
        });
        plugin.on("resize", function(e) {
            datagrid && datagrid.resize();
        });
        plugin.on("enable", function() {

        });
        plugin.on("disable", function() {

        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = false;

            model = null;
            datagrid = null;
            filterbox = null;
            btnUninstall = null;
            localPlugins = null;
            api = null;
        });

        /***** Register and define API *****/

        /**
         *
         **/
        plugin.freezePublicAPI({
            /**
             *
             */
            createNewPlugin: createNewPlugin,

            /**
             *
             */
            loadPackage: loadPackage,
            
            /**
             *
             */
            unloadPackage: unloadPackage,
            
            /**
             *
             */
            addStaticPlugin: addStaticPlugin,

            /**
             *
             */
            reload: reload,
            
            loadVFSExtension: loadVFSExtension
        });

        var shim = new Plugin();

        register(null, {
            "pluginManager": plugin,
            "plugin.manager": shim,
            "plugin.debug": shim,
        });
    }
});
