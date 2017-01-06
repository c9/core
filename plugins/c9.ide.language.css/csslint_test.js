"use server";


require("c9/inline-mocha")(module);
require("../../test/setup_paths");
if (typeof process !== "undefined") {
    require("amd-loader");
}


var assert = require("ace/test/assertions");
var LanguageWorker = require('plugins/c9.ide.language.core/worker').LanguageWorker;
var EventEmitter = require("ace/lib/event_emitter").EventEmitter;

describe(__filename, function() {
    
    it("integration base case", function(next) {
        var emitter = Object.create(EventEmitter);
        emitter.emit = emitter._dispatchEvent;
        var worker = new LanguageWorker(emitter);
        var handler = require("plugins/c9.ide.language.css/css_handler");
        handler.analyze("#hello { color: 1px; } #nonused{}", null, {}, function(markers) {
            assert.equal(markers.length, 2);
            next();
        });
    });
});

