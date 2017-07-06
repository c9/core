/*
 * This module patches the scraped results. It's like a hack. 
 */
 
var KIND_HIDDEN = "hidden";

var patchNodemanual = module.exports.patchNodemanual = function(defs) {
    defs["nodejs_latest:net"].properties._createServer[0].properties._return = ["nodejs_latest:http/Server/prototype"];
    defs["nodejs_latest:http"].properties._createServer[0].fargs = [
        {
            "id": "requestListener",
            opt: true,
            suggest: [ { name: "process.env.port", replaceText: "process.env.port" } ],
            "fargs": [
                { id: "req", type: ["nodejs_latest:http/ServerRequest/prototype"]},
                { id: "res", type: ["nodejs_latest:http/ServerResponse/prototype"]}
            ],
            "type": [ "es5:Object/prototype" ]
        }
    ];
    defs["nodejs_latest:http/Server"].properties._prototype[0].properties._listen[0].fargs =
    defs["nodejs_latest:net/Server"].properties._prototype[0].properties._listen[0].fargs = [
        {
            "id": "port",
            opt: true,
            "type": [ "es5:Number/prototype" ],
            doc: "The port to listen to. Use <tt>process.env.PORT</tt> when hosted by Cloud9."
        },
        {
            "id": "address",
            opt: true,
            suggest: [ { name: "process.env.IP", replaceText: "process.env.IP" } ],
            "type": [ "es5:String/prototype" ],
            doc: "The address to listen on. Use <tt>process.env.IP</tt> when hosted by Cloud9."
        }
    ];
    
    // HACK: Suggest listen() with Cloud9's configuration
    defs["nodejs_latest:http/Server"].properties._prototype[0].properties["_listen(process.env.PORT, process.env.IP)"] =
    defs["nodejs_latest:net/Server"].properties._prototype[0].properties["_listen(process.env.PORT, process.env.IP)"] = [
          {
            "guid": "nodejs_latest:net/Server/prototype/listen[0c9listenhack]",
            "doc": "Begin accepting connections in a Cloud9 environment."
          }
    ];
    
    // Hide scraped non-language elements
    defs["nodejs_latest:streams"].kind = KIND_HIDDEN;
    defs["nodejs_latest:Addons"].kind = KIND_HIDDEN;
    defs["nodejs_latest:Debugger"].kind = KIND_HIDDEN;
    defs["nodejs_latest:Globals"].kind = KIND_HIDDEN;
    defs["nodejs_latest:Domain"].kind = KIND_HIDDEN;
    defs["nodejs_latest:Index"].kind = KIND_HIDDEN;
    defs["nodejs_latest:eventemitter"].kind = KIND_HIDDEN;
    defs["nodejs_latest:StringDecoder"].kind = KIND_HIDDEN;
    
    return defs;
};

var patchCommon = module.exports.patchCommon = function(defs) {
    delete defs["es5:Object"].properties._prototype[0].properties._constructor[0].properties._return;
    
    // Delete deprecated stuff why not
    delete defs["es5:Object"].properties._prototype[0].properties._eval;
    
    // Delete Mozilla-only stuff why not
    delete defs["es5:Object"].properties._prototype[0].properties._watch;
    delete defs["es5:Object"].properties._prototype[0].properties._unwatch;
    delete defs["es5:Object"].properties._prototype[0].properties._toSource;
    delete defs["es5:String"].properties._prototype[0].properties._toSource;
    delete defs["es5:String"].properties._prototype[0].properties._trimLeft;
    delete defs["es5:String"].properties._prototype[0].properties._trimRight;
    delete defs["es5:String"].properties._prototype[0].properties._quote;

    // Make valueOf() static
    defs["es5:Object"].properties._valueOf =
        defs["es5:Object"].properties._prototype[0].properties._valueOf;
    delete defs["es5:Object"].properties._prototype[0].properties._valueOf;
    
    return defs;
};

function patch(root, path, value) {
    var segments = path.split(/\./);
    for (var i = 0; i < segments.length; i++) {
        var segment = segments[i];
        root = root.segment.properties;
    }
}
