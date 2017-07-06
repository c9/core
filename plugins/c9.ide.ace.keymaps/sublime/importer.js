var fs = require("fs");
var base = __dirname;
var commands = {};
fs.readdirSync(base).map(function(p) {
    if (/.sublime-keymap/.test(p)) {
        var a = eval(fs.readFileSync(base + "/" + p, "utf8"));
        a.name = /\((\w+)\)/.exec(p)[1].toLowerCase();
        if (a.name == "osx") a.name = "mac";
        if (a.name == "windows") a.name = "win";
        return a;
    }
}).filter(Boolean).map(function(keyMap) {
    keyMap.forEach(function(sublKey) {
        var name = sublKey.command;
        var args = sublKey.args ? JSON.stringify(sublKey.args) : "";
        var id = name + args;
        var o = commands[id] || (commands[id] = {
            bindKey: {},
            id: id,
            name: name
        });
        var oldKey = o.bindKey[keyMap.name];
        var newKey = convertKeys(sublKey.keys);
        if (oldKey) {
            if (oldKey.split("|").indexOf(newKey) == -1)
                newKey = oldKey + "|" + newKey;
            else
                newKey = oldKey;
        }
        o.bindKey[keyMap.name] = newKey;
        if (sublKey.context)
            o.context = sublKey.context;
        if (sublKey.args)
            o.args = sublKey.args;
    });  
});

commands = Object.keys(commands).map(function(id) {
    var cmd = commands[id];    
    delete cmd.id;
    
    if (cmd.bindKey.linux && cmd.bindKey.win == cmd.bindKey.linux)
        delete cmd.bindKey.linux;
    return cmd;
}).sort(function(a, b) {
    if (a.context && !b.context) return 1;
    if (!a.context && b.context) return -1;
    if (a.context && b.context) {
        var astr = JSON.stringify(a.context);
        var bstr = JSON.stringify(b.context);
        if (astr > bstr) return 1;
        if (astr < bstr) return -1;
    }
    
    if (a.name > b.name) return 1;
    if (a.name < b.name) return -1;
    
    if (a.args && !b.args) return 1;
    if (!a.args && b.args) return -1;
}).filter(function(x) {
    // filter out brace pairing commands as they are handled elsewhere
    return !/^(["'\[\]{}()\/](\|["'\[\]{}()\/])*|(escape))$/.test(x.bindKey.mac); 
}).filter(function(x) {
    // filter out completion commands
    return !/(^|_)completion($|_)/.test(x.name);
});

void function group() {
    function nameCore(cmd) {
        if (/bookmark/.test(cmd.name))
            return "bookmark";
        if (/(^|_)mark($|_)/.test(cmd.name))
            return "mark";
        var name = cmd.name.replace(/(de|in)crease|prev|next|left|right|upper|lower|un|all/g, "");
        name = name.replace(/(^_*|_*$)/g, "");
        return name;
    }
    for (var i = 0; i < commands.length; i++) {
        var name = nameCore(commands[i]);
        var nameParts = name.split("_");
        for (var j = i + 1; j < commands.length; j++) {
            var o = commands[j];
            if (nameCore(o) == name) {
                commands.splice(j, 1);
                i++;
                commands.splice(i, 0, o);
            }
        }
    }
}();

var cmdString = JSON.stringify(commands, null, 4)
    .replace(/\n {8}( +|(?=[}\]]))/g, " ")
    .replace(/"(\w+)":/g, "$1:")
    .replace(/(\[|\{) |(\S) (\]|\})/g, "$1$2$3")
    .replace(/"\\""/g, "'\"'")
    .replace(/},\s*{/g, "}, {")
    .replace(/\[\s*{/g, "[{")
    .replace(/}\s*]/g, "}]")
    .replace(/^ {4}/gm, "");
fs.writeFileSync("keymap", cmdString, "utf8");

function convertKeys(sublKeys) {
    var sublimeToAceKey = {
        keypad0: "numpad0",
        keypad1: "numpad1",
        keypad2: "numpad2",
        keypad3: "numpad3",
        keypad4: "numpad4",
        keypad5: "numpad5",
        keypad6: "numpad6",
        keypad7: "numpad7",
        keypad8: "numpad8",
        keypad9: "numpad9",
        keypad_period: ".",
        keypad_divide: "/",
        forward_slash: "/",
        keypad_multiply: "*",
        keypad_minus: "-",
        keypad_plus: "+",
        keypad_enter: "numpadEnter",
        equals: "=",
        plus: "+",
        super: "cmd"
    };
    
    return sublKeys.map(function(combo) {
        return combo.split("+").map(function(key) {
            return sublimeToAceKey[key] || key;
        }).join("-");
    }).join(" ");
}