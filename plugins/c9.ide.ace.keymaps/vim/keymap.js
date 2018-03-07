define(function(require, exports, module) {

exports.showCli = true;
var Vim = require("ace/keyboard/vim").Vim;
var HashHandler = require("ace/keyboard/hash_handler").HashHandler;
exports.aceKeyboardHandler = require("ace/keyboard/vim").handler;

exports.aceKeyboardHandler.defaultKeymap.unshift(
    { keys: ':', type: 'action', action: 'aceCommand', actionArgs: { exec: function(ace) {
        var selector = ace.state.cm.state.vim.visualMode ? "'<,'>" : "";
        ace.showCommandLine(":" + selector);
    } }}
);

exports.aceKeyboardHandler.defaultKeymap.push(
    { keys: 'gt', type: 'action', action: 'aceCommand', actionArgs: { exec: ideCommand, name: 'gototabright', args: { editorType: "ace" }}},
    { keys: 'gT', type: 'action', action: 'aceCommand', actionArgs: { exec: ideCommand, name: 'gototableft', args: { editorType: "ace" }}}
);

exports.execIdeCommand = null;
function ideCommand() {
    exports.execIdeCommand(this.name, null, this.args);
}
/**
 *  require(["plugins/c9.ide.ace.keymaps/vim/keymap"], function(vim) {
 *      vim.map("J", "8j", "normal")
 *      vim.map("K", "8k", "normal")
 *      vim.map(",b", "c9:build", "normal")
 *      vim.map(",g", "c9:run", "normal")
 *  });
 */
exports.map = function(keys, action, context) {
    if (!action)
        return Vim.unmap(keys, context);
    var mapping;
    if (typeof action == "function") {
        mapping = {
            keys: keys,
            type: 'action',
            action: 'aceCommand',
            actionArgs: { exec: ideCommand, name: 'gototableft' }
        };
    }
    if (/^c9:/.test(action)) {
        var commandName = action.substr(3);
        
        mapping = {
            keys: keys,
            type: 'action',
            action: 'aceCommand',
            actionArgs: { exec: ideCommand, name: commandName }
        };
    }
    if (mapping) {
        if (context)
            mapping.context = context;
        mapping.user = true;
        exports.aceKeyboardHandler.defaultKeymap.unshift(mapping);
    } else {
        Vim.map(keys, action, context);
    }
};


exports.treeKeyboardHandler = new HashHandler();
exports.treeKeyboardHandler.bindKeys({
    "k": "goUp",
    "j": "goDown",
    "h": "levelUp",
    "l": "levelDown"
});

});