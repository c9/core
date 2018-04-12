/**
 * the default response timeout in node.js is 2min. If a request takes longer
 * to process then it needs to be increased
 */

module.exports = function(timeout) {
    return function(req, res, next) {
        req.setTimeout(timeout);
        next();
    };
};