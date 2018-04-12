"use strict";
var async = require("asyncjs");

/**
 * Cache instances by ID for a certain periode of time
 */
var InstanceCache = module.exports = function(timeout, factory, onDestroy) {
    this.interval = timeout;
    this.instances = {};
    this.instCallbacks = {};
    this.factory = factory;
    this.onDestroy = onDestroy;
};

module.exports.lazyCreate = function(id, cache, callbackStore, factory, callback) {
    var item = cache[id];
    if (item)
        return callback(null, item);

    if (callbackStore[id]) {
        callbackStore[id].push(callback);
        return;
    }

    callbackStore[id] = [callback];

    factory(function(err, item) {
        var callbacks = callbackStore[id];
        delete callbackStore[id];

        if (!err)
            cache[id] = item;

        callbacks.forEach(function(cb) {
            cb(err, item);
        });
    });
};

(function() {

    /**
     * If callback is provided the factory is assumed to be async
     */
    this.get = function(id, args, callback) {
        if (!args && !callback)
            return this.instances[id] || null;

        var self = this;

        self.lazyCreate(
            id,
            this.instances,
            this.instCallbacks,
            this._create.bind(this, id, args),
            function(err, inst) {
                if (err)
                    return callback(err);

                self._updateTimeout(id, inst);
                callback(null, inst.instance);
            }
        );
    };

    this.has = function(id) {
        return !!this.instances[id];
    };

    this.remove = function(id, callback) {
        var inst = this.instances[id];
        if (!inst)
            return callback && callback();

        delete this.instances[id];
        this.onDestroy(id, inst.instance, callback || function() {});
    };

    this.forEach = function(callback) {
        for (var id in this.instances) {
            callback(this.instances[id].instance);
        }
    };

    /**
     * Get all cached instances (synchronous)
     */
    this.getAll = function() {
        var self = this;

        return Object.keys(self.instances).map(function (id) {
            return self.instances[id].instance;
        });
    };

    /**
     * If callback is provided the factory is assumed to be async
     */
    this._create = function(id, args, callback) {
        this.factory.apply(null, args.concat(function(err, instance) {
            if (err)
                return callback(err, instance);

            return callback(null, {
                instance: instance
            });
        }));
    };

    this._updateTimeout = function(id, inst) {
        if (inst.timeout)
            clearTimeout(inst.timeout);

        if (inst.interval > 0)
            inst.timeout = setTimeout(this.remove.bind(this, id), this.interval);
    };

    this.destroy = function(callback) {
        var self = this;

        async.forEach(Object.keys(this.instances), function(id, next) {
            self.remove(id);
            next();
        }, callback);
    };

    /**
     * Looks up an object by ID from a cache. If the item is not in the cache it is
     * created on demand using the factory function. Intermitted calls to the same
     * id are pooled until the object is created
     */
    this.lazyCreate = module.exports.lazyCreate;

}).call(InstanceCache.prototype);