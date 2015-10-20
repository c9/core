/*
 * Swap keys and values of an object
 */
exports.invert = function(obj) {
    return Object.keys(obj).reduce(function(res, key) {
        res[obj[key]] = key;
        return res;
    }, {});
};