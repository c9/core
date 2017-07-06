/**
 * Cloud9 Language Foundation
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "tabManager", "ace", "language",
        "language.complete", "language.tooltip"
    ];
    main.provides = ["language.keyhandler"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var language = imports.language;
        var complete = imports["language.complete"];
        var tooltip = imports["language.tooltip"];
        var complete_util = require("plugins/c9.ide.language/complete_util");
        var DEFAULT_ID_REGEX = complete_util.DEFAULT_ID_REGEX;
        var ace;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        //var emit = plugin.getEmitter();
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            language.on("attachToEditor", function addBinding(ace) {
                var kb = ace.keyBinding;
                var defaultCommandHandler = kb.onCommandKey.bind(kb);
                kb.onCommandKey = composeHandlers(onCommandKey, defaultCommandHandler, ace);
                ace.commands.on("afterExec", onAfterExec, true);
            });
            complete.on("replaceText", function(e) {
                onTextInput(e.newText, false, true);
            });
        }
        
        /***** Methods *****/
        
        function onAfterExec(e) {
            if (e.command.name === "insertstring") {
                ace = e.editor;
                onTextInput(e.args);
            } else if (e.command.name === "backspace") {
                ace = e.editor;
                if (language.isContinuousCompletionEnabled())
                    onBackspace(e);
            }
        }
        
        function composeHandlers(mainHandler, fallbackHandler, myAce) {
            return function onKeyPress() {
                ace = myAce;
                
                var result = mainHandler.apply(null, arguments);
                if (!result)
                    fallbackHandler.apply(null, arguments);
            };
        }
        
        function onTextInput(text, pasted, completed) {
            inputTriggerTooltip(text, pasted);
            if (completed)
                return false;
            if (complete.isPopupVisible())
                return false;
            if (language.isContinuousCompletionEnabled())
                typeAlongCompleteTextInput(text, pasted);
            else
                inputTriggerComplete(text, pasted);
            return false;
        }
        
        function onCommandKey(e) {
            if (e.keyCode == 27) // Esc
                tooltip.hide();
        }
        
        function onBackspace(e) {
            if (complete.isPopupVisible())
                return false;
            var pos = ace.getCursorPosition();
            var line = ace.session.doc.getLine(pos.row);
            if (inCommentToken(pos))
                return false;
            if (!complete_util.precededByIdentifier(line, pos.column, null, ace) && !inTextToken(pos))
                return false;
            if (complete.getCompletionRegex(null, ace))
                complete.deferredInvoke(false, ace, true);
        }
        
        function inputTriggerComplete(text, pasted) {
            var pos = ace.getCursorPosition();
            var completionRegex = complete.getCompletionRegex(null, ace);
            var idRegex = complete.getIdentifierRegex(null, ace);
            if (!pasted && completionRegex && text.match(completionRegex) && !inCommentToken(pos))
                handleChar(text, idRegex, completionRegex); 
        }
        
        function inputTriggerTooltip(text, pasted) {
            var tooltipRegex = tooltip.getTooltipRegex(null, ace);
            if (!pasted && tooltipRegex && text.match(tooltipRegex))
                language.onCursorChange(null, null, true);
        }
        
        function typeAlongCompleteTextInput(text, pasted) {
            var completionRegex = complete.getCompletionRegex(null, ace);
            var idRegex = complete.getIdentifierRegex(null, ace);
            if (pasted)
                return false;
            handleChar(text, idRegex, completionRegex); 
        }
        
        function inTextToken(pos) {
            var token = ace.getSession().getTokenAt(pos.row, pos.column - 1);
            return token && token.type && token.type === "text";
        }
        
        function inCommentToken(pos) {
            var token = ace.getSession().getTokenAt(pos.row, pos.column - 1);
            return token && token.type && token.type.indexOf("comment") === 0;
        }
        
        function handleChar(ch, idRegex, completionRegex) {
            var pos = ace.getCursorPosition();
            if (inCommentToken(pos))
                return;
                
            var line = ace.getSession().getDocument().getLine(pos.row);
            var matchIdRegex = ch.match(idRegex || DEFAULT_ID_REGEX);
            
            if (matchIdRegex || complete.matchCompletionRegex(completionRegex, line, pos)) { 
                if (!complete_util.precededByIdentifier(line, pos.column, ch, ace))
                    return false;
                complete.deferredInvoke(true, ace);
            }
            else if (ch === '"' || ch === "'") {
                // TODO: move this special handing into infer_completer's getCompletionRegex
                if (complete_util.isRequireJSCall(line, pos.column, "", ace, true))
                    complete.deferredInvoke(true, ace);
            }
            else {
                // No useful character was pressed, but maybe we can
                // predict what the user wants to complete next?
                setTimeout(complete.invoke.bind(complete, { predictOnly: true }));
            }
        }
        
        function setSkipInput(input) {
            // TODO: skip characters in input
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
         */
        plugin.freezePublicAPI({
            /**
             * 
             */
            composeHandlers: composeHandlers,
            
            /**
             * Set text to skip when typed in.
             * Used when automatically inserting text, but tolerating
             * users also typing it, e.g. when inserting a closing }.
             * 
             * @ignore not implemented
             * 
             * @param {String} input
             */
            setSkipInput: setSkipInput
        });
        
        register(null, {
            "language.keyhandler": plugin
        });
    }
});
