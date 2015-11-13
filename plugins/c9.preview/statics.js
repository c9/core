main.consumes = ["connect.static"];

module.exports = main;

function main(options, imports, register) {
    var statics = imports["connect.static"];
    
    statics.addStatics([{
        path: __dirname + "/static",
        mount: "/preview"
    }]);
    
    register();
}