require("amd-loader");
module.exports = function(options) {
    
// workaround for api difference between node and c9 events modules
var EventEmitter = require("../plugins/c9.nodeapi/events").EventEmitter;
var Module = require("module");
var _resolveFilename_orig = Module._resolveFilename
Module._resolveFilename = function(id, parent) {
    if (id == "events" && parent && /c9.core[\\/]ext\.js/.test(parent.id))
        id = "../c9.nodeapi/events";
    return _resolveFilename_orig.call(Module, id, parent);
};

var PID = process.env.C9_PID || 526;
var APIHOST = process.env.C9_APIHOST || "api.c9.io"; // "api.c9.io";
var APIURL = APIHOST.indexOf("localhost") > -1
    ? "http://" + APIHOST
    : "https://" + APIHOST;
var AUTHURL = APIHOST.indexOf("localhost") > -1
    ? "http://" + APIHOST
    : "https://" + APIHOST.replace(/api\./, "");

return [
    "./c9.core/ext",
    {
        packagePath: "./c9.fs/fs",
        baseProc: process.cwd(),
        cli: true
    },
    {
        packagePath: "./c9.fs/net"
    },
    {
        packagePath: "./c9.fs/proc",
        baseProc: process.cwd()
    },
    "./c9.vfs.client/vfs.cli",
    "./c9.cli/cli",
    {
        packagePath: "./c9.cli/auth.bootstrap",
        authUrl: AUTHURL
    },
    {
        packagePath: "./c9.cli.publish/publish",
    },
    {
        packagePath: "./c9.ide.auth/auth",
        accessToken: "token",
        ideBaseUrl: "",
        apiUrl: APIURL,
        cli: true
        // userId: process.env.C9_USER
    },
    {
        packagePath: "./c9.core/api",
        apiUrl: APIURL,
        projectId: PID
    },
    {
        packagePath: "./c9.core/http-node"
    },
    {
        packagePath: "./c9.cli.bridge/bridge-client",
        port: 17123
    },
    {
        packagePath: "./c9.cli.open/open",
        platform: process.platform
    },
    {
        packagePath: "./c9.cli.exec/exec",
        platform: process.platform
    },
    {
        packagePath: "./c9.cli.open/restart",
        platform: process.platform
    },
    {
        consumes: [],
        provides: ["settings", "cli_commands", "c9", "error_handler"],
        setup: function(options, imports, register) {
            register(null, {
                // @todo share with ace min
                c9 : {
                    startdate: new Date(),
                    debug: true,
                    hosted: false,
                    local: true,
                    home: process.env.HOME,
                    setStatus: function(){},
                    location: "",
                    platform: process.platform,
                },
                error_handler: {
                    log: function(){}
                },
                cli_commands: (function(){
                    var cmds = new EventEmitter();
                    var commands = {};
                    cmds.commands = commands;
                    cmds.addCommand = function(def) {
                        commands[def.name] = def;
                    };
                    cmds.exec = function(name, args) {
                        if (!commands[name]) 
                            throw new Error("Unknown command: " + name);
                        commands[name].exec(args);
                    };
                    return cmds;
                })(),
                http: new EventEmitter(),
                settings: (function(){
                    var settings = new EventEmitter();
                    var data = {};
                    
                    settings.migrate = function(){};
                    settings.setDefaults = function(type, def) {
                        var props = {};
                        def.forEach(function(d){ props[d[0]] = d[1] });
                        data[type] = props;
                    };
                    
                    settings.getBool = function(p) { 
                        return settings.get(p) == "true";
                    };
                    settings.get = function(p) { 
                        var type = p.substr(0, p.lastIndexOf("/"));
                        var prop = p.substr(p.lastIndexOf("/") + 2);
                        return data[type] && data[type][prop] || "";
                    };
                    settings.getJson = function(p) { 
                        try {
                            return JSON.parse(settings.get(p));
                        }catch(e){ return false }
                    };
                    settings.getNumber = function(p) { 
                        return Number(settings.get(p));
                    };
                    
                    settings.emit("read");
                    settings.on("newListener", function(event, listener) {
                        if (event == "read") listener();
                    });
                    
                    return settings;
                })(),
                auth: {
                
                }
            });
        }
    }
];

};

if (!module.parent) require("../server")([__filename].concat(process.argv.slice(2)));