"use strict";

var EventEmitter = require("events").EventEmitter;
var util = require("util");
var kaefer = require("kaefer");
var smith = require("smith");
var eio = require("engine.io");
var restful = require("vfs-http-adapter");
var VfsWorker = require('vfs-socket/worker').Worker;
var wrapVfs = require("./vfs_wrapper");
var proxyVfs = require("./vfs_proxy");
var urlParse = require('url').parse;

module.exports = Vfs;

function Vfs(vfs, master, options) {
    EventEmitter.call(this);
    
    this.vfs = vfs;
    this.master = master;
    this.debug = options.debug || false;
    this.logger = options.logger || {log: function(){}};
    this.readonly = options.readonly || false;
    this.public = options.public || false;
    this.vfsOptions = options.vfsOptions || {};
    this.pid = this.vfsOptions.pid;

    this.homeDir = options.homeDir;
    this.workspaceDir = options.projectDir;
    
    this.vfsHome = wrapVfs(vfs, {
        root: this.homeDir,
        // we don't want to expose files from the home dir in read only mode
        // we need to protect e.g. .ssh
        blocked: this.readonly,
        extendDirectory: options.extendDirectory,
        extendOptions: options.extendOptions,
    });
    this.vfsWorkspace = wrapVfs(vfs, {
        root: this.workspaceDir,
        readonly: this.readonly,
        extendDirectory: options.extendDirectory,
        extendOptions: options.extendOptions,
    });
    
    var vfsProxy = proxyVfs(Object.keys(this.vfsHome), this.vfsHome, this.vfsWorkspace);
    this.engine = this._createEngine(vfsProxy, options);

    this.restful = {
        home: restful("/", this.vfsHome, {
            autoIndex: false,
            noMime: true,
            readOnly: this.readonly
        }),
        workspace: restful("/", this.vfsWorkspace, {
            autoIndex: false,
            noMime: false,
            readOnly: this.readonly
        })
    };
    
    this._watchConnection(options.vfsOptions.pid);
}

util.inherits(Vfs, EventEmitter);

Vfs.prototype.handleRest = function(scope, path, req, res, next) {
    this.emit("keepalive");
    
    if (!req.uri) { req.uri = urlParse(req.url, true); }
    var proto = req.proto;
    req.restBase = proto + "://" + req.headers.host + req.uri.pathname;
    req.uri.pathname = path;

    this.restful[scope](req, res, next);
};

Vfs.prototype.handleEngine = function(req, res, next) {
    if (req.ws) {
        req.method = "GET";
        this.engine.handleUpgrade(req, req.ws.socket, req.ws.head);
        
        // default node behavior is to disconnect when no handlers
        // but by adding a handler, we prevent that
        // and if no eio thing handles the upgrade
        // then the socket needs to die!
        setTimeout(function() {
            var socket = req.ws.socket;
            if (socket.writable && socket.bytesWritten <= 0) {
                return socket.end();
            }
        }, 1000);
    }
    else {
        this.engine.handleRequest(req, res);
    }
};

Vfs.prototype.destroy = function(err) {
    if (err) {
        console.error("VFS error", err);
        console.trace();
    }

    if (this.master)
        this.master.destroy();

    if (this.socket)
        this.socket.disconnect();

    clearInterval(this.keepAliveTimer);
    
    this.master = null;
    this.emit("destroy", err);
};

Vfs.prototype._watchConnection = function(pid) {
    var master = this.master;
    var that = this;
    
    function onError(err) {
        console.log("destroying because of error", err && err.stack || err)
        that.destroy(err);
    }
    function onStderr(data) {
        // @todo collab stderr logs
        console.log("VFS stderr [" + pid + "]: " + data);
        that.logger.log({message: data.toString(), pid: pid});
    }
    
    master.on("disconnect", onError);
    master.on("error", onError);
    master.on("stderr", onStderr);
    
    master.destroy = function() {
        master.removeListener("disconnect", onError);
        master.removeListener("error", onError);
        master.removeListener("stderr", onStderr);
        master.disconnect();
    };
};

Vfs.prototype._createEngine = function(vfs, options) {
    var that = this;
    
    var engine = new eio.Server({
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ["polling", "websocket"],
        allowUpgrades: true,
        cookie: false
    });
    
    this.keepAliveTimer = null;
    var listeningForEIOSocketEvents = false;
    
    this.workers = 0;
    
    var server = new kaefer.Server(engine, { debug: false });
    server.on("connection", function (socket) {
        clearInterval(that.keepAliveTimer);
        that.keepAliveTimer = setInterval(function() {
            that.emit("keepalive");
        }, 2000);
        that.workers++;
        
        if (that.socket)
            that.socket.disconnect();
        
        that.socket = socket;
        /*  - socket is the reliablesocket, 
            - socket.socket is the reconnectsocket, 
            - socket.socket.socket is engineio's socket */ 
        if (socket.socket) { 
            /* Add listener to core Engine.io socket used for user communication
                to track and log all reasons causing it to close so when users
                complain about disconnects we can investigate what's causing them */
            var listenForEIOSocketEvents = function (eioSocket) {
                if (!eioSocket || listeningForEIOSocketEvents) return;
                eioSocket.once("close", function (reason, description) {
                    var logMetadata = {message: "Socket closed", collab: options.collab, reason: reason, description: description, id: that.id, sid: socket.id, pid: that.pid};
                    that.logger.log(logMetadata);
                    listeningForEIOSocketEvents = false;
                });
                eioSocket.on("upgrade", function (transport) {
                    var newTransportName = transport && transport.name ? transport.name : "unknown";
                    var logMetadata = {message: "Socket transport changed", collab: options.collab, type: newTransportName,  id: that.id, sid: socket.id, pid: that.pid};
                    that.logger.log(logMetadata);
                });
                listeningForEIOSocketEvents = true;
            };
            socket.socket.once('away', function() {
                listenForEIOSocketEvents(socket.socket.socket);
            });
            socket.socket.once('back', function() {
                listenForEIOSocketEvents(socket.socket.socket);
            });
        }
        socket.on('disconnect', function (err) {
            var logMetadata = {message: "Socket disconnected", collab: options.collab, err: err, id: that.id, sid: socket.id, pid: that.pid};
            that.logger.log(logMetadata);
        });
        
        var transport = new smith.EngineIoTransport(socket, true);
        var worker = new VfsWorker(vfs);
        worker.connectionTimeout = 30000;
        worker.connect(transport);
    
        worker.on("error", function (err) {
            console.error("Unhandled worker error:", err.stack);
        });

        var collabApi;

        function disposeCollabClient() {
            console.log("VFS Collab Disposing:", that.id);
            collabApi.dispose(that.id);
        }

        worker.on("disconnect", function() {
            var logMetadata = {message: "VFS socket disconnect", collab: options.collab, id: that.id, sid: socket.id, pid: that.pid};
            that.logger.log(logMetadata);
            if (options.collab) {
                if (collabApi)
                    return disposeCollabClient();
                vfs.use("collab", {}, function(err, meta) {
                    if (err || !meta || !meta.api)
                        return console.error("Collab not found on disconnect");
                    collabApi = meta.api;
                    disposeCollabClient();
                });
            }
            
            that.workers--;
            if (!that.workers)
                clearInterval(that.keepAliveTimer);
            that.socket = null;
        });
    });

    return engine;
};

Vfs.prototype.handlePublish = function(message) {
    console.log("PUBSUB: PUBLISH", message);
    var that = this;
    if (this.pubSubApi)
        return this.pubSubApi.publish(message);
    this.vfs.use("pubsub", {}, function(err, meta) {
        if (err || !meta || !meta.api)
            return console.error("PubSub not found", err, !!meta, !! (meta && meta.api));
        that.pubSubApi = meta.api;
        that.pubSubApi.publish(message);
    });
};
