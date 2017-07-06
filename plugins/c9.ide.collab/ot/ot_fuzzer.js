define(function(require, exports, module) {
var oop = require("ace/lib/oop");
var lang = require("ace/lib/lang");
var EventEmitter = require("ace/lib/event_emitter").EventEmitter;
var ace = require("ace/ace");
var Range = require("ace/range").Range;
// @todo this is too broad
var Client = require("ext/ot/client");
var OTDocument = Client.OTDocument;

var ui = {
    canEdit: function() {return true;}
};
var editors = [];
var join = function(id) {
    var editor = ace.edit(id);
    id = editors.push(editor) - 1;
    editor.otDoc = new OTDocument(editor.session, ui);
    
    editor.outgoing = [];
    editor.incoming = [];
    
    editor.otDoc.init({
        "userId": id,
        "clientId": id,
        "docId": id,
        "selections": {},
        "authAttribs": [],
        "contents": "",
        "starRevNums": [],
        "revNum": 0,
        "revisions": [
            {
                "id": 300,
                "contents": "",
                "operation": [],
                "revNum": 0,
                "deleted_at": null,
                "document_id": 6
            }
        ]
    });
    return editor;
};

var server = {
    history: [],
    revNum: 0,
    send: function(type, msg) {
        if (type !== "EDIT_UPDATE")
            return;
        console.log(type, msg);

        var id = msg.docId;
        var ed = editors[id];
        ed.outgoing.push(lang.deepCopy(msg));
        
        this._signal("recieve", id);
    },
    handleEdit: function(msg) {
        this.revNum = msg.revNum;
        editors.forEach(function(ed) {
            ed.incoming.push({
                data: lang.deepCopy(msg),
                type: "EDIT_UPDATE"
            });
        });

        this._signal("send");
    },
    pickMsg: function(id) {
        var ed = editors[id];
        var msg = ed.outgoing.shift();
        if (!msg) return;
        if (msg.revNum != this.revNum + 1) {
            ed.incoming.push({
                type: "SYNC_COMMIT",
                data: {
                    revNum: this.revNum,
                    reason: "err"
                }
            });
            return this.pickMsg(id);
        }
        this.handleEdit(msg);
    },
    applyEdit: function(id) {
        var ed = editors[id];
        var msg = ed.incoming.shift();
        if (msg)
            ed.otDoc.handleDocMsg(lang.deepCopy(msg));
    },
    reset: function() {
        
    }
};
oop.implement(server, EventEmitter);

Client.onConnect({ connected: true, send: function(msg) {server.send(msg.type, msg.data); } });

var ed1 = join("ed1");
var ed2 = join("ed2");
var ed3 = join("ed3");

function clip(val, min, max) {return Math.max(min, Math.min(val, max));}

function getRandomInt(min, max) {
    var i = Math.floor(Math.random() * (max - min + 1)) + min;
    if (i >= max) i = max - 1;
    if (i <= min) i = min;
    return i;
}

var c = 0;
function randomString(len) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    c = (c + 1) % possible.length;
    text = lang.stringRepeat(possible[c], len);
    return text;
}
function nextString(len) {
    var text = "";
    var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    nextString.c = ((nextString.c || 0) + 1) % chars.length;
    text = lang.stringRepeat(chars[nextString.c], len);
    return text;
}

var deleteMore;
function randomOp() {
    var id = getRandomInt(0, editors.length + 3);
    var op = { id: id };
    if (!editors[id]) {
        op.id = getRandomInt(0, editors.length);
        op.type = "server";
    } else {
        var ed = editors[id];
        var doc = ed.session.doc;
        var l = doc.getValue().length;
        var random = Math.random();
        if (!l || random < 0.3) {
            l = doc.getValue().length;
            op.pos = doc.indexToPosition(getRandomInt(0, l), false, true);
            op.text = nextString(getRandomInt(0, 5)) + (getRandomInt(0, 10) ? "" : "\n");
            op.type = "insert";
        } else if (random < 0.5) {
            var p = [getRandomInt(0, l), getRandomInt(0, l)].sort(function(a, b) {return a - b;});
            
            if (!deleteMore)
                p[1] = clip(p[1], p[0], p[0] + 2);
            
            op.range = Range.fromPoints(doc.indexToPosition(p[0], false, true), doc.indexToPosition(p[1], false, true));
            op.type = "remove";
        } else {
            op.type = "apply";
        }
    }
    return op;
}
function applyOp(op) {
    var id = op.id;
    if (op.type == "server") {
        server.pickMsg(op.id);
    } else {
        var ed = editors[id];
        var doc = ed.session;
        if (op.type == "insert") {
            doc.insert(op.pos, op.text);
        } else if (op.type == "remove") {
            doc.remove(op.range);
        } else if (op.type == "apply") {
            server.applyEdit(id);
        }
    }
}

window.server = server;
window.applyOp = applyOp;
window.randomOp = randomOp;
window.editors = editors;

var editRandomly = window.editRandomly = function() {
    editRandomly.editCount = document.getElementById("editCb").checked ? 300 : 0;
    var interv = setInterval(function step() {
        if (editRandomly.editCount -- < 0) {
            editRandomly.editCount = document.getElementById("editCb").checked ? 300 : 0;
            if (!editRandomly.editCount) {
                return clearInterval(interv);
            }
        }
        var op = randomOp();
        
        server.history.push(op);
        applyOp(op);
    }, 10);
};
editRandomly.editCount = 300;

window.editRandomlyWithoutServer = function(editorNum) {
    var i = 300;
    var interv = setInterval(function step() {
        if (i -- < 0) {
            return clearInterval(interv);
        }
        var op = randomOp();
        
        if ((op.type != "insert" && op.type != "remove"))
            return step();
        
        server.history.push(op);
        applyOp(op);
    }, 10);
};

window.enableAutoSync = function(enable, latency) {
    server.removeAllListeners("send");
    server.removeAllListeners("recieve");
    
    if (enable === false) return;
    
    function has(aName) {
        return editors.some(function(ed) {return ed[aName].length;});
    }
    var onsend = lang.delayedCall(function() {
        server.applyEdit(getRandomInt(0, editors.length));
        if (has("incoming")) server._emit("send");
        if (has("outgoing")) server._emit("recieve");
    });
    var onrecieve = lang.delayedCall(function() {
        server.pickMsg(getRandomInt(0, editors.length));
        if (has("outgoing")) server._emit("recieve");
        if (has("incoming")) server._emit("send");
    });
    latency = latency * 0.5;
    server.on("send", function() {
        onsend.schedule(latency + Math.random() * latency);
    });
    server.on("recieve", function() {
        onrecieve.schedule(latency + Math.random() * latency);
    });
    
    onsend.schedule();
    onrecieve.schedule();
};

window.setDeleteMore = function(val) {
    deleteMore = val;
};

});
