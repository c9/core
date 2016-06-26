define(function(require, exports, module) {
    main.consumes = [];
    main.provides = ["ext", "Plugin"];
    return main;

    function main(options, imports, register) {
        var Emitter = require("events").EventEmitter;

        var plugins = [];
        var lut = {};
        var manuallyDisabled = {};
        var dependencies = {};
        var counters = {};
        
        var $id = 1;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        var vfs, settings, api;
        
        plugin.__defineSetter__("vfs", function(remote) {
            vfs = remote;
            delete plugin.vfs;
        });
        
        plugin.__defineSetter__("settings", function(remote) {
            settings = remote;
            
            settings.on("read", function(){
                var s = settings.getNode("state/ext/counters");
                for (var type in s) {
                    counters[type] = s[type.substr(1)];
                }
            });
            
            delete plugin.settings;
        });
        
        plugin.__defineSetter__("api", function(remote) {
            api = remote;
            delete plugin.api;
        });
        
        var eventRegistry = Object.create(null);
        
        /***** Methods *****/
        
        function uid(type, name) {
            while (!name || lut[name]) {
                if (!counters[type]) counters[type] = 0;
                name = type + counters[type]++;
            }
            if (settings && counters[type])
                settings.set("state/ext/counters/@" + type, counters[type]);
            return name;
        }
        
        function registerPlugin(plugin, loaded) {
            if (plugins.indexOf(plugin) == -1)
                plugins.push(plugin);
            lut[plugin.name] = plugin;
            
            loaded(true);
            
            var deps = plugin.deps;
            if (deps) {
                deps.forEach(function(dep) {
                    // if (dep !== plugin.name) throw new Error(dep);
                    (dependencies[dep] 
                      || (dependencies[dep] = {}))[plugin.name] = 1;
                });
            }
            
            emit("register", {plugin: plugin});
        }
        
        function unregisterPlugin(plugin, loaded, ignoreDeps, keep) {
            if (!plugin.registered)
                return;
            
            if (!ignoreDeps && getDependencies(plugin.name).length) {
                //@todo this should be moved to whoever is calling this.
                // if (!silent)
                //     util.alert(
                //         "Could not disable extension",
                //         "Extension is still in use",
                //         "This extension cannot be disabled, because it is still in use by the following plugins:<br /><br />"
                //         + " - " + usedBy.join("<br /> - ")
                //         + "<br /><br /> Please disable those plugins first.");
                return false;
            }
            
            if (!keep)
                plugins.splice(plugins.indexOf(plugin), 1);
            delete lut[plugin.name];
            
            loaded(false, 0);
            
            var deps = plugin.deps;
            if (deps && dependencies) {
                deps.forEach(function(dep) {
                    delete dependencies[dep][plugin.name];
                });
            }
            
            emit("unregister", {plugin: plugin});
        }
        
        function getDependencies(pluginName){
            var usedBy = [];
            
            // Check for dependencies needing this plugin
            if (dependencies) {
                var deps = dependencies[pluginName];
                if (deps) {
                    Object.keys(deps).forEach(function(name) {
                        usedBy.push(name);
                    });
                }
            }
            
            return usedBy;
        }
        
        function unloadAllPlugins(exclude) {
            if (lut.settings)
                lut.settings.unload(null, true);
            
            function unload(plugin) {
                if (!plugin || exclude && exclude[plugin.name]) 
                    return;
                
                var deps = dependencies[plugin.name];
                if (deps) {
                    Object.keys(deps).forEach(function(name) {
                        unload(lut[name]);
                    });
                }
                
                plugin.unload(null, true); 
            }
            
            var list = plugins.slice(0);
            for (var i = list.length - 1; i >= 0; i--) {
                var plugin = list[i];
                if (!plugin.loaded) continue;
                
                if (plugin.unload)
                    unload(plugin);
                else
                    console.warn("Ignoring not a plugin: " + plugin.name);
            }
        }
        
        function loadRemotePlugin(id, options, callback) {
            vfs.extend(id, options, function(err, meta) {
                callback(err, meta && meta.api);
            });
        }
        
        function fetchRemoteApi(id, callback) {
            vfs.use(id, {}, function(err, meta) {
                callback(err, meta && meta.api);
            });
        }
        
        function unloadRemotePlugin(id, options, callback) {
            if (typeof options == "function") {
                callback = options;
                options = {};
            }
            vfs.unextend(id, options, callback);
        }
        
        function enablePlugin(name){
            if (!lut[name] && !manuallyDisabled[name]) 
                throw new Error("Could not find plugin: " + name);
            (lut[name] || manuallyDisabled[name]).load(name);
        }
        
        function disablePlugin(name){
            if (!lut[name]) 
                throw new Error("Could not find plugin: " + name);
            
            var plugin = lut[name];
            if (plugin.unload({ keep: true }) === false)
                throw new Error("Failed unloading plugin: " + name);
                
            manuallyDisabled[name] = plugin;
        }
        
        /***** Register and define API *****/

        /**
         * The Cloud9 Extension Manager
         * @singleton
         */
        plugin.freezePublicAPI({
            /**
             *
             */
            get plugins(){ return plugins.slice(0); },
            
            /**
             *
             */
            get named(){ 
                var named = Object.create(lut); 
                for (var name in manuallyDisabled) {
                    if (!lut[name])
                        lut[name] = manuallyDisabled[name];
                }
                return named;
            },
            
            _events: [
                /**
                 * Fires when a plugin registers
                 * @event register
                 * @param {Object} e
                 * @param {Plugin} e.plugin the plugin that registers
                 */
                "register",
                /**
                 * Fires when a plugin unregisters
                 * @event unregister
                 * @param {Object} e
                 * @param {Plugin} e.plugin the plugin that unregisters
                 */
                "unregister"
            ],
            
            /**
             * Loads a plugin on the remote server. This plugin can be either
             * source that we have local, or a path to a file that already
             * exists on the server. The plugin provides an api that is returned
             * in the callback. The remote plugin format is very simple. Here's
             * an example of a Math module:
             * 
             * #### Math Modules
             * 
             *     module.exports = function (vfs, options, register) {
             *         register(null, {
             *             add: function (a, b, callback) {
             *                 callback(null, a + b);
             *             },
             *             multiply: function (a, b, callback) {
             *                 callback(null, a * b);
             *             }
             *         });
             *     };
             * 
             * @param {String}   id                 A unique identifier for this module
             * @param {Object}   options            Options to specify
             * @param {String}   [options.code]     The implementation of a module, e.g. require("text!./my-service.js").
             * @param {String}   [options.file]     An absolute path to a module on the remote disk
             * @param {Boolean}  [options.redefine] specifying whether to replace an existing module with the same `id`
             * @param {Function} callback           called when the code has been loaded.
             * @param {Error}    callback.err       The error object if an error has occured.
             * @param {Object}   callback.api       The api the code that loaded defined.
             * 
             */
            loadRemotePlugin: loadRemotePlugin,
            
            /**
             * 
             */
            fetchRemoteApi: fetchRemoteApi,
            
            /**
             * Unloads a plugin loaded with loadRemotePlugin
             * @param {String}   id       The unique identifier for this module
             * @param {Function} callback 
             */
            unloadRemotePlugin: unloadRemotePlugin,
            
            /**
             * 
             */
            unloadAllPlugins: unloadAllPlugins,
            
            /**
             * 
             */
            getDependencies: getDependencies,
            
            /**
             * 
             */
            enablePlugin: enablePlugin,
            
            /**
             * 
             */
            disablePlugin: disablePlugin
        });
        
        function Plugin(developer, deps) {
            var elements = [];
            var names = {};
            var waiting = {};
            var events = [];
            var other = [];
            var name = "";
            var time = 0;
            var registered = false;
            var loaded = false;
            var event = new Emitter();
            var disabled = false;
            var onNewEvents = {};
            var declaredEvents = [];
            
            this.deps = deps;
            this.developer = developer;
            
            event.on("newListener", function(type, listener) {
                if (!(type in onNewEvents))
                    return;
                    
                var data = onNewEvents[type];
                if (data === -1)
                    event.emit("$event." + type, listener);
                else {
                    listener(onNewEvents[type]);
                    
                    if (event.listeners(type).indexOf(listener) > -1)
                        console.trace("Used 'on' instead of 'once' to "
                            + "listen to sticky event " + name + "." + type);
                }
            });
            
            function init(reg) {
                registered = reg;
            }
            
            /***** Methods *****/
            
            this.getEmitter = function(){
                var emit = event.emit.bind(event);
                
                var _self = this;
                var sticky = function(name, e, plugin) {
                    if (plugin) {
                        _self.on("$event." + name, function(listener){
                            listener(e);
                        }, plugin);
                        onNewEvents[name] = -1;
                    }
                    else {
                        onNewEvents[name] = e;
                    }
                    return emit(name, e);
                };
                
                function unsticky(name, e) {
                    delete onNewEvents[name];
                }
                
                emit.listeners = event.listeners.bind(event);
                emit.setMaxListeners = event.setMaxListeners.bind(event);
                emit.sticky = sticky;
                emit.unsticky = unsticky;
                
                return emit;
            };
            
            this.freezePublicAPI = function(api) {
                // Build a list of known events to warn users if they use a 
                // non-existent event.
                if (api._events) {
                    api._events.forEach(function(name){
                        declaredEvents[name] =  true;
                    });
                    delete api._events;
                }
                
                // Reverse prototyping of the API
                // if (!this.__proto__) {
                // modifying __proto__ is very slow on chrome!
                    Object.keys(api).forEach(function(key) {
                        var d = Object.getOwnPropertyDescriptor(api, key);
                        Object.defineProperty(this, key, d);
                    }, this);
                // }
                // else {
                //     api.__proto__ = this.__proto__;
                //     this.__proto__ = api;
                //     Object.freeze(api);
                // }
                
                if (!baseclass) {
                    delete this.baseclass;
                    delete this.freezePublicAPI.baseclass;
                    delete this.freezePublicAPI;
                    delete this.setAPIKey;
                    delete this.getEmitter;
                    Object.freeze(this);
                }
                baseclass = false;
                
                return this;
            };
            var baseclass;
            this.baseclass = 
            this.freezePublicAPI.baseclass = function(){ baseclass = true; };
            
            function getElement(name, callback) {
                // remove id's after storing them.
                if (!callback) {
                    // If we run without APF, just return a simple object
                    if (typeof apf == "undefined") 
                        return {};
                    
                    if (!names[name]) {
                        throw new Error("Could not find AML element by name '" 
                            + name + "'");
                    }

                    return names[name];
                }
                else {
                    if (names[name]) callback(names[name]);
                    else {
                        (waiting[name] || (waiting[name] = [])).push(callback);
                    }
                }
            }
            
            function addElement() {
                for (var i = 0; i < arguments.length; i++) {
                    var node = arguments[i];
                    elements.push(node);
                    recur(node);
                }
                
                function recur(node) {
                    (node.childNodes || []).forEach(recur);
                    var id = node.id;
                    if (!id)
                        return;
                    // Delete their global reference
                    delete window[id];
                    // delete apf.nameserver.lookup.all[node.id];
                    
                    // Keep their original name in a lookup table
                    names[id] = node;
                    
                    // Set a new unique id
                    if (node.localName != "page") { // Temp hack, should fix in tabs
                        node.id = "element" + node.$uniqueId;
                        apf.nameserver.lookup.all[node.id] = node;
                    }
                    
                    // Call all callbacks waiting for this element
                    if (waiting[id]) {
                        waiting[id].forEach(function(callback) {
                            callback(node);
                        });
                        delete waiting[id];
                    }
                }
                
                return arguments[0];
            }
            
            function addEvent(emitter, type, listener) {
                if (!listener.listenerId)
                    listener.listenerId = $id++;
                events.push([emitter.name, type, listener.listenerId]);
            }
            
            function addOther(o) {
                other.push(o);
            }
            
            function initLoad(type, listener) {
                if (type == "load") listener();
            }
            
            function load(nm, type) {
                var dt = Date.now();
                
                if (type) nm = uid(type, nm);
                if (nm && !name) name = nm;
                event.name = name;
                eventRegistry[name] = event;
                registerPlugin(this, init);
                loaded = true;
                
                event.emit("load");
                event.on("newListener", initLoad);
                
                time = Date.now() - dt;
            }
            
            function enable() {
                emit("enablePlugin", {plugin: this});
                event.emit("enable");
                disabled = false;
            }
            
            function disable() {
                emit("disablePlugin", {plugin: this});
                event.emit("disable");
                disabled = true;
            }
            
            function unload(e, ignoreDeps) {
                if (!loaded) return;
                
                if (event.emit("beforeUnload", e) === false)
                    return false;
                
                if (unregisterPlugin(this, init, ignoreDeps, e && e.keep) === false)
                    return false;
                
                loaded = false;
                
                event.emit("unload", e);
                
                this.cleanUp();
                
                event.off("newListener", initLoad);
                setTimeout(function() {
                    if (eventRegistry[name] == event && !loaded) {
                        delete eventRegistry[name];
                    }
                });
            }
            
            function cleanUp(what, otherPlugin) {
                if (!what || ~what.indexOf("elements")) {
                    // Loop through elements
                    elements.forEach(function(element) {
                        element.destroy(true, true);
                    });
                    elements = [];
                    names = {};
                    waiting = [];
                }
                
                // Loop through events
                if (!what || ~what.indexOf("events")) {
                    events.forEach(function(eventRecord) {
                        var event = eventRegistry[eventRecord[0]];
                        if (!event) return; // this happens with mock plugins during testing
                        if (otherPlugin && otherPlugin.name != event.name) return;
                        var type = eventRecord[1];
                        var id = eventRecord[2];
                        var _events = event._events;
                        var eventList = _events && _events[type];
                        if (typeof eventList == "function") {
                            if (eventList.listenerId == id)
                                event.off(type, eventList);
                        } else if (Array.isArray(eventList)) {
                            eventList.some(function(listener) {
                                if (listener.listenerId != id) return;
                                event.off(type, listener);
                                return true;
                            });
                        }
                    });
                    events = [];
                    onNewEvents = {};
                }
                
                // Loop through other
                if (!what || ~what.indexOf("other")) {
                    other.forEach(function(o) {
                        o();
                    });
                    other = [];
                }
            }
            
            /***** Register and define API *****/
            
            this.baseclass();
            
            /**
             * Base class for all Plugins of Cloud9. A Cloud9 Plugin is
             * an instance of the Plugin class. This class offers ways to 
             * describe the API it offers as well as ways to clean up the 
             * objects created during the lifetime of the plugin.
             * 
             * Note that everything in Cloud9 is a plugin. This means that
             * your plugins have the exact same possibilities as any other part
             * of Cloud9. When building plugins you can simply create additional
             * features or replace existing functionality, by turning off the
             * core plugins and preference of your own.
             * 
             * Check out the [template](http://example.org/template) for the
             * recommended way of building a plugin. All Cloud9 Core Plugins
             * are written in this way.
             * 
             * Our goal has been to create an extensible system that works both
             * in the browser as well as in Node.js. The Cloud9 CLI uses the
             * exact same plugin structure as the Cloud9 in the browser. The
             * same goes for many of the Cloud9 platform services. We focussed
             * on making the system easy to use by making sure you can create
             * plugins using simple javascript, html and css. The plugins you
             * create will become available as services inside the Cloud9 
             * plugin system. This means that other plugins can consume your
             * functionality and importantly you can replace existing services
             * by giving your plugin the same service name.
             * 
             * The plugin class will allow you to specify an API that is 
             * "frozen" upon definition (See {@link Object#freeze}. This means
             * that once your plugin's API is defined the object's interface
             * cannot be changed anymore. Property gettters and setters will
             * still work and events can still be set/unset. Having immutable
             * APIs will prevent users from common hacks that devs often use
             * in the javascript community, adding new properties to objects.
             * It is our aim that this will increase the stability of the system
             * as a whole while introducing foreign plugins to it.
             * 
             * The event flow of a basic plugin is as follows:
             * 
             * * {@link #event-load} - *The plugin is loaded (this can happen multiple times to the same plugin instance)*
             * * {@link #event-unload} - *The plugin is unloaded*
             * 
             * #### User Actions:
             * 
             * * {@link #event-disable} - *The plugin is disabled*
             * * {@link #event-enable} - *The plugin is enabled*
             * 
             * The following example shows how to implement a basic plugin:
             * 
             *     define(function(require, exports, module) {
             *         main.consumes = ["dependency"];
             *         main.provides = ["myplugin"];
             *         return main;
             *     
             *         function main(options, imports, register) {
             *             var dependency = imports.dependency;
             *             
             *             var plugin = new Plugin("(Company) Name", main.consumes);
             *             var emit = plugin.getEmitter();
             *         
             *             plugin.on("load", function(e) {
             *                 // Create a command, menu item, etc
             *             });
             *             plugin.on("unload", function(e) {
             *                 // Any custom unload code (most things are cleaned up automatically)
             *             });
             * 
             *             function doSomething(){
             *             }
             *         
             *             plugin.freezePublicAPI({
             *                 doSomething : doSomething
             *             });
             *         }
             *     });
             * 
             * @class Plugin
             * @extends Object
             */
            /**
             * @constructor
             * Creates a new Plugin instance.
             * @param {String}   developer  The name of the developer of the plugin
             * @param {String[]} deps       A list of dependencies for this 
             *   plugin. In most cases it's a reference to main.consumes.
             */
            this.freezePublicAPI({
                _events: [
                    /** 
                     * Fires when the plugin is loaded
                     * @event load
                     */
                    "load",
                    /** 
                     * Fires before the plugin is unloaded
                     * @event beforeUnload
                     */
                    "beforeUnload",
                    /**
                     * Fires when the plugin is unloaded
                     * @event unload 
                     */
                    "unload",
                    /**
                     * Fires when the plugin is enabled
                     * @event enable
                     */
                    "enable",
                    /**
                     * Fires when the plugin is disabled
                     * @event disable
                     */
                    "disable",
                    /**
                     * Fires any time a new listener is added.
                     *
                     *     plugin.on('newListener', function (event, listener) {
                     *         // new listener added
                     *     });
                     * 
                     * @event newListener
                     */
                    "newListener",
                    /**
                     * Fires any time a listener is removed.
                     * 
                     *     plugin.on('removeListener', function (event, listener) {
                     *         // listener is removed
                     *     });
                     * 
                     * @event removeListener
                     */
                    "removeListener"
                ],
                
                /**
                 * @property {Boolean} registered  Specifies whether the plugin is registered
                 * @readonly
                 */
                get registered(){ return registered; },
                /**
                 * @property {Date} time  The time when the plugin was registered
                 * @readonly
                 */
                get time(){ return time; },
                /**
                 * @property {Boolean} enabled  Specifies whether the plugin is enabled
                 * @readonly
                 */
                get enabled(){ return !disabled; },
                /**
                 * @property {Boolean} loaded whether the plugin is loaded. 
                 *   This happens by calling load or setting the name.
                 * @readonly
                 */
                get loaded(){ return loaded; },
                /** 
                 * @property {String} name  The name of the plugin
                 */
                get name(){ return name; },
                set name(val) {
                    if (name == val)
                        return;
                        
                    if (!name) {
                        name = val;
                        this.load();
                    }
                    else
                        throw new Error("Plugin Name Exception");
                },
                
                /**
                 * Copies all methods and properties from `api` and then freezes
                 * the plugin to prevent further changes to its API.
                 * 
                 * @method freezePublicAPI
                 * @param {Object} api simple object that defines the API
                 **/
                
                /**
                 * Fetches the event emitter for this plugin. After freezing the 
                 * public API of this plugin, this method will no longer be
                 * available.
                 * 
                 * Note that there is a limit to the amount of event listeners
                 * that can be placed on a plugin. This is to protect developers
                 * from leaking event listeners. When this limit is reached
                 * an error is thrown. Use the emit.setMaxListeners
                 * to change the amount of listeners a plugin can have:
                 * 
                 *     var emit = plugin.getEmitter();
                 *     emit.setMaxListeners(100);
                 * 
                 * @method getEmitter
                 * @return {Function}
                 * @return {String}   return.eventName      The name of the event to emit
                 * @return {Object}   return.eventObject    The data passed as the first argument to all event listeners
                 * @return {Boolean}  return.immediateEmit  Specifies whether 
                 *  to emit the event to event handlers that are set after 
                 *  emitting this event. This is useful for instance when you 
                 *  want to have a "load" event that others add listeners to 
                 *  after the load event is called.
                 **/
                 
                /**
                 * Fetches a UI element. You can use this method both sync and async.
                 * @param {String}   name       the id of the element to fetch
                 * @param {Function} [callback] the function to call when the 
                 *     element is available (could be immediately)
                 **/
                getElement: getElement,
                
                /**
                 * Register an element for destruction during the destroy phase of
                 * this plugin's lifecycle.
                 * @param {AMLElement} element the element to register
                 **/
                addElement: addElement,
                
                /**
                 * Register an event for destruction during the destroy phase of
                 * this plugin's lifecycle.
                 * @param {Array} ev Array containing three elements: 
                 *     object, event-name, callback
                 **/
                addEvent: addEvent,
                
                /**
                 * Register a function that is called during the destroy phase of
                 * this plugin's lifecycle.
                 * @param {Function} o function called during the destroy phase 
                 *      of this plugin's lifecycle
                 **/
                addOther: addOther,
                
                /**
                 * Loads this plugin into Cloud9
                 **/
                load: load,
                
                /**
                 * @ignore Enable this plugin
                 **/
                enable: enable,
                
                /**
                 * @ignore Disable this plugin
                 **/
                disable: disable,
                 
                /**
                 * Unload this plugin from Cloud9
                 **/
                unload: unload,
                
                /**
                 * Removes all elements, events and other items registered for 
                 * cleanup by this plugin
                 */
                cleanUp: cleanUp,
                
                /**
                 * Adds an event handler to this plugin. Note that unlike the
                 * event implementation you know from the browser, you are
                 * able to add the same listener multiple times to listen to
                 * the same event.
                 * 
                 * @param {String}   name       The name of this event
                 * @param {Function} callback   The function called when the event is fired
                 * @param {Plugin}   plugin     The plugin that is responsible 
                 *   for the event listener. Make sure to always add a reference 
                 *   to a plugin when adding events in order for the listeners 
                 *   to be cleaned up when the plugin unloads. If you forget 
                 *   this you will leak listeners into Cloud9.
                 * @fires newListener
                 **/
                on: function(eventName, callback, plugin){
                    // if (!declaredEvents[eventName])
                    //     console.warn("Missing event description or unknown event '" + eventName + "' for plugin '" + name + "'", new Error().stack);
                        
                    event.on(eventName, callback, plugin);
                },
                
                /**
                 * Adds an event handler to this plugin and removes it after executing it once
                 * @param {String} name the name of this event
                 * @param {Function} callback the function called when the event is fired
                 **/
                once: function(eventName, callback){
                    // if (!declaredEvents[eventName])
                    //     console.warn("Missing event description or unknown event '" + eventName + "' for plugin '" + name + "'");
                        
                    event.once(eventName, callback);
                },
                
                /**
                 * Removes an event handler from this plugin
                 * @param {String} name the name of this event
                 * @param {Function} callback the function previously registered as event handler
                 * @fires removeListener
                 **/
                off: event.removeListener.bind(event),
                
                /**
                 * Returns an array of listeners for an event specified by `name`
                 * @param {String} name the name of this event
                 */
                listeners: event.listeners.bind(event)
            });
        }
        
        register(null, {
            ext: plugin,
            Plugin: Plugin
        });
    }
});
