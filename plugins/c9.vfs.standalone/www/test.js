var bar; // Intended global

require([
    "lib/chai/chai", 
    "text!plugins/c9.ide.layout.classic/skins.xml", 
    "events",
    "text!/static/standalone/skin/default/dark.css",
    "lib/architect/architect"
], function (chai, skin, events, theme, architect) {
    "use strict";
    chai.Assertion.includeStack = true; // enable stack trace in errors
    var expect = chai.expect;
    var EventEmitter = events.EventEmitter;

    function html(path, message) {
        var htmlNode;
        if (typeof path != "object" || !(path instanceof HTMLElement))
            htmlNode = html.constr(path);
        else
            htmlNode = path;
        var not = false;
        
        function testOk(value) {
            if (not)
                expect(value, message || path).not.ok;
            else
                expect(value, message || path).ok;
            not = false;
        }
        
        var obj = {
            get is(){ return obj; },
            get has(){ return obj; },
            get have(){ return obj; },
            get and(){ return obj; },
            get to(){ return obj; },
            get not(){ not = true; return obj; },
            
            get ok(){ testOk(htmlNode); return obj; },
            get exists(){ testOk(htmlNode); return obj; },
            get exist(){ testOk(htmlNode); return obj; },
            get node(){ return htmlNode },
            
            get visible() {
                testOk(htmlNode && (htmlNode.offsetWidth || htmlNode.offsetHeight));
                return obj;
            },
            
            text: function(text) {
                testOk(htmlNode.textContent.match(text));
                return obj;
            },
            
            icon: function(icon) {
                testOk(htmlNode.innerHTML.indexOf(icon) > -1);
                return obj;
            },
            
            className: function(name) {
                testOk(htmlNode.className.indexOf(name) > -1);
                return obj;
            },
            child: function(query) { 
                if (typeof query == "number") {
                    if (query < 0)
                        query = htmlNode.children.length + query;
                    htmlNode = htmlNode.children[query];
                } else {
                    htmlNode = htmlNode.querySelector(query); 
                }
                return obj;
            }
        };
        return obj;
    }
    expect.html = html;
    expect.html.setConstructor = function(fn) {
        html.constr = fn;
    };
    
    expect.html.mocked = function(options, imports, register) {
        register(null, {
            c9 : (function(){
                var x = new EventEmitter();
                x.location = "";
                x.has = function(){ return false; };
                x.toInternalPath = x.toExternalPath = function(p) {
                    return p;
                };
                x.connected = true;
                return x;
            })(),
            vfs: (function(){
                var x = new EventEmitter();
                return x;
            })(),
            "vfs.log": {
                log: function(){} 
            },
            anims: (function(){
                var x = new EventEmitter();
                x.animateSplitBoxNode = function(node, opt) {
                    node.setAttribute("height", parseInt(opt.height, 10));
                };
                return x;
            })(),
            watcher: (function(){
                var x = new EventEmitter();
                x.watch = function(){};
                x.unwatch = function(){};
                x.check = function(){};
                return x;
            })(),
            "watcher.gui": (function(){
                var x = new EventEmitter();
                return x;
            })(),
            save: (function(){
                var x = new EventEmitter();
                x.saveAll = function(c){ c(); };
                x.getSavingState = function(tab) { return "saved"; };
                return x;
            })(),
            findreplace: {
                
            },
            ace: (function() {
                var x = new EventEmitter();
                x.getElement = function(){};
                return x;
            })(),
            css: {
                get packed() { return true; },
                get packedThemes() { return true; },
                defineLessLibrary: function(){},
                insert: function() {},
                insertLess: function() {}
            },
            settings: (function(){
                var obj = new EventEmitter();
                obj.save = function(){};
                obj.set = function(){};
                obj.get = function(){};
                obj.getNumber = function() {};
                obj.emit("read", {});
                return obj;
            })(),
            fs: (function(){
                var obj = new EventEmitter();
                obj.writeFile = function(){};
                obj.watch = function(){};
                return obj;
            })(),
            "fs.cache": (function(){
                var obj = new EventEmitter();
                return obj;
            })(),
            tooltip: {
                add: function(){}
            },
            clipboard: (function(){
                var cb = new EventEmitter();
                cb.registerHandler = function(){};
                return cb;
            })(),
            preferences: (function(){
                var prefs = new EventEmitter();
                prefs.add = function(){};
                return prefs;
            })(),
            analytics: {
                updateTraits: function() {}
            },
            commands: (function(){
                var commands = {};
                
                if (typeof apf != "undefined") {
                    apf.button.prototype.$propHandlers["command"] =
                    apf.item.prototype.$propHandlers["command"] = function(value) {
                        this.onclick = function(){
                            commands[value].exec(
                                apf.getPlugin("tabManager").focussedPage.editor
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
                c.getPrettyHotkey = function(name) { return "" };
                c.getHotkey = function(name) { return "" };
                c.getExceptionList = function(){ return []; };
                
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
            layout: (function(){
                // Load the skin
                if (imports.ui) {
                    var plugin = new imports.Plugin();
                    
                    imports.ui.insertCss(theme, false, plugin);
                    
                    imports.ui.insertSkin({
                        "data"       : skin,
                        "media-path" : "plugins/c9.ide.layout.classic/images/",
                        "icon-path"  : "plugins/c9.ide.layout.classic/icons/"
                    }, {addElement: function(){}});
                    
                    document.documentElement.style.background = "white";
                }
                
                var layout = plugin || new EventEmitter();
                
                layout.initMenus = function() {};
                layout.findParent = function(){
                    if (!bar || bar.$amlDestroyed) {
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
                layout.getElement = function(){
                    return new apf.bar();
                };
                layout.setFindArea = function(active, callback, isDefault) {
                    // callback();
                };
                layout.proposeLayoutChange = function(){};
                return layout;
            })(),
            panels: (function(){
                var panel, column;
                
                var api = {
                    register: function(p, o) {
                        if (!column) {
                            column = apf.document.documentElement.appendChild(
                                new imports.ui.bar({style:"background : #303130;"}));
                            column.$ext.style.position = "fixed";
                            column.$ext.style.top = "75px";
                            column.$ext.style.right = "20px";
                            column.$ext.style.left = "";
                            column.$ext.style.bottom = "20px";
                            column.$ext.style.width = "300px";
                            column.$ext.style.height = "";
                        }
                        
                        panel = p; 
                        p.draw({container: column.$ext, aml: column});
                    },
                    isActive: function() { return false; },
                    unregister: function(){}, 
                    activate: function(){
                        // panel.panel.show()
                    },
                    deactivate: function(){
                        // panel.panel.hide()
                    },
                    on: function(){
                        
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
                plugin.on("load", function(){
                    where = options.where || "left";
                    var panels = apf.getPlugin("panels");
                    panels.register(plugin);
                });
                plugin.freezePublicAPI.baseclass();
                plugin.freezePublicAPI({
                    get autohide(){ return false; },
                    get width(){ return options.width; },
                    get minWidth(){ return options.minWidth; },
                    get aml(){ return plugin.getElement(options.elementName); },
                    get area(){ return ""; },
                    get where(){ return where; },
                    setCommand: function(){},
                    attachTo: function(){},
                    detach: function(){},
                    emit: emit,
                    show: function(){ emit("show"); },
                    hide: function(){ emit("hide"); },
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
            tree: (function(){
                var tree = new EventEmitter();
                tree.createFolder = function(){};
                tree.getElement = function(){};
                tree.getAllExpanded = function(){ return []; };
                return tree;
            })(),
            "tree.favorites" : (function(){
                var tree = new EventEmitter();
                tree.addFavorites = function(){};
                tree.getFavoritePaths = function(){ return [] };
                return tree;
            })(),
            tabManager: (function(){
                var tabManager = new EventEmitter();
                tabManager.open = function(){ tabManager.emit("open") };
                tabManager.openFile = function(){ tabManager.emit("open") };
                tabManager.findPage = function(){};
                tabManager.getPanes = function(){ return [] };
                tabManager.checkAllTabs = function(){};
                return tabManager;
            })(),
            tabbehavior: (function(){
                var x = new EventEmitter();
                x.getElement = function(){};
                return x;
            })(),
            menus: (function(){
                var menus = new EventEmitter();
                menus.addItemByPath = function(x, aml, y, plugin) { 
                    aml && (plugin || y).addElement(aml);
                    return aml;
                };
                menus.addItemToMenu = menus.addItemByPath;
                menus.get = function(){return {}};
                menus.remove = function(){};
                menus.enableItem = function(){};
                menus.disableItem = function(){};
                return menus;
            })(),
            util: {
                alert: function() {},
                escapeXml: function(s) { return s; },
                stableStringify: function(s) { return JSON.stringify(s); },
            },
            gotoline: {
                toggle: function(){ }
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
                }
            },
            "ace.gotoline": {},
            "ace.stripws": {
                disable: function(){},
                enable: function(){}
            },
            "dialog.alert": {show: function() { console.log(console, Array.prototype.slice.apply(arguments)); }},
            "dialog.confirm": {show: function() {}},
            "dialog.question": {show: function() {}},
            "dialog.file": {show: function() {}},
            "dialog.fileremove": {show: function() {}},
            "dialog.fileoverwrite": {show: function() {}},
            "dialog.error": {
                showError: function(msg) { console.warn(msg); },
                show: function(msg) { console.warn(msg); },
                hide: function(msg) { },
            },
            "dialog.info": {
                show: function(msg) { console.log(msg); },
                hide: function(msg) { },
            },
            "installer": { createSession : function(){}, reinstall: function(){}, isInstalled: function(){ return true; } },
            "run.gui": { getElement : function(){} },
            "debugger": {debug: function() {}, stop: function(){}},
            "focusManager": {
                focus: function() {
                    
                }
            },
            "metrics": {
                getLastPing: function() { throw Error("Not implemented"); },
                getLastest: function() { throw Error("Not implemented"); },
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
                reportError: function(){}
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
            metadata: (function(){
                var x = new EventEmitter();
                return x;
            })(),
            editors: (function(){
                var x = new EventEmitter();
                return x;
            })(),
            timeslider: (function(){
                var x = new EventEmitter();
                return x;
            })(),
            OTDocument: (function(){
                var x = new EventEmitter();
                return x;
            })(),
            "notification.bubble": (function(){
                var x = new EventEmitter();
                return x;
            })(),
            "collab": (function(){
                var x = new EventEmitter();
                return x;
            })(),
            "collab.connect": (function(){
                var x = new EventEmitter();
                return x;
            })(),
            "collab.workspace": (function(){
                var x = new EventEmitter();
                x.users = [];
                return x;
            })(),
            "collab.util": (function(){
                var x = new EventEmitter();
                return x;
            })(),
            "scm": (function(){
                var x = new EventEmitter();
                x.register = function(){};
                x.unregister = function(){};
                return x;
            })(),
            "immediate": (function(){
                var x = new EventEmitter();
                x.register = function(){};
                x.unregister = function(){};
                return x;
            })(),
            "c9.analytics": (function(){
                var x = new EventEmitter();
                x.register = function(){};
                x.unregister = function(){};
                return x;
            })(),
        });
    };
    
    expect.setupArchitectTest = function(config, _, options) {
        if (options && options.mockPlugins) {
            config.push({
                consumes: options.existingPlugins || [],
                provides: options.mockPlugins,
                setup: expect.html.mocked
            });
        }
        architect.resolveConfig(config, function(err, config) {
            /*global describe it before after */
            if (err) throw err;
            var app = architect.createApp(config, function(err, app) {
                if (err && err.unresolved && !config.unresolved) {
                    expect.html.mocked({}, {}, function(a, mockServices) { 
                        err.missingMock = err.unresolved.filter(function(x) {
                            return !mockServices[x];
                        });
                        config.unresolved = err.unresolved.filter(function(x) {
                            return mockServices[x];
                        });
                    });
                    if (err.missingMock.length) {
                        console.error("Missing mock services for " + err.missingMock);
                    } else {
                        console.warn("Adding mock services for " + err.unresolved);
                        return expect.setupArchitectTest(config, architect, {
                            mockPlugins: config.unresolved,
                            existingPlugins: err.resolved
                        });
                    }
                }
                if (typeof describe == "function") {
                    describe('app', function() {
                        it('should load test app', function(done) {
                            expect(err).not.ok;
                            done();
                        });
                    });
                }
                onload && onload();
                
            });
            if (app) {
                app.on("service", function(name, plugin) { 
                    if (!plugin.name && typeof plugin != "function")
                        plugin.name = name; 
                });
                app.rerun = function() {
                    expect.setupArchitectTest(config, architect);
                };
                window.app = app;
            }
            return app;
        });
    };
        
});