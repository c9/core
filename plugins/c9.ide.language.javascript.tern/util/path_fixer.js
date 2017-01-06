var fs = require("fs");
fs.$readFileSync = fs.readFileSync;

fs.readFileSync = function(file, options) {
    if (!file.match(/\.js*$/))
        file += ".js";
    try {
        return this.$readFileSync(file, options);
    }
    catch (e) {
        if (e.code === "ENOENT")
            return "";
        throw e;
    }
};