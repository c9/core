define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "format", "settings", "preferences", "util", "save"
    ];
    main.provides = ["format.jsbeautify"];
    return main;

    function main(options, imports, register) {
        var util = imports.util;
        var prefs = imports.preferences;
        var Plugin = imports.Plugin;
        var format = imports.format;
        var settings = imports.settings;
        var save = imports.save;
        var Range = require("ace/range").Range;
        var jsbeautify = require("./lib_jsbeautify");
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        var MODES = {
            "javascript": true,
            "html": true,
            "xhtml": true,
            "plugins/salesforce.language/modes/visualforce": true,
            "plugins/salesforce.language/modes/lightning": true,
            "css": true,
            "less": true,
            "scss": true,
            "xml": true,
            "json": true,
            "handlebars": true,
        };
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            settings.on("read", function() {
                settings.setDefaults("project/javascript", [
                    ["use_jsbeautify", "true"],
                ]);
                settings.setDefaults("project/format/jsbeautify", [
                    ["preserveempty", "true"],
                    ["keeparrayindentation", "false"],
                    ["jslinthappy", "false"],
                    ["braces", "end-expand"],
                    ["preserve-inline", true],
                    ["space_before_conditional", "true"],
                    ["unescape_strings", "true"],
                    ["indent_inner_html", false],
                    ["advanced", {}]
                ]);
            });
            
            format.on("format", function(e) {
                if (MODES[e.mode])
                    return formatEditor(e.editor, e.mode, e.all);
            });
            
            prefs.add({
                "Project": {
                    "Code Formatters": {
                        position: 900,
                        "JSBeautify": {
                            type: "label",
                            caption: "JSBeautify settings:",
                        },
                        "Format Code on Save": {
                            position: 320,
                            type: "checkbox",
                            path: "project/format/jsbeautify/@formatOnSave",
                            onchange: function(e) {
                                if (e.value && settings.get("project/javascript/@formatter", ""))
                                    settings.set("project/javascript/@use_jsbeautify", true);
                            }
                        },
                        "Use JSBeautify for JavaScript": {
                            position: 340,
                            type: "checkbox",
                            path: "project/javascript/@use_jsbeautify",
                            onchange: function(e) {
                                if (e.value)
                                    settings.set("project/javascript/@formatter", "");
                            }
                        },
                        "Preserve Empty Lines": {
                            type: "checkbox",
                            path: "project/format/jsbeautify/@preserveempty",
                            position: 350,
                        },
                        "Keep Array Indentation": {
                            type: "checkbox",
                            path: "project/format/jsbeautify/@keeparrayindentation",
                            position: 351,
                        },
                        "JSLint Strict Whitespace": {
                            type: "checkbox",
                            
                            path: "project/format/jsbeautify/@jslinthappy",
                            position: 352,
                        },
                        "Braces": {
                            type: "dropdown",
                            path: "project/format/jsbeautify/@braces",
                            width: "185",
                            position: 353,
                            items: [
                                { value: "collapse", caption: "Braces with control statement" },
                                { value: "expand", caption: "Braces on own line" },
                                { value: "end-expand", caption: "End braces on own line" }
                            ]
                        },
                        "Preserve Inline Blocks": {
                            type: "checkbox",
                            path: "project/format/jsbeautify/@preserve-inline",
                            position: 353.5,
                        },
                        "Space Before Conditionals": {
                            type: "checkbox",
                            path: "project/format/jsbeautify/@space_before_conditional",
                            position: 354,
                        },
                        "Unescape Strings": {
                            type: "checkbox",
                            path: "project/format/jsbeautify/@unescape_strings",
                            position: 355,
                        },
                        "Indent Inner Html": {
                            type: "checkbox",
                            path: "project/format/jsbeautify/@indent_inner_html",
                            position: 356,
                        }
                    },
                    "JavaScript Support": {
                        position: 1100,
                        "Use Built-in JSBeautify as Code Formatter": {
                            position: 320,
                            type: "checkbox",
                            path: "project/javascript/@use_jsbeautify",
                            onchange: function(e) {
                                if (e.value)
                                    settings.set("project/javascript/@formatter", "");
                            }
                        },
                    }
                }
            }, plugin);
                
            save.on("beforeSave", function(e) {
                if (!e.tab.editor || !e.tab.editor.ace || !e.tab.path)
                    return;
                var mode = e.tab.editor.ace.session.syntax;
                if (!e.tab.editor && !e.tab.editor.ace || !MODES[mode])
                    return;
                if (mode === "javascript" && !settings.getBool("project/javascript/@formatOnSave") && !settings.getBool("project/format/jsbeautify/@formatOnSave"))
                    return;
                if (mode === "javascript" && !settings.getBool("project/javascript/@use_jsbeautify"))
                    return;
                if (mode !== "javascript" && !settings.getBool("project/format/jsbeautify/@formatOnSave"))
                    return;
                format.formatCode(null, e.tab.editor);
            }, plugin);
        }
        
        /***** Methods *****/
        
        function formatEditor(editor, mode, all) {
            if (this.disabled === true)
                return;
            if (mode === "javascript" && !settings.getBool("project/javascript/@use_jsbeautify"))
                return;
    
            var ace = editor.ace;
            var sel = ace.selection;
            var session = ace.session;
            var range = sel.getRange();
            var keepSelection = false;
            
            if (range.isEmpty() || all) {
                range = new Range(0, 0, session.getLength(), 0);
                keepSelection = true;
            }
            
            // Load up current settings data
            var options = getOptions(null, true);
            
            if (session.getUseSoftTabs()) {
                options.indent_char = " ";
                options.indent_size = session.getTabSize();
            } else {
                options.indent_char = "\t";
                options.indent_size = 1;
            }
    
            var line = session.getLine(range.start.row);
            var indent = line.match(/^\s*/)[0];
            var trim = false;
    
            if (range.start.column < indent.length)
                range.start.column = 0;
            else
                trim = true;
    
            var value = session.getTextRange(range);
            var type = getType(mode, value, options);
    
            try {
                value = jsbeautify[type + "_beautify"](value, options);
                if (trim)
                    value = value.replace(/^/gm, indent).trim();
                if (range.end.column === 0)
                    value += "\n" + indent;
            }
            catch (e) {
                return false;
            }
    
            var end = session.diffAndReplace(range, value);
            if (!keepSelection)
                sel.setSelectionRange(Range.fromPoints(range.start, end));
            
            return true;
        }
        
        function formatString(mode, value, options) {
            options = getOptions(options);
            var type = getType(mode, value, options);
            return jsbeautify[type + "_beautify"](value, options);
        }
        
        function getOptions(options, allowAdvanced) {
            if (!options) options = {};
            
            if (!options.hasOwnProperty("space_before_conditional"))
                options.space_before_conditional = 
                    settings.getBool("project/format/jsbeautify/@space_before_conditional");
            if (!options.hasOwnProperty("keep_array_indentation"))
                options.keep_array_indentation = 
                    settings.getBool("project/format/jsbeautify/@keeparrayindentation");
            if (!options.hasOwnProperty("preserve_newlines"))
                options.preserve_newlines = 
                    settings.getBool("project/format/jsbeautify/@preserveempty");
            if (!options.hasOwnProperty("unescape_strings"))
                options.unescape_strings = 
                    settings.getBool("project/format/jsbeautify/@unescape_strings");
            if (!options.hasOwnProperty("jslint_happy"))
                options.jslint_happy = 
                    settings.getBool("project/format/jsbeautify/@jslinthappy");
            if (!options.hasOwnProperty("brace_style")) {
                options.brace_style = 
                    settings.get("project/format/jsbeautify/@braces") + 
                    (settings.get("project/format/jsbeautify/@preserve-inline") ? ",preserve-inline" : "");
            }
            if (!options.hasOwnProperty("indent_inner_html"))
                options.indent_inner_html = 
                    settings.get("project/format/jsbeautify/@indent_inner_html");
            if (!options.hasOwnProperty("e4x"))
                options.e4x = true;
            
            if (allowAdvanced) {
                var json = settings.get("project/format/jsbeautify/@advanced");
                if (json && typeof json == "object")
                    util.extend(options, json);
            }
            
            if (!options.indent_char)
                options.indent_char = " ";
            if (!options.indent_size)
                options.indent_size = 4;
                
            return options;
        }
        
        function getType(mode, value, options) {
            var type = null;
    
            if (mode == "javascript" || mode == "json" || mode == "jsx") {
                type = "js";
            } else if (mode == "css" || mode == "less" || mode == "scss") {
                type = "css";
            } else if (/^\s*<!?\w/.test(value)) {
                type = "html";
            } else if (mode == "xml") {
                type = "html";
            } else if (mode == "html_ruby") {
                type = "html";
            } else if (mode == "html" || mode == "xhtml"
                       || mode === "plugins/salesforce.language/modes/visualforce"
                       || mode === "plugins/salesforce.language/modes/lightning") {
                if (/[^<]+?{[\s\-\w]+:[^}]+;/.test(value))
                    type = "css";
                else if (/<\w+[ \/>]/.test(value))
                    type = "html";
                else
                    type = "js";
            } else if (mode == "handlebars") {
                if (options) options.indent_handlebars = true;
                type = "html";
            }
            
            return type;
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
         * Beautify extension for the Cloud9 client
         *
         * Reformats the selected code in the current document
         * Processing/formatting code from https://github.com/einars/js-beautify
         */
        plugin.freezePublicAPI({
            /**
             * 
             */
            formatEditor: formatEditor,
            
            /**
             * 
             */
            formatString: formatString,
        });
        
        register(null, {
            "format.jsbeautify": plugin
        });
    }
});
