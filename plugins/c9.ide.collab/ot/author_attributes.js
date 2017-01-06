define(function(require, exports, module) {
"use strict";

var operations = require("./operations");

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
        // console.log("remove:", index, length);
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

                // console.log("Removed:", removed);
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
            // console.log("CHECK:", nodes[j].id, nodes[j+1].id);
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

    function traverse(nodes, start, end, iterator) {
        start = start || 0;
        end = end || 0;
        if (!end) {
            for (var i = 0; i < nodes.length; i += 2)
                end += nodes[i];
        }

        traverseRec(nodes, start, end, 0, iterator);
    }

    function traverseRec(nodes, start, end, index, iterator) {
        for (var i = 0; i < nodes.length && index < end; i += 2) {
            var len = nodes[i];
            if (len > start - index) {
                var val = nodes[i + 1];
                if (Array.isArray(val)) {
                    traverseRec(val, start, end, index, iterator);
                }
                else if (index + len > end || index < start) {
                    if (index < start) {
                        len -= start - index;
                        index = start;
                    }
                    len = Math.min(len, end - index);
                    iterator(index, len, val);
                }
                else {
                    iterator(index, len, val);
                }
            }
            index += len;
        }
    }

    function valueAtIndex(nodes, idx) {
        var val;
        traverseRec(nodes, idx, idx + 1, 0, function (index, length, value) {
            val = value;
        });
        return val;
    }

    function sanityCheck(nodes) {
        var len = 0;
        for (var i = 0; i < nodes.length; i += 2) {
            if (Array.isArray(nodes[i + 1])) {
                var l1 = sanityCheck(nodes[i + 1]);
                // if (l1 != nodes[i])
                //     debugger;
                len += l1;
            } else {
                len += nodes[i];
            }
        }
        return len;
    }

    function flatten(nodes, result) {
        for (var i = 0; i < nodes.length; i += 2) {
            if (Array.isArray(nodes[i + 1])) {
                flatten(nodes[i + 1], result);
            }
            else {
                result.push(nodes[i], nodes[i + 1]);
            }
        }
        return result;
    }

    return {
        apply: apply,
        valueAtIndex: valueAtIndex,
        traverse: traverse,
        flatten: flatten,
        insert: insert,
        remove: remove
    };
}

module.exports = AuthorAttributes;

});
