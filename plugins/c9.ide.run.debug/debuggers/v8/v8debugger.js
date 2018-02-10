define(function(require, exports, module) {
    main.consumes = ["Plugin", "debugger", "util", "c9", "vfs", "fs"];
    main.provides = ["nodedebugger"];
    return main;
    
    function main(options, imports, register) {
        var c9 = imports.c9;
        var vfs = imports.vfs;
        var util = imports.util;
        var Plugin = imports.Plugin;
        var debug = imports.debugger;
        var v8DebuggerPlugin = require("./oldv8debugger")(options, imports);
        var chromeDebuggerPlugin = require("../chrome/chromedebugger")(options, imports);
        
        var proxyLauncher = require("../chrome/chrome-debug-proxy-launcher");
        
        var dbg, state, process, attached;
        
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        emit.setMaxListeners(1000);
        var eventForwarder;
        var _events = [
            "attach",
            "detach",
            "suspend",
            "setScriptSource",
            "error",
            "getBreakpoints",
            "breakpointUpdate",
            "break",
            "stateChange",
            "exception",
            "frameActivate",
            "getFrames",
            "sources",
            "sourcesCompile"
        ];
    
        /***** Methods *****/
        
        function attach(socket, reconnect, callback) {
            var runner = process.runner;
            proxyLauncher.connect(imports, {
                port: runner.debugport,
                host: runner.debughost,
                sourceDir: c9.sourceDir,
                socket: socket,
            }, function(err, socket) {
                if (err) return callback(err);
                
                var newDbg = socket.mode == "v8"
                    ? v8DebuggerPlugin
                    : chromeDebuggerPlugin;
                    
                if (dbg != newDbg) {
                    detach();
                    dbg = newDbg;
                }
                
                if (eventForwarder)
                    eventForwarder.unload();
                eventForwarder = new Plugin();
                eventForwarder.load();
                _events.forEach(function(event) {
                    dbg.on(event, function(e) {
                        return emit(event, e);
                    }, eventForwarder);
                });
                
                dbg.attach(socket, reconnect, callback);
            });
        }
        
        function detach() {
            if (dbg) {
                dbg.detach();
                dbg = null;
            }
        }
    
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            v8DebuggerPlugin.load();
            chromeDebuggerPlugin.load();
            
            debug.registerDebugger("v8", plugin);
            debug.registerDebugger("chrome", plugin);
        });
        plugin.on("unload", function() {
            debug.unregisterDebugger("v8", plugin);
            debug.unregisterDebugger("chrome", plugin);
            
            v8DebuggerPlugin.unload();
            chromeDebuggerPlugin.unload();
            process = attached = dbg = null;
            eventForwarder.unload();
            eventForwarder = null;
        });
        
        /***** Register and define API *****/
        
        plugin.freezePublicAPI({
            features: {
                scripts: true,
                conditionalBreakpoints: true,
                liveUpdate: true,
                updateWatchedVariables: true,
                updateScopeVariables: true,
                setBreakBehavior: true,
                executeCode: true
            },
            get type() { dbg ? dbg.type : "" },
            get state() { return dbg ? dbg.state : state; },
            get attached() { return dbg ? dbg.attached : attached; },
            get breakOnExceptions() { return dbg.breakOnExceptions; },
            get breakOnUncaughtExceptions() { return dbg.breakOnUncaughtExceptions; },
            
            _events: _events,
            
            attach: attach,
            detach: detach,
            
            getSources: function() { return dbg.getSources.apply(dbg, arguments); },
            getSource: function() { return dbg.getSource.apply(dbg, arguments); },
            getFrames: function() { return dbg.getFrames.apply(dbg, arguments); },
            getScope: function() { return dbg.getScope.apply(dbg, arguments); },
            getProperties: function() { return dbg.getProperties.apply(dbg, arguments); },
            stepInto: function() { return dbg.stepInto.apply(dbg, arguments); },
            stepOver: function() { return dbg.stepOver.apply(dbg, arguments); },
            stepOut: function() { return dbg.stepOut.apply(dbg, arguments); },
            resume: function() { return dbg.resume.apply(dbg, arguments); },
            suspend: function() { return dbg.suspend.apply(dbg, arguments); },
            evaluate: function() { return dbg.evaluate.apply(dbg, arguments); },
            setScriptSource: function() { return dbg.setScriptSource.apply(dbg, arguments); },
            setBreakpoint: function() { return dbg.setBreakpoint.apply(dbg, arguments); },
            changeBreakpoint: function() { return dbg.changeBreakpoint.apply(dbg, arguments); },
            clearBreakpoint: function() { return dbg.clearBreakpoint.apply(dbg, arguments); },
            listBreakpoints: function() { return dbg.listBreakpoints.apply(dbg, arguments); },
            setVariable: function() { return dbg.setVariable.apply(dbg, arguments); },
            restartFrame: function() { return dbg.restartFrame.apply(dbg, arguments); },
            serializeVariable: function() { return dbg.serializeVariable.apply(dbg, arguments); },
            setBreakBehavior: function() { return dbg.setBreakBehavior.apply(dbg, arguments); },
            getProxySource: function(_process) {
                process = _process;
                return false;
            },
            setPathMap: function() { 
                v8DebuggerPlugin.setPathMap.apply(v8DebuggerPlugin, arguments);
                chromeDebuggerPlugin.setPathMap.apply(chromeDebuggerPlugin, arguments);
            },
        });
        
        register(null, {
            nodedebugger: plugin
        });
    }
});