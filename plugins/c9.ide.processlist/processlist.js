define(function(require, exports, module) {
    main.consumes = [
        "ui", "layout", "commands", "Dialog", "proc", "util", "menus"
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
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            commands.addCommand({
                name: "showprocesslist",
                bindKey: { mac: "Command-Option-P", win: "Ctrl-Alt-P" },
                exec: function() {
                    plugin.show();
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
            model.columns = [{
                caption: "Process Name",
                value: "name",
                width: "100%"
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
                width: "100",
            }, {
                caption: "PID",
                value: "pid",
                width: "50",
            }, {
                caption: "User",
                value: "user",
                width: "80",
            }];
            
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
            
            updateProcessList();
            
            emit("draw");
        }
        
        /***** Methods *****/
        
        function updateProcessList() {
            var sel = datagrid.selection.getSelectedNodes();
            
            proc.execFile("ps", { args: ["auxc"]}, function(err, stdout, stderr) {
                if (err) return;
                
                var lines = stdout.substr(0, stdout.length - 1).split("\n"); lines.shift();
                var json = lines.map(function(line) {
                    var item = line.split(/\s+/);
                    var name = item.splice(10).join(" ");
                    return {
                        name: name,
                        cpu: item[2],
                        mem: item[3],
                        ptime: item[9],
                        pid: item[1],
                        user: item[0]
                    };
                });
                
                model.cachedRoot = json;
                model.setRoot(json);
                
                if (model.keyword)
                    applyFilter();
                
                if (sel) {
                    var nodes = [];
                    var pids = sel.map(function(n) { return n.pid; });
                    
                    model.root.items.forEach(function(item) {
                        if (pids.indexOf(item.pid) > -1)
                            nodes.push(item);
                    });
                    datagrid.selection.setSelection(nodes);
                }
            });
        }
        
        function forceKill() {
            kill(true);
        }
        
        function kill(force) {
            var nodes = datagrid.selection.getSelectedNodes();
            if (!nodes.length) return;
            
            var button = force ? btnForceKill : btnKill;
            
            async.each(nodes, function(row, next) {
                button.disable();
                
                var args = [];
                if (force) args.push("-9");
                args.push(row.pid);
                
                proc.execFile("kill", { args: args }, function(err, stdout, stderr) {
                    next(err);
                });
            }, function(err) {
                button.enable();
                if (!err) updateProcessList();
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
        
        function show(reset, options) {
            if (!options)
                options = {};
            
            return plugin.queue(function() {
                // if (reset || current == -1) {
                //     path = [startPage];
                //     current = 0;
                //     activate(startPage);
                // }
                    
            }, true);
        }
        
        /***** Lifecycle *****/
        
        plugin.on("show", function() {
            timer = setInterval(function() {
                updateProcessList();
            }, INTERVAL);
        });
        plugin.on("hide", function() {
            clearInterval(timer);
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
