define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "settings", "debugger", "preferences", "fs", "tabManager"
    ];
    main.provides = ["sourcemap"];
    return main;

    /*
        Source Map Support:
        - Add "Sourcemaps: Enable/Disable/Auto" in settings 
            - (Default:auto) detects based on filename
        - [Hook debugger plugin] Setting a breakpoint via Ace
            - Record that it's a sourcemap and the sourcemap path
        - [Hook debugger plugin] Setting a breakpoint through the API
            - [Hook debugger plugin] Make sure init waits until done
            - Fetch generated file
                - Check if generated file has sourcemap
        - [Hook debugger plugin] Getting a breakpoint from the server (or using the api)
            - Fetch source in background
                - If sourcemap is detected update breakpoints
        - [Hook debugger plugin] On breaking (breakpoint, debugger, stepping)
            - Keep cache of known sourcemap states (none/map_contents)
                - Deal with loading latency
            - [Hook fs&debugger plugin] If not in cache load source (which we're doing anyway)
                - If sourcemap is detected
                    - load sourcemap
                        - add sourcemap to cache
                        - calculate original file
                            - load original file
                        - update all breakpoints set on this file
                        - update all frames in this file
            - Else if in cache, load original or do nothing
            - [Hook debugger plugin] When loading the frames, check if they belong to a known sourcemapped file
                - if so, translate the coords
        - Check out https://github.com/evanw/node-source-map-support for node
    */
    
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var debug = imports.debugger;
        var prefs = imports.preferences;
        var fs = imports.fs;
        var tabs = imports.tabManager;
        
        // Source Map Parser
        var SourceMapConsumer = require('lib/source-map/lib/source-map/source-map-consumer').SourceMapConsumer;
        var basename = require("path").basename;
        var dirname = require("path").dirname;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var KNOWN_MAP_TYPES = ["ts", "coffee"];
        
        var generated = {};
        var originals = {};
        var maps = {};
        var fetching = 0;
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            // - Add "Sourcemaps: Enable/Disable/Auto" in settings 
            //     - (Default:auto) detects based on filename
            prefs.add({
               "Project": {
                   "Run & Debug": {
                       "Source Maps": {
                           type: "dropdown",
                           path: "project/debug/@sourcemaps",
                           width: 300,
                           items: [
                               { caption: "Auto (check based on extension - .ts and .coffee)", value: "auto" },
                               { caption: "Enabled (always check)", value: "true" },
                               { caption: "Disabled (never check)", value: "false" }
                           ],
                           position: 50
                        }
                   }
               }
            }, plugin);
            
            settings.on("read", function() {
                settings.setDefaults("project/debug", [["sourcemaps", "auto"]]);
            }, plugin);
            
            // - [Hook debugger plugin] Setting a breakpoint via Ace
            //     - Record that it's a sourcemap and the sourcemap path
            // - [Hook debugger plugin] Setting a breakpoint through the API
            //     - Fetch generated file
            //         - Check if generated file has sourcemap
            // - [Hook debugger plugin] Getting a breakpoint from the server (or using the api) - also fires breakpoint.update
            //     - Fetch source in background
            //         - If sourcemap is detected update breakpoints
            debug.on("breakpointsUpdate", function(e) {
                if (e.action == "add") {
                    var bp = e.breakpoint;
                    
                    if (!isEnabled(bp.path))
                        return;
                        
                    // check if we don't already know that it has a sourcemap
                    if (!bp.sourcemap || e.force) {
                        fetching++;
                        
                        var getSourcemap = bp.serverOnly 
                            ? getSourcemapFromGenerated
                            : getSourcemapFromOriginal;

                        getSourcemap(bp.path, function(err, map) {
                            if (!err) {
                                if (!map) {
                                    bp.sourcemap = -1;
                                    return;
                                }
                                
                                if (bp.actual) {
                                    bp.actual = map.originalPositionFor({
                                        line: bp.actual.line + 1,
                                        column: bp.actual.column + 1
                                    });
                                    makeZeroBased(bp.actual);
                                }
                                else {
                                    bp.sourcemap = map.generatedPositionFor({
                                        line: bp.line + 1,
                                        column: bp.column + 1,
                                        source: basename(bp.path)
                                    });
                                    makeZeroBased(bp.sourcemap);
                                    bp.sourcemap.source = 
                                        dirname(bp.path) + map.file;
                                }
                            }
                            fetching--;
                            
                            if (!fetching)
                                emit("fetchingDone");
                        });
                    }
                }
            }, plugin);
            
            //     - [Hook debugger plugin] Make sure init waits until done
            debug.on("beforeAttach", function(e) {
                // Wait until all breakpoints have been checked
                if (fetching) {
                    plugin.once("fetchingDone", function() {
                        debug.debug(e.runner, e.callback);
                    });
                    return false;
                }
            }, plugin);
            
            // - [Hook debugger plugin] On breaking (breakpoint, debugger, stepping)
            //     - Keep cache of known sourcemap states (none/map_contents)
            //         - Deal with loading latency
            //     - [Hook debugger plugin] If not in cache load source (which we're doing anyway)
            //         - If sourcemap is detected
            //             - load sourcemap
            //                 - add sourcemap to cache
            //                 - calculate original file
            //                     - load original file
            //                 - update all breakpoints set on this file
            //                 - update all frames in this file
            debug.on("beforeOpen", function(e) {
                if (e.generated)
                    return;
                
                // Fetch the map, based on the generated file
                getSourcemapFromGenerated(e.state.path, function(err, map, source) {
                    var jump = e.state.document.ace.jump;
                    
                    if (map) {
                        if (!jump)
                            jump = { row: 0, column: 0 };
                        
                        var mapping = map.originalPositionFor({
                            line: jump.row + 1,
                            column: jump.column + 1
                        });
                        
                        // Set path, line, column
                        var path = dirname(e.state.path) + mapping.source; //@todo is this the correct path
                        
                        e.state.path = path; 
                        e.state.document.title = mapping.source;
                        
                        jump.row = mapping.line - 1;
                        jump.column = mapping.column - 1;
                        
                        delete e.state.value;
                        
                        updateFrames();
                    }
                    else if (source) {
                        e.state.value = source;
                    }
                    
                    tabs.open(e.state, function(err, tab, done) {
                        if (err || !done) 
                            return e.callback(err, tab);
                        tabs.focusTab(tab);
                        
                        fetchSource(e.state.path, function(err, value) {
                            if (err) return;
                            
                            tab.document.value = value;
                            
                            if (tab.isActive() && jump) {
                                tab.document.editor
                                  .scrollTo(jump.row, jump.column, jump.select);
                            }
                            
                            done();
                            e.callback(null, tab);
                        });
                    });
                });
                
                return false;
            }, plugin);
            
            // Update new frames with cached data
            debug.on("framesLoad", function(e) {
                var frames = e.frames;
                if (!frames) return;
                
                frames.forEach(function(frame) {
                    if (!frame.sourcemap && typeof generated[frame.path] == "string") {
                        var map = maps[generated[frame.path]];
                        
                        var mapping = map.originalPositionFor({
                            line: frame.line + 1,
                            column: frame.column + 1
                        });
                        
                        frame.line = mapping.line - 1;
                        frame.column = mapping.column - 1;
                        frame.path = dirname(frame.path) + mapping.source;
                        
                        if (mapping.name) 
                            frame.name = mapping.name;
                        
                        frame.sourcemap = true;
                    }
                    // debug.updateFrame(frame, true);
                });
            }, plugin);
            
            // Premature optimization
            debug.on("attach", function(e) {
                // Store cache in settings for accidental refreshes
                settings.setJson("user/debug/sourcemaps", [generated, originals]);
            }, plugin);
            debug.on("detach", function(e) {
                // Stop keeping cache in settings
                settings.setJson("user/debug/sourcemaps", []);
            }, plugin);
            
            //     - Else if in cache, load original or do nothing
            //     - [Hook debugger plugin] When loading the frames, check if they belong to a known sourcemapped file
            //         - if so, translate the coords
            
            // @todo frames, variables, scopes
        }
        
        function makeZeroBased(obj) {
            if (obj.line) obj.line--;
            if (obj.column) obj.column--;
        }
        
        /***** Methods *****/
        
        function isEnabled(path) {
            var enabled = settings.get("project/debug/@sourcemaps");
            return enabled == "auto" 
              && KNOWN_MAP_TYPES.indexOf(fs.getExtension(path)) > -1
              || enabled == "true";
        }
        
        function fetchSource(path, callback) {
            if (debug.state !== "disconnected") {
                var sources = debug.sources || [];
                for (var i = 0, l = sources.length; i < l; i++) {
                    if (sources[i].path == path) {
                        debug.getSource(sources[i], callback);
                        return;
                    }
                }
            }
            
            fs.readFile(path, "utf8", callback);
        }
        
        function fetchMap(path, callback) {
            if (maps[path])
                return callback(null, maps[path]);
            
            fetchSource(path, function(err, source) {
                if (err) return callback(err);
                
                // Create Map
                var map = new SourceMapConsumer(source);
                
                // Store paths in cache
                map._sources._array.forEach(function(p) {
                    originals[dirname(path) + p] = path;
                });
                generated[dirname(path) + map.file] = path;
                
                // Cache Map
                maps[path] = map;
                
                callback(null, map);
            });
        }
        
        function getMapPath(source) {
            var match = source.match(/\/\/\@ sourceMappingURL\=(.*)/);
            return match ? match[1].trim() : false;
        }
        
        function detectMap(path, source, callback) {
            // Find the path of the map file if any
            var mapPath = getMapPath(source);
            if (!mapPath) {
                generated[path] = -1;
                return callback(null, false, source);
            }
            
            if (mapPath.charAt(0) != "/")
                mapPath = dirname(path) + mapPath;
            
            // Fetch the map itself
            fetchMap(mapPath, callback);
        }
        
        // The difficult thing with this function is that we need to somehow
        // guess the map file path of this file, unless we already know it
        // lets try to get as much info from map files, otherwise we'll guess
        // the map file path
        //
        // @todo there's probably lots of room for improvement. Think about
        //    hooking into runner information, or having a settings file, or
        //    even doing a source in all files.
        function getSourcemapFromOriginal(path, callback) {
            var mapPath = originals[path]
                || path.substr(0, path.lastIndexOf(".")) + ".js.map";
            
            return fetchMap(mapPath, callback);
        }
        
        function getSourcemapFromGenerated(path, callback) {
            // We know there is no source map
            if (generated[path] == -1)
                return callback(null, false);
            
            // We know there is a source map
            if (generated[path])
                return fetchMap(generated[path], callback);
            
            // Fetch the source of the generated file
            fetchSource(path, function(err, source) {
                if (err) return callback(err);
                
                detectMap(path, source, callback);
            });
        }
        
        //@todo
        function updateFrames() {
            
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Adds source map support to the {@link debugger Cloud9 Debugger}.
         **/
        plugin.freezePublicAPI({
            
        });
        
        register(null, {
            sourcemap: plugin
        });
    }
});