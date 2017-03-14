/*global requirejs*/
define(function(require, exports, module) {
    main.consumes = [
        "PreferencePanel", "settings", "ui", "util", "ext", "c9", "Plugin",
        "layout", "proc", "menus", "commands",
        "dialog.error", "dialog.info", "tree.favorites", "fs", "tree", "vfs",
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
        var vfs = imports.vfs;
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
        var async = require("async");
        
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
        var emit = plugin.getEmitter();

        var model, datagrid, filterbox;
        var btnUninstall, btnServices, btnReadme, btnReload;
        var btnReloadLast;
        var localPlugins;
        var disabledPlugins = Object.create(null);
        var packages = Object.create(null);

        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            menus.addItemByPath("Tools/~", new ui.divider(), 100000, plugin);
            menus.addItemByPath("Tools/Developer", null, 100100, plugin);

            if (!DEBUG) {
                menus.addItemByPath("Tools/Developer/Start in Debug Mode", new ui.item({
                    onclick: function() {
                        var url = location.href + (location.href.indexOf("?") > -1
                          ? "&debug=2"
                          : "?debug=2");
                        util.openNewWindow(url);
                    }
                }), 900, plugin);
            }
            if (!ENABLED) {
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
                
                menus.addItemByPath("Tools/Developer/Reload Last Plugin", new ui.item({
                    command: "reloadLastPlugin",
                    isAvailable: getLastReloaded
                }), 1300, plugin);
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
            
            if (DEBUG && sessionStorage.localPackages) {
                loadPackage(
                    util.safeParseJson(sessionStorage.localPackages) || []
                );
            }
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
                        "initial-message": "Search installed plugins"
                    }),
                    btnReadme = new ui.button({
                        skin: "c9-toolbarbutton-glossy",
                        caption: "Readme",
                        class: "serviceButton",
                        onclick: function() {
                            mode = "readme";
                            scheduleRedraw();
                        }
                    }),
                    btnServices = new ui.button({
                        skin: "c9-toolbarbutton-glossy",
                        caption: "services",
                        class: "serviceButton",
                        onclick: function() {
                            mode = "services";
                            scheduleRedraw();
                        }
                    }),
                    new ui.filler({}),
                    btnUninstall = new ui.button({
                        skin: "c9-toolbarbutton-glossy",
                        caption: "Disable",
                        class: "btn-red",
                        onclick: function() {
                            var item = datagrid.selection.getCursor();
                            if (item.packageConfig) {
                                if (item.enabled)
                                    unloadPackage(item.packageConfig);
                                else
                                    loadPackage(item.packageConfig);
                            }
                            else {
                                if (item.enabled)
                                    unloadPlugins(item);
                                else
                                    loadPlugins(item);
                            }
                        }
                    }),
                    btnReload = new ui.button({
                        skin: "c9-toolbarbutton-glossy",
                        caption: "Reload",
                        onclick: function() {
                            var item = datagrid.selection.getCursor();
                            if (item.name)
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

            datagrid.on("changeSelection", scheduleRedraw);
            model.on("change", scheduleRedraw);
            
            plugin.on("reloadModel", scheduleRedraw);
            
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
                while (item && !item.packageOptions) {
                    item = item.parent;
                }
                if (!item) {
                    descriptionBar.$ext.textContent = "Readme is not available.";
                    return;
                }
                
                if (readmeCache[item.readmePath]) {
                    descriptionBar.$ext.textContent = readmeCache[item.readmePath];
                    return;
                }
                descriptionBar.$ext.textContent = "Loading...";
                var parts = item.filePath.split("/");
                parts.pop();
                parts.push("README.md");
                var path = parts.join("/");
                fs.readFile(path, function(e, v) {
                    if (e)
                        return descriptionBar.$ext.textContent = "Readme is not available.";
                    var div = document.createElement("div");
                    div.textContent = v;
                    div.style.cssText = "padding: 5px; white-space: pre-wrap";
                    descriptionBar.$ext.textContent = "";
                    descriptionBar.$ext.appendChild(div);
                });
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
            
            function scheduleRedraw() {
                window.requestAnimationFrame(renderDetails);
            }
            
             var mnuCtxTree = new ui.menu({
                id: "mnuChat",
            }, plugin);
            menus.decorate(mnuCtxTree);
            plugin.addElement(mnuCtxTree);
            menus.addItemByPath("context/pluginManager/", mnuCtxTree, 0, plugin);
            menus.addItemByPath("context/pluginManager/Reveal in File Tree", new ui.item({
                isAvailable: function() {
                    var selected = datagrid.selection.getCursor();
                    return selected && selected.filePath;
                    
                },
                onclick: function() {
                    var selected = datagrid.selection.getCursor();
                    var tabbehavior = architectApp.services.tabbehavior;
                    if (selected.filePath) {
                        tabbehavior.revealtab({ path: selected.filePath });
                    }
                },
            }), plugin);
            treeBar.setAttribute("contextmenu", mnuCtxTree);
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
            
            function addPlugin(plugin, node) {
                if (!plugin.provides || !plugin.consumes)
                    return console.error("Broken plugin", plugin);
                if (plugin.packagePath) {
                    var parts = plugin.packagePath.split("/");
                    
                    var path = parts.shift();
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
                            plugin.provides.forEach(function(x) {
                                var service = architectApp.services[x];
                                if (!service || (!service.loaded && service.unload)) {
                                    enabled = 0;
                                }
                            });
                            node.map[p].enabled = enabled;
                        }
                        node = node.map[p];
                        node.className = plugin.__error ? "load-error" : "";
                    });
                }
            }
            
            architectApp.config.forEach(function(plugin) {
                var node = CORE[plugin.packagePath] ? groups.core : groups.pre;
                addPlugin(plugin, node);
            });
            
            if (localPlugins) {
                localPlugins.forEach(function(x) {
                    groups.vfs.map[x] = groups.vfs.map[x] || {
                        filePath: "~/.c9/plugins/" + x + "/package.json",
                        path: "plugins/" + x,
                        name: x,
                        enabled: 0,
                        parent: groups.vfs,
                        packageOptions: {
                            name: x,
                        }
                    };
                });
            }
            
            Object.keys(packages).forEach(function(n) {
                var node = groups.vfs;
                var pkg = packages[n];
                
                if (pkg.c9.plugins) {
                    pkg.c9.plugins.forEach(function(plugin) {
                        addPlugin(plugin, node);
                    });
                }
            });
            
            function flatten(node, index) {
                if (node.map) {
                    node.items = node.children = Object.keys(node.map).map(function(x) {
                        return node.map[x];
                    });
                }
                if (node.items) {
                    node.items.forEach(flatten);
                    if (node.items.length == 1 && !node.isGroup) {
                        var other = node.items[0];
                        if (node.parent && node.parent.items[index] == node) {
                            node.parent.items[index] = other;
                            other.name = node.name + "/" + other.name;
                            other.packageOptions = node.packageOptions;
                            other.filePath = node.filePath;
                            other.url = node.url;
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
            
            emit("reloadModel");
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
            
            var tarSourcePath = join("templates", template + ".tar.gz");
            var url = staticPrefix + "/" + tarSourcePath;
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
                    ].concat(
                        c9.sourceDir
                        ? [ "cp", util.escapeShell(c9.sourceDir + "/plugins/c9.ide.plugins/" + tarSourcePath),
                            util.escapeShell(tarPathAbsolute) ]
                        : [ "curl", "-L", util.escapeShell(url), "-o", util.escapeShell(tarPathAbsolute) ]
                    ).join(" ")]
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
                                
                                readAvailablePlugins(reloadModel);
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
        
        function getAllPlugins() {
            var config = architectApp.config;
            Object.keys(packages).forEach(function(n) {
                if (packages[n] && packages[n].c9 && packages[n].c9.plugins)
                    config = config.concat(packages[n].c9.plugins);
            });
            return config.filter(function(x) {
                return x.consumes && x.provides;
            });
        }
        
        function addAllDependents(plugins) {
            var config = getAllPlugins();
            var level = 0;
            do {
                level++;
                var changed = false;
                var packageNames = Object.keys(plugins);
                config.forEach(function(x) {
                    packageNames.forEach(function(p) {
                        if (x.consumes.indexOf(p) != -1) {
                            x.provides.forEach(function(name) {
                                if (plugins[name] == null) {
                                    changed = true;
                                    plugins[name] = level;
                                }
                            });
                        }
                    });
                });
            } while (changed);
            return plugins;
        }
        
        function addAllProviders(plugins) {
            var serviceToPlugin = architectApp.serviceToPlugin;
            var level = 0;
            do {
                level--;
                var changed = false;
                var packageNames = Object.keys(plugins);
                packageNames.forEach(function(p) {
                    var service = serviceToPlugin[p];
                    if (service && service.consumes) {
                        service.consumes.forEach(function(name) {
                            if (plugins[name] == null) {
                                changed = true;
                                plugins[name] = level;
                            }
                        });
                    }
                });
            } while (changed);
            return plugins;
        }
        
        function unloadPackage(options, callback) {
            var toUnload = Object.create(null);
            var config = getAllPlugins();
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
            if (Array.isArray(options))
                return async.map(options, loadPackage, callback);
            
            if (typeof options == "string") {
                options = /^https?:/.test(options)
                    ? { path: options }
                    : { url: options };
            }
            
            if (!options.url && options.path)
                options.url = vfs.url(options.path);
            
            var parts = options.url.split("/");
            var root = parts.pop();
            options.url = parts.join("/");
            
            if (!options.name) {
                options.name = parts[parts.length - 1];
                if (options.name == "build")
                    options.name = parts[parts.length - 2];
                options.name = options.name.replace(/@.*$/, "");
            }
            if (!options.packageName)
                options.packageName = root;
            
            if (!options.rootDir)
                options.rootDir = "plugins";
            
            var id = options.rootDir + "/" + options.name;
            var pathMappings = {};
            
            pathMappings[id] = options.url;
            requirejs.config({ paths: pathMappings });
            requirejs.undef(id + "/", true);
            
            if (/\.js$/.test(root)) {
                require([options.url + "/" + root], function(json) {
                    json = json || require(options.id + "/" + options.packageName);
                    getPluginsFromPackage(json, callback);
                }, function(err) {
                    callback && callback(err);
                });
            }
            else if (options.path && /\.json$/.test(root)) {
                fs.readFile(options.path, function(e, value) {
                    try {
                        var json = JSON.parse(value);
                    } catch (e) {
                        return callback(e);
                    }
                    getPluginsFromPackage(json, callback);
                });
            }
            else {
                callback(new Error("Missing path and url"));
            }
            
            function getPluginsFromPackage(json, callback) {
                var plugins = [];
                if (json.name != options.name)
                    json.name = options.name;
                
                if (json.plugins) {
                    Object.keys(json.plugins).forEach(function(name) {
                        var plugin = json.plugins[name];
                        if (typeof plugin == "string")
                            plugin = { packagePath: plugin };
                        if (!plugin.packagePath)
                            plugin.packagePath = id + "/" + name;
                        plugin.staticPrefix = options.url;
                        plugins.push(plugin);
                    });
                }
                
                packages[json.name] = json;
                if (!json.c9)
                    json.c9 = {};
                json.c9.plugins = plugins;
                
                loadPlugins(plugins, callback);
            }
        }
        
        function loadPlugins(plugins, callback) {
            architectApp.loadAdditionalPlugins(plugins, function(err) {
                callback && callback(err);
            });
        }
        
        function unloadPlugins() {
            
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
            disabledPlugins = null;
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
        });

        var shim = new Plugin();

        register(null, {
            "pluginManager": plugin,
            "plugin.manager": shim,
            "plugin.debug": shim,
        });
    }
});
