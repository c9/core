"use strict";
"use server";


require("c9/inline-mocha")(module, null, { globals: ["db", "columnTypes"]});

var assert = require("assert");
var async = require("async");
var vfsLocal = require("vfs-local");
var fsnode = require("vfs-nodefs-adapter");

var fs = require("fs");
var vfsCollab = require("./collab-server");
var execFile = require("child_process").execFile;
var path = require("path");
var faker = require("faker");


var TEST_PID = 800;

var user1 = {
    user: {
        uid: "123",
        fullname: "Mostafa Eweda",
        email: "mostafa@c9.io"
    },
    clientId: "123abc",
    readonly: false
};

var user2 = {
    user: {
        uid: "456",
        fullname: "Maged Eweda",
        email: "maged@c9.io",
    },
    clientId: "456abc",
    readonly: false
};

var user3 = {
    user: {
        uid: "789",
        fullname: "readonly user",
        email: "readonly@c9.io",
    },
    clientId: "789xyz",
    readonly: true
};

function initCollab(user, next) {
    var vfs = vfsLocal({
        root: "/",
        wsmetapath: ".metadata",
        nodePath: __dirname + "/../../../node_modules",
        nopty: true
    });
    vfs.extend("collab", {
        file: __dirname + "/collab-server.js",
        redefine: true,
        user: user.user,
        project: { pid: TEST_PID },
        readonly: user.readonly
    }, function (err, meta) {
        if (err || !meta || !meta.api)
            assert.equal(err, null);
        assert.ok(meta);
        assert.ok(meta.api);
        var collab = meta.api;

        collab.connect({
            basePath: __dirname,
            clientId: user.clientId
        }, function (err, meta) {
            assert.equal(err, null);
            assert.ok(meta);
            assert.ok(meta.stream);

            collab.stream = meta.stream;
            collab.user = user;
            collab.meta = meta;
            setTimeout(function () {
                next(null, collab, vfs);
            }, 100);
        });
    });
}

describe(__filename, function() {

    this.timeout(15000);
    
    before(function (next) {
        execFile("rm", ["-rf", path.join(process.env.HOME, "/.c9/" + TEST_PID)], function(code, stdout, stderr) {
            if (!code)
                return next();
            next(stderr);
        });
    });


    describe("General Collab", function() {
        after(function(next) {
            fs.unlinkSync(__dirname + "/~test.txt");
            next();
            //module.exports.setUpSuite(next);
        });
    
        beforeEach(function(next) {
            var _self = this;
            initCollab(user1, function (err, collab1, vfs) {
                if (err)
                    return next(err);
                _self.collab1 = collab1;
                _self.vfs = vfs;
                _self.fs = fsnode(vfs);
    
                initCollab(user2, function (err, collab2) {
                    if (err)
                        return next(err);
                    _self.collab2 = collab2;
    
                    var path = "~test.txt";
                    var text = 'abc-def;;\nghi"-"jkl\n';
                    fs.writeFileSync(__dirname + "/" + path, text);
                    vfsCollab.Store.newDocument({
                        path: path,
                        contents: text
                    }, function() {
                        next();
                    });
                });
            });
        });
    
        afterEach(function (next) {
            var _self = this;
            this.collab2 && this.collab2.dispose(user2.clientId);
            setTimeout(function () {
                _self.collab1 && _self.collab1.dispose(user1.clientId);
                setTimeout(next, 100);
            }, 100);
        });
    
        it("should 2 clients collab initialization", function() {
            var collab1 = this.collab1;
            var collab2 = this.collab2;
            assert.ok(collab1);
            assert.ok(collab2);
            assert.ok(collab1.meta.isMaster);
            assert.ok(!collab2.meta.isMaster);
        });
    
        it("should broadcasting server", function(next) {
            this.collab1.stream.once("data", function (data) {
                console.log("Stream data:", data.toString());
                next();
            });
            this.collab1.send(user1.clientId, { type: "PING" });
        });
    
        it("should stream end on dispose", function(next) {
            this.collab1.stream.once("end", function (data) {
                next();
            });
            this.collab1.dispose(user1.clientId);
        });
    
        function joinDocument(docPath, toJoin, otherCollab, next) {
            var initatorMsg, collabMsg;
            var joinerStream = toJoin.stream;
            var collabStream = otherCollab.stream;
    
            async.parallel([
                function (next) {
                    joinerStream.on("data", function collab2Stream(msg) {
                        msg = JSON.parse(msg);
                        if (msg.type !== "JOIN_DOC")
                            return console.log("unexpected message:", msg);
                        assert.equal(msg.type, "JOIN_DOC");
                        joinerStream.removeListener("data", collab2Stream);
                        initatorMsg = msg.data;
                        next();
                    });
                },
                function (next) {
                    collabStream.on("data", function collab1Stream(msg) {
                        msg = JSON.parse(msg);
                        if (msg.type !== "JOIN_DOC")
                            return console.log("unexpected message:", msg);
                        assert.equal(msg.type, "JOIN_DOC");
                        collabStream.removeListener("data", collab1Stream);
                        collabMsg = msg.data;
                        next();
                    });
                }
            ], function (err) {
                if (err)
                    return next(err);
                assert(initatorMsg);
                assert(collabMsg);
                assert.equal(initatorMsg.docId, docPath.replace(/^\//, ""));
                assert(initatorMsg.chunk);
                var doc = JSON.parse(initatorMsg.chunk);
                assert.ok(!collabMsg.doc);
                next(null, initatorMsg.docId);
            });
    
            toJoin.send(toJoin.user.clientId, {
                type: "JOIN_DOC",
                data: { docId: docPath }
            });
        }
    
        it("should join document from master", function(next) {
            joinDocument("~test.txt", this.collab1, this.collab2, next);
        });
    
        it("should join document from slave", function(next) {
            joinDocument("~test.txt", this.collab2, this.collab1, next);
        });
    
        xit("should leave document", function (next) {
            var _self = this;
    
            var docPath = "~test.txt";
    
            joinDocument(docPath, _self.collab1, _self.collab2, function (err) {
                assert.ok(!err);
    
                joinDocument(docPath, _self.collab2, _self.collab1, function (err) {
    
                    assert.ok(!err);
                    var numLeaves = 2;
    
                    function assertLeaveMsg(next, msg) {
                        if (!numLeaves)
                            return;
                        numLeaves--;
                        msg = JSON.parse(msg);
                        assert.equal(msg.type, "LEAVE_DOC");
                        var data = msg.data;
                        assert.equal(msg.data.clientId, collabClientId);
                        next();
                    }
    
                    async.parallel([
                        function (next) {
                            _self.collab1.stream.on("data", assertLeaveMsg.bind(null, next));
                        },
                        function (next) {
                            _self.collab2.stream.on("data", assertLeaveMsg.bind(null, next));
                        }
                    ], next);
    
                    var collab = _self.collab1;
                    var collabClientId = collab.userIds.clientId;
                    // Anyone can leave -- everybody notified
                    collab.send(collabClientId, {
                        type: "LEAVE_DOC",
                        data: { docId: docPath }
                    });
                });
            });
        });
    
    
        it("should editing document - sync commit error", function(next) {
            var _self = this;
    
            var docPath = "~test.txt";
    
            joinDocument(docPath, _self.collab2, _self.collab1, function (err) {
                assert.ok(!err);
    
                _self.collab2.stream.on("data", function (msg) {
                    msg = JSON.parse(msg);
                    assert.equal(msg.type, "SYNC_COMMIT");
                    assert.equal(msg.data.docId, docPath);
                    assert.equal(msg.data.revNum, 0);
                    next();
                });
    
                _self.collab2.send(user2.clientId, {
                    type: "EDIT_UPDATE",
                    data: {
                        docId: docPath,
                        revNum: 2, // commit with wrong revision number ( != 1 )
                        op: ["r1", "ik", "r209"]
                    }
                });
            });
        });
    
        it("should editing document - a single commit", function(next) {
            var _self = this;
    
            var docPath = "~test.txt";
    
            joinDocument(docPath, _self.collab1, _self.collab2, function (err) {
                assert.ok(!err);
    
                joinDocument(docPath, _self.collab2, _self.collab1, function (err) {
    
                    assert.ok(!err);
    
                    // will be received by both joined collab streams
                    _self.collab2.stream.on("data", function (msg) {
                        msg = JSON.parse(msg);
                        assert.equal(msg.type, firstEditMsg.type);
                        assert.equal(msg.data.docId, firstEditMsg.data.docId);
                        assert.equal(msg.data.revNum, firstEditMsg.data.revNum);
                        assert.deepEqual(msg.data.op, firstEditMsg.data.op);
                        next();
                    });
    
                    var firstEditMsg = {
                        type: "EDIT_UPDATE",
                        data: {
                            docId: docPath,
                            revNum: 1,
                            op: ["r1", "ik", "r209"]
                        }
                    };
                    // Anyone can leave -- everybody notified
                    _self.collab1.send(user1.clientId, firstEditMsg);
                });
            });
        });
    
        it("should the master leaving and re-connecting", function(next) {
            var _self = this;
            this.collab1.dispose(user1.clientId);
            setTimeout(function () {
                initCollab(user1, function(err, collab1) {
                    assert.ok(!err);
                    _self.collab1 = collab1;
                    next();
                });
            }, 1000);
        });
    
        it("should a participant leaving and re-connecting", function(next) {
            var _self = this;
            this.collab2.dispose(user2.clientId);
            initCollab(user2, function(err, collab2) {
                assert.ok(!err);
                _self.collab2 = collab2;
                next();
            });
        });
    
        it("should block home access for readonly", function(next) {
            var self = this;
            function testJoinError(collab, path, next) {
                collab.stream.on("data", function onData(msg) {
                    msg = JSON.parse(msg);
                    if (msg.type !== "JOIN_DOC")
                        return console.log("unexpected message:", msg);
                    assert.equal(msg.data.err.message, "Not allowed.");
                    assert.ok(!msg.data.chunk);
                    collab.stream.removeListener("data", onData);
                    next();
                });
                collab.send(collab.user.clientId, {
                    type: "JOIN_DOC",
                    data: { docId: path }
                });
            }
            async.series([
                function(next) {
                    joinDocument("/~test.txt", self.collab1, self.collab2, function(err, id) {
                        assert.ok(!err);
                        assert.equal(id, "~test.txt");
                        next();
                    });
                },
                function(next) {
                    testJoinError(self.collab1, "a/b/../../../~test.txt", next);
                },
                function(next) {
                    testJoinError(self.collab1, "../~test.txt", next);
                },
                function(next) {
                    testJoinError(self.collab1, "..\\..\\test.txt", next);
                },
                function(next) {
                    initCollab(user3, function (err, collabRO, vfs) {
                        testJoinError(collabRO, "~/test.txt", next);
                    });
                },
                function() {
                    next();
                }
            ]);
        });
    });
    
    describe("checkDBCorruption", function() {
        it("Should return eithout error if duplicate column name error is encountered", function(done) {
            var err = new Error("SQLITE_ERROR: duplicate column name: migration");
            vfsCollab.checkDBCorruption(err, function (err, result) {
                assert(!err);
                assert(!result);
                done();
            });
        });
    });
    
    describe("areOperationsMirrored", function() {
        it("Should return false for unmirrored operations", function() {
            var op1 = ["r54", "dabc"];
            var op2 = ["r44", "dabc"];
            assert.equal(vfsCollab.areOperationsMirrored(op1, op2), false);
        });
        
        it("Should return true for mirrored operations", function() {
            var op1 = ["r54", "dabc"];
            var op2 = ["r54", "iabc"];
            assert.equal(vfsCollab.areOperationsMirrored(op1, op2), true);
        });
        
        it("Should return false for the same operation", function() {
            var op1 = ["r54", "iaaa"];
            var op2 = ["r54", "iaaa"];
            assert.equal(vfsCollab.areOperationsMirrored(op1, op2), false);
        });
        
        it("Should return false if the operations are different lengths", function() {
            var op1 = ["r54", "iaaa", "ibbb"];
            var op2 = ["r54", "iaaa"];
            assert.equal(vfsCollab.areOperationsMirrored(op1, op2), false);
            
            op1 = ["r54", "iaaa"];
            op2 = ["r54", "iaaa", "ibbb"];
            assert.equal(vfsCollab.areOperationsMirrored(op1, op2), false);
        });
        
        it("Should be able to handle empty or invalid operations without crashing", function() {
            var op1 = ["r55"];
            var op2 = [];
            assert.equal(vfsCollab.areOperationsMirrored(op1, op2), false);
            
            op1 = [""];
            op2 = [];
            assert.equal(vfsCollab.areOperationsMirrored(op1, op2), false);
            
            op1 = [];
            op2 = ["r44", ""];
            assert.equal(vfsCollab.areOperationsMirrored(op1, op2), false);
        });
        
        it("Should ignore noop operations", function() {
            var op1 = ["d ", "r0", "i"];
            var op2 = ["d", "r0", "i "];
            
            assert.equal(vfsCollab.areOperationsMirrored(op1, op2), true);
        });
        
        it("Should work when change orders are switched", function() {
            var op1 = ["dELEMENT", "iSTORIES"];
            var op2 = ["dSTORIES", "iELEMENT"];
            
            assert.equal(vfsCollab.areOperationsMirrored(op1, op2), true);
        });
        
        it("Should not modify the operations passed in", function() {
            var op1 = ["r5", "i", "imew"];
            var op2 = ["dlll", "r0"];
            vfsCollab.areOperationsMirrored(op1, op2);
            assert.deepEqual(op1, ["r5", "i", "imew"]);
            assert.deepEqual(op2, ["dlll", "r0"]);
        });
    });
    
    describe("removeNoopOperations", function () {
        it("Should remove operations that do nothing", function() {
            var operations = ["i", "dUUU", "r0", "r1", "r0", "d", "i5e"];
            var operationsParsed = vfsCollab.removeNoopOperations(operations);
            assert.deepEqual(operationsParsed, ["dUUU", "r1", "i5e"]);
        });
        
        it("Should not modify the operations passed in", function() {
            var op1 = ["r544", "d", "iaaa"];
            vfsCollab.removeNoopOperations(op1);
            assert.deepEqual(op1, ["r544", "d", "iaaa"]);
        });
    });
});