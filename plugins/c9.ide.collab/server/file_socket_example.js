var net = require("net");

var socketPath = require("path").join(process.env.HOME, ".c9", "test.sock");
console.log(socketPath);

function createServer() {
    var server = net.createServer(function(client) {
        client.on("data", function(data) {
            if (data.toString() === "PING")
                client.write("PONG");
        });
    });

    server.on("error", function(err) {
       console.log("Server error:", err.code);
    });

    server.listen(socketPath, function() {
        console.log("Server listening");
    });
}

function createClient() {
    var client = net.connect(socketPath, function () {
        client.on("data", function (data) {
            console.log("Client:", data.toString());
            client.destroy();
        });

        client.write("PING");
    });

    client.on("close", function() {
        console.log("Client closed", arguments);
    });

    client.on("err", function(err) {
        console.log("Client error", err);
    });
}

createServer();
setTimeout(createClient, 1000);
setTimeout(createClient, 2000);
setTimeout(createServer, 4000);
