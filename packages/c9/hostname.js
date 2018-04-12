var fs = require("fs");

exports.parse = function(hostname) {
    
    var m1 = hostname.match(/^([0-9a-z-]+?)-([0-9a-z]+)-([a-z]+)-([0-9]+)-([a-z0-9]+)$/);
    var m2 = hostname.match(/^([0-9a-z-]+?)-([0-9a-z]+)-([a-z]+)-([a-z0-9]+)-([a-z0-9]{4})$/);

    if (m1) {
        return {
            type: m1[1],
            provider: m1[2],
            region: m1[3],
            index: m1[4],
            env: m1[5]
        };
    }
    else if (m2) {
        return {
            type: m2[1],
            provider: m2[2],
            region: m2[3],
            env: m2[4],
            index: m2[5]
        };
    } else {
        return {};
    }
};

exports.get = function() {
    var hostname;
    try {
        hostname = fs.readFileSync("/etc/hostname", "utf8").trim();
    } catch (e) {
        hostname = "localhost";
    }

    return hostname;
};