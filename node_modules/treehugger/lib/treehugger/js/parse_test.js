if (typeof process !== "undefined") {
    require("amd-loader");
    require("../../setup_paths");
}

var parser = require("treehugger/js/parse");
require('treehugger/traverse');
var assert = require("assert");
//var microtime = require('microtime');

module.exports = {
    "test basic parsing" : function() {
        assert.equal(parser.parse("hello()").toString(), '[Call(Var("hello"),[])]');
        assert.equal(parser.parse("if(true) a = 8;").toString(), '[If(Var("true"),Assign(Var("a"),Num("8")),None())]');
        var node = parser.parse("log(); var b = true; b");
        node.traverseTopDown('VarDeclInit(x, _)', function(b) {
            var pos = b.x.getPos();
            assert.equal(pos.sc, 11);
            assert.equal(pos.ec, 12);
            pos = this.getPos();
            assert.equal(pos.sc, 11);
            assert.equal(pos.ec, 19);
        });
        node = parser.parse("function hello(a, b) { }");
        node.traverseTopDown('Function(x, fargs, body)', function(b) {
            var pos = b.x.getPos();
            assert.equal(pos.sc, 9);
            assert.equal(pos.ec, 14);
            pos = b.fargs[0].getPos();
            assert.equal(pos.sc, 15);
            assert.equal(pos.ec, 16);
            pos = b.fargs[1].getPos();
            assert.equal(pos.sc, 18);
            assert.equal(pos.ec, 19);
            pos = b.fargs.getPos();
            assert.equal(pos.sc, 15);
        });
        assert.equal(parser.parse("with(a) { console.log(b); }").toString(), "[With(Var(\"a\"),[Call(PropAccess(Var(\"console\"),\"log\"),[Var(\"b\")])])]");
        assert.equal(parser.parse("let b = true;").toString(), "[LetDecls([LetDeclInit(\"b\",Var(\"true\"))])]");
        assert.equal(parser.parse("let b = true, a, c;").toString(), "[LetDecls([LetDeclInit(\"b\",Var(\"true\")),LetDecl(\"a\"),LetDecl(\"c\")])]");
    },
    "test parse jquery": function() {
        var code = require('fs').readFileSync(__dirname+'/../../jquery.js', 'ascii');
        //var now = microtime.now();
        parser.parse(code);
        //console.log("Parsing jQuery took: " + (microtime.now() - now)/1000 + "ms");
    },
    "test parse treehugger": function() {
        var code = require('fs').readFileSync(__dirname+'/../traverse.js', 'ascii');
        code += require('fs').readFileSync(__dirname+'/../tree.js', 'ascii');
        code += require('fs').readFileSync(__dirname+'/../js/uglifyparser.js', 'ascii');
        code += require('fs').readFileSync(__dirname+'/../js/uglifyparser.js', 'ascii');
        code += require('fs').readFileSync(__dirname+'/../js/infer.js', 'ascii');
        //var now = microtime.now();
        parser.parse(code);
        //console.log("Parsing jQuery took: " + (microtime.now() - now)/1000 + "ms");
    },
    "test error recovery" : function() {
        assert.equal(parser.parse("hello.;").toString(), '[PropAccess(Var("hello"),"✖")]');
        assert.equal(parser.parse("hello.").toString(), '[PropAccess(Var("hello"),"✖")]');
        assert.equal(parser.parse("if(hello.) { }").toString(), '[If(PropAccess(Var("hello"),"✖"),Block([]),None())]');
        assert.equal(parser.parse("while(hello.) { }").toString(), '[While(PropAccess(Var("hello"),"✖"),Block([]))]');
        // for variants
        assert.equal(parser.parse("for(var i = 0; i.) { }").toString(), '[For(VarDecls([VarDeclInit("i",Num("0"))]),PropAccess(Var("i"),"✖"),None(),Block([]))]');
        assert.equal(parser.parse("for(var i = 0; i.)").toString(), '[For(VarDecls([VarDeclInit("i",Num("0"))]),PropAccess(Var("i"),"✖"),None(),Block([]))]');
        // This produces a funky AST, have to deal with it
        assert.equal(parser.parse("for(var i = 0; i.\nif(true) {}").toString(), '[For(VarDecls([VarDeclInit("i",Num("0"))]),PropAccess(Var("i"),"✖"),None(),If(Var("true"),Block([]),None()))]');
        assert.equal(parser.parse("for(var i = 0; i < array.) { }").toString(), '[For(VarDecls([VarDeclInit("i",Num("0"))]),Op("<",Var("i"),PropAccess(Var("array"),"✖")),None(),Block([]))]');
        assert.equal(parser.parse("for(var i = 0; i < array.)").toString(), '[For(VarDecls([VarDeclInit("i",Num("0"))]),Op("<",Var("i"),PropAccess(Var("array"),"✖")),None(),Block([]))]');
        assert.equal(parser.parse("for(var i = 0; i < array.length; i.)").toString(), '[For(VarDecls([VarDeclInit("i",Num("0"))]),Op("<",Var("i"),PropAccess(Var("array"),"length")),PropAccess(Var("i"),"✖"),Block([]))]');
        assert.equal(parser.parse("for(var i = 0; i < array.length; i.);\nalert('hello');").toString(), '[For(VarDecls([VarDeclInit("i",Num("0"))]),Op("<",Var("i"),PropAccess(Var("array"),"length")),PropAccess(Var("i"),"✖"),Block([])),Call(Var("alert"),[String("hello")])]');
        // for in
        assert.equal(parser.parse("for(var p in something.) bla()").toString(), '[ForIn(VarDecls([VarDecl("p")]),PropAccess(Var("something"),"✖"),Call(Var("bla"),[]))]');
        assert.equal(parser.parse("for(var p in something.) bla()").toString(), '[ForIn(VarDecls([VarDecl("p")]),PropAccess(Var("something"),"✖"),Call(Var("bla"),[]))]');
        
        assert.equal(parser.parse("if(hello.").toString(), '[If(PropAccess(Var("hello"),"✖"),Block([]),None())]');
        assert.equal(parser.parse("if(hello.after()").toString(), '[If(Call(PropAccess(Var("hello"),"after"),[]),Block([]),None())]');
        // this produces a funky AST, but we'll have to deal with it
        assert.equal(parser.parse("if(hello.\nafter()").toString(), '[If(PropAccess(Var(\"hello\"),\"✖\"),Block([]),None())]');
        assert.equal(parser.parse("while(hello.").toString(), '[While(PropAccess(Var("hello"),"✖"),Block([]))]');
        assert.equal(parser.parse("if(hello.)").toString(), '[If(PropAccess(Var("hello"),"✖"),Block([]),None())]');
        assert.equal(parser.parse("while(hello.)").toString(), '[While(PropAccess(Var("hello"),"✖"),Block([]))]');
        
        assert.equal(parser.parse("switch(hello.)").toString(), '[Switch(PropAccess(Var("hello"),"✖"),[])]');
        assert.equal(parser.parse("switch(hello.)\nhello();if(true)").toString(), '[Switch(PropAccess(Var("hello"),"✖"),[Case(None(),[Call(Var("hello"),[]),If(Var("true"),Block([]),None())])])]');
        assert.equal(parser.parse("(function() { hello()").toString(), '[Function("",[],[Call(Var("hello"),[])])]');
        assert.equal(parser.parse("(function() { hello.").toString(), '[Function("",[],[PropAccess(Var("hello"),"✖")])]');
        assert.equal(parser.parse("(function() { hello.})();").toString(), '[Call(Function("",[],[PropAccess(Var("hello"),"✖")]),[])]');
        
        assert.equal(parser.parse("bla(start.);").toString(), '[Call(Var("bla"),[PropAccess(Var("start"),"✖")])]');
        assert.equal(parser.parse("var Editor = function() { start. }; hello();").toString(), '[VarDecls([VarDeclInit("Editor",Function("",[],[PropAccess(Var("start"),"✖")]))]),Call(Var("hello"),[])]');
        
        // keywords
        assert.equal(parser.parse("function").toString(), '[Function("✖",[],[])]');
        assert.equal(parser.parse("while").toString(), '[While(Var("✖"),Block([]))]');
        assert.equal(parser.parse("if").toString(), '[If(Var("✖"),Block([]),None())]');
        assert.equal(parser.parse("for").toString(), '[For(Var("✖"),None(),None(),Block([]))]');
        assert.equal(parser.parse("do").toString(), '[Do(Block([]),Var("✖"))]');
        assert.equal(parser.parse("if(").toString(), '[If(Var("✖"),Block([]),None())]');
        // todo should this be broken if and a function outside?
        assert.equal(parser.parse("if(hello.\nfunction hello() { return 0; }").toString(), '[If(PropAccess(Var("hello"),"✖"),Function("hello",[],[Return(Num("0"))]),None())]');
        // assert.equal(parser.parse("var\nfunction hello() {}").toString(), '[VarDecls([]),Function("hello",[],[])]');
    },
    "test parse literals": function() {
        assert.equal(parser.parse("true").toString(), '[Var("true")]');
        assert.equal(parser.parse("15").toString(), '[Num("15")]');
        assert.equal(parser.parse("15.5").toString(), '[Num("15.5")]');
    },
    "test es7": function() {
        assert.equal(parser.parse("async function  a(x) {await y()}").toString(), '[Function("a",[FArg("x")],[Call(Var("y"),[])])]');
    }
};

if (typeof module !== "undefined" && module === require.main) {
    require("asyncjs").test.testcase(module.exports).exec();
}