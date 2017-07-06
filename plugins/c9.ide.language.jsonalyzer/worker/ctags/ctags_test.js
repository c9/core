"use server";


require("c9/inline-mocha")(module);
if (typeof define === "undefined") {
    require("amd-loader");
}

var fs = require("fs");
var assert = require("assert");
var ctags = require("./ctags.min.js");

function parseFile(filenameWithPath) {
    var content = fs.readFileSync(filenameWithPath);
    
    var lastSlashPos = filenameWithPath.lastIndexOf("/");
    var path = filenameWithPath.substr(0, lastSlashPos);
    var filename = filenameWithPath.substr(lastSlashPos + 1, filenameWithPath.length - lastSlashPos - 1);
    
    ctags.FS_createPath("/", path, true, true);
    ctags.FS_createDataFile("/" + path, filename, content, true, false);
    ctags.CTags_parseFile(filenameWithPath);
}


describe(__filename, function() {
    it("should detect the language", function() {
        var lang = ctags.CTags_getLanguage("ctags_test.js");
        assert.equal(lang, "JavaScript");
    });
    
    it("should parse a file", function(done) {
        function onTagEntry(name, kind, lineNumber, sourceFile, language) {
            console.log(name + " " + kind + " " + lineNumber + " " + sourceFile + " " + language);
        }
        
        function onParseFileComplete(sourceFile) {
            assert.equal(sourceFile, __filename);
            done();
        }
        
        ctags.CTags_setOnTagEntry(onTagEntry);
        ctags.CTags_setOnParsingCompleted(onParseFileComplete);
        
        parseFile(__dirname + "/ctags_test.js");
    });
});