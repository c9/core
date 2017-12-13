/*global describe:false, it:false */

"use client";

require(["lib/architect/architect", "lib/chai/chai"], function (architect, chai) {
    var expect = chai.expect;
    
    expect.setupArchitectTest([
        "plugins/c9.core/ext",
        "plugins/c9.ide.editors/undomanager",
        {
            consumes: ["UndoManager"],
            provides: [],
            setup: main
        }
    ], architect);
    
    function main(options, imports, register) {
        var UndoManager = imports.UndoManager;
        
        var data = ["a", "b"];
        var stack = [ ["a", 0], ["b", 1], ["c", 2], ["d", 3], ["e", 4] ];
        var count = 0, check = 0;
        var undo;
        
        function Item(info, idx) {
            this.getState = function() { return [ info, idx ]; };
            this.undo = function() { data.splice(idx, 1); };
            this.redo = function() { 
                data[idx || (idx = data.length)] = info; 
                return this;
            };
        }
        
        function checkCount() {
            if (count != check)
                throw new Error("invalid amount of change events called: got " 
                    + count + ", expected " + check);
        }
        
        describe('undomanager', function() {
            it('should load it\'s state from the constructor', function(done) {
                undo = new UndoManager({
                    position: 1,
                    stack: stack
                });
                
                undo.on("change", function() { count++; });
                
                undo.on("itemFind", function(e) {
                    return new Item(e.state[0], e.state[1]);
                });
                
                expect(undo.position).to.equal(1);
                expect(undo.length).to.equal(5);
                
                checkCount();
                done();
            });
            it('should return a representation of the stack using getState()', function(done) {
                var state = undo.getState();
                expect(state.stack).to.not.equal(stack);
                expect(state.stack).to.deep.equal(stack);
                checkCount();
                done();
            });
            it('should re-execute items when redo() is called', function(done) {
                undo.redo(); check++;
                expect(undo.position).to.equal(2);
                expect(data).to.deep.equal(["a", "b", "c"]);
                undo.redo(); check++;
                expect(undo.position).to.equal(3);
                expect(data).to.deep.equal(["a", "b", "c", "d"]);
                undo.redo(); check++;
                expect(undo.position).to.equal(4);
                expect(data).to.deep.equal(["a", "b", "c", "d", "e"]);
                checkCount();
                done();
            });
            it('should undo items when undo() is called', function(done) {
                undo.undo(); check++;
                expect(undo.position).to.equal(3);
                expect(data).to.deep.equal(["a", "b", "c", "d"]);
                undo.undo(); check++;
                expect(undo.position).to.equal(2);
                expect(data).to.deep.equal(["a", "b", "c"]);
                undo.undo(); check++;
                expect(undo.position).to.equal(1);
                expect(data).to.deep.equal(["a", "b"]);
                checkCount();
                done();
            });
            it('should clear redo positions when adding a new item', function(done) {
                undo.add(new Item("q").redo()); check++;
                expect(undo.position).to.equal(2);
                expect(undo.length).to.equal(3);
                expect(data).to.deep.equal(["a", "b", "q"]);
                checkCount();
                done();
            });
            it('should remove an item while keeping the stack in tact', function(done) {
                undo.remove(1); check++;
                expect(undo.position).to.equal(1);
                expect(undo.length).to.equal(2);
                expect(data).to.deep.equal(["a", "q"]);
                checkCount();
                done();
            });
            it('should clear the undo stack when calling clearUndo()', function(done) {
                undo.setState({ position: 3, stack: stack }); check++;
                expect(undo.position).to.equal(3);
                expect(undo.length).to.equal(5);
                undo.clearUndo(); check++;
                expect(undo.position).to.equal(0);
                expect(undo.length).to.equal(3);
                expect(data).to.deep.equal(["a", "q"]);
                checkCount();
                done();
            });
            it('should remember bookmarked state', function(done) {
                undo.setState({ position: 3, stack: stack, mark: 4 }); check++;
                expect(undo.position).to.equal(3);
                expect(undo.length).to.equal(5);
                expect(undo.isAtBookmark()).to.equal(false);
                undo.redo(); check++;
                checkCount();
                expect(undo.isAtBookmark()).to.equal(true);
                expect(undo.position).to.equal(4);
                undo.undo(); check++;
                expect(undo.isAtBookmark()).to.equal(false);
                undo.add(new Item("q").redo()); check++;
                expect(undo.isAtBookmark()).to.equal(false);
                expect(undo.position).to.equal(4);
                undo.undo(); check++;
                
                undo.setState({ position: -1, stack: stack, mark: -1 }); check++;
                expect(undo.isAtBookmark()).to.equal(true);
                expect(data).to.deep.equal(["a", "q"]);
                checkCount();
                done();
            });
        });
        
        register();
    }
});