/*global apf */
var bar; // Intended global

define(function(require, exports, module) {
    var EventEmitter = require("events").EventEmitter;
    var skin = require("text!plugins/c9.ide.layout.classic/skins.xml");
    var theme = require("text!/static/standalone/skin/default/dark.css");
    
    function mockPlugins(options, imports, register) {
        var mock;
        register(null, mock = {
            c9: (function() {
                var x = new EventEmitter();
                x.location = "";
                x.has = function() { return false; };
                x.toInternalPath = x.toExternalPath = function(p) {
                    return p;
                };
                x.connected = true;
                return x;
            })(),
            apf: {},
            vfs: (function() {
                var x = new EventEmitter();
                return x;
            })(),
            "vfs.log": {
                log: function() {} 
            },
            "vfs.endpoint": (function() {
                var x = new EventEmitter();
                return x;
            })(),
            anims: (function() {
                var x = new EventEmitter();
                x.animateSplitBoxNode = function(node, opt) {
                    node.setAttribute("height", parseInt(opt.height, 10));
                };
                return x;
            })(),
            watcher: (function() {
                var x = new EventEmitter();
                x.watch = function() {};
                x.unwatch = function() {};
                x.check = function() {};
                return x;
            })(),
            "watcher.gui": (function() {
                var x = new EventEmitter();
                return x;
            })(),
            save: (function() {
                var x = new EventEmitter();
                x.saveAll = function(c) { c(); };
                x.getSavingState = function(tab) { return "saved"; };
                return x;
            })(),
            findreplace: {
                
            },
            ace: (function() {
                var x = new EventEmitter();
                x.getElement = function() {};
                return x;
            })(),
            css: {
                get packed() { return true; },
                get packedThemes() { return true; },
                defineLessLibrary: function() {},
                insert: function() {},
                insertLess: function() {}
            },
            settings: (function() {
                var obj = new EventEmitter();
                obj.save = function() {};
                obj.set = function() {};
                obj.get = function() {};
                obj.getNumber = function() {};
                obj.emit("read", {});
                return obj;
            })(),
            fs: (function() {
                var obj = new EventEmitter();
                obj.readFile = function() {};
                obj.writeFile = function() {};
                obj.watch = function() {};
                return obj;
            })(),
            "fs.cache": (function() {
                var obj = new EventEmitter();
                return obj;
            })(),
            tooltip: {
                add: function() {}
            },
            clipboard: (function() {
                var cb = new EventEmitter();
                cb.registerHandler = function() {};
                return cb;
            })(),
            preferences: (function() {
                var prefs = new EventEmitter();
                prefs.add = function() {};
                return prefs;
            })(),
            analytics: {
                updateTraits: function() {}
            },
            commands: (function() {
                var commands = {};
                
                if (typeof apf != "undefined") {
                    apf.button.prototype.$propHandlers["command"] =
                    apf.item.prototype.$propHandlers["command"] = function(value) {
                        this.onclick = function() {
                            commands[value].exec(
                                (apf.getPlugin("tabManager") || mock.tabManager).focussedPage.editor
                            );
                        };
                    };
                }
                
                var c = new EventEmitter();
                
                c.commands = commands;
                c.addCommands = function(a, b, c) {
                    a.forEach(function(o) {
                        commands[o.name] = o;
                    });
                };
                c.addCommand = function(o) {
                    commands[o.name] = o;
                };
                c.removeCommand = function(o) {
                    delete commands[o.name];
                };
                c.exec = function(name) {
                    commands[name].exec();
                };
                c.getPrettyHotkey = function(name) { return ""; };
                c.getHotkey = function(name) { return ""; };
                c.getExceptionList = function() { return []; };
                
                return c;
            })(),
            log: {},
            http: {},
            ui: {},
            api: {
                stats: {
                    post: function(type, message, cb) {
                        cb && cb();
                    }
                }
            },
            layout: (function() {
                // Load the skin
                if (imports.ui) {
                    var plugin = new imports.Plugin();
                    
                    imports.ui.insertCss(theme, false, plugin);
                    
                    imports.ui.insertSkin({
                        "data": skin,
                        "media-path": "plugins/c9.ide.layout.classic/images/",
                        "icon-path": "plugins/c9.ide.layout.classic/icons/"
                    }, { addElement: function() {} });
                    
                    document.documentElement.style.background = "white";
                }
                
                var layout = plugin || new EventEmitter();
                
                layout.initMenus = function() {};
                layout.findParent = function() {
                    if (!bar || bar.$amlDestroyed || !bar.$ext || !bar.$ext.parentNode) {
                        bar = apf.document.documentElement.appendChild(
                            new imports.ui.bar());
                        bar.$ext.style.position = "fixed";
                        bar.$ext.style.left = "20px";
                        bar.$ext.style.right = "320px";
                        bar.$ext.style.bottom = "20px";
                        bar.$ext.style.height = "200px";
                        bar.$ext.style.minHeight = "200px";
                        plugin.addElement(bar);
                    }
                    bar.setAttribute("resizable", true);
                    
                    return bar;
                };
                layout.getElement = function() {
                    return new apf.bar();
                };
                layout.setFindArea = function(active, callback, isDefault) {
                    // callback();
                };
                layout.proposeLayoutChange = function() {};
                return layout;
            })(),
            panels: (function() {
                var panel, column;
                
                var api = {
                    register: function(p, o) {
                        if (!column) {
                            column = apf.document.documentElement.appendChild(
                                new imports.ui.bar({ style: "background : #303130;" }));
                            column.$ext.style.position = "fixed";
                            column.$ext.style.top = "75px";
                            column.$ext.style.right = "20px";
                            column.$ext.style.left = "";
                            column.$ext.style.bottom = "20px";
                            column.$ext.style.width = "300px";
                            column.$ext.style.height = "";
                        }
                        
                        panel = p; 
                        p.draw({ container: column.$ext, aml: column });
                    },
                    isActive: function() { return false; },
                    unregister: function() {}, 
                    activate: function() {
                        // panel.panel.show()
                    },
                    deactivate: function() {
                        // panel.panel.hide()
                    },
                    on: function() {
                        
                    }
                };
                if (imports.Plugin) {
                    var plugin = new imports.Plugin();
                    plugin.freezePublicAPI(api);
                    return plugin;
                } else {
                    return api;
                }
            })(),
            Panel: function(developer, deps, options) {
                var plugin = new imports.Plugin(developer, deps);
                var emit = plugin.getEmitter();
                var drawn = false;
                var where;
                plugin.on("load", function() {
                    where = options.where || "left";
                    var panels = apf.getPlugin("panels") || mock.panels;
                    panels.register(plugin);
                });
                plugin.freezePublicAPI.baseclass();
                plugin.freezePublicAPI({
                    get autohide() { return false; },
                    get width() { return options.width; },
                    get minWidth() { return options.minWidth; },
                    get aml() { return plugin.getElement(options.elementName); },
                    get area() { return ""; },
                    get where() { return where; },
                    setCommand: function() {},
                    attachTo: function() {},
                    detach: function() {},
                    emit: emit,
                    show: function() { emit("show"); },
                    hide: function() { emit("hide"); },
                    draw: function draw(area) {
                        if (drawn) return false;
                        drawn = true;
                        
                        emit.sticky("draw", { 
                            html: area.container, 
                            aml: area.aml 
                        });
                        
                        return true;
                    }
                });
                
                return plugin;
            },
            Dialog: function(developer, deps, options) {
                var plugin = new imports.Plugin(developer, deps);
                plugin.freezePublicAPI.baseclass();
                plugin.freezePublicAPI({});
                
                return plugin;
            },
            tree: (function() {
                var tree = new EventEmitter();
                tree.createFolder = function() {};
                tree.getElement = function() {};
                tree.getAllExpanded = function() { return []; };
                return tree;
            })(),
            "tree.favorites": (function() {
                var tree = new EventEmitter();
                tree.addFavorites = function() {};
                tree.getFavoritePaths = function() { return []; };
                return tree;
            })(),
            tabManager: (function() {
                var tabManager = new EventEmitter();
                tabManager.open = function() { tabManager.emit("open"); };
                tabManager.openFile = function() { tabManager.emit("open"); };
                tabManager.findPage = function() {};
                tabManager.getPanes = function() { return []; };
                tabManager.checkAllTabs = function() {};
                return tabManager;
            })(),
            tabbehavior: (function() {
                var x = new EventEmitter();
                x.getElement = function() {};
                return x;
            })(),
            menus: (function() {
                var menus = new EventEmitter();
                menus.addItemByPath = function(x, aml, y, plugin) { 
                    aml && (plugin || y).addElement(aml);
                    return aml;
                };
                menus.addItemToMenu = menus.addItemByPath;
                menus.get = function() {return {};};
                menus.remove = function() {};
                menus.enableItem = function() {};
                menus.disableItem = function() {};
                return menus;
            })(),
            util: {
                alert: function() {},
                escapeXml: function(s) { return s; },
                normalizePath: function(s) { return s; },
                stableStringify: function(s) { return JSON.stringify(s); },
            },
            gotoline: {
                toggle: function() { }
            },
            "auth.bootstrap": {
                login: function(callback) { callback(); }
            },
            "auth": {},
            "info": {
                getUser: function(callback) { 
                    var user = { id: 1 };
                    return callback ? callback(null, user) : user;
                },
                getWorkspace: function(callback) { 
                    var ws = { id: 2 };
                    return callback ? callback(null, ws) : ws;
                }
            },
            "preferences.experimental": {
                addExperiment: function() {
                    return false;
                },
                add: function() {},
            },
            "ace.gotoline": {},
            "ace.stripws": {
                disable: function() {},
                enable: function() {}
            },
            "dialog.alert": { show: function() { console.log(console, Array.prototype.slice.apply(arguments)); } },
            "dialog.confirm": { show: function() {} },
            "dialog.question": { show: function() {} },
            "dialog.file": { show: function() {} },
            "dialog.fileremove": { show: function() {} },
            "dialog.fileoverwrite": { show: function() {} },
            "dialog.error": {
                showError: function(msg) { console.warn(msg); },
                show: function(msg) { console.warn(msg); },
                hide: function(msg) { },
            },
            "dialog.info": {
                show: function(msg) { console.log(msg); },
                hide: function(msg) { },
            },
            "installer": { createSession: function() {}, reinstall: function() {}, isInstalled: function() { return true; } },
            "run.gui": { getElement: function() {} },
            "debugger": { debug: function() {}, stop: function() {} },
            "focusManager": {
                focus: function() {
                    
                }
            },
            "metrics": {
                getLastPing: function() { throw Error("Not implemented"); },
                getLastest: function() { throw Error("Not implemented"); },
                onPingComplete: function() { throw Error("Not implemented"); },
                log: function() {},
                increment: function() {}
            },
            MountTab: function(developer, deps, options) {
                var plugin = new imports.Plugin(developer, deps);
                plugin.freezePublicAPI.baseclass();
                plugin.freezePublicAPI({
                });
                
                return plugin;
            },
            mount: {},
            error_handler: {
                log: function() {},
                reportError: function() {}
            },
            proc: {
                execFile: function() {},
                spawn: function() {}
            },
            threewaymerge: {
                patchAce: function(oldVal, newVal, doc) {
                    if (doc == undefined) {
                        doc = newVal;
                        newVal = oldVal;
                    }
                    doc.setValue(newVal);
                }
            },
            metadata: (function() {
                var x = new EventEmitter();
                return x;
            })(),
            editors: (function() {
                var x = new EventEmitter();
                return x;
            })(),
            timeslider: (function() {
                var x = new EventEmitter();
                return x;
            })(),
            OTDocument: (function() {
                var x = new EventEmitter();
                return x;
            })(),
            "notification.bubble": (function() {
                var x = new EventEmitter();
                return x;
            })(),
            "collab": (function() {
                var x = new EventEmitter();
                return x;
            })(),
            "collab.connect": (function() {
                var x = new EventEmitter();
                return x;
            })(),
            "collab.workspace": (function() {
                var x = new EventEmitter();
                x.users = [];
                return x;
            })(),
            "collab.util": (function() {
                var x = new EventEmitter();
                return x;
            })(),
            "scm": (function() {
                var x = new EventEmitter();
                x.register = function() {};
                x.unregister = function() {};
                return x;
            })(),
            "immediate": (function() {
                var x = new EventEmitter();
                x.register = function() {};
                x.unregister = function() {};
                return x;
            })(),
            "c9.analytics": (function() {
                var x = new EventEmitter();
                x.register = function() {};
                x.unregister = function() {};
                return x;
            })(),
            "terminal.monitor.message_view": (function() {
                var x = new EventEmitter();
                x.show = function() {};
                x.hide = function() {};
                return x;
            })()
        });
    }
   
    module.exports = mockPlugins;
});