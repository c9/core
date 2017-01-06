define(function(require, exports, module) {

exports.showCli = true;
exports.aceKeyboardHandler = require("ace/keyboard/emacs").handler;


var keys = [{
    bindKey: "C-x C-f",
    name: "navigate"
}, {
    bindKey: "C-x C-s",
    name: "save"
}, {
    bindKey: "C-x s",
    name: "saveall"
}, {
    bindKey: "C-x C-w",
    name: "saveas"
}];
keys.forEach(function(item) {
    exports.aceKeyboardHandler.bindKey(item.bindKey, {
        name: item.name,
        exec: ideCommand
    });
});

// todo find a way to integrate ide commands with vim and emacs modes
exports.execIdeCommand = null;
function ideCommand() {
    exports.execIdeCommand(this.name);
}

});