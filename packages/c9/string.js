define(function(require, exports, module) {
    "use strict";
   
/*
 * Casts the first character in a string to uppercase.
 *
 * @param {String} str
 * @type {String}
 */
exports.uCaseFirst = function(str) {
    return str.substr(0, 1).toUpperCase() + str.substr(1);
};

/*
 * Removes spaces and other space-like characters from the left and right ends
 * of a string
 *
 * @param {String} str
 * @type {String}
 */
exports.trim = function(str) {
    return str.replace(/[\s\n\r]*$/, "").replace(/^[\s\n\r]*/, "");
};

/*
 * Concatenate a string with itself n-times.
 *
 * @param {String} str
 * @param {Number} times Number of times to repeat the String concatenation
 * @type  {String}
 */
exports.repeat = function(str, times) {
    return new Array(times + 1).join(str);
};

/*
 * Count the number of occurences of substring 'str' inside a string
 *
 * @param {String} str
 * @param {String} substr
 * @type  {Number}
 */
exports.count = function(str, substr){
    return str.split(substr).length - 1;
};

exports.endsWith = function(subjectString, searchString, position) {
    if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
        position = subjectString.length;
    }
    position -= searchString.length;
    var lastIndex = subjectString.indexOf(searchString, position);
    return lastIndex !== -1 && lastIndex === position;
};
 
});