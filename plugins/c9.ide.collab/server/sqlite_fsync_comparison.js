"use strict";

var Sequelize = require("sequelize");
var async = require("async");
var sequelize;
var User;

function wrapSeq(fun, next) {
    return fun.success(function () {
        next.apply(null, [null].concat(Array.prototype.slice.apply(arguments)));
    }).error(next);
}

function initDB(callback) {
    sequelize = new Sequelize("c9-collab", "c9", "c9-collab-secret", {
        // the sql dialect of the database
        dialect: "sqlite",
        storage: __dirname + "/c9-collab-test.db",
        logging: false,
        // use pooling in order to reduce db connection overload and to increase speed
        // currently only for mysql and postgresql (since v1.5.0)
        pool: { maxConnections: 5, maxIdleTime: 30 }
    });

    User = sequelize.define("User", {
        uid: { type: Sequelize.STRING, primaryKey: true },
        fullname: { type: Sequelize.STRING },
        email: { type: Sequelize.STRING }
    }, {
        timestamps: true, paranoid: true
    });

    wrapSeq(User.sync(), callback);
}

var i;

// http://www.sqlite.org/pragma.html#pragma_synchronous
function stressTestFSync(sync, callback) {
    var st;
    async.series([
            initDB,
            function (next) {
                wrapSeq(User.sync({ force: true }), next);
            },
            function (next) {
                st = new Date();
                i = 1;
                wrapSeq(sequelize.query("PRAGMA synchronous = " + sync + ";"), next);
            },
            createUsers,
            function (next) {
                console.log("SQLITE3 STRESS SYNC:", sync, " - TIME:", new Date() - st, "ms");
                next();
            }
        ],
    callback);
}


async.series([
        stressTestFSync.bind(null, 0),
        stressTestFSync.bind(null, 1),
        stressTestFSync.bind(null, 2)
    ],
    function (err) {
    if (err)
        console.log(err);
});

var TEST_SIZE = 1000;

function createUsers(done) {
    wrapSeq(User.create({
        uid: i + 1,
        fullname: "name_" + i,
        email: "email_" + i + "@something.com"
    }), function (err) {
        if (err) {
            console.log(err);
            process.exit(1);
        }
        if (i++ <= TEST_SIZE)
            createUsers(done);
        else
            done();
    });
}