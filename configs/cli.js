var EventEmitter = require("events").EventEmitter;

module.exports = [
    "./plugins/c9.core/ext",
    {
        packagePath: "./plugins/c9.fs/fs",
        baseProc: process.cwd(),
        cli: true
    },
    {
        packagePath: "./plugins/c9.fs/net"
    },
    {
        packagePath: "./plugins/c9.fs/proc",
        baseProc: process.cwd()
    },
    "./plugins/c9.vfs.client/vfs.cli",
    "./plugins/c9.cli/cli",
    {
        packagePath: "./plugins/c9.cli.bridge/bridge-client",
        port: 17123
    },
    // "./plugins/c9.cli.mount/mount",
    {
        packagePath: "./plugins/c9.cli.open/open",
        platform: process.platform
    },
    {
        packagePath: "./plugins/c9.cli.open/restart",
        platform: process.platform
    },
    // "./plugins/c9.cli.sync/sync",
    //"./plugins/c9.ide.keys/commands",
    {
        consumes: [],
        provides: ["settings", "http", "workspace", "cli_commands", "c9", "auth"],
        setup: function(options, imports, register) {
            register(null, {
                // @todo share with ace min
                c9 : {
                    startdate: new Date(),
                    debug: true,
                    hosted: false,
                    local: true,
                    setStatus: function(){}
                },
                workspace: (function(){
                    var ws = new EventEmitter();
                    ws.connect = function(name, callback) {
                        callback(null, {
                            hostname: "54.242.22.91",
                            username: "ubuntu",
                            rootPath: "/home/ubuntu/newclient/",
                            setupSshConnection: function(callback) {
                                callback();
                            }
                        });
                    };
                    return ws;
                })(),
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

if (!module.parent) require("../server")([__filename].concat(process.argv.slice(2)));