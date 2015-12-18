"use strict";

var _ = require("lodash");

/**
 * Substract all values of used from quota + extra
 * This is the so-called "uncountedQuota" logic.
 */
function available(quota, used, extra) {
    var keys = _.union(_.keys(quota), _.keys(used));

    extra = extra || {};

    return keys.reduce(function(available, key) {
        available[key] = quota[key] || 0;
        extra[key] = extra[key] || 0;

        if (!used[key])
            return available;

        var needed = used[key] - extra[key];

        if (!needed)
            return available;

        available[key] = available[key] - needed;
        return available;
    }, {});
}

module.exports = available;