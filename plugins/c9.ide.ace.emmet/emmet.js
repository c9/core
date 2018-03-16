define(function(require, exports, module) {
    "use strict";
    main.consumes = [
        "Plugin", "commands", "menus", "ace"
    ];
    main.provides = ["emmet"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var commands = imports.commands;
        var menus = imports.menus;
        
        var emmetExt = require("ace/ext/emmet");
        emmetExt.load = function(callback) {
            require(["lib/emmet/emmet"], function(m) {
                emmetExt.setCore(m);
                callback && callback();
            });
        };
        emmetExt.updateCommands = function() {};
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            var keymap = {
                expand_abbreviation: { mac: "ctrl+alt+e", win: "ctrl+alt+e" },
                match_pair_outward: {}, // {mac: "ctrl+d", win: "ctrl+,"},
                match_pair_inward: {}, // {mac: "ctrl+j", win: "ctrl+shift+0"},
                matching_pair: {}, // {mac: "ctrl+alt+j", win: "alt+j"},
                next_edit_point: {}, // "alt+right",
                prev_edit_point: {}, // "alt+left",
                toggle_comment: {}, // {mac: "command+/", win: "ctrl+/"},
                split_join_tag: {}, // {mac: "shift+command+'", win: "shift+ctrl+`"},
                remove_tag: {}, // {mac: "command+'", win: "shift+ctrl+;"},
                evaluate_math_expression: { mac: "shift+command+y", win: "shift+ctrl+y" },
                increment_number_by_1: {}, // "ctrl+up",
                decrement_number_by_1: {}, // "ctrl+down",
                increment_number_by_01: {}, // "alt+up",
                decrement_number_by_01: {}, // "alt+down",
                increment_number_by_10: {}, // {mac: "alt+command+up", win: "shift+alt+up"},
                decrement_number_by_10: {}, // {mac: "alt+command+down", win: "shift+alt+down"},
                select_next_item: { mac: "shift+command+.", win: "shift+ctrl+." },
                select_previous_item: { mac: "shift+command+,", win: "shift+ctrl+," },
                reflect_css_value: {}, // {mac: "shift+command+r", win: "shift+ctrl+r"},
                
                // encode_decode_data_url:  {}, // {mac: "shift+ctrl+d", win: "ctrl+'"},
                // update_image_size: {mac: "shift+ctrl+i", win: "ctrl+u"},
                // expand_as_you_type: "ctrl+alt+enter",
                // wrap_as_you_type: {mac: "shift+ctrl+g", win: "shift+ctrl+g"},
                expand_abbreviation_with_tab: { mac: "Tab", win: "Tab" },
                wrap_with_abbreviation: { mac: "shift+ctrl+a", win: "shift+ctrl+a" }
            };
            
            for (var i in keymap) {
                commands.addCommand({
                    name: "emmet_" + i,
                    action: i,
                    group: "emmet",
                    bindKey: keymap[i],
                    exec: emmetExt.runEmmetCommand,
                    isAvailable: isAvailable,
                    findEditor: findEditor
                }, plugin);
            }
        }
        
        var drawn = false;
        function draw() {
            if (drawn) return;
            drawn = true;
            
            // TODO add menu items?
        
            emit("draw");
        }
        
        /***** Methods *****/
        
        function isAvailable(editor, args, event) {
            if (!editor || !editor.ace) return false;
            
            // using this instead of editor.type == "ace" to make 
            // commands avaliable in editors inheriting from ace
            if (event instanceof KeyboardEvent && (!editor.ace.isFocused()))
                return false;
            
            return emmetExt.isAvailable(editor.ace, this.name);
        }
    
        function findEditor(editor) {
            if (editor && editor.ace)
                return editor.ace;
            return editor;
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
            drawn = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * 
         **/
        plugin.freezePublicAPI({
        });
        
        register(null, {
            emmet: plugin
        });
    }
});