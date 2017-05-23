define(function(require, exports, module) {
    main.consumes = [
        "ui", "layout", "commands", "Dialog", "proc", "util", "menus", "dialog.error"
    ];
    main.provides = ["processlist"];
    return main;
    
    // @todo turn off multiselect

    function main(options, imports, register) {
        var Dialog = imports.Dialog;
        var ui = imports.ui;
        var commands = imports.commands;
        var layout = imports.layout;
        var proc = imports.proc;
        var util = imports.util;
        var menus = imports.menus;
        var showError = imports["dialog.error"].show;
        
        var search = require("../c9.ide.navigate/search");
        var Tree = require("ace_tree/tree");
        var TreeData = require("ace_tree/data_provider");
        
        var async = require("async");
        
        /***** Initialization *****/
        
        var plugin = new Dialog("Ajax.org", main.consumes, {
            name: "dialog.processlist",
            allowClose: true,
            dark: true,
            title: "Process List",
            width: 600,
            height: 500,
            zindex: 100000,
            resizable: true,
            modal: true,
            custom: true,
            elements: [
                { type: "textbox", id: "tbFilter", message: "Filter", width: 200, realtime: true },
                { type: "filler" },
                { type: "button", id: "btnKill", caption: "Kill", onclick: kill, disabled: true },
                { type: "button", id: "btnForceKill", color: "red", caption: "Force Kill", onclick: forceKill, disabled: true }
            ]
        });
        var emit = plugin.getEmitter();
        
        var INTERVAL = 5000;
        var model, datagrid, btnKill, btnForceKill, tbFilter, timer;
        
        var mode = "ps";
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            commands.addCommand({
                name: "showprocesslist",
                bindKey: { mac: "Command-Option-P", win: "Ctrl-Alt-P" },
                exec: function(editor, args) {
                    plugin.show(args.mode || "ps");
                }
            }, plugin);
            
            menus.addItemByPath("Tools/Process List", new ui.item({
                command: "showprocesslist"
            }), 1100, plugin);
        }
        
        var drawn = false;
        function draw(options) {
            if (drawn) return;
            drawn = true;
            
            ui.insertCss(require("text!./processlist.css"), plugin);
            
            plugin.aml.setAttribute("resizable", true);
            
            var pNode = options.html;
            pNode.className = "process-list";
            
            model = new TreeData();
            model.emptyMessage = "No processes to be shown";
            model.$sortNodes = true;
            
            model.$sorted = true;
            model.columnsPs = [{
                caption: "Process Name",
                value: "name",
                width: "100%",
                type: "tree",
            }, {
                caption: "CPU",
                // value: "cpu",
                getText: function(node) { return node.cpu + "%"; },
                width: "50",
            }, {
                caption: "MEM",
                // value: "mem",
                getText: function(node) { return node.mem + "%"; },
                width: "50",
            }, {
                caption: "Process Time",
                value: "ptime",
                width: "50",
            }, {
                caption: "PID",
                value: "pid",
                width: "50",
            }, {
                caption: "User",
                value: "user",
                width: "80",
            }];
            
            model.columnsLsof = [{
                caption: "Address",
                value: "address",
                width: "100%",
            }, {
                caption: "Process Name",
                value: "command",
                width: "80",
            }, {
                caption: "Status",
                value: "status",
                width: "50",
            }, {
                caption: "PID",
                value: "pid",
                width: "50",
            }, {
                caption: "Type",
                value: "type",
                width: "50",
            }];
            
            model.columns = model.columnsPs;
            
            var datagridDiv = pNode.appendChild(document.createElement("div"));
            datagrid = new Tree(datagridDiv);
            datagrid.renderer.setTheme({ cssClass: "blackdg" });
            // datagrid.setOption("maxLines", 200);
            
            layout.on("eachTheme", function(e) {
                var height = parseInt(ui.getStyleRule(".blackdg .row", "height"), 10) || 24;
                model.rowHeightInner = height;
                model.rowHeight = height;
                
                if (e.changed) (datagrid).resize(true);
            });
            
            datagrid.setDataProvider(model);
            
            layout.on("resize", function() { datagrid.resize(); }, plugin);
            
            datagrid.on("changeSelection", function(e) {
                var row = datagrid.selection.getCursor();
                if (row) {
                    btnKill.enable();
                    btnForceKill.enable();
                }
                else {
                    btnKill.disable();
                    btnForceKill.disable();
                }
            });
            
            btnKill = plugin.getElement("btnKill");
            btnForceKill = plugin.getElement("btnForceKill");
            tbFilter = plugin.getElement("tbFilter");
            
            // Filter
            tbFilter.on("afterchange", function(e) {
                applyFilter();
            });
            
            update();
            
            emit("draw");
        }
        
        /***** Methods *****/
        
        function update() {
            if (mode == "ps")
                updateProcessList();
            else
                updateServerList();
        }
        
        function updateProcessList() {
            setModel(null, model.columnsPs);
            proc.execFile("ps", { args: ["axh", "-ouser,pid:1,ppid:1,pcpu:1,pmem:1,time:1,command:1"] }, function(err, stdout, stderr) {
                if (err) return;
                var hiddenRegex = /^\[kthreadd|/
                
                var oldNodes = model.pidMap;
                if (!oldNodes || oldNodes.mode != mode)
                    oldNodes = { mode: mode };
                var pidMap = model.pidMap = { mode: mode };
                
                var lines = stdout.substr(0, stdout.length - 1).split("\n");
                var json = lines.map(function(line) {
                    var item = line.split(/\s+/);
                    var name = item.slice(6).join(" ");
                    var pid = item[1];
                    var node = oldNodes[pid] || { pid: pid, isOpen: hiddenRegex.test(name) };
                    pidMap[pid] = node;
                    
                    node.cpu = item[3];
                    node.mem = item[4];
                    node.ppid = item[2];
                    node.name = name;
                    node.user = item[0];
                    node.ptime = item[5];
                    
                    node.items = node.children = null;
                    
                    return node;
                });
                
                var root = [];
                json.forEach(function(node) {
                    var parent = pidMap[node.ppid];
                    if (!parent) return root.push(node);
                    if (!parent.items) parent.items = [];
                    parent.items.push(node);
                });
                json = root;
                
                setModel(json, model.columnsPs);
            });
        }
        
        function updateServerList() {
            setModel(null, model.columnsLsof);
            proc.execFile("bash", { args: ["-c", 
                // try both with sudo and without, to get all servers
                "sudo -n lsof -P -i -F pcnTtu; lsof -P -i -F pcnTtu"
            ]}, function(err, stdout, stderr) {
                if (err) return;
                var json = [];
                var node;
                var oldNodes = model.pidMap;
                if (!oldNodes || oldNodes.mode != mode)
                    oldNodes = { mode: mode };
                model.pidMap = { mode: mode };
                stdout.split("\n").forEach(function(part) {
                    if (part[0] == "p") {
                        if (node) json.push(node);
                        var pid = part.slice(1);
                        node = oldNodes[pid] || { pid: pid };
                        model.pidMap[pid] = node;
                    }
                    if (part[0] == "c")
                        node.command = part.slice(1);
                    if (part[0] == "n")
                        node.address = part.slice(1);
                    if (part[0] == "T" && /^TST=/.test(part))
                        node.status = part.slice(4);
                    if (part[0] == "t")
                        node.type = part.slice(1);
                    if (part[0] == "u")
                        node.uid = parseInt(part.slice(1), 10);
                });
                if (node) json.push(node);
                
                setModel(json, model.columnsLsof);
            });
        }
        
        function setModel(json, columns) {
            if (model.columns != columns) {
                model.columns = columns;
                datagrid.setDataProvider(model);
                if (!json) json = [];
            }
            if (json) {
                model.cachedRoot = json;
                model.setRoot(json);
            }
            if (model.keyword)
                applyFilter();
        }
        
        function forceKill() {
            kill(true);
        }
        
        function kill(force) {
            var nodes = datagrid.selection.getSelectedNodes();
            if (!nodes.length) return;
            var button = force ? btnForceKill : btnKill;
            
            async.each(nodes, function(row, next) {
                if (!/^\d+$/.test(row.pid)) return next();
                button.disable();
                var args = (force ? "" : "-9 ") + row.pid;
                proc.execFile("bash", { 
                    args: ["-c", "sudo -n kill " + args + " || kill " + args] 
                }, function(err, stdout, stderr) {
                    next(err);
                });
            }, function(err) {
                button.enable();
                if (err) return showError(err); 
                update();
            });
            
        }
        
        function applyFilter() {
            model.keyword = tbFilter.getValue();
            if (!model.keyword) {
                model.reKeyword = null;
                model.setRoot(model.cachedRoot);
            }
            else {
                model.reKeyword = new RegExp("(" 
                    + util.escapeRegExp(model.keyword) + ")", 'i');
                var root = search.treeSearch(model.cachedRoot, model.keyword, true);
                model.setRoot(root);
            }
        }
        
        function show(mode, options) {
            if (!options)
                options = {};
            
            setMode(mode);
            return plugin.queue(function() {
                    
            }, true);
        }
        
        function setMode(val) {
            if ((val == "ps" || val == "lsof") && mode != val) {
                mode = val;
                if (timer) update();
            }
        }
        
        /***** Lifecycle *****/
        
        plugin.on("show", function() {
            timer = setInterval(function() {
                update();
            }, INTERVAL);
            update();
        });
        plugin.on("hide", function() {
            timer = clearInterval(timer);
        });
        plugin.on("draw", function(options) {
            draw(options);
        });
        plugin.on("load", function() {
            load();
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
            btnKill = null;
            btnForceKill = null;
            tbFilter = null;
            timer = null;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            show: show
        });
        
        register(null, {
            processlist: plugin
        });
    }
});
