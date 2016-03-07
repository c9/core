/*global requirejs*/
define(function(require, exports, module) {
    main.consumes = [
        "PreferencePanel", "settings", "ui", "util", "Form", "ext", "c9",
        "dialog.alert", "dialog.confirm", "layout", "proc", "menus", "commands",
        "dialog.error", "dialog.info", "tree.favorites", "fs", "tree", "plugin.debug",
        "preferences.experimental"
    ];
    main.provides = ["plugin.manager"];
    return main;

    /*
        - Show Packages to be updated
        - Open Plugin Store
        - Open Cloud9 in Debug Mode
        - List all installed packages
            - Filter
            - Core packages
                - Name
                - Version
                - Description
                - Load Time
                - Plugin profile
            - Pre-installed
                - *
            - Custom packages
                - *

            - Actions:
                - Uninstall
                - Report Issue
                - Open README
                - Open in Cloud9

        DataProvider.variableHeightRowMixin.call(this)  in datagrid constructor
        and set node.height

        harutyun [1:11 PM]
        or add a custom getItemHeight function like https://github.com/c9/newclient/blob/master/node_modules/ace_tree/demo/demo.js#L63 (edited)
    */

    function main(options, imports, register) {
        var PreferencePanel = imports.PreferencePanel;
        var settings = imports.settings;
        var layout = imports.layout;
        var ui = imports.ui;
        var c9 = imports.c9;
        var menus = imports.menus;
        var fs = imports.fs;
        var commands = imports.commands;
        var ext = imports.ext;
        var tree = imports.tree;
        var proc = imports.proc;
        var util = imports.util;
        var qs = require("querystring");
        var alert = imports["dialog.alert"].show;
        var confirm = imports["dialog.confirm"].show;
        var showError = imports["dialog.error"].show;
        var showInfo = imports["dialog.info"].show;
        var favs = imports["tree.favorites"];
        var pluginDebug = imports["plugin.debug"];
        var experimental = imports["preferences.experimental"];

        var search = require("../c9.ide.navigate/search");
        var Tree = require("ace_tree/tree");
        var TreeData = require("./managerdp");
        var join = require("path").join;
        var basename = require("path").basename;
        var dirname = require("path").dirname;

        var staticPrefix = options.staticPrefix;
        var architect;

        var CORE = {
            "c9.core":1,"c9.fs":1,"c9.ide.preferences":1,"c9.ide.panels":1,
            "c9.ide.plugins":1,"c9.ide.login":1,"c9.vfs.client":1,
            "c9.ide.console":1,"c9.ide.editors":1,"c9.ide.dialog.common":1,
            "c9.ide.dialog.file":1,"c9.ide.dialog.login":1,"c9.ide.errorhandler":1,
            "c9.ide.help":1,"c9.ide.keys":1,"c9.ide.restore":1,"c9.ide.watcher":1,
            "c9.ide.tree":1, "c9.ide.info":1, "c9.ide.browsersupport":1,
            "c9.ide.layout.classic":1, "c9.ide.terminal":1, "c9.ide.ace":1,
            "c9.ide.clipboard":1, "c9.nodeapi":1
        };
        var GROUPS = {
            "custom": "Installed Plugins",
            "pre": "Pre-installed plugins",
            "core": "Core Plugins",
            "runtime": "Plugins created runtime"
        };
        var TEMPLATES = {
            "plugin.simple": "Empty Plugin",
            "plugin.default": "Full Plugin",
            "plugin.installer": "Installer Plugin",
            "plugin.bundle": "Cloud9 Bundle"
        };

        // @TODO add sorting

        /***** Initialization *****/

        var ENABLED = c9.location.indexOf("debug=2") > -1
            || experimental.addExperiment(
                  "plugin-manager",
                  options.devel,
                  "SDK/Plugin Manager"
               );

        var plugin = new PreferencePanel("Ajax.org", main.consumes, {
            caption: "Plugin Manager",
            className: "plugins",
            form: false,
            noscroll: true,
            index: 200,
            visible: ENABLED,
        });
        // var emit = plugin.getEmitter();

        var model, datagrid, filterbox;
        var btnUninstall, btnReport, btnReadme, btnCloud9, btnReload;

        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;

            if (!ENABLED) return;

            // @TODO enable/disable plugins -> move to ext

            // settings.on("read", function(e) {
            //     updateCommandsFromSettings();
            // }, plugin);

            // commands.on("update", function(){
            //     changed = true;
            //     updateCommandsFromSettings();
            // }, plugin);
            
            
            if (options.devel) {
                commands.addCommand({
                    name: "reloadLastPlugin",
                    bindKey: {mac: "F4", win: "F4"},
                    hint: "reload plugin last reloaded in plugin manager",
                    exec: function() {
                        var name = getLastReloaded();
                        if (!name)
                            return commands.exec("reloadPlugin", null, { panel: plugin });
                        reload(name);
                    }
                }, plugin);
                commands.addCommand({
                    name: "reloadPlugin",
                    group: "Plugins",
                    exec: function(){ 
                        commands.exec("openpreferences", null, { panel: plugin });
                    }
                }, plugin);
                
                menus.addItemByPath("Tools/~", new ui.divider(), 100000, plugin);
                menus.addItemByPath("Tools/Developer", null, 100100, plugin);
    
                menus.addItemByPath("Tools/Developer/Reload Built-in Plugin...", new ui.item({
                    command: "reloadPlugin"
                }), 1100, plugin);
                
                menus.addItemByPath("Tools/Developer/Reload Last Plugin", new ui.item({
                    command: "reloadLastPlugin",
                    isAvailable: getLastReloaded
                }), 1200, plugin);
            }

            menus.addItemByPath("File/New Plugin", null, 210, plugin);
            Object.keys(TEMPLATES).forEach(function(name){
                menus.addItemByPath("File/New Plugin/" + TEMPLATES[name], new ui.item({
                    onclick: function(){
                        createNewPlugin(name);
                    }
                }), 210, plugin);
            });
            
            ext.on("register", function(){
                setTimeout(reloadModel);
            });
        }

        var drawn;
        function draw(e) {
            if (drawn) return;
            drawn = true;

            model = new TreeData();
            model.emptyMessage = "No plugins found";

            model.columns = [{
                caption: "Name",
                value: "name",
                // getText: function(p){
                //     return p.name + " (" + p.items.length + ")";
                // },
                width: "250",
                type: "tree"
            }, {
                caption: "Version",
                // value: "version",
                getText: function(p){
                    return p.version ||
                        (p.isPackage
                            ? p.items.length && p.items[0].version || ""
                            : "");
                },
                width: "100"
            }, {
                caption: "Startup Time",
                // value: "time",
                width: "100",
                getText: function(p){
                    if (p.time !== undefined)
                        return (p.time || 0) + "ms";

                    var total = 0;
                    if (p.isPackage || p.name == "runtime") {
                        p.items.forEach(function(item){ total += item.time || 0 });
                    }
                    else {
                        p.items.forEach(function(p){
                            p.items && p.items.forEach(function(item){ total += item.time || 0 });
                        });
                    }
                    return (p.time = total) + "ms";
                }
            }, {
                caption: "Enabled",
                value: "enabled",
                width: "100"
            // }, {
            //     caption: "Package",
            //     value: "package", // @todo make a link
            //     width: "100%"
            }, {
                caption: "Developer",
                // value: "developer",
                getText: function(p){
                    return p.developer ||
                        (p.isPackage
                            ? p.items.length && p.items[0].developer || ""
                            : "");
                },
                width: "150"
            }];

            layout.on("eachTheme", function(e){
                var height = parseInt(ui.getStyleRule(".bar-preferences .blackdg .tree-row", "height"), 10) || 24;
                model.rowHeightInner = height;
                model.rowHeight = height;

                if (e.changed) datagrid.resize(true);
            });

            reloadModel();

            // type: "custom",
            // title: "Introduction",
            // position: 1,
            // node: intro = new ui.bar({
            //     height: 149,
            //     "class" : "intro",
            //     style: "padding:12px;position:relative;"
            // })

            // intro.$int.innerHTML =
            //     '<h1>Keybindings</h1><p>Change these settings to configure '
            //     + 'how Cloud9 responds to your keyboard commands.</p>'
            //     + '<p>You can also manually edit <a href="javascript:void(0)" '
            //     + '>your keymap file</a>.</p>'
            //     + '<p class="hint">Hint: Double click on the keystroke cell in the table below to change the keybinding.</p>';

            // intro.$int.querySelector("a").onclick = function(){ editUserKeys(); };

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
                    new ui.filler({}),
                    btnUninstall = new ui.button({
                        skin: "btn-default-css3",
                        caption: "Uninstall",
                        class: "btn-red",
                        onclick: function(){
                            var item = datagrid.selection.getCursor();
                            if (item.isPackage)
                                uninstall(item.name, function(){});
                            else if (item.enabled == "true")
                                disable(item.name, function(){});
                            else
                                enable(item.name, function(){});
                        }
                    }),
                    btnReport = new ui.button({
                        skin: "btn-default-css3",
                        caption: "Report Issue"
                    }),
                    btnReadme = new ui.button({
                        skin: "btn-default-css3",
                        caption: "Open README"
                    }),
                    btnCloud9 = new ui.button({
                        skin: "btn-default-css3",
                        caption: "Open in Cloud9"
                    }),
                    btnReload = new ui.button({
                        skin: "btn-default-css3",
                        caption: "Reload",
                        onclick: function(){
                            var item = datagrid.selection.getCursor();
                            if (item.enabled && item.name)
                                reload(item.name);
                        }
                    })
                ]
            });

            var div = e.html.appendChild(document.createElement("div"));
            div.style.position = "absolute";
            div.style.left = "10px";
            div.style.right = "10px";
            div.style.bottom = "10px";
            div.style.top = "50px";

            datagrid = new Tree(div);
            datagrid.setTheme({ cssClass: "blackdg" });
            datagrid.setDataProvider(model);

            layout.on("resize", function(){ datagrid.resize() }, plugin);

            function setTheme(e) {
                filterbox.setAttribute("class",
                    e.theme.indexOf("dark") > -1 ? "dark" : "");
            }
            layout.on("themeChange", setTheme);
            setTheme({ theme: settings.get("user/general/@skin") });

            filterbox.ace.commands.addCommands([
                {
                    bindKey: "Enter",
                    exec: function(){ }
                }, {
                    bindKey: "Esc",
                    exec: function(ace){ ace.setValue(""); }
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

            datagrid.on("changeSelection", function(e){
                var item = datagrid.selection.getCursor();

                if (item.isGroup) {
                    btnUninstall.disable();
                    btnReport.disable();
                    btnReadme.disable();
                    btnCloud9.disable();
                    btnReload.disable();
                }
                else {
                    if (item.isPackage) {
                        btnUninstall.setCaption("Uninstall");
                        btnUninstall.setAttribute("class", "btn-red");
                    }
                    else {
                        btnUninstall.setCaption(item.enabled == "true" ? "Disable" : "Enable");
                        btnUninstall.setAttribute("class", item.enabled == "true" ? "btn-red" : "btn-green");
                    }

                    if (CORE[item.name] || item.parent.parent && item.parent.parent.isType == "core") {
                        btnUninstall.disable();
                    } else {
                        btnUninstall.enable();
                    }

                    if (item.isPackage || CORE[item.name] || item.parent.parent && item.parent.parent.isType == "core") {
                        btnReload.disable();
                    } else {
                        btnReload.enable();
                    }

                    btnReport.enable();
                    btnReadme.enable();
                    btnCloud9.enable();
                }
            });
        }

        /***** Methods *****/

        function reloadModel() {
            if (!model) return;

            var groups = {};
            var packages = {};
            var root = [];

            ["custom", "pre", "core", "runtime"].forEach(function(name){
                root.push(groups[name] = {
                    items: [],
                    isOpen: name != "runtime",
                    className: "group",
                    isGroup: true,
                    isType: name,
                    noSelect: true,
                    name: GROUPS[name]
                });
            });

            var lut = ext.named;

            ext.plugins.forEach(function(plugin) {
                var info = architect.pluginToPackage[plugin.name];
                var packageName = info && info.package || "runtime";

                var groupName;
                if (CORE[packageName]) groupName = "core";
                else if (info && info.isAdditionalMode) groupName = "custom";
                else groupName = "pre";

                var package;
                if (packageName == "runtime") {
                    package = groups.runtime;
                }
                else {
                    package = packages[packageName];
                    if (!package)
                        groups[groupName].items.push(package = packages[packageName] = {
                            items: [],
                            isPackage: true,
                            className: "package",
                            parent: groups[groupName],
                            name: packageName
                        });
                }

                package.items.push({
                    name: plugin.name,
                    enabled: lut[plugin.name].loaded ? "true" : "false",
                    time: plugin.time,
                    version: info && info.version || "N/A",
                    parent: package,
                    package: packageName,
                    developer: plugin.developer == "Ajax.org"
                        ? "Cloud9"
                        : plugin.developer
                });
            });

            model.cachedRoot = { items: root };
            applyFilter();
        }

        function applyFilter() {
            model.keyword = filterbox && filterbox.getValue();

            if (!model.keyword) {
                model.reKeyword = null;
                model.setRoot(model.cachedRoot);

                // model.isOpen = function(node){ return node.isOpen; }
            }
            else {
                model.reKeyword = new RegExp("("
                    + util.escapeRegExp(model.keyword) + ")", 'i');
                var root = search.treeSearch(model.cachedRoot.items, model.keyword, true);
                model.setRoot(root);

                // model.isOpen = function(node){ return true; };
            }
        }

        function uninstall(name){
            btnUninstall.setAttribute("caption", "...");
            btnUninstall.disable();

            // @TODO first disable the plugin

            proc.spawn("c9", { args: ["uninstall", name] }, function(err, p){
                p.stdout.on("data", function(c){

                });
                p.stderr.on("data", function(c){

                });
                p.on("exit", function(code){
                    if (code) {
                        return alert("Could not uninstall plugin",
                            "Could not uninstall plugin",
                            "Could not uninstall plugin");
                    }

                    btnUninstall.setAttribute("caption", "Uninstall");
                    btnUninstall.enable();
                });
            });
        }

        function enable(name){
            try{ ext.enablePlugin(name); }
            catch(e){
                alert("Could not disable plugin",
                    "Got an error when disabling plugin: " + name,
                    e.message);
                return false;
            }

            reloadModel();
        }

        function disable(name, callback){
            var deps = ext.getDependencies(name);
            var plugins = ext.named;

            for (var i = 0; i < deps.length; i++) {
                ext.getDependencies(deps[i]).forEach(function(name){
                    if (deps.indexOf(name) == -1)
                        deps.push(name);
                });
            }

            if (deps.length) {
                confirm("Found " + deps.length + " plugins that depend on this plugin.",
                    "Would you like to disable all the plugins that depend on '" + name + "'?",
                    "These plugins would also be disabled: " + deps.join(", "),
                    // Yes
                    function(){
                        if (deps.reverse().every(function(name){
                            console.log("Disabling", name);
                            return !recurDisable(name);
                        })) {
                            disable(name);
                            reloadModel();
                        }
                    },
                    // No
                    function(){
                        callback(new Error("User Cancelled"));
                    });
            }
            else {
                var e = disable(name);
                if (!e) reloadModel();
                callback(e);
            }

            function recurDisable(name){
                var deps = ext.getDependencies(name);

                if (deps.length) {
                    if (!deps.every(function(name){
                        return !recurDisable(name);
                    })) return false;
                }

                return disable(name);
            }

            function disable(name) {
                if (!plugins[name].loaded) return;

                try{ ext.disablePlugin(name); }
                catch(e){
                    alert("Could not disable plugin",
                        "Got an error when disabling plugin: " + name,
                        e.message);
                    return e;
                }
            }
        }

        function createNewPlugin(template){
            if (!template)
                template = "c9.ide.default";

            var url = staticPrefix + "/" + join("templates", template + ".tar.gz");
            if (!url.match(/^http/))
                url = location.origin + url;

            function getPath(callback, i){
                i = i || 0;
                var path = join("~", ".c9/plugins/", template + (i ? "." + i : ""));
                fs.exists(path, function(exists){
                    if (exists) return getPath(callback, i+1);
                    callback(null, path);
                });
            }

            function handleError(err){
                showError("Could not create plugin.");
                console.error(err);
            }

            getPath(function(err, path){
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
                }, function(err, stderr, stdout){
                    if (err)
                        return handleError(err);

                    // Untar tar file
                    proc.execFile("bash", {
                        args: ["-c", ["tar", "-zxvf", util.escapeShell(tarPath), "-C", util.escapeShell(pluginsDirAbsolute)].join(" ")]
                    }, function(err, stderr, stdout){
                        if (err)
                            return handleError(err);

                        // Move template to the right folder
                        var dirPath = join(dirname(tarPath), template);
                        fs.rename(dirPath, path, function(err){
                            if (err)
                                return handleError(err);

                            // Remove .tar.gz
                            fs.unlink(tarPath, function(){

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
            
            for (var plugin in architect.lut) {
                if (architect.lut[plugin].provides.indexOf(name) < 0)
                    continue;

                pluginDebug.reloadPackage(plugin);
                return;
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

            architect = null;
            model = null;
            datagrid = null;
            filterbox = null;
            btnUninstall = null;
            btnReport = null;
            btnReadme = null;
            btnCloud9 = null;
            btnReload = null;
        });

        /***** Register and define API *****/

        /**
         *
         **/
        plugin.freezePublicAPI({
            /**
             *
             */
            get architect(){ throw new Error(); },
            set architect(v){
                architect = v;
                architect.on("ready-additional", function(){
                    reloadModel();
                });
            },

            /**
             *
             */
            createNewPlugin: createNewPlugin,

            /**
             *
             */
            uninstall: uninstall,

            /**
             *
             */
            enable: enable,

            /**
             *
             */
            disable: disable,

            /**
             *
             */
            reload: reload
        });

        register(null, {
            "plugin.manager" : plugin
        });
    }
});
