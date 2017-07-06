define(function(require, exports, module) {

exports.showCli = true;
exports.aceKeyboardHandler = require("ace/keyboard/emacs").handler;


var keys = [{
    bindKey: "C-x C-f",
    name: "newfile"
}, {
    bindKey: "C-x d",
    name: "navigate"
}, {
    bindKey: "C-x Left",
    name: "nexttab",
    exec: function() {
        exports.tabbehavior.nexttab(1, true);
    }
}, {
    bindKey: "C-x Right",
    name: "previoustab",
    exec: function() {
        exports.tabbehavior.nexttab(-1, true);
    }
}, {
    bindKey: "C-x C-s",
    name: "save"
}, {
    bindKey: "C-x s",
    name: "saveall"
}, {
    bindKey: "C-x C-w",
    name: "saveas"
}, {
    bindKey: "C-x k",
    name: "closetab"
}];
keys.forEach(function(item) {
    exports.aceKeyboardHandler.bindKey(item.bindKey, {
        name: item.name,
        exec: item.exec || item.ideCommand
    });
});

// todo find a way to integrate ide commands with vim and emacs modes
exports.execIdeCommand = null;
exports.tabbehavior = null;
function ideCommand() {
    exports.execIdeCommand(this.name);
}

});