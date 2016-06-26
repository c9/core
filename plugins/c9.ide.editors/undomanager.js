define(function(require, module, exports) {
    main.consumes = ["Plugin"];
    main.provides = ["UndoManager"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        
        function UndoManager(options) {
            var plugin = new Plugin("Ajax.org", main.consumes);
            var emit = plugin.getEmitter();
            
            var position = -1, mark = -1, stack = [];

            if (options)
                setState(options);
            

            function canUndo() {
                return position >= 0;
            }

            function undo(){
                if (!canUndo())
                    return false;
                
                var item = stack[position];
                if (!item.undo)
                    item = stack[position] = findItem(item);
                position--;
                item.undo();
                
                emit("change");
            }

            function canRedo() {
                return position !== stack.length - 1;
            }
            
            function redo(){
                if (!canRedo())
                    return false;
                
                position++;
                var item = stack[position];
                if (!item.redo)
                    item = stack[position] = findItem(item);
                item.redo();
                
                emit("change");
            }
            
            function clearUndo(){
                stack = stack.slice(position - 1);
                position = 0;
                
                if (mark < position)
                    mark = -2;
                
                emit("change");
            }
            
            function clearRedo(noEvent) {
                stack = stack.slice(0, position + 1);
                
                if (mark > position)
                    mark = -2;
                
                if (!noEvent)
                    emit("change");
            }
            
            function add(item) {
                if (!item.undo || !item.redo)
                    throw new Error("Missing undo and/or redo method implementation");
                
                clearRedo(true);
                stack.push(item);
                position = stack.length - 1;
                
                emit("change");
            }
            
            function remove(idx) {
                var item = stack.splice(idx, 1)[0];
                if (!item.undo)
                    item = findItem(item);
                item.undo();
                
                if (idx <= position)
                    position--;
                
                if (mark == idx)
                    mark = -2;
                else if (mark > idx)
                    mark--;
                
                emit("change");
            }
            
            function bookmark(index) {
                mark = index !== undefined ? index : position;
                
                emit("change");
            }
            
            function isAtBookmark(){
                return mark == position;
            }
            
            function item(idx) {
                return stack[idx] || null;
            }
            
            function getState(){
                return {
                    mark: mark,
                    position: position,
                    stack: stack
                        .filter(function(item){ return item; })
                        .map(function(item) {
                            return item.getState ? item.getState() : item;
                        })
                };
            }
            
            function setState(state) {
                if (!state || !state.stack.length) 
                    return reset();

                mark = state.mark;
                position = state.position;
                if (state.stack.length && state.stack[0] == undefined)
                    return; // guard against broken stack 
                stack = state.stack;
                
                emit("change"); // If you remove this again, change the test
            }
            
            function findItem(compressedItem) {
                return emit("itemFind", { state: compressedItem });
            }
            
            function reset(){
                if (position == -1)
                    return;

                position = -1;
                stack = [];
                mark = -1;
                
                emit("change");
            }
            
            plugin.freezePublicAPI.baseclass();
            
            /**
             * The Undo Manager class of Cloud9. Each {@link Document} 
             * has a single instance of the undo manager that
             * is used by each editor that works on the document. The undo 
             * manager manages the undo stack which tracks the changes to the
             * document.
             * 
             * The undoManager relates to other objects as such:
             * 
             * * {@link Pane} - Represent a single pane, housing multiple tabs
             *   * {@link Tab} - A single tab (button) in a pane
             *     * {@link Editor} - The editor responsible for displaying the file in the tab
             *     * {@link Document} - The representation of a file in the tab
             *       * {@link Session} - The session information of the editor
             *       * **UndoManager - The object that manages the undo stack for this document**
             * 
             * Panes can live in certain areas of Cloud9. By default these areas are:
             * 
             * * {@link panes}      - The main area where editor panes are displayed
             * * {@link console}    - The console in the bottom of the screen
             * 
             * Tabs are managed by the {@link tabManager}. The default way to
             * open a new file in an editor uses the tabManager:
             * 
             *     tabManager.openFile("/file.js", true, function(err, tab) {
             *         tab.document.value = "new value"; // adds item to the undo manager.
             * 
             *         var undoManager = tab.document.undoManager;
             *         undoManager.undo();
             *     });
             * 
             * The undo manager doesn't apply any changes itself. The changes
             * are managed by objects that are pushed onto the stack and have
             * an undo(), redo() and getState() method. This allows each
             * editor to implement it's own way to change the document while
             * keeping a consistent undo stack for the document.
             * 
             * Example:
             * 
             * The item class in the following example simply manages an
             * array, adding and removing items.
             * 
             *     var data = [];
             *     
             *     function Item(info, idx) {
             *         this.getState = function(){ return [ info, idx ] }
             *         this.undo = function(){ data.splice(idx, 1) }
             *         this.redo = function(){ 
             *             data[idx || (idx = data.length)] = info; 
             *             return this;
             *         }
             *     }
             *     
             *     var undoManager = new UndoManager();
             *     undoManager.add(new Item("a").redo()); // data = ["a"]
             *     undoManager.add(new Item("b").redo()); // data = ["a", "b"]
             * 
             *     undoManager.undo(); // data = ["a"];
             *     undoManager.undo(); // data = [];
             * 
             **/
            plugin.freezePublicAPI({
                /**
                 * The number of items on the stack. This number will stay the
                 * same when using {@link UndoManager#undo} and 
                 * {@link UndoManager#redo}. See the {@link UndoManager#position}
                 * property if you want to find out which items are applied 
                 * to the document and which are not.
                 * 
                 * @property {Number} length
                 * @readonly
                 */
                get length(){ return stack.length; },
                /**
                 * Set to the index of the item in the stack up to which the 
                 * items have been applied to the document. This property 
                 * changes when using the {@link UndoManager#undo} and 
                 * {@link UndoManager#redo} methods.
                 * 
                 * When {@link UndoManager#length} is 10, and 6 items have been
                 * executed, this property is set to 5. It is then 
                 * possible to execute redo() 4 times. At that point, the
                 * position property is set to 9. Calling redo() further will
                 * not result in any changes. Similarly undo() can be called
                 * until position is -1.
                 * 
                 * @property {Number} position
                 * @readonly
                 */
                get position(){ return position; },
                
                events: [
                    /**
                     * Fires when the undo manager is loading state from a state
                     * object (object returned by {@link #getState}() call). This
                     * event allows you to switch the state object (which was a
                     * result of the getState() call to your item object) with
                     * the actual implementation of your item object.
                     * 
                     * Return an instance of the item to push on to the stack.
                     * 
                     * Example: 
                     * 
                     *     undoManager.on("itemFind", function(e) {
                     *         return new Item(e.state[0], e.state[1]);
                     *     });
                     * 
                     * @event itemFind
                     * @param {Object} e
                     * @param {Object} e.state  The state of the object to 
                     *   be unserialized.
                     */
                    "itemFind",
                    /**
                     * Fires whenever the {@link #position} or {@link #length}
                     * properties changes.
                     * @event change
                     */
                    "change"
                ],
                
                /**
                 * Checks if there are items to be undone. This is equivalent
                 * to:
                 * 
                 *     undoManager.position >= 0
                 */
                canUndo: canUndo,

                /**
                 * Checks if there are items to be redone. This is equivalent
                 * to:
                 * 
                 *     undoManager.position != undoManager.length - 1
                 */
                canRedo: canRedo,
                
                /**
                 * Reverts the last change that was applied to the document.
                 * This method calls undo() on the item that is on the stack
                 * at the index specified by the {@link UndoManager#position}
                 * property.
                 */
                undo: undo,

                /**
                 * Executes the change that was undone last.
                 * This method calls redo() on the item that is on the stack
                 * at the index specified by the {@link UndoManager#position}
                 * property + 1.
                 */
                redo: redo,
                
                /**
                 * Clears the complete stack
                 */
                reset: reset,
                
                /**
                 * Retrieves an object from the stack by it's index.
                 * @param {Number} index  The index of the item to retrieve. 
                 *   This needs to be a number between 0 and the value of the
                 *   {@link UndoManager#length} property, including 0.
                 */
                item: item,
                
                /**
                 * Sets the bookmark pointer to the `index` specfied or the 
                 * current value of the `position` property.
                 * The bookmark is used by Cloud9 to specify at which point the
                 * file was saved.
                 * @param {Number} [index]  The index of the item to bookmark
                 */
                bookmark: bookmark,
                
                /**
                 * Retrieves whether the current position of the stack is bookmarked.
                 */
                isAtBookmark: isAtBookmark,
                
                /**
                 * Removes all items on the stack that have an index less than
                 * or equal to the value of {@link UndoManager#position}. These
                 * are all the items that have been applied to the document.
                 */
                clearUndo: clearUndo,
                
                /**
                 * Removes all items on the stack that have an index greater than
                 * the value of {@link UndoManager#position}. These are all the
                 * items that have not been applied to the document.
                 */
                clearRedo: clearRedo,
                
                /**
                 * Retrieves the state of the undo stack. The state of the
                 * stack is retrieved by calling getState() on each item in the
                 * stack.
                 * 
                 * @return {Object}
                 * @return {Number} return.mark      The value of the {@link #bookmark} property.
                 * @return {Number} return.position  The value of the {@link #position} property.
                 * @return {Array}  return.stack     An array containing the 
                 *   results of calling getState() on each stack item.
                 */
                getState: getState,
                
                /**
                 * Sets the state of the undo stack
                 * @param {Object} state  The state object. See {@link #getState}.
                 * @fires itemFind
                 */
                setState: setState,
                
                /**
                 * Adds an item to the undo stack. The redo() method is called
                 * on the `item` that is added and the item is added to the
                 * stack.
                 * @param {Object} item the object to put on the undo stack.
                 *   This item should have getState(), undo() and redo()
                 *   methods.
                 */
                add: add,
                
                /**
                 * Removes an item from the undo stack
                 * @param {Number} index  The index of the item to remove
                 */
                remove: remove
            });
            
            plugin.load(null, "undoManager");
            
            return plugin;
        }
        
        /***** Register and define API *****/
        
        register(null, {
            UndoManager: UndoManager
        });
    }
});
