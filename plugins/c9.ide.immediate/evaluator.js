define(function(require, module, exports) {
    main.consumes = ["Plugin", "immediate"];
    main.provides = ["Evaluator"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var immediate = imports.immediate;
        
        function Evaluator(developer, deps, options) {
            var plugin = new Plugin(developer, deps);
            var emit = plugin.getEmitter();
            emit.setMaxListeners(1000);
            
            var caption = options.caption;
            var id = options.id;
            var mode = options.mode;
            var message = options.message;
            
            /***** Methods *****/
            
            function evaluate(expression, cell, cb) {
                return emit("evaluate", {
                    expression: expression,
                    cell: cell,
                    callback: cb
                });
            }
            
            function canEvaluate(expression) {
                return emit("canEvaluate", {
                    expression: expression
                });
            }
            
            function draw(parent) {
                return emit("draw", {
                    aml: parent,
                    html: parent.$int
                });
            }
            
            /***** Lifecycle *****/
        
            plugin.on("load", function() {
                immediate.addEvaluator(caption, id, plugin, plugin);
            });
            plugin.on("enable", function() {
                
            });
            plugin.on("disable", function() {
                
            });
            plugin.on("unload", function() {
                immediate.removeEvaluator(id);
            });
            
            /***** Register and define API *****/
            
            plugin.freezePublicAPI.baseclass();
            
            /**
             * A cell in the immediate REPL. Each section in which a user can write
             * a (multi-line) expression is called a cell. A cell can have one
             * or more 'widgets' that display HTML or plain text, which are usually
             * the result of executing the expression.
             * 
             * @class immediate.Cell
             * @extends Object
             */
            /**
             * The ace session that the cell belongs to.
             * @property {ace.Session} session
             * @readonly
             */
            /**
             * Adds an HTML based widget to the cell. Note that the cell height is
             * always N x the line height of ace.
             * 
             * @method addWidget
             * @param {Object}      options
             * @param {String}      [options.html]         An html string that is inserted as the widget of this cell.
             * @param {HTMLElement} [options.el]           A reference to an html element that will be appended to this cell as it's widget.
             * @param {Boolean}     [options.coverLine]    Specifies whether the widget should cover the line before it.
             * @param {Boolean}     [options.coverGutter]  Specifies whether the widget should draw over the gutter.
             * @param {Number}      [options.pixelHeight]  The height of the widget in pixels.
             * @param {Number}      [options.rowCount]     The height of the widget in number of rows.
             * @param {Number}      [options.row]          The row at which to insert the widget, defaults to the row after the cell.
             * @param {Boolean}     [options.fixedWidth]   Whether the widget has a fixed width.
             */
            /**
             * Adds a string as plain text to the cell
             * @method insert
             * @param {Object} [pos]         The position to insert the text at.
             * @param {Number} [pos.column]  The column (0 based)
             * @param {Number} [pos.row]     The row (0 based)
             * @param {String} text          The value to insert
             */
            /**
             * Toggle the visibility of the loading indicator of the cell.
             * @method setWaiting
             * @param {Boolean}  Turns the loading indicator in the gutter of the 
             *   cell on/off.
             */
            /**
             * Set the contents of this cell. This method removes any widget that is
             * attache to this cell.
             * @method setValue
             * @param {String} value      The new value of this cell.
             * @param {1/-1}   selection  Where to place the cursor. `1` for the 
             *   end of the contents and `-1` for the beginning.
             */
            /**
             * Retrieve the contents of this cell.
             * @method getValue
             * @return {String}
             */
            /**
             * Retrieve a range object poining to the contents of this cell.
             * @method getRange
             * @return {ace.Range}
             */
            /**
             * Remove the widget from this cell
             * @method removeWidget
             */
            /**
             * Remove this cell from the session.
             * @method remove
             */
            /**
             * Evaluates expressions from the {@link immediate immediate pane} REPL.
             * 
             * This documentation doesn't describe an implementation, instead these
             * docs provide you a guide on how to write your own evaluator.
             * 
             * The following example shows a simple evaluator that evaluates
             * javascript in an iframe:
             * 
             *     var evaluator = {
             *         mode        : "ace/mode/javascript",
             *         message     : "",
             *         canEvaluate : function(str) { return str.trim() ? true : false; },
             *         evaluate    : function(expression, cell, done) {
             * 
             *             var win = iframe.contentWindow;
             *             win.eval("try{window.result = " + expression 
             *                 + "}catch(e){window.result = e}");
             *             
             *             var result = JSON.serialize(win.result);
             *             cell.addWidget({ 
             *                 html       : "<div class='result'>" + result + "</div>",
             *                 coverLine  : true, 
             *                 fixedWidth : true 
             *             });
             *             cell.setWaiting(false);
             *         
             *         }
             *     };
             * 
             * @class Evaluator
             * @extends Object
             * @singleton
             */
            /**
             * @constructor
             * Creates a new Evaluator instance.
             * @param {String}   developer        The name of the developer of the plugin
             * @param {String[]} deps             A list of dependencies for this 
             *   plugin. In most cases it's a reference to `main.consumes`.
             * @param {Object}   options          The options for the debug panel
             * @param {String}   options.caption  
             * @param {String}   options.id       
             * @param {String}   options.name     
             * @param {String}   options.mode     
             * @param {String}   options.message  
             */
            plugin.freezePublicAPI({
                /**
                 * The language mode that is used to provide syntax highlighting. Any
                 * ace mode is supported (e.g. "ace/mode/javascript", "ace/mode/html", etc).
                 * @property {String} mode
                 */
                get mode() { return mode; },
                /**
                 * A message displayed at the top of the REPL. Leave this empty to not
                 * show a message.
                 * @property {String} message
                 */
                get message() { return message; },
                /**
                 * The caption of this evaluator
                 * @property {String} caption
                 */
                get caption() { return caption; },
                
                _events: [
                    /**
                     * 
                     */
                    "evaluate",
                    
                    /**
                     * 
                     */
                    "canEvaluate"
                ],
                    
                /**
                 * Evaluates an expression. Both synchronous and asynchronous evaluators
                 * are supported.
                 * 
                 * Example of a sync evaluator:
                 * 
                 *     var evaluator = {
                 *         mode        : "ace/mode/javascript",
                 *         message     : "",
                 *         canEvaluate : function(str) { return str.trim() ? true : false; },
                 *         evaluate    : function(expression, cell, done) {
                 * 
                 *             var win = iframe.contentWindow;
                 *             win.eval("try{window.result = " + expression 
                 *                 + "}catch(e){window.result = e}");
                 *             
                 *             var result = JSON.serialize(win.result);
                 *             cell.addWidget({ 
                 *                 html       : "<div class='result'>" + result + "</div>",
                 *                 coverLine  : true, 
                 *                 fixedWidth : true 
                 *             });
                 *             cell.setWaiting(false);
                 *         
                 *         }
                 *     };
                 * 
                 * Example of an async evaluator:
                 * 
                 *     var evaluator = {
                 *         mode        : "ace/mode/text",
                 *         message     : "",
                 *         canEvaluate : function(str) { return str.trim() ? true : false; },
                 *         evaluate    : function(expression, cell, done) {
                 *         
                 *             executeCommand(expression, function(err, result) {
                 *                 if (err)
                 *                     done("Error: " + err);
                 *                 else {
                 *                     cell.addWidget({ 
                 *                         html       : "<div class='result'>" 
                 *                             + result + "</div>",
                 *                         coverLine  : true, 
                 *                         fixedWidth : true 
                 *                     });
                 *                     
                 *                     done();
                 *                 }
                 *             });
                 *         
                 *         }
                 *     };
                 * 
                 * @method evaluate
                 * @param {String}          expression     The expression to evaluate.
                 * @param {immediate.cell}  cell           The cell (each REPL section is a cell) that the expression was typed in.
                 * @param {Function}        done           Call this function when the evaluation is async and the execution is completed.
                 * @param {String}          [done.message] The message to print below the cell in plain text.
                 */
                evaluate: evaluate,
                
                /**
                 * Determines whether the expression is valid and can be executed.
                 * @method canEvaluate
                 * @param {String} expression  The expression to inspect.
                 * @return {Boolean}
                 */
                canEvaluate: canEvaluate,
                
                /**
                 */
                draw: draw
            });
            
            return plugin;
        }
        
        /***** Register and define API *****/
        
        register(null, {
            Evaluator: Evaluator
        });
    }
});