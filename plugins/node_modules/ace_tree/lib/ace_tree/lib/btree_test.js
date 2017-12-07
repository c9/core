/*global describe it before */

var isBrowser = true;
if (typeof module !== "undefined") {
    var isBrowser = false;
    require("amd-loader");
}

define(function(require, exports, module) {
    "use strict";

    var expect = (isBrowser ? require("../../node_modules/chai/chai") : global["require"]("chai")).expect;
    var BTree  = isBrowser ? require("./btree") : global["require"]("experiments/btree");
    
    describe("BTree", function(){
        var btree, expected = [], data;
        before(function(done){
            btree = new BTree(25);
            done();
        });
        
        describe("add()", function(){
            it('should add a single node to the tree', function(done) {
                btree.add(null, 90, {"root": 1});
                
                expected.push({size: 90, value: {"root": 1}});
                expect(btree.toArray()).deep.equal(expected);
                done();
            });
            it('should add a multiple nodes to the tree and create a new level', function(done) {
                var size;
                for (var i = 0; i < 25; i++) {
                    size = Math.round(90 * Math.random());
                    btree.add(null, size, {"first": i});
                    expected.push({size: size, value: {"first": i}});
                }
                
                expect(btree.toArray()).deep.equal(expected);
                done();
            });
            it('should add create more levels as each time the max nodes is reached', function(done) {
                var size;
                for (var i = 0; i < 150; i++) {
                    size = Math.round(90 * Math.random());
                    btree.add(null, size, {"second": i});
                    expected.push({size: size, value: {"second": i}});
                }
                
                expect(btree.toArray()).deep.equal(expected);
                done();
            });
        });
        describe("findNodeAtStart(), findNodeByIndex()", function() {
            it('should find a node based on a start position', function(done) {
                var node = btree.findNodeAtStart(0);
                expect(node.value, "node at 0px").to.deep.equal(expected[0].value);
                
                node = btree.findNodeAtStart(80);
                expect(node.value, "node at 80px").to.deep.equal(expected[0].value);
                
                node = btree.findNodeAtStart(500);
                var total = 0, found, i = 0; do {
                    found = expected[i];
                    total += expected[i++].size;
                } while(total < 500);
                expect(node.value, "node at 500px").to.deep.equal(found.value);
                
                total = 0, found, i = 0; do {
                    total += expected[i++].size;
                    found = expected[i];
                } while(i == 100);
                node = btree.findNodeAtStart(total);
                expect(node.value, "node at 500px").to.deep.equal(found.value);
                
                done();
            });
            it('should find a node based on an index', function(done) {
                var node = btree.findNodeByIndex(0);
                expect(node.value, "node at index 0").to.deep.equal(expected[0].value);
                
                node = btree.findNodeByIndex(80);
                expect(node.value, "node at index 80").to.deep.equal(expected[80].value);
                done();
            });
        });
        describe("load()", function() {
            it('should load 10 records', function(done) {
                expected = [], data = [];
                for (var size, i = 0; i < 10; i++) {
                    size = Math.round(90 * Math.random());
                    expected.push({size: size, value: {"first": i}});
                    data.push({size: size, value: {"first": i}});
                }
                
                btree.load(data);
                expect(btree.toArray()).to.deep.equal(expected);
                expect(btree.root.count).equal(10);
                done();
            });
            it('should load 100 records', function(done) {
                expected = [], data = [];
                for (var size, i = 0; i < 100; i++) {
                    size = Math.round(90 * Math.random());
                    expected.push({size: size, value: {"first": i}});
                    data.push({size: size, value: {"first": i}});
                }
                
                btree.load(data);
                expect(btree.toArray()).to.deep.equal(expected);
                expect(btree.root.count).equal(100);
                done();
            });
            it('should load 1000 records', function(done) {
                expected = [], data = [];
                for (var size, i = 0; i < 1000; i++) {
                    size = Math.round(90 * Math.random());
                    expected.push({size: size, value: {"first": i}});
                    data.push({size: size, value: {"first": i}});
                }
                
                btree.load(data);
                expect(btree.toArray()).to.deep.equal(expected);
                expect(btree.root.count).equal(1000);
                done();
            });
            it('should find a node based on a start position', function(done) {
                var node = btree.findNodeAtStart(0);
                expect(node.value, "node at 0px").to.deep.equal(expected[0].value);
                
                node = btree.findNodeAtStart(500);
                var total = 0, found, i = 0; do {
                    found = expected[i];
                    total += expected[i++].size;
                } while(total < 500);
                expect(node.value, "node at 500px").to.deep.equal(found.value);
                
                total = 0, found, i = 0; do {
                    total += expected[i++].size;
                    found = expected[i];
                } while(i == 100);
                node = btree.findNodeAtStart(total);
                expect(node.value, "node at 500px").to.deep.equal(found.value);
                
                done();
            });
            it('should find a node based on an index', function(done) {
                var node = btree.findNodeByIndex(0);
                expect(node.value, "node at index 0").to.deep.equal(expected[0].value);
                
                node = btree.findNodeByIndex(800);
                expect(node.value, "node at index 800").to.deep.equal(expected[800].value);
                done();
            });
        });
        
        function getRange(start, end){
            var total = 0, nodes = [], i = 0; do {
                total += expected[i].size;
                if (total > start)
                    nodes.push(expected[i]);
                i++;
            } while(total < end);
            
            return nodes;
        }
        
        describe("getRange()", function() {
            it('should return nodes within a viewport starting at 0', function(done) {
                var nodes = btree.getRange(0, 500);
                var range = getRange(0, 500);
                
                expect(nodes, "length").length(range.length);
                expect(nodes[0].value, "first").deep.equal(range[0].value);
                expect(nodes[nodes.length - 1].value, "last").deep.equal(range[range.length - 1].value);
                done();
            });
            it('should return nodes within a viewport starting at 4000', function(done) {
                var nodes = btree.getRange(4000, 5600);
                var range = getRange(4000, 5600);
                
                expect(nodes, "length").length(range.length);
                expect(nodes[0].value, "first").deep.equal(range[0].value);
                expect(nodes[nodes.length - 1].value, "last").deep.equal(range[range.length - 1].value);
                done();
            });
        });
        describe("updateNodes()", function() {
            /*
                @todo
                - remove left node
                - remove right node
                - remove node in the middle
                
                same, but with 2 nodes in the middle
                
                for humongous set and normal set and mixed
            */
            it('should update a set of nodes', function(done) {
                var viewport = btree.getRange(3000, 5000);
                
                var start = Math.round(viewport.length / 4);
                var end   = Math.round(viewport.length * 3 / 4);
                
                var changed = [];
                for (var node, i = start; i < end; i++) {
                    node = viewport[i];
                    node.oldsize = node.size;
                    node.size    = 0;
                    changed.push(node);
                };
                
                btree.updateNodes(changed);
                
                var viewport2 = btree.getRange(3000, 5000);
                expect(viewport2.length).gt(viewport.length);
                done();
            });
        });
        describe("Scalability Tests", function() {
            it('should load 25 billion records', function(done) {
                btree.loadHumongousSet(25000000000, 90);
                
                expect(btree.root.count).equal(25000000000);
                expect(btree.root.size).equal(25000000000 * 90);
                done();
            });
            it('should update a set of nodes', function(done) {
                var viewport = btree.getRange(3000, 5000);
                
                viewport.forEach(function(n){
                    expect(n).not.instanceOf(Array);
                });
                
                var start = Math.round(viewport.length / 4);
                var end   = Math.round(viewport.length * 3 / 4);
                
                var changed = [];
                for (var node, i = start; i < end; i++) {
                    node = viewport[i];
                    node.oldsize = node.size;
                    node.size    = 0;
                    changed.push(node);
                };
                btree.updateNodes(changed);
                
                var viewport2 = btree.getRange(3000, 5000);
                
                viewport2.forEach(function(n){
                    expect(n).not.instanceOf(Array);
                });
                
                expect(viewport2.length).gt(viewport.length);
                expect(btree.root.count).equal(25000000000);
                expect(btree.root.size).equal((25000000000 - changed.length) * 90);
                
                done();
            });
        });
    });
    
    (typeof onload == "function") && onload();
});

// if (typeof module !== "undefined" && module === require.main) {
//     mocha.run();
// }