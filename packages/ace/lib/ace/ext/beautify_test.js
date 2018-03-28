if (typeof process !== "undefined") {
    require("amd-loader");
}

define(function(require, exports, module) {
"use strict";

var assert = require("assert");
var EditSession = require("../edit_session").EditSession;
var beautify = require("./beautify");
var PHPMode = require("../mode/php").Mode;

// Execution ORDER: test.setUpSuite, setUp, testFn, tearDown, test.tearDownSuite
module.exports = {
    timeout: 10000,

    "test beautify block tag indentation": function(next) {
        var s = new EditSession([
            "<div>",
            "<h1>test</h1>",
            "</div>"
        ], new PHPMode());
        s.setUseSoftTabs(false);

        beautify.beautify(s);
        assert.equal(s.getValue(), "<div>\n"
            + "\t<h1>test</h1>\n"
            + "</div>");

        next();
    },

    "test beautify block tag line breaks and indentation": function(next) {
        var s = new EditSession([
            "<html><body><div></div></body></html>"
        ], new PHPMode());
        s.setUseSoftTabs(false);

        beautify.beautify(s);
        assert.equal(s.getValue(), "<html>\n"
            + "<body>\n"
            + "\t<div></div>\n"
            + "</body>\n"
            + "</html>");

        next();
    },

    "test beautify empty block tag": function(next) {
        var s = new EditSession([
            "\t<div></div>"
        ], new PHPMode());
        s.setUseSoftTabs(false);

        beautify.beautify(s);
        assert.equal(s.getValue(), "<div></div>");

        next();
    },

    "test beautify inline tag indentation": function(next) {
        var s = new EditSession([
            "<div>",
            "<span>hello world</span>",
            "</div>"
        ], new PHPMode());
        s.setUseSoftTabs(false);

        beautify.beautify(s);
        assert.equal(s.getValue(), "<div>\n"
            + "\t<span>hello world</span>\n"
            + "</div>");

        next();
    },

    "test beautify multiline inline tag indentation": function(next) {
        var s = new EditSession([
            "<div>",
            "<span>",
            "hello world",
            "</span>",
            "</div>"
        ], new PHPMode());
        s.setUseSoftTabs(false);

        beautify.beautify(s);
        assert.equal(s.getValue(), "<div>\n"
            + "\t<span>\n"
            + "\t\thello world\n"
            + "\t</span>\n"
            + "</div>");

        next();
    },

    "test beautify singleton tag indentation": function(next) {
        var s = new EditSession([
            "<div>",
            "hello<br>",
            "world",
            "</div>"
        ], new PHPMode());
        s.setUseSoftTabs(false);

        beautify.beautify(s);
        assert.equal(s.getValue(), "<div>\n"
            + "\thello<br>\n"
            + "\tworld\n"
            + "</div>");

        next();
    },

    "test beautify unknown singleton indentation": function(next) {
        var s = new EditSession([
            "<div>",
            "hello<single />",
            "world",
            "</div>"
        ], new PHPMode());
        s.setUseSoftTabs(false);

        beautify.beautify(s);
        assert.equal(s.getValue(), "<div>\n"
            + "\thello<single />\n"
            + "\tworld\n"
            + "</div>");

        next();
    },

    "test beautify curly indentation": function(next) {
        var s = new EditSession([
            "<?php",
            "if (true) {",
            "$i++;",
            "}"
        ], new PHPMode());
        s.setUseSoftTabs(false);

        beautify.beautify(s);
        assert.equal(s.getValue(), "<?php\n"
            + "if (true) {\n"
            + "\t$i++;\n"
            + "}");

        next();
    },

    "test beautify adding bracket whitespace": function(next) {
        var s = new EditSession([
            "<?php",
            "if(true){",
            "\t$i++;",
            "}"
        ], new PHPMode());
        s.setUseSoftTabs(false);

        beautify.beautify(s);
        assert.equal(s.getValue(), "<?php\n"
            + "if (true) {\n"
            + "\t$i++;\n"
            + "}");

        next();
    },

    "test beautify removing bracket whitespace": function(next) {
        var s = new EditSession([
            "<?php",
            "if ( true ) {",
            "\t$i++;",
            "}"
        ], new PHPMode());
        s.setUseSoftTabs(false);

        beautify.beautify(s);
        assert.equal(s.getValue(), "<?php\n"
            + "if (true) {\n"
            + "\t$i++;\n"
            + "}");

        next();
    },

    "test beautify adding keyword whitespace": function(next) {
        var s = new EditSession([
            "<?php",
            "if ($foo===true) {",
            "\t$i++;",
            "}"
        ], new PHPMode());
        s.setUseSoftTabs(false);

        beautify.beautify(s);
        assert.equal(s.getValue(), "<?php\n"
            + "if ($foo === true) {\n"
            + "\t$i++;\n"
            + "}");

        next();
    },

    "test beautify if without paren": function(next) {
        var s = new EditSession([
            "<?php",
            "if ($foo===true)",
            "$i++;",
            "print $i"
        ], new PHPMode());
        s.setUseSoftTabs(false);

        beautify.beautify(s);
        assert.equal(s.getValue(), "<?php\n"
            + "if ($foo === true)\n"
            + "\t$i++;\n"
            + "print $i");

        next();
    },

    "test beautify switch indentation": function(next) {
        var s = new EditSession([
            "<?php",
            "switch ($i) {",
            "case 1;",
            "case 2;",
            "print $i;",
            "break;",
            "}"
        ], new PHPMode());
        s.setUseSoftTabs(false);

        beautify.beautify(s);
        assert.equal(s.getValue(), "<?php\n"
            + "switch ($i) {\n"
            + "\tcase 1;\n"
            + "\tcase 2;\n"
            + "\t\tprint $i;\n"
            + "\tbreak;\n"
            + "}");

        next();
    }
};

});

if (typeof module !== "undefined" && module === require.main) {
    require("asyncjs").test.testcase(module.exports).exec();
}
