
var Cache = function(maxSize, age) {
    this._maxSize = (parseInt(maxSize, 10) === maxSize) ? maxSize : 1000;
    this._maxAge = (parseInt(age, 10) === age) ? age : 5000;
    this._items = {};
    this._keys = [];
};

var proto = Cache.prototype;

proto.set = function(key, value) {
    var item = this._items[key];
    if (item) {
        this.delete(key);
    }

    this._keys.push(key);
    this._items[key] = {
        value: value,
        lastAccessed: Date.now()
    };

    this.purge();
};

proto.has = function(key) {
    var item = this._items[key];
    return (item && !this._hasExpired(item));
};

proto.get = function(key) {
    var item = this._items[key];
    if (item && !this._hasExpired(item)) {
        return item.value;
    }
    return null;
};

proto.delete = function(key) {
    delete this._items[key];
    this._keys.splice(this._keys.indexOf(key), 1);
};

proto.purge = function() {
    if (this._keys.length > this._maxSize) {
        this._purgeItems();
    }
};

proto.size = function() {
    return this._keys.length;
};

proto._purgeItems = function() {
    var maxSize = this._maxSize * 0.75;

    // Remove epired items
    this._keys.forEach(function(key) {
        var item = this._items[key];
        if (this._hasExpired(item)) {
            this.delete(key);
        }
    }, this);

    // Remove least used items
    if (this._keys.length > maxSize) {
        this._keys = this._keys.sort(function(a, b) {
            return this._items[b].lastAccessed - this._items[a].lastAccessed;
        }.bind(this));

        while (this._keys.length > maxSize) {
            var key = this._keys.pop();
            this.delete(key);
        }
    }
};

proto._hasExpired = function(item) {
    return (Date.now() - item.lastAccessed) > this._maxAge;
};

module.exports = Cache;