define(function(require, exports, module) {
"use strict";

/**
 * @class debugger.xdebug.util
 */

/**
 * Parse an XML string and return a DOM `Document`.
 *
 * ```
 * var xmlDocument = parseXml("<root><element/></root>");
 *
 * xmlDocument.documentElement.tagName; // "root"
 * ```
 *
 * @param {string} str  The XML string to parse.
 *
 * @return {Document}  The resulting DOM Document.
 * @throws {Error}  If the XML string cannot be parsed.
 */
exports.parseXml = function parseXml(str) {
    var parser = new DOMParser();

    var xmlDoc = parser.parseFromString(str, "application/xml");
    var errors = xmlDoc.getElementsByTagName("parsererror");
    var error = errors && errors[0];

    if (error) {
        throw new Error("Invalid XML message: " + error.innerText);
    }

    return xmlDoc;
};

/**
 * Converts the given XML to an object, using the JXON notation described at
 * https://developer.mozilla.org/en-US/docs/JXON.
 *
 * The XML can be given as a raw string or an already parsed DOM Document or
 * DOM Element.
 *
 * ```
 * var data = xmlToObject('<house number="10"><roof /><room>Kitchen</room><room>Living</room></house>');
 *
 * // attributes are prefixed with the \@ sign
 * data.house["@number"]; // 10
 *
 * // single elements are indexed by their name
 * data.house.roof; // {}
 *
 * // multiple elements are grouped in an array
 * // text values are stored with the $ sign
 * data.house.room[0]["$"]; // "Kitchen"
 * ```
 *
 * @param {string|Node} xml
 *
 * @return {Object}
 */
exports.xmlToObject = function xmlToObject(xml) {
    if (typeof xml === "string")
        xml = exports.parseXml(xml);
    else if (!(xml instanceof Node))
        throw new TypeError("Expected xml to be string or Node");

    function parseText(sValue) {
        if (/^\s*$/.test(sValue)) { return null; }
        if (/^(?:true|false)$/i.test(sValue)) { return sValue.toLowerCase() === "true"; }
        if (isFinite(sValue)) { return parseFloat(sValue); }
        return sValue;
    }

    var result = {}, // default node value
        length = 0,
        text = "";

    if (xml.hasAttributes && xml.hasAttributes()) {
        result = {};
        for (length; length < xml.attributes.length; length++) {
            var attrib = xml.attributes.item(length);
            result["@" + attrib.name.toLowerCase()] = parseText(attrib.value.trim());
        }
    }

    if (xml.hasChildNodes()) {
        for (var i = 0; i < xml.childNodes.length; i++) {
            var node = xml.childNodes.item(i);

            if (node.nodeType === 4) {
                text += node.nodeValue;
            } /* nodeType is "CDATASection" (4) */
            else if (node.nodeType === 3) {
                text += node.nodeValue.trim();
            } /* nodeType is "Text" (3) */
            else if (node.nodeType === 1 && !node.prefix) { /* nodeType is "Element" (1) */
                if (length === 0) {
                    result = {};
                }
                var name = node.nodeName.toLowerCase();
                var children = xmlToObject(node);

                if (result.hasOwnProperty(name)) {
                    if (result[name].constructor !== Array) {
                        result[name] = [result[name]];
                    }
                    result[name].push(children);
                }
                else {
                    result[name] = children;
                    length++;
                }
            }
        }
    }

    if (text) {
        if (length > 0) result["$"] = parseText(text);
        else result = parseText(text);
    }

    return result;
};

/**
 * Decode a base-64 encoded ASCII string to a "string" of data.
 *
 * @param {string} str
 *
 * @return {string}
 */
exports.base64Decode = function base64Decode(str) {
    if (!str) return "";
    return window.atob(str);
};

/**
 * Encode a "string" of binary data to a base-64 encoded ASCII string.
 *
 * @param {string} data
 *
 * @return {string}
 */
exports.base64Encode = function base64Encode(data) {
    return window.btoa(data);
};

});
