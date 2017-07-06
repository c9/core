
"use strict";
var Fs = require("fs");
var Path = require("path");
var net = require("net");
var Stream = require("stream").Stream;
var crypto = require('crypto');
var events = require("events");
var exists = Fs.exists || Path.exists;

var localfsAPI; // Set on VFS register
var DEFAULT_NL_CHAR_FILE = "\n";
var DEFAULT_NL_CHAR_DOC = "";
var MAX_WRITE_ATTEMPTS = 3;
var DEFAULT_HOME = "/home/ubuntu";

// If you leave unsaved changes for more than 24 hours and the file on disk changes 
// those unsaved changes will be lost. Don't want them hanging around forever. 
var UNSAVED_CHANGE_EXPIRY_TIME = 24 * 60 * 60 * 1000; 

// Models
var User, Document, Revision, Workspace, ChatMessage;
var basePath;
var PID;
var dbFilePath;

// Cache the workspace state got from the database
var cachedWS;
var cachedUsers;

var totalWriteAttempts = 0;
var lastFailedWrite = 0;
var resettingDatabase = false;

var isMaster = false;

var Sequelize;
var nodePath = getHomeDir() + "/.c9/node_modules";

var debug = false;
var logVerbose = function() {};
var logVerboseError = function() {};
var logError = function() { console.error.apply(console, arguments); };

function getHomeDir() {
    return process.env.HOME || DEFAULT_HOME;
}

function getProjectWD() {
    var env = process.env;
    var pidStr = env.BASE_PROC ? "" : String(PID);
    return Path.resolve(env.BASE_PROC || env.HOME || DEFAULT_HOME, ".c9", pidStr);
}

/**
 * Checks if the collab server required modules are installed
 * npm: sqlite3 & sequelize
 */
function installServer(callback) {
    function checkInstalled(root) {
        try {
            require(root + "sqlite3");
            Sequelize = require(root + "sequelize");
            return true;
        } catch (err) {
            logError(err);
            return false;
        }
    }
    if (!Sequelize && !checkInstalled(nodePath + "/") && !checkInstalled("")) {
        var err = new Error("[vfs-collab] Couldn't load node modules sqlite3 and sequelize "
            + "from " + nodePath + " "
            + "node version: " + process.version + "; "
            + "node execPath " + process.execPath
            );
        err.code = "EFATAL";
        return callback && callback(err);
    }
    callback && callback();
}

/**
 * Wrap Sequelize callback-style to NodeJS"s standard callback-style
 */
function wrapSeq(fun, next) {
    return fun.then(function () {
        next.apply(null, [null].concat(Array.prototype.slice.apply(arguments)));
    }, function (err) {
        checkDBCorruption(err, next);
    });
}

/** 
 * Check for DB corruption errors in SQL Query and if we have some then run initDB again
 **/
function checkDBCorruption (err, callback) {
    if (!err || !isMaster) {
        return callback();
    }
    
    var errMessage = err && err.message ? " " + err.message : "";
    
    // Ignore duplicate column name errors, there is no way to stop them happening in ALTER TABLE syntax
    if (errMessage.match(/duplicate column name/)) {
        return callback(); 
    }
    
    broadcast({
        type: "ERROR",
        err: new Error("Collab encountered error" + errMessage),
        collabError: err
    });
    
    logError("[vfs-collab] CheckDBCorruption encountered error: ", err);
    if (err.code === "SQLITE_CORRUPT" || err.code === "SQLITE_NOTADB" || err.code === "SQLITE_IOERR") {
        logError("[vfs-collab] found a corrupted database - backing up and starting with a fresh collab database");
        broadcast({
            type: "ERROR",
            err: new Error("Collab database corrupt")
        });
        return resetDB(callback); 
    }
    
    if (err.code == "SQLITE_READONLY") {
        if (lastFailedWrite < (Date.now() - 5000)) {
            totalWriteAttempts = 0;
        }
        totalWriteAttempts++;
        lastFailedWrite = Date.now();
        if (totalWriteAttempts >= MAX_WRITE_ATTEMPTS) {
            logError("[vfs-collab] Failed to write " + MAX_WRITE_ATTEMPTS + " times, checking if database is corrupt");
            
            // If the database is really corrupt this should return a corruption error which will be caught above
            var sequelize = connectToDB();
            wrapSeq(sequelize.query("PRAGMA synchronous = 0;"), function() {
                if (sequelize.close) {
                    sequelize.close();
                }
            }); 
        }
    }
    
    callback(err); 
}

function connectToDB() {
    var MAX_LOG_LINE_LENGTH = 151;

    dbFilePath = dbFilePath || Path.join(getProjectWD(), "collab.db");
    installServer();
    var sequelize = new Sequelize("c9-collab", "c9", "c9-collab-secret", {
        // the sql dialect of the database
        dialect: "sqlite",
        omitNull: true,
        storage: dbFilePath,
        // capture only the most important pieces of a sql statement or query
        logging: function (log) {
            if (!debug)
                return;

            var lines = log.split(/\r\n|\n|\r/);
            var firstLine = lines[0];
            firstLine = firstLine.length < MAX_LOG_LINE_LENGTH ? firstLine : (firstLine.substring(0, MAX_LOG_LINE_LENGTH) + "...");
            var lastLine = lines[lines.length - 1];
            lastLine = lastLine.length < MAX_LOG_LINE_LENGTH ? lastLine : (lastLine.substring(lastLine.length - MAX_LOG_LINE_LENGTH) + "...");
            logVerbose("[vfs-collab] DB", lines.length === 1
                ? (lines[0].length <= (2 * MAX_LOG_LINE_LENGTH) ? lines[0] : (firstLine + lines[0].substring(Math.max(MAX_LOG_LINE_LENGTH, lines[0].length - MAX_LOG_LINE_LENGTH))))
                : (firstLine + " --- " + lastLine));
        },

        define: {
            // don"t use camelcase for automatically added attributes but underscore style
            // so updatedAt will be updated_at
            underscored: true,
            freezeTableName: false,
            charset: "utf8",
            collate: "utf8_general_ci",
            classMethods: {},
            instanceMethods: {}
        },

        // sync after each association (see below). If set to false, you need to sync manually after setting all associations. Default: true
        syncOnAssociation: true,

        // use pooling in order to reduce db connection overload and to increase speed
        // currently only for mysql and postgresql (since v1.5.0)
        pool: { maxConnections: 5, maxIdleTime: 30 }
    });
    
    return sequelize;
}

/**
 * Initialize the collab server sqlite3 database
 *  - Define modules mapping to tables
 *  - Declare relationships
 *  - Sync sequelize modules
 *  - Create and cache the Workspace metadata
 *  - Set synchronous = 0 for fastest IO performance
 *  - Create indices, if not existing
 * 
 * @param {Boolean} readonly    Whether the intention is only to read from the
 *                              database (if true, initialization is skipped)
 * @param {Function} callback
 */
function initDB(readonly, callback) {
    var sequelize = connectToDB();

    Store.User = User = sequelize.define("User", {
        uid: { type: Sequelize.STRING, primaryKey: true },
        fullname: { type: Sequelize.STRING },
        email: { type: Sequelize.STRING }
    }, {
        timestamps: true
    });

    Store.Workspace = Workspace = sequelize.define("Workspace", {
        authorPool: { type: Sequelize.TEXT }, // Stringified JSON  - uid -> 1,2, ...etc.
        colorPool: { type: Sequelize.TEXT }, // Stringified JSON - uid --> "{r: 256, g: 0, b: 0}"
        basePath: { type: Sequelize.STRING, allowNull: false },
        migration: { type: Sequelize.INTEGER, defaultValue: 0 }
    }, {
        timestamps: true
    });

    Store.Document = Document = sequelize.define("Document", {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        path: { type: Sequelize.STRING, unique: true },
        contents: { type: Sequelize.TEXT },
        fsHash: { type: Sequelize.STRING },
        authAttribs: { type: Sequelize.TEXT }, // Stringified JSON
        starRevNums: { type: Sequelize.TEXT }, // Stringified JSON list of integers
        revNum: { type: Sequelize.INTEGER, defaultValue: 0 },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        lastUpdate: { type: Sequelize.BIGINT, defaultValue: 0 },
        newLineChar: { type: Sequelize.STRING, defaultValue: DEFAULT_NL_CHAR_DOC }, // "" or "\n" or "\r\n"
    }, {
        timestamps: false
    });

    Store.Revision = Revision = sequelize.define("Revision", {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        operation: { type: Sequelize.TEXT }, // Stringified JSON Array - can be empty for rev:0
        author: { type: Sequelize.STRING }, // userId if exists, 0 in syncing operations, -1 in undo non authored text
        revNum: { type: Sequelize.INTEGER },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    }, {
        timestamps: false
    });

    Store.ChatMessage = ChatMessage = sequelize.define("ChatMessage", {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        text: { type: Sequelize.STRING },
        userId: { type: Sequelize.STRING, allowNull: false },
        timestamp: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    }, {
        timestamps: true
    });

    Document.hasMany(Revision);
    Revision.belongsTo(Document);
    
    if (readonly || !isMaster)
        return callback();

    // Add migrations here e.g. ALTER TABLE ... ADD COLUMN ...
    var migrations = [
        { query: "CREATE INDEX DocumentRevisionsIndex ON Revisions(document_id)", skipError: true },
        { query: "CREATE INDEX ChatMessageTimestampIndex ON ChatMessages(timestamp)", skipError: true },
        { query: "DELETE FROM Documents" },
        { query: "DELETE FROM Revisions" },
        { query: "ALTER TABLE Documents ADD COLUMN newLineChar VARCHAR(255)" },
        { query: "ALTER TABLE Documents ADD COLUMN lastUpdate BIGINT" }
    ];

    async.series([
        function(next) {
            // http://www.sqlite.org/pragma.html
            wrapSeq(sequelize.query("PRAGMA synchronous = 0;"), next);
        },
        // Document.drop(), // Cleanup on init
        // Revision.drop(), // Cleanup on init
        function(next) {
            wrapSeq(User.sync(), next);
        },
        function(next) {
            wrapSeq(Workspace.sync(), next);
        },
        function(next) {
            wrapSeq(sequelize.query("ALTER TABLE Workspaces ADD COLUMN migration INTEGER DEFAULT 0"), next.bind(null, null));
        },
        function(next) {
            wrapSeq(Document.sync(), next);
        },
        function(next) {
            wrapSeq(Revision.sync(), next);
        },
        function(next) {
            wrapSeq(ChatMessage.sync(), next);
        },
        function (next) {
            wrapSeq(Workspace.findOrCreate({ id: 1 }, {
                authorPool: "{}",
                colorPool: "{}",
                basePath: basePath,
                migration: migrations.length
            }), function(err, ws) {
                if (err)
                    return next(err);
                ws.authorPoolParsed = parseJSONField(ws.authorPool);
                ws.colorPoolParsed = parseJSONField(ws.colorPool);
                cachedWS = ws;
                next();
            });
        },
        function (next) {
            var migNum = cachedWS.migration || 0;
            if (migNum === migrations.length)
                return next();
            var migApplied = migNum;
            async.forEachSeries(migrations.slice(migNum - migrations.length), function (migration, next) {
                logVerbose("[vfs-collab] applying database migration:", migration.query);
                wrapSeq(sequelize.query(migration.query), function(err) {
                    if (err && !migration.skipError)
                        return next(err);
                    migApplied++;
                    cachedWS.migration = migApplied;
                    Store.saveWorkspaceState(cachedWS, next);
                });
            }, function(err) {
                if (cachedWS.migration != migrations.length)
                     err = (err ? (err + " -- ") : "") + "Not all migrations could be applied!";
                next(err);
            });
        }
    ], function(err) {
        if (!err)
            return callback();
        logError("[vfs-collab] initDB attempt failed:", err);
        checkDBCorruption(err, callback);
    });
}

// parse json encoded several times
function parseJSONField(val) {
    try {
        while (typeof val == "string") {
            val = JSON.parse(val);
        }
    } catch (e) {
        logError("[vfs-collab] parseJSONField failed:", val, e);
        val = {};
    }
    return val;
}

/** 
 * Resets the database back to default state deleting all collab changes. 
 * This is useful if the database somehow becomes corrupt and can no longer be written to
 **/

function resetDB(callback) {
    if (resettingDatabase || !isMaster) return callback();
    logError("[vfs-collab] resetting collab database");
    resettingDatabase = true;
    Fs.rename(dbFilePath, dbFilePath + ".old", function (err) {
        if (err && err.code !== "ENOENT") {
            resettingDatabase = false; 
            return callback(err);
        }
        
        initDB(false, function() {
            resettingDatabase = false;     
            broadcast({
                type: "RESET_DB",
            });
            callback();
        });
    });
}

/**************** operations.js ******************/
var operations = (function() {
/**
 * Get a diff operation to transform a text document from: `fromText` to `toText`
 *
 * @param {String} fromText
 * @param {String} toText
 * @return {Operation} op
 */
function operation(fromText, toText) {
    var dmp = new diff_match_patch();
    var diffs = dmp.diff_main(fromText, toText);
    dmp.diff_cleanupSemantic(diffs);
    var d, type, val;
    var op = [];
    for (var i = 0; i < diffs.length; i++) {
        d = diffs[i];
        type = d[0];
        val = d[1];
        switch (type) {
            case DIFF_EQUAL:
                op.push("r" + val.length);
            break;
            case DIFF_INSERT:
                op.push("i" + val);
            break;
            case DIFF_DELETE:
                op.push("d" + val);
            break;
        }
    }
    return op;
}

// Simple edit constructors.

function insert(chars) {
    return "i" + chars;
}

function del(chars) {
    return "d" + chars;
}

function retain(n) {
    return "r" + String(n);
}

/**
 * Return the type of a sub-edit
 *
 * @param  {String} edit
 * @return {String} type of the operation
 */
function type(edit) {
    switch (edit[0]) {
    case "r":
        return "retain";
    case "d":
        return "delete";
    case "i":
        return "insert";
    default:
        throw new TypeError("Unknown type of edit: ", edit);
    }
}

/**
 * Return the value of a sub-edit
 *
 * @param  {String} sub-edit
 * @return the value of the operation
 *   - Retain: the number of characters to retain
 *   - Insert/Delete: the text to insert or delete
 */
function val(edit) {
    return type(edit) === "retain" ? ~~edit.slice(1) : edit.slice(1);
}

/**
 * Return the length of a sub-edit
 *
 * @param  {String} edit
 * @return {Number} the length of the operation
 *   - Retain: the number of characters to retain
 *   - Insert/Delete: the text length to insert or delete
 */
function length(edit) {
    return type(edit) === "retain" ? ~~edit.slice(1) : edit.length - 1;
}

/**
 * Split a sub-edit on a index: idx
 *
 * @param  {String} edit
 * @return [{String}] an array of length 2 of the sub-operaion splitted to 2 operaions
 */
function split(edit, idx) {
    if (type(edit) === "retain") {
        var rCount = ~~edit.slice(1);
        return [
            "r" + idx,
            "r" + (rCount - idx)
        ];
    }
    else {
        return [
            edit[0] + edit.substring(1, idx + 1),
            edit[0] + edit.substring(idx + 1)
        ];
    }
}

/**
 * Pack an operation to a minimal operation
 *
 * @param  {Operation} op
 * @return {Operation} packed
 */
function pack(op) {
    var packed = op.slice();
    var i = 0;
    while (i < packed.length - 1) {
        if (packed[i][0] === packed[i + 1][0])
            packed.splice(i, 2, packed[i][0] + (val(packed[i]) + val(packed[i + 1])));
        else
            i++;
    }
    return packed;
}

/**
 * Inverse an operation to undo revert its effect on a document
 *
 * @param  {Operation} op
 * @return {Operation} inversed
 */
function inverse(op) {
    var edit, t, v, inversed = new Array(op.length);
    for (var i = 0, el = op.length; i < el; i++) {
        edit = op[i];
        t = type(edit);
        v = val(edit);
        switch (t) {
            case "retain":
                inversed[i] = op[i];
                break;
            case "insert":
                inversed[i] = del(v);
                break;
            case "delete":
                inversed[i] = insert(v);
                break;
        }
    }
    return inversed;
}

return {
    insert: insert,
    del: del,
    retain: retain,
    type: type,
    val: val,
    length: length,
    split: split,
    pack: pack,
    operation: operation,
    inverse: inverse
};

})();

/**************** apply.js ******************/

function OTError(expected, actual) {
    var err = new Error("OT removed text mismatch");
    err.expected = expected;
    err.actual = actual;
    err.code = "EMISMATCH";
    return err;
}

/**
 * Apply an operation on a string document and return the resulting new document text.
 *
 * @param  {Opeartion} op - e.g. ["r2", "iabc", "r12"]
 * @param  {String} doc
 * @return {String} newDoc
 */
 function applyContents(op, doc) {
    var val, newDoc = "";
    for (var i = 0, len = op.length; i < len; i += 1) {
        val = op[i].slice(1);
        switch (op[i][0]) {
        case "r": // retain
            val = Number(val);
            newDoc += doc.slice(0, val);
            doc = doc.slice(val);
            break;
        case "i": // insert
            newDoc += val;
            break;
        case "d": // delete
            if (doc.indexOf(val) !== 0)
                throw new OTError(val, doc.slice(0, 10));
            else
                doc = doc.slice(val.length);
            break;
        default:
            throw new TypeError("Unknown operation: " + operations.type(op[i]));
        }
    }
    return newDoc;
}


/**************** author_attributes.js ******************/
/**
 * This is a specifically designed data structure that tends to behave as a relaxed B-Tree
 * to optimize author attributes processing time, disk usage and network overhead
 *
 * It optimizes on two main factors:
 * - insert/delete/traversal/find time: The B-tree try to maintain a minimal depth, so minimal processing needed for those operations: O(log with base minKeySize)
 * - Parsing/Stringification time and disk usage: the nodes are implemented as arrays with the first element
 *     indicating the number of entries in the node
 *
 * @param minKeySize - the minimum number of entries in a node
 * @param maxKeySize - the maximum number of entries in a node
 *
 * @author Mostafa
 * @author Harutyun
 */
function AuthorAttributes(minKeySize, maxKeySize) {
    // 2 * x ---> [length, [value]]
    minKeySize = minKeySize || 20; // 4
    maxKeySize = maxKeySize || (5 * minKeySize); // 8

    function addValue(nodes, index, startI, length, id) {
        var i = startI;
        var len = nodes[i];
        var val = nodes[i + 1];
        if (index < 0 || index > len)
            throw new Error("Invalid index passed!");

        if (val === id) {
            nodes[i] += length;
        } else if (index === len) {
            if (nodes[i + 3] == id)
                nodes[i + 2] += length;
            else
                nodes.splice(i + 2, 0, length, id);
        } else if (index === 0) {
            if (nodes[i - 1] == id)
                nodes[i - 2] += length;
            else
                nodes.splice(i, 0, length, id);
        } else {
            nodes.splice(i, 2, index, val, length, id, len - index, val);
        }
    }

    function split(parent, nodes, pos) {
        var splitPos = (nodes.length >> 2) << 1;
        var leftLen = 0, rightLen = 0;
        var right = nodes.splice(splitPos, splitPos + 2);

        for (var i = 0; i < right.length; i += 2)
            rightLen += right[i];

        if (parent) {
            parent.splice(pos + 2, 0, rightLen, right);
            parent[pos] -= rightLen;
        } else {
            var left = nodes.splice(0, splitPos + 2);
            for (var i = 0; i < left.length; i += 2)
                leftLen += left[i];
            nodes.push(leftLen, left, rightLen, right);
        }
    }

    function insert(nodes, index, length, id) {
        if (nodes.length === 0) {
            nodes.push(length, id);
            return;
        }
        var spilled = _insert(nodes, index, length, id);
        if (spilled)
            split(null, nodes, null);
        // sanityCheck(nodes)
    }

    function _insert(nodes, index, length, id) {
        for (var i = 0; i < nodes.length; i += 2) {
            var len = nodes[i];
            if (index <= len) {
                var node = nodes[i + 1];
                if (Array.isArray(node)) {
                    nodes[i] += length;
                    var spilled = _insert(node, index, length, id);
                    if (spilled)
                        split(nodes, nodes[i + 1], i);
                }
                else {
                    addValue(nodes, index, i, length, id);
                }
                return nodes.length > maxKeySize;
            }
            index -= len;
        }
    }

    function remove(nodes, index, length) {
        var removedTotal = 0;
        for (var i = 0; i < nodes.length; i += 2) {
            var len = nodes[i]; // node.length
            var ch = nodes[i + 1];
            var removed;
            if (index <= len) {
                if (Array.isArray(ch))
                    removed = remove(ch, index, length);
                else
                    removed = Math.max(0, Math.min(length, len - index));

                nodes[i] -= removed; // node.length
                length -= removed;
                removedTotal += removed;
                if (!nodes[i]) {
                    nodes.splice(i, 2);
                    i -= 2;
                }
                else if (Array.isArray(ch) && ch.length < minKeySize &&
                    (ch.length + nodes.length) <= maxKeySize) {
                    // Move elements from child to parent
                    nodes.splice.apply(nodes, [i, 2].concat(ch));
                }
                if (!length)
                    break;
                index = 0;
            }
            else {
                index -= len;
            }
        }

        for (var j = 0; j < nodes.length - 2; j += 2) {
            if (!nodes[j] || nodes[j + 1] !== nodes[j + 3])
                continue;
            nodes[j] += nodes[j + 2];
            nodes.splice(j + 1, 2);
            j -= 2;
        }
        // sanityCheck(nodes);
        return removedTotal;
    }


    function apply(nodes, op, authPoolId) {
        authPoolId = authPoolId || 0;

        var index = 0;
        var opLen;
        for (var i = 0; i < op.length; i++) {
            opLen = operations.length(op[i]);
            switch (operations.type(op[i])) {
            case "retain":
                index += opLen;
                break;
            case "insert":
                insert(nodes, index, opLen, authPoolId);
                index += opLen;
                break;
            case "delete":
                remove(nodes, index, opLen);
                break;
            default:
                throw new TypeError("Unknown operation: " + operations.type(op[i]));
            }
        }
    }

    return {
        apply: apply,
        // insert: insert,
        // remove: remove
    };
}

var applyAuthorAttributes = AuthorAttributes().apply;

/**
 * Hash a string (document content) for easier comparison of state changes
 */
function hashString(str) {
    // if ((str + "").indexOf("\r") != -1) debugger
    return crypto.createHash('md5').update(str).digest("hex");
}

/**
 * Normalize document path to discard workspace prefix
 */
function getDocPath(path) {
    if (path.indexOf(basePath) === 0)
        return path.substring(basePath.length + 1);
    return path;
}

var emitter = new events.EventEmitter();

/**
 * Document Store database wrapper utility to ease persistence/retrieval and update of entities such as:
 * Documents, Revisions, Workspace, ChatMessages, Users
 */
var Store = (function () {
    /**
     * Create a `Document` from a template with path, contents
     * Also, create its Revision#0 record
     * @param {Object}   tmpl
     * @param {Function} callback
     */
    function newDocument(tmpl, callback) {
        var contents = tmpl.contents || "";
        var fsHash = tmpl.fsHash || hashString(contents);
        wrapSeq(Document.create({
            contents: new Buffer(contents),
            path: tmpl.path,
            fsHash: fsHash,
            authAttribs: contents.length ? JSON.stringify([contents.length, null]) : "[]",
            starRevNums: "[]",
            newLineChar: tmpl.newLineChar || DEFAULT_NL_CHAR_DOC,
            revNum: 0
        }), function (err, doc) {
            if (err)
                return callback(err);
            wrapSeq(Revision.create({
                document_id: doc.id,
                operation: new Buffer("[]"),
                revNum: 0
            }), function (err, rev) {
                if (err)
                    return callback(err);
                doc.revisions = parseRevisions([rev]);
                callback(null, parseDocument(doc));
            });
        });
    }

    /*
    function moveDocument(docId, newPath, callback) {
        wrapSeq(Document.find(docId), function (err, doc) {
            if (err || !doc)
                return callback(err || "No document found to rename!");
            doc.path = newPath;
            wrapSeq(doc.save(), callback);
        });
    }
    */

    function parseDocument(doc) {
        if (doc.authAttribs)
            doc.authAttribs = JSON.parse(doc.authAttribs);
        if (doc.starRevNums)
            doc.starRevNums = JSON.parse(doc.starRevNums);
        doc.contents = doc.contents && doc.contents.toString(); // because it can be a buffer
        return doc;
    }

    function parseDocumentCallback(callback) {
        return function (err, doc) {
            if (err || !doc)
                return callback(err);

            callback(null, parseDocument(doc));
        };
    }

    /**
     * Get a `Document` from the database given its path
     * @param {String}   path the document path to query the database with
     * @param [{String}] attributes - optional
     * @param {Function} callback
     * @param {Object} callback.err
     * @param {Object} callback.result   The result, or null if getDocument() failed (might even though err is null)
     */
    function getDocument(path, attributes, callback) {
        var query = { where: { path: getDocPath(path) }};
        if (!callback) {
            callback = attributes;
            attributes = undefined;
        }
        else {
            attributes.unshift("id");
            query.attributes = attributes; // ["id", other attributes]
        }

        return wrapSeq(Document.find(query), parseDocumentCallback(callback));
    }

    /**
     * Get the revisions of a certain document
     * @param {Document} doc
     * @param {Function} callback
     */
    function getRevisions(doc, callback) {
        wrapSeq(doc.getRevisions(), function (err, revisions) {
            if (err)
                return callback(err);
            callback(null, parseRevisions(revisions));
        });
    }
    
    /**
     * In-place parsing of revisions
     * @param [{Revision}] revisions
     */
    function parseRevisions(revisions) {
        revisions.forEach(function (rev) {
            // rev.operation can be a buffer and is always a stringified JSON array
            rev.operation = JSON.parse(rev.operation.toString());
        });
        revisions.sort(function(a, b) {
            return a.revNum - b.revNum;
        });
        return revisions;
    }

    function prepareAttributes(doc, attributes) {
        var update = {};
        for (var i = 0; i < attributes.length; i++)
            update[attributes[i]] = doc[attributes[i]];
        return update;
    }

    /**
     * Save a document with changes to the database
     * @param {Function} callback
     */
    function saveDocument(doc, callback) {
        var authAttribs = doc.authAttribs;
        var starRevNums = doc.starRevNums;
        doc.authAttribs = JSON.stringify(authAttribs);
        doc.starRevNums = JSON.stringify(starRevNums);
        doc.contents = new Buffer(doc.contents);
        doc.updated_at = new Date();
        doc.lastUpdate = doc.updated_at.getTime();
        logVerbose("Saving document to db with lastUpdate: " + doc.lastUpdate);

        return wrapSeq(
            doc.save(),
            function(err) {
                doc.authAttribs = authAttribs;
                doc.starRevNums = starRevNums;
                callback(err, doc);
            }
        );
    }

    /**
     * Gets the latest workspace state with the most important properties being: aurhorPool and colorPool
     * @param {Function} callback
     */
    function getWorkspaceState(callback) {
        // the table has only a single entry
        if (cachedWS)
            return callback(null, cachedWS);
        wrapSeq(Workspace.find(1), function (err, ws) {
            if (err || !ws)
                return callback(err || "No workspace state found!");
            ws.authorPoolParsed = parseJSONField(ws.authorPool);
            ws.colorPoolParsed = parseJSONField(ws.colorPool);
            cachedWS = ws;
            callback(null, ws);
        });
    }

    /**
     * Save the workspace with changes to the database
     * @param {Workspace} ws
     * @param {Function}  callback
     */
    function saveWorkspaceState(ws, callback) {
        var authorPool = ws.authorPoolParsed;
        var colorPool = ws.colorPoolParsed;
        ws.authorPool = JSON.stringify(authorPool);
        ws.colorPool = JSON.stringify(colorPool);
        return wrapSeq(ws.save(), function(err, savedWS) {
            if (err) {
                cachedWS = null;
                return callback(err);
            }
            savedWS.authorPoolParsed = authorPool;
            savedWS.colorPoolParsed = colorPool;
            cachedWS = savedWS;
            callback(null, savedWS);
        });
    }

    /**
     * Save a document with changes to the database
     * @param {Function} callback
     */
    function getUsers(callback) {
        if (cachedUsers)
            return callback(null, cachedUsers);
        wrapSeq(User.all(), function (err, users) {
            cachedUsers = users;
            callback(err, users);
        });
    }

    /**
     * Add uer's chat message to the database
     * @param {String}   text
     * @param {String}   userId
     * @param {Function} callback
     */
    function saveChatMessage(text, userId, callback) {
        wrapSeq(ChatMessage.create({
            text: text,
            userId: userId
        }), callback);
    }

    /**
     * Get the most recent chat messages
     * @param {Number}   limit - optional
     * @param {Function} callback
     */
    function recentChatHistory(limit, callback) {
        limit = limit || 100;
        wrapSeq(ChatMessage.findAll({
            order: 'timestamp DESC',
            limit: limit
        }), function(err, history) {
            if (err)
                return callback(err);
            callback(null, history.reverse());
        });
    }

    return {
        newDocument: newDocument,
        // moveDocument: moveDocument, // not used
        getDocument: getDocument,
        getRevisions: getRevisions,
        saveDocument: saveDocument,
        getWorkspaceState: getWorkspaceState,
        saveWorkspaceState: saveWorkspaceState,
        getUsers: getUsers,
        saveChatMessage: saveChatMessage,
        recentChatHistory: recentChatHistory
    };
})();


// This object should have the following structure:
//
//     { <document id> : { <client id> : true } }
var documents = Object.create(null);

// This object should have the following structure:
//
//     { <document id> : { fs.FSWatcher } }
var watchers;

// This object should have the following structure:
//
//     { <client id> : <client> }
var clients;

var lastSaveStarts = Object.create(null);

// SQLite doesn't provide atomic instructions or locks
// So this variable expresses in-process locks
// Used to block concurrent edit updates while the document is being processed
//
//     { <key or document_id> : [{Function}] }
var locks = Object.create(null);
function lock(key, callback) {
    if (!locks[key]) {
        locks[key] = [];
        return callback();
    }
    
    var watchdog = setTimeout(function() {
        throw Error("[vfs-collab] Lock timeout"); // log & suicide
    }, 60000);
    return locks[key].push(function() {
        clearTimeout(watchdog);
        callback();
    });
}

function unlock(key) {
    var lock = locks[key];
    if (!lock || !lock.length)
        return delete locks[key];
    var next = lock.shift();
    next();
}

// Selected using colors.html
var featuredColors = [
    { r: 255, g: 146, b: 45 },
    { r: 157, g: 47, b: 254 },
    { r: 105, g: 215, b: 83 },
    { r: 255, g: 105, b: 130 },
    { r: 200, g: 109, b: 218 },
    { r: 210, g: 230, b: 51 },
    { r: 6, g: 134, b: 255 },
    { r: 254, g: 13, b: 244 },
    { r: 188, g: 255, b: 86 },
    { r: 255, g: 212, b: 125 },
    { r: 107, g: 4, b: 255 },
    { r: 66, g: 248, b: 255 }
];

// An algorithm to select bright random colors
function randomColor() {
    var a, b, c;
    do {
      a = Math.random();
      b = Math.random();
      c = Math.max(a, b);
    } while (c < 0.001);

    // scale them such that the larger number scales to 1.0f
    var scale = 1.0 / c;
    a *= scale;
    b *= scale;

    // Pick third value, ensure it's dark.
    c = Math.random() * 0.5;
    var rgb = new Array(3);

    var idx = Math.floor(Math.random() * 3) % 3;
    rgb[idx] = a;

    var rnd2 = Math.floor(Math.random() * 2) + 1;
    var idx2 = (rnd2 + idx) % 3;
    rgb[idx2] = b;

    var idx3 = 3 - (idx + idx2);
    rgb[idx3] = c;

    rgb = rgb.map(function(x) {
        return Math.floor(255 * x);
    });
    return { r: rgb[0], g: rgb[1], b: rgb[2] };
}

/**
 * Handle new collab connections (can be reconnects)
 * Sync user's info to the collab database and select a color and aurhor id for him/her if not previously set
 * Send USER_JOIN notifications to other connected members
 * Send handshake CONNECT message to the user with the needed workspace info and chat history
 */
function handleConnect(userIds, client) {
    var userId = userIds.userId;
    var clientId = userIds.clientId;

    function done(err) {
        if (!err)
            return;
        logError(err);
        client.send({
            type: "CONNECT",
            error: err
        });
    }

    // Make sure to cache user's info
    syncUserInfo();

    function syncUserInfo() {
        if (!userId)
            return done("[vfs-collab] Anonyous users connections not supported");

        var fullname = userIds.fullname;
        var email = userIds.email;
        
        wrapSeq(User.find({ where: { uid: userId }}), function (err, user) {
            if (err)
                return done("[vfs-collab] syncUserInfo " + String(err));

            if (!user) {
                return wrapSeq(User.create({
                    uid: userId,
                    fullname: fullname,
                    email: email
                }), function(err, createdUser) {
                    if (err)
                        return done("[vfs-collab] Failed creating user " + String(err));
                    cachedUsers && cachedUsers.push(createdUser);
                    augmentWorkspaceInfo();
                });
            }

            if (user.fullname == fullname && user.email == email)
                return augmentWorkspaceInfo();

            user.fullname = fullname;
            user.email = email;
            wrapSeq(user.save(), function (err, user) {
                if (err)
                    return done("[vfs-collab] Failed updating user " + String(err));
                augmentWorkspaceInfo();
            });
        });
    }

    function augmentWorkspaceInfo() {
        Store.getWorkspaceState(function (err, ws) {
            if (err)
                return done("[vfs-collab] augmentWorkspaceInfo " + String(err));
            var authorPool = ws.authorPoolParsed;
            var colorPool = ws.colorPoolParsed;

            if (authorPool[userId] && colorPool[userId])
                return doConnect(authorPool, colorPool);

            if (!authorPool[userId])
                authorPool[userId] = Object.keys(authorPool).length + 1;
            if (!colorPool[userId])
                colorPool[userId] = featuredColors[authorPool[userId] - 1] || randomColor();
            Store.saveWorkspaceState(ws, function (err) {
                if (err)
                    return done("[vfs-collab] augmentWorkspaceInfo " + String(err));
                doConnect(authorPool, colorPool);
            });
        });
    }

    function doConnect(authorPool, colorPool) {
        Store.getUsers(function (err, users) {
            if (err)
                return done("[vfs-collab] getUsers " + String(err));

            if (users.length > 1)
                logVerbose("[vfs-collab] User", userIds.userId, "is connecting to a workspace with",
                    users.length - 1, "other workspace members");

            var onlineUsers = {};
            var idleUsers = {};
            for (var clId in clients) {
                var cl = clients[clId];
                var uid = cl.userIds.userId;
                if (!onlineUsers[uid])
                    onlineUsers[uid] = [];
                onlineUsers[uid].push(clId);
                var idleClinet = cl.state === "idle";
                if (typeof idleUsers[uid] === "undefined")
                    idleUsers[uid] = idleClinet; // set through a USER_STATE message
                else
                    idleUsers[uid] = idleUsers[uid] && idleClinet;
            }

            if (Object.keys(onlineUsers).length > 1)
                logVerbose("[vfs-collab] User", userIds.userId, "is connecting Collab with",
                    Object.keys(clients).length - 1, "other clients & online workspace members", onlineUsers);

            var usersMap = {};
            users.forEach(function (user) {
                var uid = user.uid;
                var onlineUserClients = onlineUsers[uid] || [];
                var onlineState;
                if (idleUsers[uid])
                    onlineState = "idle";
                else if (onlineUserClients.length)
                    onlineState = "online";
                else
                    onlineState = "offline";
                usersMap[uid] = {
                    md5Email: hashString(user.email),
                    fullname: user.fullname,
                    uid: user.uid,
                    clients: onlineUserClients, 
                    online: onlineUserClients.length,
                    state: onlineState,
                    author: authorPool[uid],
                    color: colorPool[uid]
                };
            });

            broadcast({
                type: "USER_JOIN",
                data: {
                    userId: userId,
                    clientId: clientId,
                    user: usersMap[userId]
                }
            }, client);

            Store.recentChatHistory(100, function (err, chatHistory) {
                if (err)
                    logError("[vfs-collab] recentChatHistory", err);

                client.send({
                    type: "CONNECT",
                    data: {
                        myClientId: clientId,
                        myUserId: userId,
                        fs: userIds.fs,
                        authorPool: authorPool,
                        colorPool: colorPool,
                        users: usersMap,
                        chatHistory: chatHistory || []
                    }
                });
            });
        });
    }
}

/**
 * Returns true if the users has read access to the filesystem
 */
function collabReadAccess(fs) {
    return (/r/).test(fs);
}

/**
 * Returns true if the users has write access to the filesystem
 */
function collabWriteAccess(fs) {
    return (/w/).test(fs);
}

/**
 * Apply a user's operation to a document
 * @param {Object}    userIds - user descriptor with: uid, email, fullname, fs, clientId 
 * @param {String}    docId   - the document path
 * @param {Document}  doc     - the document to apply the operation on
 * @param {Operation} op      - the operation to applly
 * @param {Function}  callback
 */
function applyOperation(userIds, docId, doc, op, callback) {
    userIds = userIds || { userId: 0 };
    var userId = userIds.userId;
    Store.getWorkspaceState(function (err, ws) {
        if (err)
            return callback(err);
        try {
            doc.contents = applyContents(op, doc.contents);
            applyAuthorAttributes(doc.authAttribs || [], op, ws.authorPoolParsed[userId]);

            wrapSeq(Revision.create({
                operation: new Buffer(JSON.stringify(op)),
                author: userId,
                revNum: doc.revNum + 1,
                document_id: doc.id
            }), next);
        } catch (e) {
            return next(e);
        }
    });
    function next(err) {
        if (err)
            return callback(err);
        if (userId == 0) {
            detectCodeRevertError(op, doc.revNum, doc);
        }
        var contentsHash = hashString(doc.contents);
        doc.revNum++;
        logVerbose("[vfs-collab] applyOperation saveDocument User " + userId + " client " + userIds.clientId + " doc " + docId + " revNum " + doc.revNum + " fsHash " + doc.fsHash + " contentsHash " + contentsHash + " time: " + Date.now());
        Store.saveDocument(doc, function (err) {
            if (err)
                return callback(err);
                
            logVerbose("[vfs-collab] applyOperation successfully saved User " + userId + " client " + userIds.clientId + " doc " + docId + " revNum " + doc.revNum + " fsHash " + doc.fsHash + " contentsHash " + contentsHash + " time: " + Date.now());
            var msg = {
                docId: docId,
                clientId: userIds.clientId,
                userId: userId,
                revNum: doc.revNum,
                op: op
            };
            callback(null, msg);
        });
    }
}

function detectCodeRevertError(operation, lastRevisionNum, doc) {
    Store.getRevisions(doc, function(err, revisions) {
        if (err) return logError("[vfs-collab] Failed to get document revisions in detectCodeRevertError");
        
        var lastRevision = revisions[lastRevisionNum];
        if (!lastRevision || !lastRevision.operation) return;
        
        
        var lastOperation = lastRevision.operation;
        if (operation.length != lastOperation.length) return;
        
        if (!areOperationsMirrored(operation, lastOperation)) return;
        
        logError("[vfs-collab] ERROR: Detected code revert by system in ", doc.path, "revision " + (lastRevisionNum + 1) + ". Investigation needed.");
    });
}

// Check if all operations are the same except for insert/delete which is the opposite
function areOperationsMirrored(operation1, operation2) {
    if (!operation1.length || !operation2.length) return false;
    operation1 = removeNoopOperations(operation1);
    operation2 = removeNoopOperations(operation2);
    
    function areOpsMirrors(op1, op2) {
        if (!op1.length || !op2.length) return true;
        if (["i", "d"].indexOf(op1.charAt(0)) >= 0 && ["i", "d"].indexOf(op2.charAt(0)) >= 0) {
            if (op1.charAt(0) != op2.charAt(0) && op1.slice(1) == op2.slice(1)) {
                return true; 
            }
        } 
        else if (op1 == op2) {
            return true;
        }
    }
    
    for (var i = 0; i < operation1.length; i++) {
        if (areOpsMirrors(operation1[i], operation2[i])) continue; 
        
        // Check if they are mirrored and order is just flipped
        if (operation2[i + 1] != null && areOpsMirrors(operation1[i], operation2[i + 1]) && areOpsMirrors(operation1[i + 1], operation2[i])) {
            i++; // As we already compared this and the next
            continue;
        }
        
        return false;
    }
    
    return true;
}

function removeNoopOperations(ops) {
    var operations = ops.filter(function (op) {
        if (["d", "i", "r0"].indexOf(op) >= 0) { 
            return false;
        }
        return true;
    });
    
    return operations;
}

/**
 * Handle user's EDIT_UPDATE for a document
 * @param {Object} userIds - user descriptor with: uid, email, fullname, fs, clientId 
 * @param {Socket} client  - the connected collab client
 * @param {Object} data    - the EDIT_UPDATE message data with the document id, revision number and applied operation
 */
function handleEditUpdate(userIds, client, data) {
    var docId = data.docId;
    var userId = userIds.userId;
    var clientId = userIds.clientId;
    var newRev = data.revNum;
    var docL;

    logVerbose("[vfs-collab] handleEditUpdate User " + userId + " client " + clientId + " doc " + docId + " revision " + newRev);
    function done(err) {
        unlock(docId);
        if (err) {
            syncCommit(err);
        }
    }

    // the user's edit couldn't be commited, please try again
    function syncCommit(err) {
        logVerboseError("[vfs-collab] encountered syncCommit error User " + userId + " client " + clientId + " doc " + docId + " revision " + newRev + " err " + err.message);
        client.send({
            type: "SYNC_COMMIT",
            data: {
                docId: docId,
                revNum: docL && docL.revNum,
                reason: err.message || err,
                code: err.code || "SYNC_E"
            }
        });
    }

    if (!documents[docId] || !documents[docId][clientId] || !client.openDocIds[docId])
        return done("Trying to update a non-member document!",
            docId, clientId, documents[docId] && Object.keys(documents[docId]), Object.keys(client.openDocIds),
            Object.keys(documents), Object.keys(clients));

    if (!collabWriteAccess(userIds.fs))
        return done("User " + userIds.userId + " doesn't have write access to edit document " + docId + " - fs: " + userIds.fs);

    // Lock a document while updating - to stop any possible inconsistencies
    lock(docId, function () {
        Store.getDocument(docId, function (err, doc) {
            if (err || !doc)
                return done(err || ("No Document to update! " + docId));

            docL = doc;

            if (doc.revNum !== newRev - 1) { // conflicting versions
                var err2 = new Error("Version log: " + docId + " " + doc.revNum + " " + newRev);
                err2.code = "VERSION_E";
                return done(err2);
            }

            // message.author for udno auth attributes
            applyOperation(userIds, docId, doc, data.op, function (err, msg) {
                if (err) {
                    var err2 = new Error("OT Error: " + String(err));
                    err2.code = "OT_E";
                    return done(err2);
                }

                msg.selection = data.selection;
                var contentsHash = hashString(doc.contents);
                logVerbose("[vfs-collab] broadcasting EDIT_UPDATE User " + userId + " client " + clientId + " doc " + docId + " revision " + newRev + " fsHash " + doc.fsHash + " contentsHash " + contentsHash);
                broadcast({
                    type: "EDIT_UPDATE",
                    data: msg
                }, client, docId);

                delete msg.op;
                delete msg.selection;

                client.send({
                    type: "EDIT_UPDATE",
                    data: msg
                });
                
                emitter.emit("afterEditUpdate", {
                    docId: docId,
                    path: getAbsolutePath(docId),
                    doc: doc
                });

                done();
            });
        });
    });
}

function handleResolveConflict(userInfo, client, data) {
    var docId = data.docId;
    logVerbose("[vfs-collab] Handling resolve conflict with data: ", data, " doc is: ", documents[docId]);
    broadcast({
        type: "RESOLVE_CONFLICT",
        data: data
    }, client, docId); 
}

/**
 * Handle user's UPDATE_NL_CHAR for a document
 * @param {Object} userIds - user descriptor with: uid, email, fullname, fs, clientId 
 * @param {Socket} client  - the connected collab client
 * @param {Object} data    - the UPDATE_NL_CHAR message data with the document id, newLineChar
 */
function handleUpdateNlChar(userInfo, client, data) {
    var docId = data.docId;
    var newLineChar = data.newLineChar || "";

     var nlCharLog;
    switch (newLineChar) {
        case "\n":
            nlCharLog = "\\n";
            break;
        case "\r\n":
            nlCharLog = "\\r\\n";
            break;
        default:
            nlCharLog = newLineChar.length + ":" + newLineChar;
            return missingInfo();
    }

    if (!docId)
        return missingInfo();

    function missingInfo() {
        logError("[vfs-collab] updateNlChar missing info:", docId, nlCharLog);
    }

    function done(err) {
        unlock(docId);
        if (err)
            logError("[vfs-collab] updateNlChar failed:", err);
    }

    // Lock a document while updating - to stop any possible inconsistencies
    lock(docId, function () {
        Store.getDocument(docId, function(err, doc) {
            if (err || !doc)
                return done((err || "updateNlChar of a non-collab document!") + " : " + docId);
            if (doc.newLineChar == newLineChar)
                return done();
            doc.newLineChar = newLineChar;
            Store.saveDocument(doc, function (err) {
                if (err)
                    return done(err);
                logVerbose("[vfs-collab] updateNlChar changed", newLineChar);

                broadcast({
                    type: "UPDATE_NL_CHAR",
                    data: {
                        docId: docId,
                        newLineChar: newLineChar
                    }
                }, client, docId);
                done();
            });
        });
    });
}

/**
 * Handle user's CHAT_MESSAGE
 * @param {Object} userIds - user descriptor with: uid, email, fullname, fs, clientId 
 * @param {Socket} client  - the connected collab client
 * @param {Object} data    - the CHAT_MESSAGE data with the chat text
 */
function handleChatMessage(userIds, client, data) {
    var text = data.text;
    var userId = userIds.userId;

    // Save the chat message and broadcast it
    Store.saveChatMessage(text, userId, function (err, message) {
      if (err)
          return logError("[vfs-collab] saveChatMessage:", err);
      var msg = {
          type: "CHAT_MESSAGE",
          data: {
            id: message.id,
            userId: userId,
            timestamp: message.timestamp,
            text: text
          }
      };

      broadcast(msg);
  });
}

/**
 * Handle user's CURSOR_UPDATE messages
 * @param {Object} userIds - user descriptor with: uid, email, fullname, fs, clientId 
 * @param {Socket} client  - the connected collab client
 * @param {Object} data    - the CURSOR_UPDATE data with the document id and the user selection
 */
function handleCursorUpdate(userIds, client, data) {
    var docId = data.docId;
    var clientId = userIds.clientId;

    if (!documents[docId] || !documents[docId][clientId] || !client.openDocIds[docId])
        return logError("[vfs-collab] Trying to select in a non-member document!",
            docId, clientId, documents[docId] && Object.keys(documents[docId]), Object.keys(client.openDocIds),
            Object.keys(documents), Object.keys(clients));

    documents[docId][clientId].selection = data.selection;
    data.clientId = clientId;
    data.userId = userIds.userId;
    broadcast({
        type: "CURSOR_UPDATE",
        data: data
    }, client, docId);
}

/**
 * Broadcast a message to all or a selected group of connected collab clients
 * @param {Object} message - the message to broadcast
 * @param {Socket} sender  - optional, when we want to exclude the sender from the group to send the message to
 * @param {String} docId   - the document id or path
 */
function broadcast(message, sender, docId) {
    var toClientIds = docId ? documents[docId] : clients;
    var audienceNum = 0;
    for (var clientId in toClientIds) {
        var client = clients[clientId];
        // Exclude sender if exists
        if (client === sender || !client)
            continue;
        client.send(message);
        audienceNum++;
    }
}

function getAbsolutePath(docId) {
    if (docId[0] === "~" && docId[1] === "/")
        return Path.join(getHomeDir(), docId.substring(1));
    else
        return Path.join(basePath, docId);
}

/**
 * Watch documents for other filesystem changes and sync them back to the collab documents
 * @param docId - the document id or path
 */
function initVfsWatcher(docId) {
    var absPath = getAbsolutePath(docId);

    function done(err) {
        if (err)
            logError("[vfs-collab] WATCH ERR:", docId, err);
        unlock(docId);
    }

    // Check if a collab document sync is needed, apply it and save to the filesystem
    function doWatcherSync(stats, next) {
        var ctime = new Date(stats.ctime).getTime();
        var watcher = watchers[docId];
        var timeDiff = ctime - watcher.ctime;
        logVerbose("[vfs-collab] WATCH CHANGE:", docId, "last ctime:", watcher.ctime, "new ctime:", ctime);
        if (watcher.ctime && timeDiff < 1)
            return;
        lock(docId, function () {
            logVerbose("[vfs-collab] WATCH SYNC:", docId, "time diff: ", timeDiff);
            watcher.ctime = ctime;
            Store.getDocument(docId, function (err, oldDoc) {
                if (err)
                    return next(err);
                syncDocument(docId, oldDoc, null, false, function (err, doc2) {
                    if (err) return next(err);
                    if (doc2.syncedWithDisk) {
                        doSaveDocument(docId, doc2, -1, true, function(err, result) {
                            if (err) return next(err);
                            broadcast({ type: "FILE_SAVED", data: result }, null, docId);
                            next();
                        });
                        delete doc2.syncedWithDisk;
                    }
                    next();
                });
            });
        });
    }

    localfsAPI.watch(absPath, {}, function (err, meta) {
        if (err)
            return logError("[vfs-collab] WATCH INIT ERR:", docId, err);

        var watcher = meta.watcher;
        watcher.on("change", function (event, filename, stat, files) {
            if (stat.vfsWrite) // ignore our own writes
                return;
            doWatcherSync(stat, done);
        });
        watcher.on("error", function(err) {
            logError("[vfs-collab] WATCH ERR:", docId, err);
        });
        watchers[docId] = watcher;
        watcher.ctime = Date.now();
        Fs.stat(absPath, function (err, stat) {
            if (err) return;
            watcher.ctime = new Date(stat.ctime).getTime();
        });
    });
}

/**
 * Handle user's JOIN_DOC messages - a user is joining a document to collaborate on
 * @param {Object} userIds - user descriptor with: uid, email, fullname, fs, clientId 
 * @param {Socket} client  - the connected collab client
 * @param {Object} data    - the JOIN_DOC data with the document id
 */
function handleJoinDocument(userIds, client, data) {
    var docId = data.docId;
    var clientId = userIds.clientId;
    var userId = userIds.userId;
    
    logVerbose("[vfs-collab] User", clientId, "trying to join document", docId);

    function done(err) {
        if (err) {
            logError("[vfs-collab] handleJoinDocument ERR:", docId, err);
            client.send({
                type: "JOIN_DOC",
                data: {
                    clientId: clientId,
                    docId: docId,
                    err: err
                }
            });
        }
        logVerbose("[vfs-collab] User", clientId, "joined document", docId);
        unlock(docId);
    }

    lock(docId, function() {
        Store.getDocument(docId, function(err, doc) {
            if (err)
                return done("getDocument " + String(err));

            if (doc && documents[docId])
                return fetchMetadataThenJoinDocument(doc);

            logVerbose("[vfs-collab] Joining a closed document", docId, " - Syncing");
            syncDocument(docId, doc, client, false, function(err, doc2) {
                if (err)
                    return done(err);
                fetchMetadataThenJoinDocument(doc2);
            });
        });
    });

    function fetchMetadataThenJoinDocument(doc) {
        localfsAPI.getMetadata(docId, { sandbox: basePath }, function(err, metadata) {
            if (err)
                logError("[vfs-collab] Warning: failed to fetch metadata!", docId, err);
            var file = getAbsolutePath(docId);
            isVeryLargeFile(file, doc.contents, function(err, isLarge) {
                if (err)
                    logError("[vfs-collab] isVeryLargeFile failed:", err);
                if (!isLarge)
                    return joinDocument(doc, String(metadata || ""));
                client.send({
                    type: "LARGE_DOC",
                    data: {
                        userId: userId,
                        clientId: clientId,
                        docId: docId,
                        response: true
                    }
                });
            });
        });
    }

    function joinDocument(doc, metadata) {
        if (!documents[docId]) {
            documents[docId] = {};
            initVfsWatcher(docId);
            logVerbose("[vfs-collab] User", clientId, "is joining document", docId);
        }
        else {
            logVerbose("[vfs-collab] User", clientId, "is joining a document", docId, "with",
                Object.keys(documents[docId]).length, "other document members");
        }

        var docHash = hashString(doc.contents);

        var clientDoc = JSON.stringify({
            selections: documents[docId],
            authAttribs: doc.authAttribs,
            contents: doc.contents.toString(),
            metadata: metadata,
            fsHash: doc.fsHash,
            docHash: docHash,
            revNum: doc.revNum,
            newLineChar: doc.newLineChar,
            created_at: doc.created_at,
            updated_at: doc.updated_at,
            lastUpdate: doc.lastUpdate
        });

        documents[docId][clientId] = userIds;
        client.openDocIds[docId] = true;
        
        logVerbose("[vfs-collab] User", clientId, "is opening", docId, "revNum", doc.revNum, "docHash", docHash, "fsHash", doc.fsHash);

        // Cut the document to pices and stream to the client
        var chunkSize = 10 * 1024; // 10 KB
        var contentsLen = clientDoc.length;
        var chunksLen = Math.ceil(contentsLen / chunkSize);
        for (var i = 0; i < contentsLen; i += chunkSize) {
            var chunk = clientDoc.slice(i, i + chunkSize);
            client.send({
                type: "JOIN_DOC",
                data: {
                    userId: userId,
                    clientId: clientId,
                    docId: docId,
                    reqId: data.reqId,
                    chunkNum: (i / chunkSize) + 1,
                    chunksLength: chunksLen,
                    chunk: chunk
                }
            });
        }
        
        if (doc.hasPendingChanges) {
            logVerbose("Sending doc ", docId, " has pending changes to user ", userId, " client ", clientId);
            client.send({
                type: "DOC_HAS_PENDING_CHANGES",
                data: {
                    userId: userId,
                    clientId: clientId,
                    docId: docId,
                }
            });
            delete doc.hasPendingChanges;
        }

        if (doc.changedOnDisk) {
            logVerbose("Sending doc ", docId, " has changed on disk to user ", userId, " client ", clientId);
            client.send({
                type: "DOC_CHANGED_ON_DISK",
                data: {
                    userId: userId,
                    clientId: clientId,
                    docId: docId,
                }
            });
            delete doc.changedOnDisk;
        }

        broadcast({
            type: "JOIN_DOC",
            data: {
                docId: docId,
                userId: userId,
                clientId: clientId
            }
        }, client);

        done();
    }
}

/**
 * Normalize text line terminators for collab index-based calculations to seamlessly work
 * @param  {String} text
 * @return {String} normalized
 */
function normalizeTextLT(text) {
    return text.replace(/\r\n|\r/g, "\n");
}

// return "\n" or "\r\n" or null
function detectNewLineChar(text) {
    // Must be the strictly same as on the client
    // (and note that Ace doesn't have \r newLine mode)
    var match = text.match(/^.*?(\r\n|\n)/m);
    return match && match[1];
}

/**
 * Synchronize collab document state with the filesystem state (utilizing hashes)
 *
 * @param {String}   docId - the document id or path
 * @param {Document} doc   - the collab document
 * @param {Client} client   - the client requesting the sync
 * @param {Boolean} forceSync   - skip all the sanity checks, just sync from disk if the collab doc is different from disk
 * @param {Function} callback
 */
function syncDocument(docId, doc, client, forceSync, callback) {
    var file = getAbsolutePath(docId);
    isBinaryFile(file, function (err, isBinary) {
        if (err)
            return callback(new Error("SYNC: Binary check failed - ERR: " + String(err)));
        if (isBinary)
            return callback(new Error("SYNC: Binary file opened " + isBinary));
        
        isVeryLargeFile(file, null, function(err, isLarge) {
            if (err)
                return callback(err);

            if (!isLarge)
                return doSyncDocument();
            
            logError("[vfs-collab] File is too large, ignoring: " + file);
            err = new Error("File is too large");
            err.code = "ELARGE";
            callback(err);
        });
    });
    
    function doSyncDocument() {
        Fs.readFile(file, "utf8", function (err, contents) {
            if (err)
                return callback(err);

            // "\n" or "\r\n" or null
            var newLineChar = detectNewLineChar(contents);
            var oldNewLineChar = doc && doc.newLineChar || DEFAULT_NL_CHAR_DOC;
            var normContents = normalizeTextLT(contents);

            var fsHash = hashString(normContents);
            
            if (doc && typeof doc.contents != "string" && doc.contents)
                doc.contents = doc.contents.toString(); // because it can be a buffer
            
            // HACK: fsHash from database is unreliable (https://github.com/c9/newclient/issues/3980)
            if (doc)
                doc.fsHash = hashString(doc.contents);
            
            if (!doc) {
                logVerbose("[vfs-collab] SYNC: Creating document:", docId, fsHash);

                Store.newDocument({
                    path: docId,
                    contents: normContents,
                    fsHash: fsHash,
                    newLineChar: newLineChar
                }, callback);
            }
            // update database OT state
            else if (fsHash !== doc.fsHash && doc.contents != normContents) {
                logVerbose("[vfs-collab] Doc", docId, " revnum: ", doc.revNum, "with hash:", doc.fsHash, "does not match file system hash", fsHash);
                if (forceSync) return syncCollabDocumentWithDisk();
                
                // Check if the document was updated at the same time as this revision. 
                // If it was then this doc has been saved as a revision before, no need to sync to it
                Fs.stat(file, function (err, stats) {
                    if (err) return callback(err);
                    
                    var lastFileChange = stats.ctime.getTime();
                    var lastCollabChange = doc.lastUpdate;
                    var lastSaveStart = lastSaveStarts[docId];
                    logVerbose("[vfs-collab] Doc", docId, "Last file change:", lastFileChange, " last collab change:", lastCollabChange, " last save start: ", lastSaveStart);
                    
                    // Never sync if the last doc change is older than the last collab change
                    if (lastFileChange < lastCollabChange) {
                        if (!client) {
                            logVerbose("[vfs-collab] Broadcasting document", docId, "has pending changes");
                            broadcast({
                                type: "DOC_HAS_PENDING_CHANGES",
                                data: {
                                    docId: docId
                                }
                            });
                        } 
                        else {
                            doc.hasPendingChanges = true;
                        }
                        return callback(null, doc);
                    }
                    
                    return documentContentsHaveChanged(lastCollabChange);
                });
            }
            else {
                checkNewLineChar();
                callback(null, doc);
            }
            
            function documentContentsHaveChanged(lastCollabChange) {
                var timeSinceLastCollabChange = Date.now() - lastCollabChange;
                if (wasLatestRevisionSaved(doc)) {
                    return syncCollabDocumentWithDisk();
                } else if (timeSinceLastCollabChange > UNSAVED_CHANGE_EXPIRY_TIME) {
                    logVerbose("[vfs-collab] Doc ", docId, " last collab change was " + (timeSinceLastCollabChange / 1000) + "s ago. Expiring change and syncing from disk");
                    return syncCollabDocumentWithDisk();
                }
                
                return informUserFileContentsHaveChanged();
            }
            
            function informUserFileContentsHaveChanged() {
                if (!client) {
                    logVerbose("[vfs-collab] Broadcasting document", docId, "contents have changed");
                    broadcast({
                        type: "DOC_CHANGED_ON_DISK",
                        data: {
                            docId: docId
                        }
                    });
                } else {
                    doc.changedOnDisk = true;
                }
                return callback(null, doc);
            }
            
            function syncCollabDocumentWithDisk() {
                var op = operations.operation(doc.contents, normContents);
                logVerbose("[vfs-collab] SYNC: Syncing document from disk:", docId, op.length, "fsHash", fsHash, "docHash", doc.fsHash);
                // non-user sync operation
                doc.fsHash = fsHash; // applyOperation will save it for me
                
                doc.syncedWithDisk = true;
                doc.newLineChar = newLineChar || oldNewLineChar;
                applyOperation(null, docId, doc, op, function (err, msg) {
                    if (err)
                        return callback("SYNC: Failed updating OT database document state! " + String(err));
                    msg.sync = true;
                    broadcast({
                        type: "EDIT_UPDATE",
                        data: msg
                    }, null, docId);

                    checkNewLineChar();
                    callback(null, doc);
                });
            }

            function checkNewLineChar() {
                if (newLineChar && oldNewLineChar !== newLineChar) {
                    broadcast({
                        type: "UPDATE_NL_CHAR",
                        data: {
                            oldNewLineChar: oldNewLineChar,
                            newLineChar: newLineChar
                        }
                    }, null, docId);
                    doc.newLineChar = newLineChar || oldNewLineChar;
                }
            }
        });
    }
}

/**
 * Handle user's GET_REVISIONS messages - retrive the revision history of the file
 *
 * @param {Object} userIds - user descriptor with: uid, email, fullname, fs, clientId 
 * @param {Socket} client  - the connected collab client
 * @param {Object} data    - the JOIN_DOC data with the document id
 */
function handleGetRevisions(userIds, client, data) {
    var docId = data.docId;

    function done(err) {
        if (err)
            logError("[vfs-collab] handleGetRevisions ERR:", docId, err);
        unlock(docId);
    }

    lock(docId, function () {
        Store.getDocument(docId, function (err, doc) {
            if (err)
                return done("getDocument " + String(err));

            Store.getRevisions(doc, function (err, revisions) {
                if (err || !revisions)
                    return done("getRevisions " + (revisions || []).length + " " + String(err));

                var docRevisions = JSON.stringify({
                    revisions: revisions,
                    starRevNums: doc.starRevNums,
                    revNum: doc.revNum
                });

                // Cut the revisions into pices and stream to the client
                var chunkSize = 10 * 1024; // 10 KB
                var contentsLen = docRevisions.length;
                var chunksLen = Math.ceil(contentsLen / chunkSize);
                for (var i = 0; i < contentsLen; i += chunkSize) {
                    var chunk = docRevisions.slice(i, i + chunkSize);
                    client.send({
                        type: "GET_REVISIONS",
                        data: {
                            userId: userIds.userId,
                            clientId: userIds.clientId,
                            docId: data.docId,
                            chunkNum: (i / chunkSize) + 1,
                            chunksLength: chunksLen,
                            chunk: chunk
                        }
                    });
                }
                done();
            });
        });
    });
}

/**
 * Handle user's SAVE_FILE messages - save collab documents
 * @param {Object} userIds - user descriptor with: uid, email, fullname, fs, clientId 
 * @param {Socket} client  - the connected collab client
 * @param {Object} data    - the SAVE_FILE data with the document id and wether to sielently save (with auto-save enabled) or star the save
 */
function handleSaveFile(userIds, client, data) {
    var st = Date.now();
    var docId = data.docId;
    var postProcessor = data.postProcessor;
    var userId = userIds.userId;
    
    lastSaveStarts[docId] = Date.now();

    function done(err, result) {
        unlock(docId);
        if (err) {
            logError("[vfs-collab] Failed to save file. docID: " + docId + " Err: ", err);
            client.send({
                type: "FILE_SAVED",
                data: {
                    docId: docId,
                    err: err
                }
            });
            return;
        }
                    
        broadcast({ type: "FILE_SAVED", data: result }, null, docId);
    }

    logVerbose("[vfs-collab] Saving file", docId);
    client.send({ type: "FILE_LOCKING", data: { docId: docId }});

    lock(docId, function () {
        client.send({ type: "FILE_LOCKED", data: { docId: docId }});
        Store.getDocument(docId, ["contents", "revNum", "starRevNums", "newLineChar"], function (err, doc) {
            if (err || !doc)
                return done((err || "Writing a non-collab document!") + " : " + docId);

            if (watchers[docId])
                watchers[docId].ctime = Date.now();
                
            client.send({ type: "FILE_RETRIEVED", data: { docId: docId }});

            var absPath = getAbsolutePath(docId);
            var fileContents = doc.contents.replace(/\n/g, doc.newLineChar || DEFAULT_NL_CHAR_FILE);

            mkfileWriteFile(fileContents, writeFileCallback);

            function mkfileWriteFile(contents, callback) {
                var options = { bufferWrite: true };
                var stream = options.stream = new Stream();
                stream.readable = true;
                localfsAPI.mkfile(absPath, options, callback);
                stream.emit("data", contents);
                stream.emit("end");
            }

            /*
            function regularWriteFile() {
                Fs.writeFile(absPath, doc.contents, "utf8", writeFileCallback);
            }
            */

            function writeFileCallback(err) {
                if (err) return done("Failed saving file ! : " + docId + " ERR: " + String(err));
                
                client.send({ type: "DATA_WRITTEN", data: { docId: docId }});
                doSaveDocument(docId, doc, userId, !data.silent, function (err, result) {
                    logVerbose("[vfs-collab] Saving took", Date.now() - st, "ms - time is now: " + Date.now() + " file:", docId, !err);
                    if (err) {
                        client.send({
                            type: "POST_PROCESSOR_ERROR",
                            data: {
                                code: err.code,
                                stderr: err.stderr,
                                docId: docId,
                            }
                        });
                        return done(err);
                    }
                    
                    if (postProcessor) {
                        return execPostProcessor(absPath, docId, doc, fileContents, client, postProcessor, function(err) {
                            done(err, result);
                        });
                    }

                    done(null, result);
                });
            }
        });
    });
}

function execPostProcessor(absPath, docId, doc, fileContents, client, postProcessor, callback) {
    localfsAPI.writeToWatchedFile(absPath, function(afterWrite) {
        localfsAPI.execFile(postProcessor.command, {
            args: postProcessor.args.map(function(a) { return a.replace(/\$file/g, absPath); }),
            cwd: Path.dirname(absPath),
        },
        function(err, result) {
            if (err) {
                client.send({
                    type: "POST_PROCESSOR_ERROR",
                    data: {
                        code: err.code,
                        stderr: err.stderr,
                        docId: docId,
                    }
                });
            }
            
            syncDocument(docId, doc, null, true, function() {
                afterWrite(callback)
            });
        });
    });
}

/**
 * Apply the save to the collab document, update the hash and optionally add a star revision
 * @param {String}   docId     - the document id or path
 * @param {Document} doc       - the collab document
 * @param {String}  userId     - the user id
 * @param {Boolean} star       - add a star to the document if not triggered by auto-save
 * @param {Function} callback
 */
function doSaveDocument(docId, doc, userId, star, callback) {
    if (star && doc.starRevNums.indexOf(doc.revNum) === -1)
        doc.starRevNums.push(doc.revNum);

    var fsHash = doc.fsHash = hashString(doc.contents);
    Store.saveDocument(doc, function (err) {
        if (err)
            return callback(err);
        logVerbose("[vfs-collab] User", userId, "saved document", docId, "revision", doc.revNum, "hash", fsHash);
        callback(null, {
            userId: userId,
            docId: docId,
            star: star,
            revNum: doc.revNum,
            fsHash: fsHash
        });
    });
}

/** 
 * Was the latest document revision saved to disk or is it just in the collabdb
 * @param {Document} doc
 */
function wasLatestRevisionSaved(doc) {
    return doc.starRevNums && doc.starRevNums.indexOf(doc.revNum) >= 0;
}


/**
 * Handle user's LEAVE_DOC messages - client closing a collab document
 * @param {Object} userIds - user descriptor with: uid, email, fullname, fs, clientId 
 * @param {Socket} client  - the connected collab client
 * @param {Object} data    - the LEAVE_DOC data with the document id
 */
function handleLeaveDocument(userIds, client, data) {
    var docId = data.docId;
    var userId = userIds.userId;
    var clientId = userIds.clientId;
    var userDisconnected = data.disconnected;
    if (!documents[docId] || !documents[docId][clientId] || !client.openDocIds[docId])
        return logError("[vfs-collab] Trying to leave a non-member document!",
            docId, clientId, documents[docId] && Object.keys(documents[docId]), Object.keys(client.openDocIds),
            Object.keys(documents), Object.keys(clients));
    delete client.openDocIds[docId];
    logVerbose("[vfs-collab]", clientId, "is leaving document", docId);
    delete documents[docId][clientId];
    if (!Object.keys(documents[docId]).length) {
        logVerbose("[vfs-collab] Closing document", docId);
        if (!userDisconnected) {
            // If the user closed this on purpose and it's the last user
            // Resync this document with what's on disk to remove unsaved collab changes
            logVerbose("[vfs-collab] Last user closed document ", docId, " resyncing it from disk");
            Store.getDocument(docId, function (err, doc) {
                if (err) return logError("[vfs-collab] Failed to get doc", docId, " from the store. Error is: ", err.message);
                syncDocument(docId, doc, null, true, function(err) {
                    if (err) return logError("[vfs-collab] Failed to sync", docId, "with disk. Error is: ", err.message);
                    logVerbose("[vfs-collab] Successfully synced document", docId, " with disk.");
                });
            });
        }
        closeDocument(docId);
    }

    broadcast({
        type: "LEAVE_DOC",
        data: {
            docId: docId,
            userId: userId,
            clientId: clientId
        }
    }, client);
}

/**
 * Handle user's LARGE_DOC messages - document has grown too large for collab
 * 
 * @param {Object} userIds - user descriptor with: uid, email, fullname, fs, clientId 
 * @param {Socket} client  - the connected collab client
 * @param {Object} data    - the LEAVE_DOC data with the document id
 */
function handleLargeDocument(userIds, client, data) {
    var docId = data.docId;
    var userId = userIds.userId;
    var clientId = userIds.clientId;
    logVerbose("[vfs-collab] ", docId);
    delete documents[docId][clientId];
    if (!Object.keys(documents[docId]).length) {
        logVerbose("[vfs-collab] File has grown too large, ignoring: " + docId);
        closeDocument(docId);
    }

    broadcast({
        type: "LARGE_DOC",
        data: {
            docId: docId,
            userId: userId,
            clientId: clientId
        }
    }, client);
}

/**
 * Handle user's USER_STATE messages - update connected clients with user state
 * @param {Object} userIds - user descriptor with: uid, email, fullname, fs, clientId 
 * @param {Socket} client  - the connected collab client
 * @param {Object} data    - the JOIN_DOC data with the document id
 */
function handleUserState(userIds, client, data) {
    var userId = userIds.userId;
    var clientId = userIds.clientId;
    logVerbose("[vfs-collab]", clientId, "is switching to", data.state);
    clients[clientId].state = data.state;
    var isUserIdle = Object.keys(clients)
        .map(function(cliId) {
            return clients[cliId];
        }).filter(function(cl) {
            return cl.userIds.userId === userId;
        }).reduce(function(isIdle, cl) {
            return isIdle && cl.state === "idle";
        }, true);

    broadcast({
        type: "USER_STATE",
        data: {
            state: isUserIdle ? "idle" : "online",
            userId: userId,
            clientId: clientId
        }
    }, client);
}

/**
 * Clears specific chat messages or complete chat history
 *
 * @param {Object} userIds - user descriptor with: uid, email, fullname, fs, clientId 
 * @param {Socket} client  - the connected collab client
 * @param {Object} data    - either id: $id of the message to be deleted or clear: true to clear all of the chat history
 */
function handleClearChat(userIds, client, data) {
    logVerbose("[vfs-collab] Clear chat history: ", data.id, data.clear, userIds.fs);

    if (!collabWriteAccess(userIds.fs))
        return logError("[vfs-collab] clearChat: User don't have write access!");

    var stmt;
    if (data.clear)
        stmt = ChatMessage.destroy({}, { truncate: true });
    else if (data.id)
        stmt = ChatMessage.destroy({ id: data.id });
    else
        return logError("[vfs-collab] clearChat: Invalid message", data);

    wrapSeq(stmt, function(err) {
        logError("[vfs-collab] Chat clear:", err ? err : "SUCCESS");
        if (err)
            return;
        broadcast({
            type: "CLEAR_CHAT",
            data: data
        });
    });
}

/**
 * Clears specific chat messages or complete chat history
 *
 * @param {Object} userIds - user descriptor with: uid, email, fullname, fs, clientId 
 * @param {Socket} client  - the connected collab client
 * @param {Object} data    - either id: $id of the message to be deleted or clear: true to clear all of the chat history
 */
function broadcastUserMessage(userIds, client, data) {
    logVerbose("[vfs-collab] Clear chat history: ", data.id, data.clear, userIds.fs);

    broadcast({
        type: "MESSAGE",
        data: data
    }, client);
}


function isPathAllowed(userIds, docId) {
    // only accept normalized unix paths without /../ or /./ or ../
    if (/(\/|^)[.]{1,2}(\/|$)|\\/.test(docId))
        return false;
    // do not allow redonly users to open ~
    if (userIds.fs == "r" && docId[0] === "~" && docId[1] === "/")
        return false;
    return true;
}

/**
 * Handle any user message by routing to its proper handler
 *
 * @param {Object} userIds - user descriptor with: uid, email, fullname, fs, clientId 
 * @param {Socket} client  - the connected collab client
 * @param {Object} data    - the SAVE_FILE data with the document id and wether to sielently save (with auto-save enabled) or star the save
 */
function handleUserMessage(userIds, client, message) {
    var data = message.data || {};
    var docId = data.docId || "";
    if (docId[0] === "/")
        docId = docId.slice(1);
    
    if (!isPathAllowed(userIds, docId)) {
        return client.send({
            type: message.type,
            data: {
                clientId: userIds.clientId,
                docId: docId,
                err: { message: "Not allowed." }
            }
        });
    }
    data.docId = docId;
    switch (message.type) {
    case "JOIN_DOC":
        handleJoinDocument(userIds, client, data);
        break;
    case "GET_REVISIONS":
        handleGetRevisions(userIds, client, data);
        break;
    case "LEAVE_DOC":
        handleLeaveDocument(userIds, client, data);
        break;
    case "LARGE_DOC":
        handleLargeDocument(userIds, client, data);
        break;
    case "EDIT_UPDATE":
        handleEditUpdate(userIds, client, data);
        break;
    case "RESOLVE_CONFLICT":
        handleResolveConflict(userIds, client, data);
        break;
    case "UPDATE_NL_CHAR":
        handleUpdateNlChar(userIds, client, data);
        break;
    case "CURSOR_UPDATE":
        handleCursorUpdate(userIds, client, data);
        break;
    case "SAVE_FILE":
        handleSaveFile(userIds, client, data);
        break;
    case "CHAT_MESSAGE":
        handleChatMessage(userIds, client, data);
        break;
    case "USER_STATE":
        handleUserState(userIds, client, data);
        break;
    case "CLEAR_CHAT":
        handleClearChat(userIds, client, data);
        break;
    case "PING":
        client.send({ type: "PING" });
        break;
    case "MESSAGE":
        broadcastUserMessage(userIds, client, data);
        break;
    default:
        throw new Error("Unknown message message type: " + message.type);
    }
}


/**
 * @param {Object} userIds - user descriptor with: uid, email, fullname, fs, clientId 
 * @param {Socket} client  - the just-connected collab client
 */
function onConnect(userIds, client) {
    var userId = userIds.userId;
    var clientId = userIds.clientId;

    logVerbose("[vfs-collab] CONNECTED UserID: " + userId + " & ClientId: " + clientId);

    client.on("message", function (messag) {
        // logVerbose("[vfs-collab] Message from ",  userIds, ": " + messag);
        try {
            messag = JSON.parse(messag);
        } catch (e) {
            return logVerboseError("[vfs-collab] Can't parse client data!", messag);
        }
        try {
            handleUserMessage(userIds, client, messag);
        } catch (e) {
            return logVerboseError("[vfs-collab] Can't handle user messag", messag, e);
        }
    });

    handleConnect(userIds, client);

    client.on("disconnect", function () {
        for (var docId in client.openDocIds)
            handleLeaveDocument(userIds, client, { docId: docId, disconnected: true });
        broadcast({
            type: "USER_LEAVE",
            data: {
                userId: userId,
                clientId: clientId
            }
        }, client);
        logVerbose("[vfs-collab] DISCONNECTED a socket with userId " + userId);
    });
}

var compressTimers = {};

/**
 * Close a document because it's no more open for collaboration, close the watcher and schedule a compression
 * @param {String} docId   - the document id or path
 */
function closeDocument(docId) {
    delete documents[docId];

    if (compressTimers[docId])
        clearTimeout(compressTimers[docId]);
    compressTimers[docId] = setTimeout(function () {
        delete compressTimers[docId];
        compressDocument(docId, {
            MAX_REVISION_NUM: 256,
            COMPRESSED_REV_NUM: 128
        });
    }, 100000);
    
    if (watchers[docId]) {
        watchers[docId].close();
        delete watchers[docId];
    }
}

/**
 * Pack documents' revisions if they go beyond a certain threshould: options.MAX_REVISION_NUM
 * to put it back to a reasonable number of revisions: options.COMPRESSED_REV_NUM
 * 
 * It applies multiple heuristic algorithms to combine revisions trying not to lose any authorship information
 * 
 * @param {String}   docId   - the document id or path
 * @param {Object}   options - compression configuration parameters
 * @param {Function} callback
 */
function compressDocument(docId, options, callback) {
    if (documents[docId])
        return;

    var ALREADY_COMPRESSED = "ALREADY_COMPRESSED";
    var MAX_REVISION_NUM = options.MAX_REVISION_NUM;
    var COMPRESSED_REV_NUM = options.COMPRESSED_REV_NUM;

    var doc, revisions, path;
    var newRevisions, newStarRevNums;
    var starsHash, rev0Contents, lastRevTime, docTimeDiff, optimalRevTimeDiff;

    // compaction modes
    var mergeDifferentAuthors = false;
    var isAggressive = false;

    var secondTime = 1000;
    var minuteTime = secondTime * 60;
    var hourTime = minuteTime * 60;
    var dayTime = hourTime * 24;
    var fourDaysTime = dayTime << 2;

    function done(err) {
        unlock(docId);
        if (err === ALREADY_COMPRESSED)
            err = undefined;
        if (err)
            logError("[vfs-collab] ERROR Closing Document", docId, err);
        callback && callback(err);
    }

    function cloneRevision(rev, revNum) {
        return {
            document_id: rev.document_id,
            operation: rev.operation.slice(),
            author: rev.author,
            revNum: revNum,
            created_at: rev.created_at,
            updated_at: rev.updated_at
        };
    }

    function shouldMergeTimeDiff(rev, lastRev) {
        if (lastRev.author != rev.author) {
            if (mergeDifferentAuthors)
                lastRev.author = "0";
            else
                return false;
        }

        var latestRevDiff = lastRevTime - rev.created_at;
        var prevRevDiff = rev.created_at - lastRev.created_at;

        if (isAggressive)
            return prevRevDiff < (optimalRevTimeDiff << 1);

        if (latestRevDiff < hourTime)
            // previous revision is < 8-seconds away (co-editing)
            return prevRevDiff < (secondTime << 3);
        else if (latestRevDiff < dayTime)
            // previous revision is < 4-minutes away
            return prevRevDiff < (minuteTime << 2);
        else if (latestRevDiff < fourDaysTime)
            // previous revision is < 1-hour away
            return prevRevDiff < (hourTime);
        else
            return prevRevDiff < optimalRevTimeDiff;
    }

    lock(docId, function() {
        async.series([
            function (next) {
                Store.getDocument(docId, function (err, docL) {
                    if (err || !docL)
                        return next(err || "No document to close!");
                    path = docL.path;
                    doc = docL;
                    next();
                });
            },
            function (next) {
                Store.getRevisions(doc, function (err, revisionsL) {
                    if (err || !revisionsL)
                        return next(err || "No document revisions found!");
                    if (revisionsL.length < MAX_REVISION_NUM)
                        return next(ALREADY_COMPRESSED);
                    revisions = revisionsL;
                    next();
                });
            },
            function prepare(next) {
                // compress to the latest N/2 saves only
                var newStars = doc.starRevNums.slice(-COMPRESSED_REV_NUM);

                starsHash = {};
                var i;
                for (i = 0; i < newStars.length; i++)
                    starsHash[newStars[i]] = true;

                rev0Contents = doc.contents;
                for (i = revisions.length - 1; i > 0; i--) {
                    var op = operations.inverse(revisions[i].operation);
                    revisions[i].contents = rev0Contents;
                    rev0Contents = applyContents(op, rev0Contents);
                }

                lastRevTime = revisions[revisions.length - 1].created_at;
                docTimeDiff = lastRevTime - revisions[0].created_at;
                optimalRevTimeDiff = docTimeDiff / COMPRESSED_REV_NUM;

                next();
            },
            function compressDoc(next) {
                var shouldCompress = revisions.length - COMPRESSED_REV_NUM;

                logVerbose("[vfs-collab] Compress document trial", docId, shouldCompress, mergeDifferentAuthors, isAggressive);

                newRevisions = [ cloneRevision(revisions[0], 0) ];
                newStarRevNums = [];

                var lastRev = { author: -9 };
                var prevContents, prevLastContents;
                var lastContents = rev0Contents;
                var i, rev;
                for (i = 1; i < revisions.length && shouldCompress; i++) {
                    rev = revisions[i];
                    prevLastContents = lastContents;
                    lastContents = applyContents(rev.operation, lastContents);
                    // Check if can merge revisions and clear lastRev's author if different & can merge different authors
                    // TODO: remove the side-effect on parameters the function do
                    if (shouldMergeTimeDiff(rev, lastRev)) {
                        var compressedOp = operations.operation(prevContents, lastContents);
                        lastRev.operation = compressedOp;
                        shouldCompress--;
                    }
                    else {
                        lastRev = cloneRevision(rev, newRevisions.length);
                        newRevisions.push(lastRev);
                        prevContents = prevLastContents;
                    }
                    if (starsHash[i] && !lastRev.isStar) {
                        newStarRevNums.push(lastRev.revNum);
                        lastRev.isStar = true;
                    }
                }
                if (!shouldCompress) {
                    while (i < revisions.length) {
                        newRevisions.push(cloneRevision(revisions[i++], newRevisions.length));
                    }
                }
                else if (!mergeDifferentAuthors) {
                    logError("[vfs-collab] Merge single-author failed to compact the document enough", revisions.length, newRevisions.length);
                    mergeDifferentAuthors = true;
                    return compressDoc(next);
                }
                else if (!isAggressive) {
                    logError("[vfs-collab] Merge multi-author failed to compact the document enough", revisions.length, newRevisions.length);
                    isAggressive = true;
                    return compressDoc(next);
                }
                else if (newRevisions.length >= MAX_REVISION_NUM) {
                    logError("[vfs-collab] All compression modes failed to compact the document enough", revisions.length, newRevisions.length);
                }

                logError("[vfs-collab] Compressed document:", revisions.length, newRevisions.length,
                    "Different Authors:", mergeDifferentAuthors,
                    "isAggressive:", isAggressive);

                // var newContents = rev0Contents;
                // for (i = 1; i < newRevisions.length; i++) {
                //     var newRev = newRevisions[i];
                //     newContents = applyContents(newRev.operation, newContents);
                // }
                // logVerbose("[vfs-collab] Compressed document:", newContents == doc.contents, revisions.length, newRevisions.length);
                // logVerbose("[vfs-collab] New Revisions:", newRevisions);
                // logVerbose("[vfs-collab] Stars:", doc.starRevNums, newStarRevNums);

                next();
            },
            function (next) {
                wrapSeq(Revision.destroy({ document_id: doc.id }), next);
            },
            function (next) {
                doc.starRevNums = newStarRevNums;
                doc.revNum = newRevisions.length - 1;
                Store.saveDocument(doc, next);
            },
            function (next) {
                newRevisions.forEach(function(newRev) {
                    delete newRev.isStar;
                    newRev.operation = JSON.stringify(newRev.operation);
                });
                wrapSeq(Revision.bulkCreate(newRevisions), next);
            }
        ], done);
    });
}

// ********* VFS Stream, net.Socket Collab Communication Infrastructure ************ //

/**
 * Create the collab socket net.Server
 * The net.Server is file-socket to allow multiple collab-enabled workspaces on SSH workspaces
 */
function createServer() {
    var server = net.createServer(function(client) {

        // logVerbose("[vfs-collab] Client connected");
        var userIds;
        var isClosed = false;

        client.send = function (msg) {
            if (isClosed)
                return;
            msg.command = msg.command || "vfs-collab";
            var strMsg = JSON.stringify(msg);
            client.write(strMsg + "\0");
        };

        client.on("data", function handShake(data) {
            client.removeListener("data", handShake);
            client.on("data", onData);

            userIds = JSON.parse(data);
            if (!collabReadAccess(userIds.fs))
                return logVerbose("[vfs-collab] Client don't have read access to workspace! - " +
                    "Note that visitors of private workspaces can't use collab features");

            client.userIds = userIds;
            client.openDocIds = Object.create(null);
            clients[userIds.clientId] = client;
            // logVerbose("[vfs-collab] Server handshaked", Object.keys(clients).length);

            // handshaking the client
            client.write(data.toString());

            if (server.collabInited)
                onConnect(userIds, client);
            else
                server.once("collabInited", function() {
                    onConnect(userIds, client);
                });
        });

        var buff = [];

        function onData(data) {
            data = data.toString();
            var idx;
            while (true) {
                idx = data.indexOf("\0");
                if (idx === -1)
                    return data && buff.push(data);
                buff.push(data.substring(0, idx));
                var clientMsg = buff.join("");
                data = data.substring(idx + 1);
                buff = [];
                client.emit("message", clientMsg);
            }
        }

        client.on("close", onClose);
        client.on("end", onClose);

        function onClose() {
            if (isClosed)
                return;
            isClosed = true;
            delete clients[userIds.clientId];
            client.emit("disconnect");
            // logVerbose("[vfs-collab] Client disconnected", Object.keys(clients).length);
        }

        client.on("error", function (err) {
            onClose();
            logError("[vfs-collab] CLIENT SOCKET ERROR", err);
            client.destroy();
        });
    });
    return server;
}


function initSocket(userIds, callback) {
    var projectWD = getProjectWD();
    var server;

    // file sockets can have multiple servers open on the same path
    // So, we connect first
    var sockPath = process.platform == "win32"
        ? "\\\\.\\pipe\\" + projectWD + "\\collab.sock"
        : Path.join(projectWD, "collab.sock");
    clientConnect();

    function startServer() {
        server = createServer();
        logVerbose("[vfs-collab] PID:", PID, "Socket:", sockPath,
             "ClinetId:", userIds.clientId, " & UserId:", userIds.userId);

        async.series([
            function (next) {
                // Create the directoty ~/.c9 if not existing
                Fs.mkdir(Path.dirname(projectWD), function (err) {
                    if (err && err.code !== "EEXIST")
                        return next(err);
                    next();
                });
            },
            function (next) {
                // Create the directoty ~/.c9/$pid if not existing
                Fs.mkdir(projectWD, function (err) {
                    if (err && err.code !== "EEXIST")
                        return next(err);
                    next();
                });
            },
            function (next) {
                // Remove the stale socket, if existing at ~/.c9/$pid/collab.sock
                Fs.unlink(sockPath, function (err) {
                    if (err && err.code !== "ENOENT")
                        return next(err);
                    next();
                });
            },
        ], function(err) {
            if (err)
                return callback(err);

            function closeServerThenCallback(err) {
                try {
                    logError("[vfs-collab] Shuting down a faulty collab server - reason: ", err);
                    server.close();
                } catch (e) {
                    logError("[vfs-collab] Can't shutdown faulty collab server", e);
                }
                callback(err);
            }

            server.listen(sockPath, function () {
                isMaster = true;
                server.collabInited = false;

                // init server state
                documents = Object.create(null);
                watchers = Object.create(null);
                clients = Object.create(null);

                // Check server installation, init the server and then connect the client to the inited collab server
                installServer(function (err) {
                    if (err) return closeServerThenCallback(err);

                    initDB(false, function (err) {
                        if (err)
                            return closeServerThenCallback(err);
                        server.collabInited = true;
                        clientConnect();
                        server.emit("collabInited");
                    });
                });

                server.on("close", function () {
                    logVerbose("[vfs-collab] Server closed");
                    // Should handover to another server (if exists)
                    // e.g. Elect the first client as the new master.
                });
            });

            server.on("error", function (err) {
                // if another connection/thread was able to listen as collab-server, let's just connect to it
                if (err.code === "EADDRINUSE")
                    return clientConnect();
                logError("[vfs-collab] Server error", err);
            });
        });
    }

    // Connect to a collab client
    // If this fails to connect or the socket file doesn't exist, we try to create the server first
    function clientConnect() {
        var stream = new Stream();
        stream.readable = true;

        var client = net.connect(sockPath, function () {
            client.setTimeout(0);
            client.setNoDelay(true);
            client.setKeepAlive(true);

            client.userIds = userIds;
            client.clientStream = stream;
            // logVerbose("[vfs-collab] User connected:", userIds.clientId);

            client.on("data", function handShake(data) {
                // logVerbose("[vfs-collab]", "Client handshaked", data.toString());
                client.removeListener("data", handShake);
                client.on("data", onData);
            });

            var buff = [];

            function onData(data) {
                data = data.toString();
                var idx;
                while (true) {
                    idx = data.indexOf("\0");
                    if (idx === -1)
                        return buff.push(data);
                    buff.push(data.substring(0, idx));
                    var streamData = buff.join("");
                    data = data.substring(idx + 1);
                    buff = [];
                    stream.emit("data", streamData);
                }
            }

            client.on("close", function() {
                // logVerbose("[vfs-collab] Connection closed :", userIds.userId);
                stream.emit("end");
            });

            client.write(JSON.stringify(userIds), "utf8", function() {
                callback(null, client, isMaster && server);
            });
        });

        client.on("error", function (err) {
            if (err && (err.code === "ECONNREFUSED" || err.code === "ENOENT" || err.code === "EAGAIN")) {
                startServer();
            }
            else {
                logError("[vfs-collab] CLIENT SOCK ERR", err, client.userIds);
                // mock client.write
                client.write = function () {
                    logError("[vfs-collab] CLIENT SOCK WRITE AFTER ERROR", client.userIds);
                    console.trace();
                };
                stream.emit("end");
            }
        });
    }
}

/**
 * Export the vfs extend API hook
 * Receive the user and project identification thorugh the vfs-extend server-verified options
 * 
 * @param {Vfs}      vfs      - an instance of localfs.js
 * @param {Object}   options  - { user: {}, project: {} }
 * @param {Function} register - register the collab server API
 */
var exports = module.exports = function(vfs, options, register) {

    var vfsClientMap = {};
    localfsAPI = vfs;
    
    if (options.nodePath)
        nodePath = options.nodePath;

    function connect(opts, callback) {
        var user = options.user;
        var project = options.project;
        var clientId = opts.clientId;

        if (!user || !project || !clientId || !opts.basePath)
            return callback(new Error("[OT] Invalid or icomplete collab options passed: " + opts.basePath + " " + clientId));

        PID = project.pid || project.id;
        basePath = Path.normalize(opts.basePath);

        var userIds = {
            userId: user.uid || user.id,
            email: user.email,
            fullname: user.fullname,
            clientId: clientId,
            fs: options.readonly ? "r" : "rw"
        };

        function cleanOldClient() {
            if (!vfsClientMap[clientId])
                return;
            logVerbose("[vfs-collab] Disposing old client - possible reconnect?", clientId);
            dispose(clientId);
        }

        cleanOldClient();

        initSocket(userIds, function (err, client, server) {
            if (err)
                return callback(err.message ? err : new Error(err));

            client.netServer = server;

            cleanOldClient();
            vfsClientMap[clientId] = client;

            callback(null, {
                stream: client.clientStream,
                isMaster: isMaster && !!server
            });
        });
    }

    function send(clientId, msg) {
        // logVerbose("[vfs-collab] IN-STREAM", msg);
        var client = vfsClientMap[clientId];
        if (client)
            client.write(JSON.stringify(msg) + "\0");
    }

    function dispose(clientId) {
        var client = vfsClientMap[clientId];
        if (!client)
            return;
        client.end();
        client.destroy();
        // TODO: properly handover
        // if (client.netServer)
        //    client.netServer.close();
        delete vfsClientMap[clientId];
    }

    /**
     * Get a `Document` from the database given its path
     * @param {String}   path the document path to query the database with
     * @param [{String}] attributes - optional
     * @param {Function} callback
     * @param {Object} callback.err
     * @param {Object} callback.result   The result, or null if getDocument() failed (might even though err is null)
     */
    function getDocument(path, attributes, callback) {
        if (!Document) {
            console.log("Initializing collab db for read access");
            return initDB(true, getDocument.bind(null, path, attributes, callback));
        }
        Store.getDocument(path, attributes, callback);
    }

    register(null, {
        connect: connect,
        send: send,
        dispose: dispose,
        getDocument: getDocument,
        emitter: emitter
    });
};

// export for testing
exports.Store = Store;
exports.compressDocument = compressDocument;
exports.checkDBCorruption = checkDBCorruption;
exports.areOperationsMirrored = areOperationsMirrored;
exports.hashString = hashString;
exports.removeNoopOperations = removeNoopOperations;

var DIFF_EQUAL = 0;
var DIFF_INSERT = 1;
var DIFF_DELETE = -1;
var diff_match_patch = require("./diff_match_patch");

// Copied from async
// Can be generically used in many scenarios
var async = function() {

    function forEachSeries(arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed === arr.length) {
                        callback(null);
                    }
                    else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    }

    function series(arr, callback) {
        forEachSeries(arr, function (fn, next) {
            fn.call(null, function (err) {
                if (err)
                    return callback(err);
                next();
            });
        }, callback);
    }

    return {
        series: series,
        forEachSeries: forEachSeries
    };

}();

// Copied from https://github.com/gjtorikian/isBinaryFile
function isBinaryFile(file, callback) {
    var max_bytes = 512;
    exists(file, function (exists) {
        if (!exists)
            return callback(null, false);

        Fs.open(file, 'r', function(err, descriptor) {
            if (err)
                return callback(err);
            var bytes = new Buffer(max_bytes);
            // Read the file with no encoding for raw buffer access.
            Fs.read(descriptor, bytes, 0, bytes.length, 0, function(err, size, bytes) {
                Fs.close(descriptor, function(err2) {
                    if (err || err2)
                        return callback(err || err2);
                    return callback(null, isBinaryCheck(size, bytes));
                });
            });
        });
    });

    function isBinaryCheck(size, bytes) {
        if (size === 0)
            return false;

        var suspicious_bytes = 0;
        var total_bytes = Math.min(size, max_bytes);

        if (size >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF) {
            // UTF-8 BOM. This isn't binary.
            return false;
        }

        for (var i = 0; i < total_bytes; i++) {
            if (bytes[i] === 0) { // NULL byte--it's binary!
                return true;
            }
            else if ((bytes[i] < 7 || bytes[i] > 14) && (bytes[i] < 32 || bytes[i] > 127)) {
                // UTF-8 detection
                if (bytes[i] > 191 && bytes[i] < 224 && i + 1 < total_bytes) {
                    i++;
                    if (bytes[i] < 192) {
                        continue;
                    }
                }
                else if (bytes[i] > 223 && bytes[i] < 239 && i + 2 < total_bytes) {
                    i++;
                    if (bytes[i] < 192 && bytes[i + 1] < 192) {
                        i++;
                        continue;
                    }
                }
                suspicious_bytes++;
                // Read at least 32 bytes before making a decision
                if (i > 32 && (suspicious_bytes * 100) / total_bytes > 10) {
                    return true;
                }
            }
        }

        if ((suspicious_bytes * 100) / total_bytes > 10) {
            return true;
        }

        return false;
    }
}

function isVeryLargeFile(file, contents, callback) {
    Fs.stat(file, function(err, stat) {
        if (err) return callback(err);
        
        callback(null, stat.size > 1024 * 1024 || contents && contents.length > 1024 * 1024);
    });
}
