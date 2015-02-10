
var port = parseInt(process.env.PORT || 8080, 10);
var host = process.env.IP || "0.0.0.0";

module.exports = [{
    packagePath: "../../connect",
    port: port,
    host: host
}, {
    packagePath: "../../connect.session",
    key: "connect.architect." + port,
    secret: "1234"
}, {
    packagePath: "../../connect.session.memory"
}, {
    packagePath: "../plugin"
}];
