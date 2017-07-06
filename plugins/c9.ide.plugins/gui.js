define(function(require, exports, module) {
    main.consumes = [
        "app", "ext", "c9", "PreferencePanel", "settings", "ui", "util",
        "layout", "menus", "commands", "pluginManager",
        "dialog.error", "dialog.info", "tree.favorites", "fs", "tree", "vfs",
        "preferences.experimental", "apf","dialog.notification"
    ];
    main.provides = ["pluginManagerUi"];
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
        var util = imports.util;
        var apf = imports.apf;
        var showError = imports["dialog.error"].show;
        var showInfo = imports["dialog.info"].show;
        var notify = imports["dialog.notification"].show;
        var experimental = imports["preferences.experimental"];
        var pluginManager = imports.pluginManager;
        var architectApp = imports.app;

        var search = require("../c9.ide.navigate/search");
        var Tree = require("ace_tree/tree");
        var TreeData = require("./managerdp");
        var qs = require("querystring");
        
        var escapeHTML = require("ace/lib/lang").escapeHTML;

        var CORE = {};
        var TEMPLATES = {
            "plugin.simple": "Empty Plugin",
            "plugin.default": "Full Plugin",
            "plugin.installer": "Installer Plugin",
            "plugin.bundle": "Cloud9 Bundle"
        };

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

        var model;
        var datagrid;
        var filterbox;
        var btnInstall;
        var btnUninstall;
        var btnServices;
        var btnReadme;
        var btnReloadLast;
        var localPlugins;
        var btnSettings;

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
            
            menus.addItemByPath("Tools/Developer/Open Plugin Explorer", new ui.item({
                command: "openPluginManager"
            }), 1100, plugin);
            
            if (DEBUG) {
                notify("<div class='c9-readonly'>You are in <span style='color:rgb(245, 234, 15)'>Debug</span> Mode. "
                    + "<button id='.pm_btn1'>Open Plugin Explorer</button>"
                    + "<button id='.pm_btn2' style='float:right'>Reload last Plugin</button>",
                    false);
                
                document.getElementById(".pm_btn1").onclick = function() { commands.exec("openPluginManager") };
                btnReloadLast = document.getElementById(".pm_btn2");
                btnReloadLast.onclick = function() { commands.exec("reloadLastPlugin") };
                updateReloadLastButton();
                
                pluginManager.readAvailablePlugins(function(err, available) {
                    if (err) return console.error(err);
                    localPlugins = available;
                    reloadModel();
                    if (sessionStorage.localPackages) {
                        pluginManager.loadPackage(
                            util.safeParseJson(sessionStorage.localPackages) || []
                        );
                    }
                    var updateSessionStorage = function() {
                        var packages = pluginManager.packages;
                        sessionStorage.localPackages = JSON.stringify(Object.keys(packages).map(function(x) {
                            if (packages[x] && packages[x].fromVfs && packages[x].enabled)
                                return packages[x].filePath;
                        }).filter(Boolean));
                    };
                    pluginManager.on("enablePackage", updateSessionStorage);
                    pluginManager.on("disablePackage", updateSessionStorage);
                });
                
                commands.addCommand({
                    name: "reloadLastPlugin",
                    bindKey: { mac: "F4", win: "F4" },
                    hint: "reload plugin last reloaded in plugin manager",
                    exec: function() {
                        var names = getLastReloaded();
                        if (!names)
                            return commands.exec("openPluginManager", null, { panel: plugin });
                        reload(names);
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
                        pluginManager.createNewPlugin(name);
                    }
                }), 210, plugin);
            });
        }

        var drawn;
        function draw(e) {
            if (drawn) return;
            drawn = true;
            
            function scheduleReloadModel() {
                if (scheduleReloadModel.timer) return;
                scheduleReloadModel.timer = setTimeout(function() {
                    scheduleReloadModel.timer = null;
                    reloadModel();
                });
            }
            ext.on("register", scheduleReloadModel);
            pluginManager.on("change", scheduleReloadModel);
            pluginManager.on("enablePackage", scheduleReloadModel);
            pluginManager.on("disablePackage", scheduleReloadModel);
            
            ui.insertCss(require("text!./style.css"), plugin);

            model = new TreeData();
            model.emptyMessage = "No plugins found";

            model.columns = [{
                caption: "Name",
                value: "name",
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
                    btnInstall = new ui.button({
                        skin: "c9-toolbarbutton-glossy",
                        caption: "Enable",
                        class: "btn-red",
                        onclick: function() {
                            reloadGridSelection(true);
                        }
                    }),
                    btnUninstall = new ui.button({
                        skin: "c9-toolbarbutton-glossy",
                        caption: "Disable",
                        class: "btn-red",
                        onclick: function() {
                            reloadGridSelection(false);
                        }
                    }),
                    new ui.button({
                        skin: "c9-toolbarbutton-glossy",
                        caption: "Reload",
                        onclick: function() {
                            reloadGridSelection();
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
                    + (node.loading ? "loading" : "")
                    + (enabled == -1 
                        ? "half-checked " 
                        : (enabled ? "checked " : ""))
                    + "'></span>";
            };
            
            var mode = "services";
            var readmeCache = {};
            function renderDetails() {
                var items = datagrid.selection.getSelectedNodes();
                var hasEnabled = 0;
                var hasDisabled = 0;
                items.forEach(function(x) {
                    if (x.enabled != 0)
                        hasEnabled = true;
                    if (x.enabled != 1)
                        hasDisabled = true;
                });
                btnUninstall.setProperty("visible", hasEnabled);
                btnInstall.setProperty("visible", hasDisabled);
                
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
                
                if (items.length == 1 && items[0].__error) {
                    var errorContainer = document.createElement("div");
                    errorContainer.style.cssText = "padding: 5px; white-space: pre-wrap";
                    errorContainer.textContent = items[0].__error.message;
                    descriptionBar.$ext.insertBefore(errorContainer, descriptionBar.$ext.firstChild);
                }
            }
            
            function renderReadmeDetails(items) {
                if (items.length > 1) {
                    descriptionBar.$ext.textContent = "Multipe items selected.";
                    return;
                }
                var item = items[0];
                while (item && !item.packageConfig) {
                    item = item.parent;
                }
                if (!item) {
                    descriptionBar.$ext.textContent = "Readme is not available.";
                    return;
                }
                
                if (readmeCache[item.name]) {
                    var div = document.createElement("div");
                    div.textContent = readmeCache[item.name];
                    div.style.cssText = "padding: 5px; white-space: pre-wrap";
                    descriptionBar.$ext.textContent = "";
                    descriptionBar.$ext.appendChild(div);
                    return;
                }
                descriptionBar.$ext.textContent = "Loading...";
                if (item.packageConfig.filePath) {
                    var parts = item.packageConfig.filePath.split("/");
                    parts.pop();
                    parts.push("README.md");
                    var path = parts.join("/");
                    fs.readFile(path, function(e, v) {
                        if (e)
                            return readmeCache[item.name] = "Readme is not available.";
                        readmeCache[item.name] = v;
                        renderDetails();
                    });
                }
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
                pluginManager.addAllProviders(consumedMap);
                var consumedList = Object.keys(consumedMap);
                var consumedGroups = splitToGroups(consumedList, consumedMap);
                
                var dependents = Object.create(null);
                provided.forEach(function(service) {
                    dependents[service] = 0;
                });
                pluginManager.addAllDependents(dependents);
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
                var serviceDesc = '<h1 class="pluginManagerHeader">Provided services [' + provided.length + ']</h1>\
                    <p type="provided">' + (provided.length ? formatServices(provided) : "") + '</p>\
                    <h1 class="pluginManagerHeader">Consumed services [' + (consumedList.length - provided.length) + ']</h1>\
                    <p type="consumed">' + consumedGroups.map(formatServices).join("<br/>") + '</p>\
                    <h1 class="pluginManagerHeader">Dependent services [' + (depList.length - provided.length) + ']</h1>\
                    <p type="dependent">' + depGroups.map(formatServices).join("<br/>") + '</p>\
                    <br/>';
                descriptionBar.$ext.innerHTML = '<div class="basic intro" \
                    style="padding:12px 0 12px 12px;white-space:pre-line">\
                    <p>' + (items.length == 1 
                        ? '<span class="serviceButton">' + escapeHTML(items[0].path) + '</span>'
                        : (items.length || "no") + " plugins selected") + '</p>\
                    <hr></hr>'
                    + (items.length ? serviceDesc : "")
                + '</div>';
                
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
                pluginManager.addAllDependents(deps);
                pluginManager.addAllProviders(deps);
                
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
            
            
            btnSettings = new ui.button({
                skin: "header-btn",
                class: "panel-settings",
                submenu: mnuCtxTree
            });
            treeBar.appendChild(btnSettings);
            datagrid.renderer.on("scrollbarVisibilityChanged", updateScrollBarSize);
            function updateScrollBarSize() {
                var scrollBarV = datagrid.renderer.scrollBarV;
                var w = scrollBarV.isVisible ? scrollBarV.getWidth() : 0;
                btnSettings.$ext.style.marginRight = Math.max(w - 2, 0) + "px";
            }
            
            menus.addItemByPath("context/pluginManager/", mnuCtxTree, 0, plugin);
            menus.addItemByPath("context/pluginManager/Reveal in File Tree", new ui.item({
                isAvailable: function() {
                    var selected = datagrid.selection.getCursor();
                    return selected && selected.packageConfig && selected.packageConfig.filePath
                        || c9.sourceDir && selected && selected.path;
                },
                onclick: function() {
                    var selected = datagrid.selection.getCursor();
                    var tabbehavior = architectApp.services.tabbehavior;
                    var filePath = selected.packageConfig && selected.packageConfig.filePath;
                    if (!filePath && c9.sourceDir)
                        filePath = c9.sourceDir + "/" + selected.path + (selected.items ? "" : ".js");
                    if (filePath)
                        tabbehavior.revealtab({ path: util.normalizePath(filePath) });
                    else
                        showInfo("Path is not available.");
                },
            }), plugin);
            menus.addItemByPath("context/pluginManager/Refresh List", new ui.item({
                onclick: function() {
                    pluginManager.readAvailablePlugins(function(err, available) {
                        if (err) return console.error(err);
                        localPlugins = available;
                        reloadModel();
                    });
                },
            }), plugin);
            menus.addItemByPath("context/pluginManager/~", new ui.divider({}), plugin);
            menus.addItemByPath("context/pluginManager/Disable", new ui.item({
                isAvailable: function() {
                    var selected = datagrid.selection.getCursor();
                    return selected && selected.enabled != 0;
                },
                onclick: function() { reloadGridSelection(false); },
            }), plugin);
            menus.addItemByPath("context/pluginManager/Enable", new ui.item({
                isAvailable: function() {
                    var selected = datagrid.selection.getCursor();
                    return selected && selected.enabled != 1;
                },
                onclick: function() { reloadGridSelection(true); },
            }), plugin);
            menus.addItemByPath("context/pluginManager/Reload", new ui.item({
                isAvailable: function() {
                    var selected = datagrid.selection.getCursor();
                    return selected;
                },
                onclick: function() { reloadGridSelection(); },
            }), plugin);
            treeBar.setAttribute("contextmenu", mnuCtxTree);
            
            model.on("toggleCheckbox", function(e) {
                reloadGridSelection(!e.target.enabled, e.selectedNodes || [e.target]);
            });
        }
        

        /***** Methods *****/
        
        function reloadModel() {
            if (!model) return;
            
            var packages = pluginManager.packages;
            
            if (!CORE.pluginManagerUi) {
                CORE.pluginManagerUi = 1;
                pluginManager.addAllProviders(CORE);
                Object.keys(CORE).forEach(function(n) {
                    if (architectApp.serviceToPlugin[n])
                        CORE[architectApp.serviceToPlugin[n].packagePath] = 1;
                });
            }

            var GROUPS = {
                // "changed": "Recently Changed",
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
                    return;
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
                        node.__error = plugin.__error;
                    });
                }
            }
            
            function addPackage(name) {
                var pkg = packages[name];
                var parent = pkg.filePath ? groups.vfs : groups.remote;
                
                var node = parent.map[name] = parent.map[name] || {
                    path: "plugins/" + name,
                    name: name,
                    enabled: 0,
                    parent: parent,
                };
                
                node.packageConfig = pkg;
                node.className = pkg.__error ? "load-error" : "";
                node.__error = pkg.__error;
                node.loading = pkg.loading;
            }
            
            architectApp.config.forEach(function(plugin) {
                var node = CORE[plugin.packagePath] ? groups.core : groups.pre;
                addPlugin(plugin, node);
            });
            
            if (localPlugins) {
                localPlugins.forEach(function(name) {
                    if (!packages[name]) {
                        packages[name] = {
                            name: name,
                            filePath: "~/.c9/plugins/" + name + "/package.json",
                        };
                    }
                    
                });
            }
            
            Object.keys(packages).forEach(function(n) {
                var pkg = packages[n];
                var node = pkg.filePath ? groups.vfs : groups.remote;
                
                addPackage(n);
                
                if (pkg.c9 && pkg.c9.plugins) {
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
                            other.packageConfig = node.packageConfig;
                            other.filePath = node.filePath;
                            other.url = node.url;
                            other.loading = node.loading;
                        }
                    }
                    if (!node.isGroup) {
                        node.enabled = null;
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

        function reload(names) {
            var nodes = names.split(/\s*,\s*/).map(function(name) {
                if (pluginManager.packages[name])
                    return { packageConfig: pluginManager.packages[name] };
                return { path: name };
            });
            
            reloadGridSelection(null, nodes);
        }
        
        function reloadGridSelection(mode, nodes) {
            if (!nodes)
                nodes = datagrid.selection.getSelectedNodes();
            
            var reloadLast = pluginManager.reload(nodes, mode);
            if (reloadLast.length) {
                var href = document.location.href.replace(/[?&]reload=[^&]+/, "");
                href += (href.match(/\?/) ? "&" : "?") + "reload=" + reloadLast.join(",");
                window.history.replaceState(window.history.state, null, href);
                if (mode !== false) {
                    showReloadTip(reloadLast.join(","), mode);
                    updateReloadLastButton();
                }
            }
        }
        
        function updateReloadLastButton() {
            if (!btnReloadLast) return;
            var last = getLastReloaded();
            if (last) {
                btnReloadLast.visible = true;
                btnReloadLast.textContent = "Reload " + last;
            } else {
                btnReloadLast.visible = false;
            }
        }
        
        function showReloadTip(name, mode) {
            if (options.devel) {
                var key = commands.getPrettyHotkey("reloadLastPlugin");
                if (!getLastReloaded()) {
                    showInfo("Loaded " + name + ". Press " + key + " to reload again.", 3000);
                    return;
                }
            }
            showInfo("Loaded " + name + " for the duration of current browser session.", 3000);
        }
        
        function getLastReloaded() {
            return qs.parse(document.location.search.substr(1)).reload;
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
            btnServices = null;
            btnReadme = null;
            btnReloadLast = null;
            model = null;
            datagrid = null;
            filterbox = null;
            btnInstall = null;
            btnUninstall = null;
            localPlugins = null;
        });

        /***** Register and define API *****/

        /**
         *
         **/
        plugin.freezePublicAPI({
            
            /*
             * @ignore
             */
            get datagrid() { return datagrid; },
        });

        register(null, {
            "pluginManagerUi": plugin,
        });
    }
});
