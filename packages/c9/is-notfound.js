"use strict";


module.exports = function isNotFound(err) {
    if (err && err.code === 404) return true;
    return false;
};