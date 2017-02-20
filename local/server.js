require("amd-loader");

var fs = require("fs");
var join = require("path").join;
var proc = require("child_process");
var path = require("path");

// set up env variables for windows
if (process.platform == "win32") {
    process.env.CYGWIN = "nodosfilewarning " + (process.env.CYGWIN || "");
    process.env.CHERE_INVOKING = 1; // prevent cygwin from changing bash path
}

// HOME usually isn't defined on windows, so weload settings/standalone which adds it
var localSettings = require(join(__dirname, "../settings/local.js"))({ revision: " " }, null);

// Ports on which we'd like to run preview (see http://saucelabs.com/docs/connect#localhost)
var SAFE_PORTS = [2222, 2310, 3000, 3001, 3030, 3210, 3333, 4000, 4001,
                  4040, 4321, 4502, 4503, 4567, 5000, 5001, 5050, 5555,
                  5432, 6000, 6001, 6060, 6666, 6543, 7000, 7070, 7774,
                  7777, 8000, 8001, 8003, 8031, 8080, 8081, 8765, 8777,
                  8888, 9000, 9001, 9080, 9090, 9876, 9877, 9999, 49221];

var installPath = process.platform == "dar-win" // disabled for sdk
    ? "/Library/Application Support/Cloud9"
    : join(process.env.HOME, ".c9");
    
// Support legacy installations
if (installPath === "/Library/Application Support/Cloud9" 
    && !fs.existsSync(join(installPath, "version"))
    && fs.existsSync(join(process.env.HOME, installPath, "version")))
    installPath = join(process.env.HOME, installPath);

var nodePath = process.platform == "win32"
    ? join(installPath, "node.exe")
    : installPath + "/node/bin/node";

var logStream;

// this seems to be needed in both window and server
process.on("uncaughtException", function(err) { 
    console.error(err);
});

function toInternalPath(path) {
    if (process.platform == "win32")
        path = path.replace(/^[/]*/, "/").replace(/[\\/]+/g, "/");
    return path;
}

var App = window.nwGui.App;
var argv = App.argv;
argv.parsed = parseArgs(argv);

var settingDir = argv.parsed["--setting-path"]
    ? path.resolve(argv.parsed["--setting-path"])
    : (installPath === "/Library/Application Support/Cloud9"
        ? path.join(process.env.HOME, installPath)
        : installPath);

function parseArgs(argv) {
    if (typeof argv == "string")
        argv = argv.match(/(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|((?:[^ \\]|\\.)+))/g)
            .map(function(x) { return x.replace(/^["']|["']$/g, ""); });
    var parsed = {
        _: [],
        "--setting-path": "",
        "-w": ""
    };
    var argname;
    for (var i = 0; i < argv.length; i++) {
        var arg = argv[i];
        if (arg[0] === "-") {
            argname = arg;
            if (!(argname in parsed)) {
                parsed[argname] = true;
                argname = "";
            }
        } else if (argname) {
            parsed[argname] = arg;
            argname = "";
        } else {
            parsed._.push(arg);
        }
    }
    return parsed;
}


var server = {
    writePIDFile : function(path){
        function write(pid){
            fs.writeFile(process.env.HOME + "/.c9/pid", pid + ":" + path, 
                function(err){});
        }
        
        // In OSX the pid is not the nw process, but a child
        // We'll look up the parent
        if (process.platform == "darwin") {
            proc.execFile("ps", ["-axf"], function(err, stdout, stderr){
                if (err) return console.log("Could not write PID file: ", 
                    (err.message || err) );
                
                var re = new RegExp("[ \\d]*?\\s" + process.pid 
                    + "\\s+(\\d+)\\s+.*Contents\\/Frameworks\\/node\\-webkit");
                
                var m = stdout.match(re);
                if (!m) return console.log("Could not write PID file");
                
                write(m[1]);
            });
        }
        else
            write(process.pid);
    },
    
    start : function(options, callback){
        if (nwProcessId) {
            return windowManager.connection.call(0, {
                type: "serverStart",
                options: options,
            }, callback);
        }
        
        var self = this;
        if (this.process) {
            return process.nextTick(function() {
                callback(null, self.options.port);
            });
        }
        // console.log("Starting Cloud9...", port);
        var allowExit;
        var path = options.path;
        if (!path)
            path = process.env.HOME || "/";
        
        // Write PID file
        this.writePIDFile(path);
        
        // Listen for exit signals
        process.on("exit", function(){
            if (p) p.kill();
            
            fs.unlink(process.env.HOME + "/.c9/pid", function(){});
        });
        
        var args = [
            join(__dirname, "../server.js"),
            "local",
            "--setting-path", settingDir,
            "-s", "local",
            "--listen", options.host,
            "-w", path, 
            "-p", options.port,
            "--collab", options.collab
        ];
        
        if (options.wsType)
            args.push("--workspacetype", options.wsType);
        
        if (options.inProcess) {
            var server = require("../server");
            args.shift();
            return server(args, "local", function() {
                callback(null, options.port);
            });
        }
        
        var env = {}; 
        Object.keys(process.env).forEach(function(name){
            env[name] = process.env[name];
        }); 
        env["NODE_PATH"] = (process.platform == "win32"
            ? join(nodePath, "../deps")
            : installPath) + "/node_modules";
        
        var p = proc.spawn(nodePath, args, { env: env });
        
        // Do Nothing
        function done(){
            p.stderr.removeListener("data", waitErr);
            p.stdout.removeListener("data", waitOut);
        }
        function waitErr(chunk){
            chunk = chunk.toString();
            if (chunk.indexOf("EADDRINUSE") > -1) {
                done();
                p.kill();
                
                var err = new Error(chunk);
                err.code = "EADDRINUSE";
                err.options = options;
                allowExit = true;
                callback(err);
            }
        }
        function waitOut(chunk){
            chunk = chunk.toString();
            console.warn("SERVER:", chunk);
            if (chunk.indexOf("Started") > -1) {
                done();
                callback(null, options.port);
            }
        }
        p.stderr.on("data", waitErr);
        p.stdout.on("data", waitOut);
        
        p.stderr.on("data", function(e) {
            console.error(e+"");
        });
        p.stdout.on("data", function(e) {
            console.log(e+"");
        });
        p.on("exit", function() {
            self.process = null;
            setTimeout(function() {
                if (p.exitCode && !allowExit && !self.process)
                    self.start(options, function(){});
            }, 1000);
        });
        self.options = options;
        self.process = p;
    },
    
    findFreePort : function(host, callback) {
        var ports = SAFE_PORTS.slice();
        find();

        function find() {
            var port = ports.pop();
            if (!port)
                return callback(new Error("Could not find an available port"));
            require("netutil").isPortOpen(host, port, 2000, function(open) {
                if (!open)
                    return callback(null, port);
                find();
            });
        }
    },
    
    stop : function() {
        this.process.kill();
    },
    
    restart : function() {
        this.stop();
        this.start(this.options);
    },
    
    getPlugins : function(options, cb, restoreWindow) {
        var windowConfig = options.windowConfig || {};
        var configPath = join(__dirname, "../configs/ide/default-local.js");
        var themeDir = join(__dirname, "../build/standalone/skin/" + 
            (windowConfig.isRemote ? "full" : "default-local"));
            
        var stateConfigFilePath = windowConfig.id
            ? join(settingDir,  "windows/" + windowConfig.id + "-state.settings")
            : join(settingDir, "state.settings");
        
        function getConfig(options) {
            options.installed = true;
            options.settingDir = settingDir;
            var settings = {
                "user": join(settingDir, "user.settings"),
                "profile": join(settingDir, "profile.settings"),
                "project": join(settingDir, "project.settings"),
                "state": stateConfigFilePath
            };
            
            for (var type in settings) {
                settings[type] = readJSONFile(settings[type]);
            }
            
            if (windowConfig.stateSettings) {
                settings.state = windowConfig.stateSettings;
                delete windowConfig.stateSettings;
            }
            
            options.settings = settings;
            
            if (settings.profile.id) {
                options.user = settings.profile;
                if (settings.profile.saucelabs) {
                    options.saucelabs.account = settings.profile.saucelabs;
                }
            }
            else {
                options.user = {
                    id: -1,
                    name: "Anonymous",
                    fullname: "Anonymous",
                    email: "",
                    pubkey: null
                };
            }
            
            if (process.platform == "win32")
                options.sauceConnectPath = join(nodePath, "../deps");
                
            
            return require(configPath)(options);
        }
        
        function updateFilePaths(plugins, cb) {
            var stateSettings, userSettings, preloadPlugin;
            
            function fixCssStaticPath(str) {
                if (options.windowLocation && str)
                    return str.replace(/(url\(["']?)\/(?:standalone\/)?static/g, "$1" + options.windowLocation);
                return str;
            }
            function loadTheme(name, cb) {
                if (preloadPlugin[name])
                    return cb(null, preloadPlugin[name]);
                fs.readFile(themeDir + "/" + name + ".css", "utf8", function(err, data) {
                    // todo rebuild missing themes
                    data = fixCssStaticPath(data);
                    preloadPlugin[name] = data;
                    cb && cb(err, data);
                });
            }
            var isRemote = windowConfig.isRemote;
            for (var i = 0; i < plugins.length; i++) {
                var p = plugins[i];
                if (p.packagePath === "plugins/c9.ide.layout.classic/preload") {
                    preloadPlugin = p;
                    if (options.packed || isRemote)
                        p.loadTheme = loadTheme;
                    else
                        p.themePrefix = "/static/standalone/skin/default-local";
                }
                else if (p.packagePath === "plugins/c9.vfs.client/endpoint") {
                    p.getServers = options.getServers;
                }
                else if (p.packagePath == "plugins/c9.ide.language/language") {
                    p.useUIWorker = options.noWorker;
                    if (options.packed) {
                        p.staticPrefix = options.windowLocation;
                        p.workerPrefix = settings.CORSWorkerPrefix;
                    } else {
                        p.staticPrefix = p.workerPrefix = null;
                    }
                }
                else if (p.packagePath == "plugins/c9.core/settings") {
                    if (!isRemote)
                        p.stateConfigFilePath = stateConfigFilePath;
                    stateSettings = p.settings.state;
                    if (typeof stateSettings == "string") {
                        try {
                            stateSettings = JSON.parse(stateSettings);
                        } catch(e) {}
                    }
                    userSettings = p.settings.user;
                    if (typeof userSettings == "string") {
                        try {
                            userSettings = JSON.parse(userSettings);
                        } catch(e) {}
                    }
                }
                
                if (p.staticPrefix && options.windowLocation && (options.packed || isRemote)) {
                    p.staticPrefix = p.staticPrefix.replace(/^\/static/, options.windowLocation);
                }
            }
            var themeName = userSettings && userSettings.general && userSettings.general["@skin"] || "dark";
            restoreWindow && restoreWindow(stateSettings);
            loadTheme(themeName, cb);
        }
    
        var settings = localSettings;
        settings.packed = options.packed;
        
        settings.vfsServers = options.vfsServers;
        settings.workspaceDir = options.workspaceDir;
        settings.CORSWorkerPrefix = (
            options.windowLocation && options.packed ? options.windowLocation + "/build/" : "/static/"
        ) + "standalone/worker";
        
        if (windowConfig.isRemote)
            settings.remoteWorkspace = windowConfig.name;
        
        if (settings.remoteWorkspace) {
            getRemoteWorkspaceConfig(windowConfig.name, function(err, config) {
                if (err) {
                    plugins = getConfig(settings);
                    addErrorHandlerPlugin(plugins, windowConfig);
                }
                else {
                    plugins = require(configPath).makeLocal(config.plugins, settings);
                    settings.url = config.url;
                }
                plugins.forEach(function(p) {
                    if (p.staticPrefix)
                        p.staticPrefix = p.staticPrefix.replace(/^https?:\/\/.*?\/static/, "/static");
                })
                updateFilePaths(plugins, function(){
                    cb(plugins, settings);
                });
            });
        } else {
            var plugins = getConfig(settings);
            updateFilePaths(plugins, function(){
                cb(plugins, settings);
            });
        }
    },
    
    appendLog : function(message) {
        logStream && logStream.write(message);
    },
    
    __dirname : __dirname,
    installPath : installPath,
    argv: argv,
    
    openWindow : openWindow,
    parseArgs : parseArgs,
    getRecentWindows: getRecentWindows,
    getRemoteWorkspaceConfig: getRemoteWorkspaceConfig
};

function addErrorHandlerPlugin(plugins, windowConfig) {
    plugins.push({
        provides: [],
        consumes: ["c9", "auth", "restore", "dialog.alert", "commands"],
        setup: function(options, imports, register) {
            imports.auth.on("login", function() {
                getRemoteWorkspaceConfig(windowConfig.name, function(err, config) {
                    if (err) {
                        
                        return imports["dialog.alert"].alert(
                            "Error loading remote workspace",
                            "Couldn't load config for " + windowConfig.name
                        );
                    }
                    imports.commands.exec("restartc9");
                });
            });
            
            register(null, {});
        }
    });
}

/*****************************************************************/
/* windowManager: move to own file once build tool supports that */
/*****************************************************************/

var MAX_RECENT_WINDOWS = 20;
var MAX_SAME_PROCESS = 1;
var processIdCounter = 1;
var activeWindowId = null;
var nwProcessId = 0;
var allWindows = Object.create(null);
var windowData = Object.create(null);
var connection = null;

var windowManager = server.windowManager = {
    quit: quit,
    quitAll: quitAll,
    unquit: unquit,
    onClose: onClose,
    save: scheduleSave,
    statePath: join(settingDir, "window.settings"),
    openWindow: openWindow,
    $allWindows: allWindows,
    $windowData: windowData,
    onShowWindow: onShowWindow,
    restoreSession: restoreSession,
    registerWindow: registerWindow,
    getRecentWindows: getRecentWindows,
    findWindowForPath: findWindowForPath,
    registerSharedModule: registerSharedModule,
    signalToAll: signalToAll,
    setFavorites: setFavorites,
    forEachWindow: forEachWindow,
    isPrimaryWindow: isPrimaryWindow,
    get connection() { return connection },
    get activeWindow() { return allWindows[activeWindowId] },
    get activeWindowId() { return activeWindowId },
};

function forEachWindow(fn) {
    getRecentWindows().forEach(function(data) {
        fn(data, allWindows[data.id]);
    });
}


function signalToAll(name, e) {
    if (nwProcessId)
        return connection.call(0, {type: "signalToAll", arg: [name, e]});
        
    forEachWindow(function(data, win) {
         if (win && win.emit) win.emit(name, e);
    });
}

function isPrimaryWindow(window) {
    if (nwProcessId) return false;
    var win = window.win;
    if (win.options.nwProcessId)
        return false;
    return true;
}

function findWindowForPath(path) {
    var matches = [];
    path = toInternalPath(path);
    for (var id in windowData) {
        var win = windowData[id];
        win.favorites && win.favorites.forEach(function(p, i) {
            if (path.indexOf(p) === 0 && (path[p.length] == "/" || !path[p.length])) {
                matches.push({
                    win: win,
                    dist: path.substr(p.length).split("/").length + (i ? 1 : 0)
                });
                return true;
            }
        });
    }
    matches.sort(function(a, b) {
        return a.dist - b.dist;
    });
    
    return matches[0] && matches[0].win;
}

function restoreSession(win) {
    var state = readJSONFile(this.statePath);
    var toOpen = [];
    Object.keys(state).forEach(function(id) {
        var data = state[id];
        if (data.isOpen) {
            data.isOpen = false;
            toOpen.push(data);
        }
        if (!data.favorites)
            data.favorites = [];
        windowData[id] = data;
    });

    // Deal with user reopening app on osx
    App.on("reopen", function(){
        openWindow({id: activeWindowId || "latest", focus: true});
    });
    // Event to open additional files (I hope)
    App.on("open", function(cmdLine) {
        // console.log(cmdLine);
        var parsed = parseArgs(cmdLine);
        var path = parsed._.pop();
        openWindowForPath(path);
    });
    
    var path = argv.parsed._.pop();
    if (path) {
        // todo handle folders?
        openWindowForPath(path);
    } else {
        if (!toOpen.length)
            toOpen.push({id: "latest"});
        toOpen.sort(function(a, b) {
            return b.time - a.time;
        });
        toOpen[0].focus = true;
        openWindow(toOpen[0]);
    }
}

function setFavorites(id, favorites) {
    if (windowData[id]) {
        windowData[id].favorites = favorites;
        scheduleSave();
    }
    updateTitle(id);
    if (nwProcessId)
        connection.call(0, {id: id, favorites: favorites, type: "setFavorites"});
}

function updateTitle(id) {
    var winData = windowData[id];
    var win = allWindows[id];
    if (win && winData) {
        var favs = winData.favorites;
        if (winData.isRemote) {
            win.displayName = "Remote " + /[^\/]*\/?$/.exec(winData.name || "")[0];
        } else {
            win.displayName = /[^\/]*\/?$/.exec(favs[0] || "")[0];
        }
    }
}

function openWindowForPath(path, forceNew) {
    var data = windowManager.findWindowForPath(path);
    if (!data && !forceNew)
        data = {id : "latest", isRemote: false, isEmpty: true};
        
    data.focus = true;
    data.filePath = path;
    openWindow(data);
}

function registerWindow(win, id) {
   if (typeof id == "string") {
        if (id[0] == "{") {
            win.options = JSON.parse(id);
            id = win.options.id;
        }
    }
    
    if (!win.options)
        win.options = {id: id};
    
    allWindows[id] = win;
    activeWindowId = id;
    function mainCloseHandler() {
        if (win.listeners("close").length == 1) {
            onClose(id);
            win.close(true);
        }
    }
    // make sure only one mainCloseHandler is attached even after calling win.reload()
    win.listeners("close").forEach(function(f) {
        if (f.name == "mainCloseHandler")
            win.removeListener("close", f);
    });
    win.on("close", mainCloseHandler);
    win.on("focus", function() {
        onFocus(id);
    });
    
    win.on("savePosition", function() {
        savePosition(id);
    });
    
    if (id != "root")
        scheduleSave();
        
    if (win.options.nwProcessId && !allWindows.root)
        nwProcessId = win.options.nwProcessId;

    if (nwProcessId)
        updateWindowData(win.options);

    if (!connection)
        connection = new MsgChannel();
    
    if (!logStream) {
        try {
            logStream = fs.createWriteStream(settingDir + '/log.txt', nwProcessId ? {flags: 'a'} : undefined);
        } catch (e) {}
    }
    
    // if (id != "root") {
    //     setTimeout(function() {
    //         windowManager.registerWindow();
    //     });
    // }
}

function onClose(id) {
    delete allWindows[id];
    var winState = windowData[id];
    
    if (nwProcessId) {
        return connection.call(0, {type: "onClose", id: id});
    }
    
    if (Object.keys(allWindows).length <= 1 && allWindows.root) {
        if (process.platform != "darwin" || allWindows.root.quitting) {
            allWindows.root.close(true);
            allWindows.root.quitting = true;
        }
    }
    
    // Only save state when not quitting the application
    if (allWindows.root && !allWindows.root.quitting) {
        winState.isOpen = false;
        savestate();
    }
    
    if (activeWindowId == id)
        activeWindowId = 0;
}

function quit() {
    if (nwProcessId)
        return connection.call(0, {type: "quit"});
    
    var active = allWindows[activeWindowId];
    
    forEachWindow(function(data, win) {
        if (win && win != active && win.hide)
            win.hide();
    });
    
    if (active) {
        active.emit("askForQuit", true);
    }
}

function quitAll(){
    if (nwProcessId)
        return connection.call(0, {type: "quitAll"});
    
    if (allWindows.root)
        allWindows.root.quitting = true;
    
    forEachWindow(function(data, win) {
        if (win && win.emit) win.emit("saveAndQuit");
    });
}

function unquit(){
    if (nwProcessId)
        return connection.call(0, {type: "unquit"});
    
    var active = allWindows[activeWindowId];
    forEachWindow(function(data, win) {
        if (win && win != active && win.show) 
            win.show();
    });
    
    active && active.show();
}

function onFocus(id) {
    if (nwProcessId)
        return connection.call(0, {type: "onFocus", id: id});
    activeWindowId = id;
    if (windowData[id])
        windowData[id].time = Date.now();
}

function onShowWindow(win) {
    if (win.options && win.options.focus) {
        delete win.options.focus;
        win.focus();
    }
    if (win.$onShow) {
        win.$onShow(null, win);
        win.$onShow = undefined;
    }
}

function savePosition(id, position) {
    var win = allWindows[id];
    if (!position) {
        if (!win || win.isMinimized)
            return;
        position = [win.x, win.y, win.width, win.height];
    }
    
    if (nwProcessId)
        return connection.call(0, {type: "savePosition", id: id, position: position});
    var winData = windowData[id];
    if (winData) {
        winData.position = position;
        scheduleSave();
    }
}

function openQuitSure(callback){
    
}

function openWindow(options, callback) {
    if (nwProcessId)
        return connection.call(0, {type: "openWindow", options: options}, callback);
    
    options = validateWindowOptions(options);
    var id = options.id;
    
    if (allWindows[id]) {
        if (options.duplicate && id == activeWindowId) {
            id = options.id = options.id + ".1";
        } else {
            win = allWindows[id];
            win.emit("focusWindow");
            if (options.filePath)
                win.emit("openFile", {path: options.filePath});
            return callback && callback();
        }
    }
    
    var window = allWindows.root.window;
    var nwGui = window.require("nw.gui");
    
    var isNewInstance = false;
    var inProcessWindows = 0;
    for (var i in allWindows) {
        if (allWindows[i].options && allWindows[i].options.nwProcessId === 0) {
            if (++inProcessWindows >= MAX_SAME_PROCESS) {
                isNewInstance = true;
                break;
            }
        }
    }
    options.nwProcessId = isNewInstance ? processIdCounter++ : 0;
    
    var url = "index.html?id=" + (isNewInstance ? escape(JSON.stringify(options)) : id);
    if (options.reset) {
        url += "&reset=state";
        delete options.reset;
    }
    var sc = window.screen;
    var ah = sc.availHeight, aw = sc.availWidth, ax = sc.availLeft, ay = sc.availTop;
    var h, w, x, y;
    var position = options.position;
    
    if (!position) {
        w = Math.min(1200, Math.round(0.7 * aw));
        h = Math.min(960, Math.round(0.8 * ah));
        x = Math.round(ax + (aw - w)/2);
        y = Math.round(ay + (ah - h)/2);
    } else {
        x = Math.max(ax - 10, position[0]);
        y = Math.max(ay - 10, position[1]);
        w = Math.min(aw, position[2]);
        h = Math.min(ah, position[3]);
    }
    
    var win = nwGui.Window.open(url, {
        "new-instance": !!isNewInstance,
        height: h,
        width: w,
        left: x,
        top: y,
        show: false,
        frame: false,
        toolbar: false,
        title: "Cloud9",
        icon: "icon.png",
        "win_bg": "#000000"
    });
    win.moveTo(x, y);
    win.options = options;
    allWindows[id] = win;
    win.$onShow = callback;
    
    if (isNewInstance) {
        win.emit = function() {
            connection.call(win.options.nwProcessId, {
                type: "winEvent",
                id: id,
                arguments: Array.apply(null, arguments)
            });
        };
    }
    updateWindowData(options);
}

function updateWindowData(options) {
    var id = options.id;
    var winState = windowData[id] || {};
    winState.id = id;
    if (!winState.favorites)
        winState.favorites = [];
    
    winState.isRemote = options.isRemote;
    winState.time = Date.now();
    winState.isOpen = true;
    
    if (winState.isRemote) {
        winState.name = options.name;
    }
    
    windowData[id] = winState;
}

function validateWindowOptions(options) {
    options = options || {};
    if (options.isRemote) {
        options.id = "remote/" + options.name;
    } else {
        var windows = Object.keys(windowData).map(function(id) {
            return windowData[id];
        }).filter(function(x) {
            return !x.isRemote;
        }).sort(function(a, b) {
            if (Boolean(b.isOpen) !== Boolean(a.isOpen))
                return b.isOpen ? 1 : -1;
            if (b.isOpen || (a.favorites.length && b.favorites.length))
                return b.time - a.time;
            return b.favorites.length ? 1 : -1;
        });
        
        if (options.id == "latest") {
            for (var i = 0; i < windows.length; i++) {
                var d = windows[i];
                if (options.isOpen === false && d.isOpen)
                    continue;
                if (options.isRemote === false && d.isRemote)
                    continue;
                if (options.isEmpty && d.favorites.length)
                    continue;
                    
                d.filePath = options.filePath;
                options = d;
                break;
            }
            if (options.id == "latest")
                options.id = 0;
        }
        if (!options.id) {
            var id = 0;
            if (windows.length > MAX_RECENT_WINDOWS) {
                var last = windows[windows.length - 1];
                id = last.isOpen ? 0 : last.id;
            }
            
            if (!id) {
                do  id++;
                while (windowData[id]);
            }
            
            if (!options.stateSettings)
                options.reset = true;
            options.id = id;
            delete windowData[id];
        }
    }
    
    if (windowData[options.id] && !options.position)
        options.position = windowData[options.id].position;
    
    return options;
}

function readJSONFile(path) {
    try {
        var data = fs.readFileSync(path, "utf8");
        return JSON.parse(data) || {};
    }
    catch(e){
        console.log("Could not parse JSON", e);
        return {};
    }
}

function getRecentWindows(callback) {
    if (nwProcessId && callback)
        return connection.call(0, {type: "getRecentWindows"}, callback);
    var names = Object.create(null);
    var recentWindows = Object.keys(windowData).map(function(id) {
        var data = windowData[id];
        var name = data.name;
        if (!name && data.favorites[0])
            name = data.favorites[0].match(/[^\/]*\/?$/)[0];
        if (!name)
            name = "[Untitled" + (id < 10 ? " " : "") + id + "]";
        // todo better handling for duplicate windows
        if (names[name]) {
            name += " (" + names[name] + ")";
            names[name]++;
        } else {
            names[name] = 1;
        }
        return {
            name: name,
            id: id,
            time: data.time,
            isRemote: !!data.isRemote,
            isOpen: !!data.isOpen,
            isEmpty: !data.isRemote && !data.favorites.length,
            favorites: data.favorites.slice()
        };
    });
    callback && callback(null, recentWindows);
    return recentWindows;
}

function registerSharedModule(name, construct) {
    if (nwProcessId) return;
    var root = allWindows.root;
    if (!root.modules)
        root.modules = Object.create(null);
    if (!root.modules[name]) {
        root.modules[name] = construct(windowManager, connection);
        //@nightwing why eval?
        // root.modules[name] = "(" + global.eval("(" + construct + ")")(windowManager, connection);
    }
}

var saveTimer, saving;
function savestate() {
    if (nwProcessId)
        return connection.call(0, {type: "windowManagerSave"});
    if (saving)
        return scheduleSave();
    var content = JSON.stringify(windowData, function(x,y) { return y || undefined});
    saving = true;
    var tmp = windowManager.statePath + "~";
    fs.writeFile(tmp, content, "utf8", function(err, result) {
        saving = false;
        fs.rename(tmp, windowManager.statePath, function(err, result) {
            saving = false;
        });
    });
}
function scheduleSave() {
    if (nwProcessId)
        return connection.call(0, {type: "windowManagerSave"});
    if (!saveTimer) {
        saveTimer = setTimeout(function() {
            saveTimer = null;
            savestate(); 
        }, 500);
    }
}

// remote projects
function loadData(url, callback) {
    var xhr = new window.XMLHttpRequest();
    xhr.open("GET", url + "?access_token=fake_token", true);
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
    xhr.onload = function(e) {
        callback(null, xhr.responseText);
    };
    xhr.onabort = xhr.onerror = function(e) {
        callback(e);
    };
    xhr.send("");
}

function getRemoteWorkspaceConfig(projectName, callback) {
    var url = "https://ide.c9.io/" + projectName + "?config=1";
    loadData(url, function(err, result, xhr) {
        try {
            var config = JSON.parse(result);
        } catch(e) {
            err = err || e;
        }
        callback(err, {
            url: url,
            plugins: config && config.architectConfig,
            raw: config
        });
    });
}


var net = require('net');
var projectWD = window.nwGui.App.dataPath;
var sockPath = process.platform == "win32"
    ? "\\\\.\\pipe\\"+ projectWD +"\\c9.windowManager.socket"
    : join(projectWD, "c9.windowManager.socket");

function MsgChannel() {
    this.callbacks = {};
    this.callbackId = 0;
    this.sockets = {};
    this.handlers = {};
    var self = this;
    var buffer = "";
    function read(e, fn) {
        e = e + "";
        var i;
        while ((i = e.indexOf("\x01")) != -1) {
            buffer += e.substring(0, i);
            e = e.substr(i + 1);
            try {
                var msg = JSON.parse(buffer);
                fn(msg);
            } catch(e) {
                console.error(buffer);
                console.error(e);
            }
            buffer = "";
        }
        buffer += e;
    }
    
    if (nwProcessId) {
        var client = net.connect(sockPath, function () {});
        this.client = client;
        this.send(0, {type: "init"});
        client.on("data", function(e) {
            read(e, function(msg) {self.onMessage(msg)});
        });
        client.on("error", function(e){
            console.error(e);
        });
    } else {
        var server = net.createServer(function(socket) {
            socket.on("data", function(e){
                read(e, function(msg) {
                    if (msg.type == "init")
                        self.sockets[msg.$from] = socket;
                    else
                        self.onMessage(msg);
                });
            });
        });
        
        var startServer = function() {
            try {
                server.listen(sockPath);
            } catch(e) {
                console.error(e);
            }
        };
        if (process.platform == "win32") {
            startServer();
        } else {
            // Remove the stale socket, if it exists at sockPath
            fs.unlink(sockPath, startServer);
        }
    }
}
(function(){
    this.send = function(processId, msg) {
        msg.$from = nwProcessId;
        if (nwProcessId) {
            this.client.write(JSON.stringify(msg) + "\x01", "utf8");
        } else if (processId) {
            this.sockets[processId].write(JSON.stringify(msg) + "\x01", "utf8");
        } else {
            this.onMessage(msg);
        }
    };
    
    this.call = function(processId, args, callback) {
        if (callback) {
            var id = this.callbackId++;
            this.callbacks[id] = callback;
            args.callbackId = id;
        }
        this.send(processId, args);
    };

    this.onMessage = function(msg) {
        switch(msg.type) {
            case "callback":
                var callback = this.callbacks[msg.callbackId];
                if (callback) {
                    callback(msg.err, msg.data);
                    delete this.callbacks[msg.callbackId];
                }
                break;
            case "serverStart":
                server.start(msg.options, function(err, data) {
                    connection.call(msg.$from, {
                        err: err,
                        data: data,
                        type: "callback",
                        callbackId: msg.callbackId
                    });
                });
                break;
            case "openWindow":
                openWindow(msg.options, function() {
                    connection.call(msg.$from, {
                        type: "callback",
                        callbackId: msg.callbackId
                    });
                });
                break;
            case "windowManagerSave":
                scheduleSave();
                break;
            
            case "quit":
                quit();
                break;
            case "unquit":
                unquit();
                break;
            case "quitAll":
                quitAll();
                break;
            case "onClose":
                onClose(msg.id);
                break;
            case "onFocus":
                onFocus(msg.id);
                break;
            case "savePosition":
                savePosition(msg.id, msg.position);
                return;
            case "getRecentWindows":
                getRecentWindows(function(err, data) {
                    connection.call(msg.$from, {
                        err: err,
                        data: data,
                        type: "callback",
                        callbackId: msg.callbackId
                    });
                });
                break;
            case "setFavorites":
                setFavorites(msg.id, msg.favorites);
                break;
            case "winEvent":
                var win = allWindows[msg.id];
                if (win) {
                    win.emit.apply(win, msg.arguments);
                }
                break;
            case "signalToAll":
                signalToAll.apply(null, msg.arg);
                break;
            default:
                if (this.handlers[msg.type])
                    this.handlers[msg.type](msg);
        }
    };
    
    this.sendToWindow = function(id, type, msg) {
        var win = allWindows[id];
        var processId = win.options.nwProcessId;
        this.send(processId, {
            id: id,
            type: "winEvent",
            arguments: [type, msg]
        });
    };
    
    this.on = function(type, handler) {
        this.handlers[type] = handler;
    };
    
}).call(MsgChannel.prototype);


//
module.exports = server;
