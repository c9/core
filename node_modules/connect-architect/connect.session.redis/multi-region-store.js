

// master 
// slave

var debug = require('debug')('connect:redis-multi-region');

module.exports = function(connect) {

    var Store = connect.session.Store;
    var RedisStore = require("connect-redis")(connect);
    
    function RedisMultiRegionStore(options) {
        options.master.prefix = options.prefix;
        options.slave.prefix = options.prefix;
        
        this.master = new RedisStore(options.master);
        this.slave = new RedisStore(options.slave);
    }


    RedisMultiRegionStore.prototype.__proto__ = Store.prototype;

    /**
     * Attempt to fetch session by the given `sid`.
     *
     * @param {String} sid
     * @param {Function} fn
     * @api public
     */
    RedisMultiRegionStore.prototype.get = function(sid, fn) {
        debug('GET "%s"', sid);
        this.slave.get(sid, fn);
    };

    /**
     * Commit the given `sess` object associated with the given `sid`.
     *
     * @param {String} sid
     * @param {Session} sess
     * @param {Function} fn
     * @api public
     */
    RedisMultiRegionStore.prototype.set = function(sid, sess, fn) {
        debug("SET %s %j", sid, sess);
        this.master.set(sid, sess);
        this.slave.set(sid, sess, fn);
    };

    /**
     * Destroy the session associated with the given `sid`.
     *
     * @param {String} sid
     * @api public
     */
    RedisMultiRegionStore.prototype.destroy = function(sid, fn) {
        debug("DESTROY %s", sid);
        this.master.destroy(sid);
        this.slave.destroy(sid, fn);
    };

    return RedisMultiRegionStore;
};
