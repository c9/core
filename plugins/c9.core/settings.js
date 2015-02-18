define(function(require, exports, module) {
    main.consumes = [
        "c9", "ui", "Plugin", "fs", "proc", "api", "info", "ext", "util"
    ];
    main.provides = ["settings"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var ext = imports.ext;
        var ui = imports.ui;
        var Plugin = imports.Plugin;
        var fs = imports.fs;
        var proc = imports.proc;
        var api = imports.api;
        var info = imports.info;
        var util = imports.util;
        var _ = require("lodash");
        
        var join = require("path").join;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        // Give the info, ext plugin a reference to settings
        info.settings = plugin;
        ext.settings = plugin;
        
        // We'll have a lot of listeners, so upping the limit
        emit.setMaxListeners(10000);
        
        var resetSettings = options.reset || c9.location.match(/reset=([\w\|]*)/) && RegExp.$1;
        var develMode = c9.location.indexOf("devel=1") > -1;
        var debugMode = c9.location.indexOf("debug=2") > -1;
        var testing = options.testing;
        var debug = options.debug;
        
        // do not leave reset= in url
        if (resetSettings && window.history)
            window.history.pushState(null, null, location.href.replace(/reset=([\w\|]*)/,""));
        
        var TEMPLATE = options.template || { user: {}, project: {}, state: {} };
        var INTERVAL = 1000;
        var PATH = {
            "project" : c9.toInternalPath(options.projectConfigPath || "/.c9") + "/project.settings",
            "user"    : c9.toInternalPath(options.userConfigPath || "~/.c9") + "/user.settings",
            "state"   : c9.toInternalPath(options.stateConfigFilePath || (options.stateConfigPath || "/.c9") + "/state.settings")
        };
        var KEYS = Object.keys(PATH);
        
        var saveToCloud = {};
        var model = {};
        var cache = {};
        var diff = 0; // TODO should we allow this to be undefined and get NaN in timestamps?
        var userData;
        
        var inited = false;
        function loadSettings(json) {
            if (!json) {
                // Load from TEMPLATE
                if (options.settings == "defaults" || testing)
                    json = TEMPLATE;
                // Load from parsed settings in the index file
                else if (options.settings) {
                    json = options.settings;
                    
                    if (debugMode)
                        json.state = localStorage["debugState" + c9.projectName];
                    
                    for (var type in json) {
                        if (typeof json[type] == "string") {
                            if (json[type].charAt(0) == "<") {
                                json[type] = TEMPLATE[type];
                            }
                            else {
                                try {
                                    json[type] = JSON.parse(json[type]);
                                } catch (e) {
                                    json[type] = TEMPLATE[type];
                                }
                            }
                        }
                    }
                }
        
                if (!json) {
                    var info = {};
                    var count = KEYS.length;
                    
                    KEYS.forEach(function(type) {
                        fs.readFile(PATH[type], function(err, data) {
                            try {
                                info[type] = err ? {} : JSON.parse(data);
                            } catch (e) {
                                console.error("Invalid Settings Read for ", 
                                    type, ": ", data);
                                info[type] = {};
                            }
                            
                            if (--count === 0)
                                loadSettings(info);
                        });
                    });
                    return;
                }
            }
            
            read(json);
            events();
            
            if (resetSettings)
                saveToFile();
            
            KEYS.forEach(function(type) {
                var node = model[type];
                if (node)
                    cache[type] = JSON.stringify(node);
            });
            
            model.loaded = true;
        }
        
        /***** Methods *****/
        
        var dirty, timer;
        function checkSave(){
            if (dirty)
                saveToFile();
        }
    
        function startTimer(){
            if (c9.readonly) return;
            
            clearInterval(timer);
            timer = setInterval(checkSave, INTERVAL);
        }
    
        function save(force, sync) {
            dirty = true;
    
            if (force) {
                saveToFile();
                startTimer();
            }
        }
    
        function saveToFile(sync) {
            if (c9.readonly || !plugin.loaded) 
                return;
            
            if (c9.debug)
                console.log("Saving Settings...");
                
            emit("write", { model : model });
    
            model.time = new Date().getTime();
    
            if (develMode) {
                dirty = false;
                return;
            }
    
            saveModel(sync);
        }
        
        function saveModel(forceSync) {
            if (c9.readonly || !c9.has(c9.NETWORK)) return;
            
            if (model.loaded && !testing) {
                KEYS.forEach(function(type) {
                    var node = model[type];
                    if (!node) return;
                    
                    // Get XML string
                    var json = util.stableStringify(node, 0, "    ");
                    if (cache[type] == json) return; // Ignore if same as cache
                    
                    // Set Cache
                    cache[type] = json;
                    
                    // Debug mode
                    if (debugMode && type == "state") {
                        localStorage["debugState" + c9.projectName] = json;
                        return;
                    }
                    
                    // Detect whether we're in standalone mode
                    var standalone = !options.hosted;
                    
                    if (standalone || type == "project") {
                        fs.writeFile(PATH[type], json, forceSync, function(err){});
                        
                        if (standalone && !saveToCloud[type])
                            return; // We're done
                    }
                    
                    var addPid = type !== "user" 
                        ? "/" + info.getWorkspace().id 
                        : "";
                    
                    // Save settings in persistent API
                    api.settings.put(type + addPid, {
                        body: { settings: json },
                        sync: forceSync
                    }, function (err) {});
                });
            }
            
            dirty = false;
        }
    
        function read(json, isReset) {
            try {
                if (testing) throw "testing";
                
                KEYS.forEach(function(type) {
                    if (json[type])
                        model[type] = json[type];
                });
                
                if (resetSettings) {
                    var query = (resetSettings == 1 
                        ? "user|state" : resetSettings).split("|");
                    query.forEach(function(type) {
                        model[type] = TEMPLATE[type];
                    });
                }
                
            } catch (e) {
                KEYS.forEach(function(type) {
                    model[type] = TEMPLATE[type];
                });
            }
    
            if (!c9.debug) {
                try {
                    emit("read", {
                        model: model,
                        ext: plugin,
                        reset: isReset
                    });
                } catch (e) {
                    fs.writeFile(PATH.project 
                        + ".broken", JSON.stringify(json), function(){});
    
                    KEYS.forEach(function(type) {
                        model[type] = TEMPLATE[type];
                    });
    
                    emit("read", {
                        model: model,
                        ext: plugin,
                        reset: isReset
                    });
                }
            }
            else {
                emit("read", {
                    model: model,
                    ext: plugin,
                    reset: isReset
                });
            }
            
            if (inited)
                return;
            
            inited = true;
    
            plugin.on("newListener", function(type, cb) {
                if (type != "read") return;

                if (c9.debug || debug) {
                    cb({model : model, ext : plugin});
                }
                else {
                    try {
                        cb({ model : model, ext : plugin });
                    }
                    catch (e) {
                        console.error(e.message, e.stack);
                    }
                }
            });
        }
    
        var hasSetEvents;
        function events() {
            if (hasSetEvents) return;
            hasSetEvents = true;
            
            startTimer();

            c9.on("beforequit", function(){
                emit("write", { model: model, unload: true });
                saveModel(true); //Forcing sync xhr works in chrome 
            }, plugin);

            c9.on("stateChange", function(e) {
                if (e.state | c9.NETWORK && e.last | c9.NETWORK)
                    saveToFile(); //Save to file
            }, plugin);
        }
        
        function migrate(pathFrom, pathTo) {
            var idx = pathFrom.lastIndexOf("/");
            var nodeParent = getNode(pathFrom.substr(0, idx));
            var name = pathFrom.substr(idx + 1);
            var nodeFrom = nodeParent && nodeParent[name];
            if (!nodeFrom) return;
            
            // Remove node
            delete nodeParent[name];
            
            // Create new node
            var nodeTo = getNode(pathTo) || setNode(pathTo, {}) && getNode(pathTo);
            
            // Move attributes
            for (var prop in nodeFrom) {
                nodeTo[prop] = nodeFrom[prop];
            }
        }

        function setDefaults(path, attr) {
            var node = getNode(path) || set(path, {}, true, true) && getNode(path);
            var changed;
            
            attr.forEach(function(a) {
                var name = "@" + a[0];
                if (!node.hasOwnProperty(name)) {
                    node[name] = a[1];
                    emit(path + "/" + name, a[1]);
                    changed = true;
                }
            });
            
            if (changed)
                emit(path);
        }
        
        function update(type, json, ud){
            // Do nothing if they are the same
            if (_.isEqual(model[type], json))
                return;
            
            userData = ud;
            
            // Compare key/values (assume source has same keys as target)
            (function recur(source, target, base){
                for (var prop in source) {
                    if (prop == "json()") {
                        setJson(base, source[prop]);
                    }
                    else if (typeof source[prop] == "object") {
                        if (!target[prop]) target[prop] = {};
                        recur(source[prop], target[prop], join(base, prop));
                    }
                    else if (source[prop] != target[prop]) {
                        set(join(base, prop), source[prop]);
                    }
                }
            })(json, model[type], type);
            
            userData = null;
        }
        
        function setNode(query, value) {
            return set(query, value, true);
        }
        
        function set(query, value, isNode, isDefault, checkDefined) {
            if (!inited && !isDefault) return false;
            
            var parts = query.split("/");
            var key = parts.pop();
            if (!isNode && key.charAt(0) !== "@") {
                parts.push(key);
                key = "json()";
            }
            
            var hash = model;
            if (!parts.every(function(part) {
                if (!hash[part] && checkDefined) return false;
                hash = hash[part] || (hash[part] = {});
                return hash;
            })) {
                console.warn("Setting non defined query: ", query);
                return false;
            }
            if (hash[key] === value) 
                return;

            hash[key] = value;
            
            // Tell everyone this property changed
            emit(parts.join("/"));
            // Tell everyone it's parent changed
            emit(query, value);
            
            // Tell everyone the root type changed (user, project, state)
            scheduleAnnounce(parts[0], userData);
            
            dirty = true; //Prevent recursion
            
            return true;
        }
        
        var timers = {};
        function scheduleAnnounce(type, userData){
            clearTimeout(timers[type]);
            timers[type] = setTimeout(function(){ 
                emit("change:" + type, { data: model[type], userData: userData }); 
            });
        }
        
        function setJson(query, value) {
            return set(query, value);
        }
        
        function getJson(query) {
            var json = get(query, true);
            
            if (query.indexOf("json()") == -1)
                json = json["json()"];
            
            if (typeof json == "object")
                return JSON.parse(JSON.stringify(json));
                
            try {
                var obj = JSON.parse(json);
                return obj;
            }
            catch (e) {
                return false;
            }
        }
        
        function getBool(query) {
            var bool = get(query);
            return ui.isTrue(bool) || (ui.isFalse(bool) ? false : undefined);
        }
        
        function getNumber(query) {
            var double = get(query);
            return parseFloat(double, 10);
        }
        
        function getNode(query) {
            return get(query, true);
        }
        
        function get(query, isNode) {
            var parts = query.split("/");
            if (!isNode && parts[parts.length - 1].charAt(0) !== "@")
                parts.push("json()");
            
            var hash = model;
            parts.every(function(part) { 
                hash = hash[part];
                return hash;
            });
            
            return hash === undefined ? "" : hash;
        }
        
        function exist(query) {
            var parts = query.split("/");
            var hash = model;
            return parts.every(function(part) { 
                hash = hash[part];
                return hash;
            });
        }
        
        function reset(query) {
            if (!query) query = "user|state";
            
            var info = {};
            query.split("|").forEach(function(type) {
                info[type] = TEMPLATE[type];
            });
            
            read(model, true);
            saveToFile();
        }
    
        /***** Lifecycle *****/
        
        plugin.on("load", function(){
            // Give ui a reference to settings
            ui.settings = plugin;
            
            // Get the Time
            proc.execFile("node", { 
                args: ["-e", "console.log(Date.now())"]
            }, function(err, stdout, stderr) {
                if (err || stderr)
                    return;
                
                var time = parseInt(stdout, 10);
                diff = Date.now() - time;
            });
        });
        plugin.on("enable", function(){
        });
        plugin.on("disable", function(){
        });
        plugin.on("unload", function(){
            dirty = false;
            diff = 0;
            userData = null;
            inited = false;
            clearInterval(timer);
        });
        
        /***** Register and define API *****/
        
        /**
         * Settings for Cloud9. Settings are stored based on a path pointing
         * to leaves. Each leaf can be accessed using the "@" char.
         * 
         * Example:
         * 
         *     settings.set("user/tree/@width", "200");
         * 
         * Example:
         * 
         *     settings.getNumber("user/tree/@width");
         * @singleton
         */
        plugin.freezePublicAPI({
            /**
             * Exposes the model object that stores the XML used to store the
             * settings. This property is here for backwards compatibility only
             * and will be removed in the next version.
             * @property model
             * @deprecated
             * @private
             */
            model: model, //Backwards compatibility, should be removed in a later version
            
            /**
             * @property {Boolean} inited whether the settings have been loaded
             */
            get inited(){ return inited; },
            
            /**
             * The offset between the server time and the client time in 
             * milliseconds. A positive number means the client is ahead of the
             * server.
             * @property timeOffset
             * @readonly
             */
            get timeOffset(){ return diff; },
            
            /**
             * 
             */
            get paths(){ return PATH; },
            
            /**
             * 
             */
            get saveToCloud(){ return saveToCloud; },
            
            _events: [
                /** 
                 * @event read Fires when settings are read
                 */
                "read",
                /**
                 * @event write Fires when settings are written
                 * @param {Object}  e
                 * @param {Boolean} e.unload  specifies whether the application 
                 *   is being unloaded. During an unload there is not much time 
                 *   and only the highly urgent information should be saved in a
                 *   way that the browser still allows (socket is gone, etc).
                 **/ 
                "write"
            ],
            
            /**
             * Saves the most current settings after a timeout
             * @param {Boolean} force forces the settings to be saved immediately
             */
            save: save,
            
            /**
             * Loads the xml settings into the application
             * @param {XMLElement} xml The settings xml
             */
            read: read,
            
            /**
             * Sets a value in the settings tree
             * @param {String} path the path specifying the key for the value
             * @param {String} value the value to store in the specified location
             */
            "set" : set,
            
            /**
             * Sets a value in the settings tree and serializes it as JSON
             * @param {String} path the path specifying the key for the value
             * @param {String} value the value to store in the specified location
             */
            "setJson" : setJson,
            
            /**
             * Gets a value from the settings tree
             * @param {String} path the path specifying the key for the value
             */
            "get" : get,
            
            /**
             * Gets a value from the settings tree and interprets it as JSON
             * @param {String} path the path specifying the key for the value
             */
            "getJson" : getJson,
            
            /**
             * Gets a value from the settings tree and interprets it as Boolean
             * @param {String} path the path specifying the key for the value
             */
            "getBool" : getBool,
            
            /**
             * Gets a value from the settings tree and interprets it as Boolean
             * @param {String} path the path specifying the key for the value
             */
            "getNumber" : getNumber,
            
            /**
             * Gets an object from the settings tree and returns it
             * @param {String} path the path specifying the key for the value
             */
            "getNode" : getNode,
            
            /**
             * Checks to see if a node exists
             * @param {String} path the path specifying the key for the value
             */
            "exist" : exist,
            
            /**
             * Sets the default attributes of a settings tree node.
             * 
             * Example:
             * 
             *     settings.setDefaults("user/myplugin", [
             *       ["width", 200],
             *       ["show", true]
             *     ])
             * 
             * @param {String} path   the path specifying the key for the value
             * @param {Array}  attr   two dimensional array with name 
             *      values of the attributes for which the defaults are set
             */
            setDefaults: setDefaults,
            
            /**
             * Moves and renames attributes from one path to another path
             * @param {String} fromPath the path specifying where key for the value
             * @param {String} toPath   the path specifying where key for the value
             * @param {Array}  attr     two dimensional array with name 
             *      values of the attributes for which the defaults are set
             */
            migrate: migrate,
            
            /**
             * Resets the settings to their defaults
             */
            reset: reset,
            
            /**
             * Update user, project or state settings incrementally
             * @param {String} type
             * @param {Object} settings
             */
            update: update
        });
        
        if (c9.connected || options.settings) 
            loadSettings();
        else
            c9.once("connect", loadSettings);
        
        register(null, {
            settings: plugin
        });
    }
});
