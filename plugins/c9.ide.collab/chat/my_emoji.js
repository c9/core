define(function(require, exports, module) {
"use strict";

var Emojis = require("./emojis");

exports.emoji = function(text, staticPrefix) {
    return text.replace(/([\ue001-\ue999])/g, function(str, p1) {
        return p1.charCodeAt(0).toString(16).toUpperCase().replace(
            /^([\da-f]+)$/i,
            "<img class='emoji' src=\"" + staticPrefix + "/emoji/emoji-$1.png\" alt=\"emoji\" />"
        );
    });
};

exports.toEmojiUnicode = function(text) {
    function toUnicode(str, p1) {
        return Emojis.reverse[p1] ? eval('"\\u' + Emojis.reverse[p1] + '"') : str;
    }
    text = text.replace(/(:[\w_\-\+]*:)/g, toUnicode);
    specialEmojis.forEach(function (emot) {
        text = text.replace(emot[0], toUnicode(emot[1], emot[1]));
    });
    return text;
};

var specialEmojis = [
    [/:-*\)/g, ':blush:'],
    [/:-*o/gi, ':scream:'],
    [/(:|;)-*\]/g, ':smirk:'],
    [/(:|;)-*d/gi, ':smile:'],
    [/xd/gi, ':stuck_out_tongue_closed_eyes:'],
    [/:-*p/gi, ':stuck_out_tongue:'],
    [/:-*(\[|@)/g, ':rage:'],
    [/:-*\(/g, ':disappointed:'],
    [/:-*\*/g, ':kissing_heart:'],
    [/;-*\)/g, ':wink:'],
//    [/:-*\//g, ':pensive:'], - contradicsts with clickable links in the chat text
    [/:-*s/gi, ':confounded:'],
    [/:-*\|/g, ':flushed:'],
    [/:-*\$/g, ':relaxed:'],
    [/:-*x/gi, ':mask:'],
    [/&lt;3/g, ':heart:'],
    [/&lt;\/3/g, ':broken_heart:'],
    [/:('|’)-*\(/g, ':sob:']
];

});
