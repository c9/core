/*
 * Cloud9 Language Foundation
 *
 * @copyright 2013, Ajax.org B.V.
 */
 
/**
 * This module is used as a base class for language handlers.
 * It provides properties, helper functions, and functions that
 * can be overridden by language handlers to implement
 * language services such as code completion.
 * 
 * @class language.base_handler
 */
define(function(require, exports, module) {

module.exports = {
    
    /**
     * Indicates the handler handles editors, the immediate window,
     * and anything else.
     */
    HANDLES_ANY: 0,
    
    /**
     * Indicates the handler only handles editors, not the immediate window.
     */
    HANDLES_EDITOR: 1,
    
    /**
     * Indicates the handler only handles the immediate window, not editors.
     */
    HANDLES_IMMEDIATE: 2,
    
    /**
     * Indicates the handler only handles the immediate window, not editors.
     */
    HANDLES_EDITOR_AND_IMMEDIATE: 3,
    
    /**
     * The language this worker is currently operating on.
     * @type {String}
     */
    language: null,
    
    /**
     * The path of the file this worker is currently operating on.
     * @type {String}
     */
    path: null,
    
    /**
     * The current workspace directory.
     * @type {String}
     */
    workspaceDir: null,
    
    /**
     * The current document this worker is operating on.
     * 
     * @type {Document}
     */
    doc: null,
    
    /**
     * Indicates this completer cannot complete zero-length identifiers.
     * @internal
     */
    $disableZeroLengthCompletion: false,
    
    /**
     * An identifier length at which completions should be recomputed.
     * @internal
     */
    $recacheCompletionLength: null,

    // UTILITIES

    /**
     * Utility function, used to determine whether a certain feature is enabled
     * in the user's preferences.
     * 
     * Should not be overridden by inheritors.
     * 
     * @deprecated Use worker_util#isFeatureEnabled instead
     * 
     * @param {String} name  The name of the feature, e.g. "unusedFunctionArgs"
     * @return {Boolean}
     */
    isFeatureEnabled: function(name) {
        /*global disabledFeatures*/
        return !disabledFeatures[name];
    },
    
    /**
     * Utility function, used to determine the identifier regex for the 
     * current language, by invoking {@link #getIdentifierRegex} on its handlers.
     * 
     * Should not be overridden by inheritors.
     * 
     * @deprecated Use worker_util#getIdentifierRegex instead
     * 
     * @return {RegExp}
     */
    $getIdentifierRegex: function() {
        return null;
    },
    
    /**
     * Get an event emitter for emitting and receiving
     * UI events.
     * 
     * Example:
     * 
     * ```
     * worker_util.getEmitter().emit("log", "Hello there")
     * ```
     * 
     * which can be received by a UI plugin using:
     * 
     * ```
     * language.registerLanguageHandler("myplugin", function(err, handler) {
     *     if (err) return console.error(err);
     * 
     *     handler.on("log", function(e) {
     *         console.log(e);
     *     });
     * });
     * ```
     * 
     * @param {String} [overridePath] An optional path of the plugin for which to send/receive UI events,
     *                                e.g. "c9.ide.language.python/worker/python_completer" to send/receive
     *                                events in name of the Python completer plugin.
     */
    getEmitter: function(overridePath) {
        // implemented by worker
        throw new Error("getEmitter() is not available yet, please call after init()");
    },
    
    // OVERRIDABLE ACCESORS

    /**
     * Returns whether this language handler should be enabled for the given
     * file.
     * 
     * MUST be overridden by inheritors.
     * 
     * @param {String} language   to check the handler against
     * @return {Boolean}
     */
    handlesLanguage: function(language) {
        throw new Error("base_handler.handlesLanguage() is not overridden");
    },

    /**
     * Returns whether this language handler should be used in a
     * particular kind of editor.
     * 
     * MAY be overridden by inheritors; returns {@link #HANDLES_EDITOR}
     * by default.
     * 
     * @return {Number} One of {@link #HANDLES_EDITOR},
     *                  {@link #HANDLES_IMMEDIATE}, or
     *                  {@link #HANDLES_EDITOR_AND_IMMEDIATE}, or
     *                  {@link #HANDLES_ANY}.
     */
    handlesEditor: function() {
        return this.HANDLES_EDITOR;
    },
    
    /**
     * Returns the maximum file size this language handler supports.
     * Should return Infinity if size does not matter.
     * Default is 10.000 lines of 80 characters.
     * 
     * MAY be overridden by inheritors.
     * 
     * @return {Number}
     */
    getMaxFileSizeSupported: function() {
        // Moderately conservative default (well, still 800K)
        return 10 * 1000 * 80;
    },

    /**
     * Returns a regular expression for identifiers in the handler's language.
     * If not specified, /[A-Za-z0-9$_]/ is used.
     * 
     * Note: to indicate dollars are allowed at the start of identifiers
     * (like with php $variables), include '$$'' in the regex, e.g.
     * /[A-Z0-9$$_]/.
     *
     * SHOULD be overridden by inheritors that implement code completion.
     * 
     * @return RegExp
     */
    getIdentifierRegex: function() {
        return null;
    },
    
    /**
     * Returns a regular expression used to trigger code completion.
     * If a non-null value is returned, it is assumed continous completion
     * is supported for this language.
     * 
     * This regex may match the last character, e.g. for Java-like O.O. languages
     * you might might want to use: /^\.$/
     * 
     * The regex may also match the whole preceding line, e.g.
     * /console\.$/. Only when the regex ends with a $ will it be tried
     * as a regex that matches against the whole line.
     * 
     * SHOULD be overridden by inheritors that implement code completion.
     * Default implementation returns null.
     * 
     * @return RegExp
     */
    getCompletionRegex: function() {
        return null;
    },

    /**
     * Returns a regular expression used to trigger a tooltip.
     * Normally, tooltips after a scheduled analysis has been completed.
     * To avoid delays, this function can be used to trigger
     * analysis & tooltip fetching early.
     * 
     * SHOULD be overridden by inheritors that implement tooltips.
     * Default implementation returns null.
     * 
     * @return RegExp
     */
    getTooltipRegex: function() {
        return null;
    },
    
    /**
     * Extends the default caching strategy for code completion.
     * Implementors should return a regular expression used to determine if
     * whether completions can be cached. If the prefix of the current line
     * matches this regular expression, this tells the completion engine that it
     * is allowed to reuse any completions cached at the start of this prefix.
     * Without this, caching also performed but only based on
     * {@link #getIdentifierRegex()}.
     * 
     * As an example, consider a scenario where the user just typed
     * 
     * ```
     * if (i
     * ```
     * 
     * If completion proposals were suggested at the start of the line,
     * and the complretion cache regex matches "if (", then Cloud9 will
     * use those completions rather than recompute them. With this optimization,
     * it's possible to use caching to such an extent that even for longer
     * statements like `if (foo === bar`, completions only need to be computed
     * once.
     * 
     * Warning: this is an expert feature that helps optimize the caching
     * strategy of the code completion engine. Implemented incorrectly, it can
     * make completions appear in places they shouldn't or may cause completions
     * to go missing.
     * 
     * 
     * 
     * Example implementation for JavaScript:
     * 
     * ```
     * completer.getCacheCompletionRegex = function() {
     *     // Match strings that can be an expression or its prefix
     *     return new RegExp(
     *         // 'if/while/for ('
     *         "(\\b(if|while|for|switch)\\s*\\("
     *         // other identifiers and keywords without (
     *         + "|\\b\\w+\\s+"
     *         // equality operators, operators such as + and -,
     *         // and opening brackets { and [
     *         + "|(==|!=|[-+]=|[-+*%<>?!|&{[])"
     *         // spaces
     *         + "|\\s)+"
     *     );
     * };
     * ```
     * 
     * which matches strings such as "if (", "while (", and "x + ".
     * 
     * MAY be overridden by inheritors that implement code completion.
     * 
     * @return RegExp
     */
    getCacheCompletionRegex: function() {
        return null;
    },

    // PARSING AND ABSTRACT SYNTAX CALLBACKS

    /**
     * Parses the given document.
     * 
     * SHOULD be overridden by inheritors that implement parsing
     * (which is, like all features here, optional).
     * 
     * @param {String} docValue   the source the document to analyze
     * @param {Object} options    options
     * @return {Object}           an abstract syntax tree (of any type), or null if not implemented
     */
    parse: function(docValue, options, callback) {
        callback();
    },

    /**
     * Finds a tree node at a certain row and column,
     * e.g. using the findNode(pos) function of treehugger.
     * 
     * SHOULD be overridden by inheritors that implement parsing.
     * 
     * @param {Object} ast                An abstract syntax tree object from {@link #parse}
     * @param {Object} pos                The position of the node to look up
     * @param {Number} pos.row            The position's row
     * @param {Number} pos.column         The position's column
     * @param {Function} callback         The callback for the result
     * @param {Error|String} callback.err Any resulting error
     * @param {Object} [callback.result]  The found node
     */
    findNode: function(ast, pos, callback) {
        callback();
    },

    /**
     * Returns the  a tree node at a certain row and col,
     * e.g. using the node.getPos() function of treehugger.
     * 
     * SHOULD be overridden by inheritors that implement parsing.
     * 
     * @param {Object} node                The node to look up
     * @param {Function} callback          The callback for the result
     * @param {Error|String} callback.err  Any resulting error
     * @param {Object} [callback.result]   The resulting position
     * @param {Number} callback.result.sl  The starting line
     * @param {Number} callback.result.el  The ending line
     * @param {Number} callback.result.sc  The starting column
     * @param {Number} callback.result.ec  The ending column
     */
    getPos: function(node, callback) {
        callback();
    },

    // OTHER CALLBACKS

    /**
     * Initialize this language handler.
     * 
     * MAY be overridden by inheritors.
     * 
     * @param callback            The callback; must be called
     */
    init: function(callback) {
        callback();
    },

    /**
     * Invoked when the document has been updated (possibly after a certain delay)
     * 
     * MAY be overridden by inheritors.
     * 
     * @param {Document} doc  The current document
     * @param {Function} callback            The callback; must be called
     */
    onUpdate: function(doc, callback) {
        callback();
    },

    /**
     * Invoked when a new document has been opened.
     * 
     * MAY be overridden by inheritors.
     * 
     * @param {String} path        The path of the newly opened document
     * @param {String} doc         The Document object representing the source
     * @param {String} oldPath     The path of the document that was active before
     * @param {Function} callback  The callback; must be called
     */
    onDocumentOpen: function(path, doc, oldPath, callback) {
        callback();
    },

    /**
     * Invoked when a document is closed in the IDE.
     * 
     * MAY be overridden by inheritors.
     * 
     * @param {String} path the path of the file
     * @param {Function} callback  The callback; must be called
     */
    onDocumentClose: function(path, callback) {
        callback();
    },

    /**
     * Invoked when the cursor has been moved.
     * 
     * MAY be overridden by inheritors that immediately act upon cursor moves.
     * 
     * See {@link #tooltip} and {@link #highlightOccurrences}
     * for handler functions that are invoked after the cursor has been moved,
     * the document has been analyzed, and feedback is requested.
     * 
     * @param {Document} doc                      Document object representing the source
     * @param {Object} ast                        The entire AST of the current file (if parsed already, otherwise null)
     * @param {Object} cursorPos                  The current cursor position
     * @param {Number} cursorPos.row              The current cursor's row
     * @param {Number} cursorPos.column           The current cursor's column
     * @param {Object} options                    Options
     * @param {String} options.path               The current file path.
     * @param {Object} options.node               The current AST node (if parse() is implemented and if parsed already, otherwise null)
     * @param {Function} callback                 The callback; must be called
     * @param {Error|String} callback.err         Any resulting error
     * @paran {Object} callback.result            An optional result. Supports the same result objects as
     *                                            {@link #tooltip} and {@link #highlightOccurrences}
     */
    onCursorMove: function(doc, ast, cursorPos, options, callback) {
        callback();
    },
    
    /**
     * Invoked when the cursor has been moved inside to a different AST node.
     * Gets a tooltip to display when the cursor is moved to a particular location.
     * 
     * SHOULD be overridden by inheritors that implement tooltips.
     * 
     * See {@link #getTooltipRegex} for setting a regular expression to trigger
     * tooltips early.
     * 
     * @param {Document} doc                               Document object representing the source
     * @param {Object} ast                                 The entire AST of the current file (if any)
     * @param {Object} cursorPos                           The current cursor position
     * @param {Number} cursorPos.row                       The current cursor's row
     * @param {Number} cursorPos.column                    The current cursor's column
     * @param {Object} options                             Options
     * @param {String} options.path                        The current file path.
     * @param {Object} options.node                        The current AST node (if parse() is implemented) 
     * @param {Function} callback                          The callback; must be called
     * @param {Error|String} callback.err                  Any resulting error
     * @param {Object} callback.result                     The function's result
     * @param {Object|String} callback.result.hint         An object or HTML string with the tooltip to display
     * @param {Object[]} [callback.result.signatures]      One or more function signatures to show
     * @param {String} callback.result.signatures.name     Function name
     * @param {String} [callback.result.signatures.doc]    Function documentation, as text
     * @param {String} [callback.result.signatures.docHtml]
     *                                                     Function documentation, as HTML
     * @param {Object[]} callback.result.signatures.parameters
     *                                                     Function parameters
     * @param {String} callback.result.signatures.parameters.name
     *                                                     Parameter name
     * @param {String} [callback.result.signatures.parameters.type]
     *                                                     Parameter type
     * @param {String} [callback.result.signatures.parameters.doc]
     *                                                     Parameter documentation, as text
     * @param {String} [callback.result.signatures.parameters.docHtml]
     *                                                     Parameter documentation, as HTML
     * @param {String} [callback.result.signatures.returnType]
     *                                                     The function return type
     * @param {Object} callback.result.pos                 The position range for which this tooltip is valid
     * @param {Number} callback.result.pos.sl              The starting line
     * @param {Number} callback.result.pos.el              The ending line
     * @param {Number} callback.result.pos.sc              The starting column
     * @param {Number} callback.result.pos.ec              The ending column
     * @param {Object} [callback.result.displayPos]        The position to display this tooltip
     * @param {Number} [callback.result.displayPos.row]    The display position's row
     * @param {Number} [callback.result.displayPos.column] The display position's column
     */
    tooltip: function(doc, ast, cursorPos, options, callback) {
        callback();
    },
    
    /**
     * Gets the instances to highlight when the cursor is moved to a particular location.
     * 
     * SHOULD be overridden by inheritors that implement occurrence highlighting.
     * 
     * @param {Document} doc                           Document object representing the source
     * @param {Object} ast                             The entire AST of the current file (if any)
     * @param {Object} cursorPos                       The current cursor position
     * @param {Number} cursorPos.row                   The current cursor's row
     * @param {Number} cursorPos.column                The current cursor's column
     * @param {Object} options                         Options
     * @param {String} options.path                    The current file path.
     * @param {Object} options.node                    The current AST node (if parse() is implemented) 
     * @param {Function} callback                      The callback; must be called
     * @param {Error|String} callback.err              Any resulting error
     * @param {Object} callback.result                 The function's result
     * @param {Object[]} [callback.result.markers]     The occurrences to highlight
     * @param {Object} callback.result.markers.pos     The marker's position
     * @param {Number} callback.result.markers.pos.sl  The starting line
     * @param {Number} callback.result.markers.pos.el  The ending line
     * @param {Number} callback.result.markers.pos.sc  The starting column
     * @param {Number} callback.result.markers.pos.ec  The ending column
     * @param {Boolean} callback.result.isGeneric      Indicates this is generic highlighting and should be deferred
     * @param {"occurrence_other"|"occurrence_main"} callback.result.markers.type
     *                                                 The type of occurrence: the main one, or any other one.
     */
    highlightOccurrences: function(doc, ast, cursorPos, options, callback) {
        callback();
    },
    
    /**
     * Determines what refactorings to enable when the cursor is moved to a particular location.
     * 
     * SHOULD be overridden by inheritors that implement refactorings.
     * 
     * @param {Document} doc                 Document object representing the source
     * @param {Object} ast                   The entire AST of the current file (if any)
     * @param {Object} cursorPos             The current cursor position
     * @param {Number} cursorPos.row         The current cursor's row
     * @param {Number} cursorPos.column      The current cursor's column
     * @param {Object} options               Options
     * @param {String} options.path          The current file path.
     * @param {Object} options.node          The current AST node (if parse() is implemented) 
     * @param {Function} callback            The callback; must be called
     * @param {Error|String} callback.err    Any resulting error
     * @param {Object} callback.result       The function's result
     * @param {String[]} callback.result.refactorings
     *                                       The refactorings to enable, such as "rename"
     * @param {String[]} [callback.result.isGeneric]
     *                                       Whether is a generic answer and should be deferred
     */
    getRefactorings: function(doc, ast, cursorPos, options, callback) {
        callback();
    },

    /**
     * Constructs an outline.
     * 
     * Example outline object:
     * 
     *     {
     *          icon: 'method',
     *          name: "fooMethod",
     *          pos: this.getPos(),
     *          displayPos: { sl: 15, sc: 20 },
     *          items: [ ...items nested under this method... ],
     *          isUnordered: true
     *     }
     * 
     * SHOULD be overridden by inheritors that implement an outline.
     * 
     * @param {Document} doc                           The Document object representing the source
     * @param {Object} ast                             The entire AST of the current file (if any)
     * @param {Function} callback                      The callback; must be called
     * @param {Error|String} callback.err              Any resulting error
     * @param {Object} callback.result                 The function's result, a JSON outline structure or null if not supported
     * @param {"event"|"method"|"method2"|"package"|"property"|"property2"|"unknown"|"unknown2"} callback.result.icon
     *                                                 The icon to display for the first outline item
     * @param {String} callback.result.name            The name to display for the first outline item
     * @param {Object} callback.result.pos             The item's range, e.g. the full visible range of a method
     * @param {Number} callback.result.pos.sl          The item's starting row
     * @param {Number} [callback.result.pos.el]        The item's ending row
     * @param {Number} [callback.result.pos.sc]        The item's starting column
     * @param {Number} [callback.result.pos.ec]        The item's ending column
     * @param {Object} [callback.result.displayPos]    The item's position of the text to select when it's picked from the outline
     * @param {Number} callback.result.displayPos.sl   The item's starting row
     * @param {Number} [callback.result.displayPos.el] The item's ending row
     * @param {Number} [callback.result.displayPos.sc] The item's starting column
     * @param {Number} [callback.result.displayPos.ec] The item's ending column
     * @param {Object[]} callback.result.items         Any items nested under the curent item.
     * @param {Boolean} [callback.result.isGeneric]    Indicates that this is a generic, language-independent outline
     * @param {Boolean} [callback.result.isUnordered]  Indicates the outline is not ordered by appearance of the items,
     *                                                 but that they're e.g. grouped as methods, properties, etc.
     */
    outline: function(doc, ast, callback) {
        callback();
    },

    /**
     * Constructs a hierarchy.
     * 
     * SHOULD be overridden by inheritors that implement a type hierarchy.
     * 
     * @ignore Not supported right now.
     * 
     * @param {Document} doc               The Document object representing the source
     * @param {Object} cursorPos           The current cursor position
     * @param {Number} cursorPos.row       The current cursor's row
     * @param {Number} cursorPos.column    The current cursor's column
     * @param {Function} callback          The callback; must be called
     * @param {Error|String} callback.err  Any resulting error
     * @param {Object} callback.result     A JSON hierarchy structure or null if not supported
     */
    hierarchy: function(doc, cursorPos, callback) {
        callback();
    },

    /**
     * Performs code completion for the user based on the current cursor position.
     * 
     * MUST be overridden by inheritors that implement code completion.
     * 
     * Example completion result:
     * {
     *    name        : "foo()",
     *    replaceText : "foo()",
     *    icon        : "method",
     *    meta        : "FooClass",
     *    doc         : "The foo() method",
     *    docHead     : "FooClass.foo",
     *    priority    : 1
     *  };
     * 
     * See also {@link #getCompletionRegex}.
     * See also {@link #predictNextCompletion}.
     * See also {@link language.worker_util#execAnalysis} for invoking a code
     * completion tool that runs in the workspace.
     * 
     * @param {Document} doc                 The Document object representing the source
     * @param {Object} ast                   The entire AST of the current file (if any)
     * @param {Object} pos                   The current cursor position
     * @param {Number} pos.row               The current cursor's row
     * @param {Number} pos.column            The current cursor's column
     * @param {Object} options               Options
     * @param {String} options.path          The current file path
     * @param {String} options.language      The current language 
     * @param {Object} options.node          The current AST node (if parse() is implemented) 
     * @param {String} options.line          The current line
     * @param {String} options.identifierPrefix
     *                                       The current identifier up to the cursor position
     * @param {Boolean} options.noDoc        Docs are not requested at this time and may
     *                                       be left out as an optimization. Please set `noDoc: true`
     *                                       for any completions where docs are left out so
     *                                       another `complete()` request can be fired to retrieve their docs.
     * @param {Function} callback            The callback; must be called
     * @param {Error|String} callback.err    Any resulting error
     * @param {Object} callback.result       The function's result, an array of completion matches
     * @param {String} [callback.result.replaceText]
     *                                       The text to replace the selection with
     * @param {String} callback.result.name
     *                                       The full name to show in the completion popup
     * @param {String} [callback.result.id]  The short name that identifies this completion
     * @param {"event"|"method"|"method2"|"package"|"property"|"property2"|"unknown"|"unknown2"} [callback.result.icon]
     *                                       The icon to use
     * @param {String} callback.result.meta  Additional information to show
     * @param {String} [callback.result.doc] Documentation to display
     * @param {Boolean} [callback.result.noDoc]
     *                                       Boolean indicating that documentation may be available for
     *                                       this completion but was not included as options.noDoc was
     *                                       set. See options.noDoc.
     * @param {String} [callback.result.docHead]
     *                                       Documentation heading to display
     * @param {Boolean} [callback.result.guessTooltip]
     *                                       Try to guess a tooltip based on this completion.
     * @param {Number} [callback.result.priority]
     *                                       Priority of this completion suggestion
     * @param {Boolean} [callback.result.isGeneric]
     *                                       Indicates that this is a generic, language-independent
     *                                       suggestion
     * @param {Boolean} [callback.result.isContextual]
     *                                       Indicates that this is a contextual completion,
     *                                       and that any generic completions should not be shown
     */
    complete: function(doc, ast, pos, options, callback) {
        callback();
    },

    /**
     * Adds pre-caching or predictions to the code completer,
     * by predicting how to do the next completion after the
     * current one as the user keeps typing.
     *
     * An example implementation for JavaScript returns the current
     * completion plus a dot:
     * 
     * ```
     * handler.predictNextCompletion = function(doc, ast, pos, options, callback) {
     *     // Only predict if we have exactly one available completion
     *     if (options.matches.length !== 1)
     *         return callback();
     *     // Return that completion plus a dot
     *     callback(null, { predicted: predicted[0] + "." });
     * };
     * ```
     * 
     * To understand how the above works, consider the following scenario:
     * 
     * ```
     * var foo = { bar: 2 };
     * fo
     * ```
     * 
     * So we can predict that the current identifier `fo` will expand to `foo`.
     * That means that the next interesting code completion may relate to `foo.`.
     * Predicting this allows us to precompute those completions rather than
     * wait until the user types the next character(s).
     * 
     * For the above scenario, our function is called with the following arguments:
     * 
     * ```
     * predictNextCompletion(doc, ast, pos, {
     *     matches: [{
     *        name: "foo",
     *        replaceText: "foo"
     *     }]
     * })
     * ```
     * 
     * So all our function has to do is return "foo." and we're on
     * our way to predict the future!
     * 
     * Below is a more sophisticated example which filters the current completions
     * before making a prediction:
     * 
     * ```
     * handler.predictNextCompletion = function(doc, ast, pos, options, callback) {
     *     // We look at all current completion proposals, but first filter for
     *     // contextual completions and ignore any keyword predictions
     *     var predicted = options.matches.filter(function(m) {
     *         return m.isContextual && !m.replaceText.match(KEYWORD_REGEX);
     *     });
     *     // Let's predict only if we have exactly one proposal left over to
     *     // make a prediction for (e.g., we know the user is going to type "foo")
     *     if (predicted.length !== 1)
     *         return callback();
     *     // Predict that the current user is going to type this identifier
     *     // followed by a dot (e.g., "foo.")
     *     callback(null, { predicted: predicted[0] + "." });
     * };
     * ```
     * 
     * Use the showEarly property to show the predicted completions immediately
     * to users, e.g. show `this.foo` when the user types `th`. Only
     * completions marked "isContextual" are shown in this fashion.
     * 
     * MAY be overridden by inheritors that implement code completion.
     * 
     * @param {Document} doc                 The Document object representing the source
     * @param {Object} ast                   The entire AST of the current file (if any)
     * @param {Object} pos                   The current cursor position
     * @param {Number} pos.row               The current cursor's row
     * @param {Number} pos.column            The current cursor's column
     * @param {Object} options               Options
     * @param {String} options.path          The current file path.
     * @param {Object} options.node          The most recent completion AST node (if parse() is implemented) 
     * @param {Object} options.matches       The most recent completion matches
     * @param {String} options.path          The current path
     * @param {String} options.language      The current language 
     * @param {String} options.line          The current line
     * @param {String} options.identifierPrefix
     *                                       The current identifier up to the cursor position
     * @param {Function} callback            The callback; must be called
     * @param {Error|String} callback.err    Any resulting error
     * @param {Object} callback.result       The function's result, an array of completion matches
     * @param {String} callback.result.predicted
     *                                       The predicted text for which to try completion
     * @param {Boolean} callback.result.showEarly
     *                                       Show the prediction as part of the completion
     *                                       results immediately (e.g., to show this.foo
     *                                       when the user types 'th')
     */
    predictNextCompletion: function(doc, ast, pos, options, callback) {
        callback();
    },

    /**
     * Analyzes an AST or file and annotates it as desired.
     * 
     * Example of an annotation to return:
     * 
     *     {
     *         pos: { sl: 1, el: 1, sc: 4, ec: 5 },
     *         type: "warning",
     *         message: "Assigning to undeclared variable."
     *     }
     * 
     * SHOULD be overridden by inheritors that implement analysis.
     * 
     * See also {@link language.worker_util#execAnalysis} for invoking a code
     * completion tool that runs in the workspace.
     * 
     * @param {Document} doc                       The Document object representing the source
     * @param {Object} ast                         The entire AST of the current file (if any)
     * @param {Function} callback                  The callback; must be called
     * @param {Error|String} callback.err          Any resulting error
     * @param {Object} options
     * @param {String} options.path                The current file path.
     * @param {Boolean} [options.minimalAnalysis]  Fast, minimal analysis is requested, e.g.
     *                                             for code completion or tooltips.
     * @param {Object[]} callback.result           The function's result, an array of error and warning markers
     * @param {Object} callback.result.pos         The current cursor position
     * @param {Number} callback.result.pos.row     The current cursor's row
     * @param {Number} callback.result.pos.column  The current cursor's column
     * @param {String} callback.result.type        The type of warning, i.e., "error", "warning", or "info"
     * @param {String} callback.result.message     The message of the warning, i.e., "error", "warning", or "info"
     * @param {Boolean} [callback.result.quickfix] Whether there is a quickfix available for this marker
     */
    analyze: function(doc, ast, options, callback) {
        callback();
    },

    /**
     * Gets all positions to select for a rename refactoring.
     * 
     * Example result, renaming a 3-character identfier
     * on line 10 that also occurs on line 11 and 12:
     * 
     *     {
     *         length: 3,
     *         pos: {
     *             row: 10,
     *             column: 5
     *         },
     *         others: [
     *             { row: 11, column: 5 },
     *             { row: 12, column: 5 }
     *         ]
     *     }
     * 
     * MUST be overridden by inheritors that implement rename refactoring.
     * 
     * @param {Document} doc                          The Document object representing the source
     * @param {Object} ast                            The entire AST of the current file (if any)
     * @param {Object} pos                            The current cursor position
     * @param {Number} pos.row                        The current cursor's row
     * @param {Number} pos.column                     The current cursor's column
     * @param {Object} options                        Options
     * @param {String} options.path                   The current file path.
     * @param {Object} options.node                   The current AST node (if parse() is implemented) 
     * @param {Function} callback                     The callback; must be called
     * @param {Error|String} callback.err             Any resulting error
     * @param {Object} callback.result                The function's result (see function description).
     * @param {Boolean} callback.result.isGeneric     Indicates this is a generic refactoring and should be deferred.
     * @param {Boolean} callback.result.length        The lenght of the rename identifier
     * @param {Object} callback.result.pos            The position of the current identifier
     * @param {Number} callback.result.pos.row        The row of the current identifier
     * @param {Number} callback.result.pos.column     The column of the current identifier
     * @param {Object[]} callback.result.others       The positions of other identifiers to be renamed
     * @param {Number} callback.result.others.row     The row of another identifier to be renamed
     * @param {Number} callback.result.others.column  The column of another identifier to be renamed
     */
    getRenamePositions: function(doc, ast, pos, options, callback) {
        callback();
    },

    /**
     * Invoked when refactoring is started.
     * 
     * MAY be overridden by inheritors that implement rename refactoring.
     * 
     * @param {Document} doc                 The Document object representing the source
     * @param {Function} callback            The callback; must be called
     */
    onRenameBegin: function(doc, callback) {
        callback();
    },

    /**
     * Confirms that a rename refactoring is valid, before committing it.
     * 
     * MAY be overridden by inheritors that implement rename refactoring.
     * 
     * @param {Document} doc                 The Document object representing the source
     * @param {Object} oldId                 The old identifier was being renamed
     * @param {Number} oldId.row             The row of the identifier that was being renamed
     * @param {Number} oldId.column          The column of the identifier that was being renamed
     * @param {String} oldId.value           The value of the identifier that was being renamed
     * @param {String} newName               The new name of the element after refactoring
     * @param {Boolean} isGeneric            True if this was a refactoring marked with 'isGeneric' (see {@link #getRenamePositions})
     * @param {Function} callback            The callback; must be called
     * @param {Error|String} callback.err    Null if the refactoring can be committed, or an error message if refactoring failed
     */
    commitRename: function(doc, oldName, newName, isGeneric, callback) {
        callback();
    },

    /**
     * Invoked when a refactor request is cancelled
     * 
     * MAY be overridden by inheritors that implement rename refactoring.
     * 
     * @param {Function} callback            The callback; must be called
     */
    onRenameCancel: function(callback) {
        callback();
    },

    /**
     * Performs code formatting.
     * 
     * MUST be overridden by inheritors that implement code formatting.
     * 
     * @param {Document} doc the Document object representing the source
     * @param {Function} callback            The callback; must be called
     * @param {Error|String} callback.err    Any resulting error
     * @param {String} callback.result       The source code after formatting
     */
    codeFormat: function(doc, callback) {
        callback();
    },

    /**
     * Performs jumping to a definition.
     * 
     * MUST be overridden by inheritors that implement jump to definition.
     * 
     * @param {Document} doc                 The Document object representing the source
     * @param {Object} ast                   The entire AST of the current file (if any)
     * @param {Object} pos                   The current cursor position
     * @param {Number} pos.row               The current cursor's row
     * @param {Number} pos.column            The current cursor's column
     * @param {Object} options               Options
     * @param {String} options.path          The current file path.
     * @param {Object} options.node          The current AST node (if parse() is implemented) 
     * @param {String} options.language      The current language 
     * @param {Function} callback            The callback; must be called
     * @param {Error|String} callback.err    Any resulting error
     * @param {Object[]} callback.results    The results
     * @param {String} [callback.results.path]
     *                                       The result path
     * @param {Number} [callback.results.row]
     *                                       The result row
     * @param {Number} [callback.results.column]
     *                                       The result column
     * @param {"event"|"method"|"method2"|"package"|"property"|"property2"|"unknown"|"unknown2"} [callback.results.icon] 
     *                                       The icon to display (in case of multiple results)
     * @param {Boolean} [callback.results.isGeneric]
     *                                       Indicates that this is a generic, language-independent
     *                                       suggestion (that should be deferred)
     */
    jumpToDefinition: function(doc, ast, pos, options, callback) {
        callback();
    },
    
    /**
     * Gets quickfixes for a position (also referred to "quick assists" when
     * there is no error).
     * 
     * Note that there is currently no UI for this feature,
     * we just have a keyboard shortcut.
     * 
     * MUST be overridden by inheritors that implement quickfixes.
     * 
     * Example result:
     * 
     * ```
     * var Range = new require("ace/range").Range;
     * var result = {
     *     message: "Insert missing semicolon",
     *     image: "semicolon.png",
     *     preview: ";",
     *     deltas: [{
     *         action: "insert",
     *         start: { row: row, column: column },
     *         end: { row: row, column: column },
     *         lines: [";"]
     *     }],
     *     pos: { row: row, column: column + 1 }
     * };
     * ```
     * 
     * @param {Document} doc                          The Document object representing the source
     * @param {Object} ast                            The entire AST of the current file (if any)
     * @param {Object} pos                            The current cursor position
     * @param {Number} pos.row                        The current cursor's row
     * @param {Number} pos.column                     The current cursor's column
     * @param {Function} callback                     The callback; must be called
     * @param {Error|String} callback.err             Any resulting error
     * @param {Object[]} callback.result              The function's result
     * @param {String} [callback.result.message]      Short description, to be displayed in the list of resolutions, as text
     * @param {String} [callback.result.messageHtml]  Short description, to be displayed in the list of resolutions, as HTML
     * @param {String} [callback.result.image]        Image to be displayed in the list of resolutions
     * @param {String} [callback.result.preview]
     * @param {String} [callback.result.previewHtml]
     * @param {Object[]} callback.result.deltas       An array of Ace delta objects
     * @param {String} callback.result.deltas.action  The action, i.e. insert or remove.
     * @param {Object} callback.result.deltas.start.row
     * @param {Object} callback.result.deltas.start.column
     * @param {Object} callback.result.deltas.end.row
     * @param {Object} callback.result.deltas.end.column
     * @param {String} [callback.result.deltas.path]  The file path to apply this delta to
     * @param {String[]} [callback.result.deltas.lines]
     * @param {Object} [callback.result.pos]          The position where the cursor should be after applying
     */
    getQuickfixes: function(doc, ast, pos, options, callback) {
        callback();
    },
    
    /** 
     * Given the cursor position and the parsed node at that position,
     * gets the string to send to the debugger for live inspect hovering.
     * 
     * SHOULD be overridden by inheritors that implement a debugger
     * with live inspect. If not implemented, the string value based on
     * options's position is used.
     * 
     * @param {Document} doc                    The Document object representing the source
     * @param {Object} ast                      The entire AST of the current file (if any)
     * @param {Object} pos                      The current cursor position
     * @param {Number} pos.row                  The current cursor's row
     * @param {Number} pos.column               The current cursor's column
     * @param {Function} callback               The callback; must be called
     * @param {Error|String} callback.err       Any resulting error
     * @param {Object} callback.result          The resulting expression
     * @param {String} callback.result.value    The string representation of the expression to inspect
     * @param {Object} callback.result.pos      The expression's position
     * @param {Number} callback.result.pos.sl   The expression's starting row
     * @param {Number} callback.result.pos.el   The expression's ending row
     * @param {Number} callback.result.pos.sc   The expression's starting column
     * @param {Number} callback.result.pos.ec   The expression's ending column
     */
    getInspectExpression: function(doc, ast, pos, options, callback) {
        callback();
    }
};

// Mark all abstract/builtin methods for later optimization
for (var f in module.exports) {
    if (typeof module.exports[f] === "function")
        module.exports[f].base_handler = true;
}

});
