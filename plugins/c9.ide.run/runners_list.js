var fs = require("fs");

function readRunners(path) {
    var results = {};
    var runnersPath = __dirname + "/" + path + "/";
    fs.readdirSync(runnersPath).forEach(function (name) {
        var runner = fs.readFileSync(runnersPath + name, "utf8");        
        try {
            // handle symlinks on windows
            if (/^..\//.test(runner))
                runner = fs.readFileSync(runnersPath + runner.trim(), "utf8");
            var json = JSON.parse(runner.replace(/(^|\n)\s*\/\/.*$/mg, ""));
            json.caption = name.replace(/\.run$/, "");
            json.$builtin = true;
            results[json.caption] = json;
        } catch (e) {
            console.error("Syntax error in runner", runnersPath + name, e);
        }
    });
    return results;
}

var defaultRunners = readRunners("runners");

module.exports = {
    local: defaultRunners,
    ssh: defaultRunners,
    docker: readRunners("runners-docker")
};