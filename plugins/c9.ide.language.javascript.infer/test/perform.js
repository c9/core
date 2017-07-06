var o = {
    aString: ""
};
    o.aString;
//#        ^ es5:String

var o = {
    
    init: function() {
        var _self = this;
        
        if (!editors.currentEditor || !editors.currentEditor.amlEditor)
            return;

        this.editor = editors.currentEditor.amlEditor.$editor;
        this.$onCursorChange = this.onCursorChangeDefer.bind(this);
        this.editor.selection.on("changeCursor", this.$onCursorChange);
        var oldSelection = this.editor.selection;
        this.setPath();
        
        this.updateSettings();
        
        var defaultHandler = this.editor.keyBinding.onTextInput.bind(this.editor.keyBinding);
        var defaultCommandHandler = this.editor.keyBinding.onCommandKey.bind(this.editor.keyBinding);
        this.editor.keyBinding.onTextInput = keyhandler.composeHandlers(keyhandler.onTextInput, defaultHandler);
        this.editor.keyBinding.onCommandKey = keyhandler.composeHandlers(keyhandler.onCommandKey, defaultCommandHandler);
        
    }
};
