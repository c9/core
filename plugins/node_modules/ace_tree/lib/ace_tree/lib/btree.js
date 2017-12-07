define(function(require, exports, module) {

function BTree(maxChilds){
    this.maxChilds = maxChilds;
    this.minChilds = Math.floor(maxChilds / 2);
    
    this.root = [];
}
BTree.prototype = {
    get length() {
        return this.root.count;
    },
    
    get size() {
        return this.root.size;
    },
    
    /**
     * Loads a data set efficiently into the tree
     */
    load : function(data){
        var btree = this;
        btree.root = null;
        
        function checkParents(nodes){
            var p, c;
            if (nodes.length == max + 1) { //instead of .length it could calc based on i
                if (!nodes.parent) {
                    c = nodes.pop();
                    nodes.count -= c.count; //this could be optimized to not set and unset this
                    nodes.size  -= c.size; //this could be optimized to not set and unset this
                    p = nodes.parent = btree.root = [nodes, c];
                    c.parent = p;
                    p.size  = nodes.size + c.size;
                    p.count = nodes.count + c.count;
                    p.push(nodes = []);
                    nodes.count = nodes.size = 0;
                }
                else {
                    c = nodes.pop();
                    nodes.count -= c.count; //this could be optimized to not set and unset this
                    nodes.size  -= c.size; //this could be optimized to not set and unset this
                    p = nodes.parent;
                    p.size  += nodes.size + c.size;
                    p.count += nodes.count + c.count;
                    p.push(c, nodes = []);
                    c.parent = p;
                    nodes.count = nodes.size = 0;
                    checkParents(p);
                }
                nodes.parent = p;
            }
            return nodes;
        }
        
        var leaf = [], leafs = [leaf], max = this.maxChilds;
        leafs.size = leafs.count = leaf.size = leaf.count = 0;
        leaf.parent = leafs;
        for (var d, i = 0, l = data.length; i < l; i++) {
            d = data[i];
            d.count  = 1;
            
            if ((i + 1) % (max + 1) === 0) {
                leafs.push(d);
                d.parent = leafs;
                leafs.size  += leaf.size + d.size;
                leafs.count += leaf.count + d.count; //always 1
                
                if ((i / (max + 1)) % (max + 1))
                    leafs = checkParents(leafs);
                
                leafs.push(leaf = []);
                leaf.parent = leafs;
                leaf.size = leaf.count = 0;
            }
            else {
                leaf.push(d);
                d.parent = leaf;
                leaf.size  += d.size;
                leaf.count += d.count;
            }
        }
        
        if (leaf.length) {
            var p = leaf;
            do {
                p.parent.count += p.count;
                p.parent.size  += p.size;
            } while((p = p.parent).parent);
        }
        
        if (!btree.root) 
            btree.root = leafs;
    },
    
    /**
     * 
     */
    loadHumongousSet : function(count, size){
        var billion = 1000000000;
        var parts   = Math.ceil(count / billion);
        if (parts > this.maxChilds)
            throw new Error("Exceeded maximum size of 25 billion");
        
        if (parts > 1) {
            this.root = [];
            for (var n, i = 0; i < parts - 1; i++) {
                this.root.push(n = Array(billion));
                n.size   = billion * size;
                n.count  = billion;
                n.parent = this.root;
            }
            var last = count % billion || billion;
            this.root.push(n = Array(last));
            n.size   = last * size;
            n.count  = last;
            n.parent = this.root;
        }
        else {
            this.root = [Array(count)];
            this.root[0].size  = size * count;
            this.root[0].count = count;
            this.root[0].parent = this.root;
        }
        
        this.defaultSize = size;
        
        this.root.size  = size * count;
        this.root.count = count;
    },
    
    /**
     * Add an object to the tree
     * @param afterIndex {Number} the index of the node to insert after. Null to append as last child.
     * @param size       {Number} the size of the node (usually stands for pixels)
     * @param value      {Mixed}  the value of the node
     */
    add : function(afterIndex, size, value){
        if (typeof size != "number" || isNaN(size))
            throw new Error("Incorrect size specified: " + size);
        
        // Find parent
        var after = (afterIndex 
            ? this.findNodeByIndex(afterIndex)
            : this.findLastNode());
        var parent = after.parent || this.root;
        
        // Add new leaf node
        var node = {};
        node.size   = size;
        node.value  = value;
        node.count  = 1;
        node.parent = parent;

        if (!afterIndex)
            parent.push(node);
        else {
            var idx = parent.indexOf(idx) + 1;
            idx && parent.splice(idx, 0, node) || parent.push(node);
        }
        
        this.checkParents(parent);
    },
    
    checkParents : function(parent){
        // Update a set
        function update(parent){
            var total = 0, count = 0;
            for (var i = 0; i < parent.length; i++) {
                total += parent[i].size;
                count += parent[i].count;
                parent[i].parent = parent;
            }
            parent.size  = total;
            parent.count = count;
        }
        
        var max = this.maxChilds, min = this.minChilds, btree = this;
        (function recur(parent) {
            // End of recursion
            if (!parent){
                return;
            }
            
            // There is still room
            else if (parent.length <= max) {
                update(parent);
                recur(parent.parent);
            }
            
            // Split the parent into two nodes
            else {
                var right  = parent.splice(min + 1); 
                var median = parent.pop();
                
                // Update left set
                update(parent);
                
                // Update right set
                update(right);
                
                // Find grandpa or create a new root
                var grandpa = parent.parent || (btree.root = [parent]);
                
                // Insert new children in grandpa
                var idx = grandpa.indexOf(parent);
                grandpa.splice(idx + 1, 0, median, right);
                
                // Check if grandpa needs to be split
                recur(grandpa);
            }
        })(parent);
    },
    
    /**
     * Updates the size of nodes
     */
    updateNodes : function(nodes){
        var n, p, i, l, parents = [], right, grandpa, idx, empty = [];
        
        for (n, p, i = nodes.length - 1; i >= 0; i--) {
            n = nodes[i];
            if (n.empty) {
                right = n.parent.splice(n.index);
                right.shift();
                
                n.parent.count = n.parent.length;
                n.parent.size  = n.parent.length * this.defaultSize;
                
                grandpa = n.parent.parent;
                idx = grandpa.indexOf(n.parent);
                
                var args = [idx + (n.parent.length ? 1 : 0), n.parent.length ? 0 : 1, n];
                if (right.length) {
                    args.push(right);
                    
                    right.count = right.length;
                    right.size  = right.length * this.defaultSize;
                }
                grandpa.splice.apply(grandpa, args);
                
                delete n.index;
                delete n.empty;
                
                if (empty.indexOf(grandpa) == -1)
                    empty.push(grandpa);
                
                continue;
            }
            
            p = n.parent;
            if (parents.indexOf(p) == -1)
                parents.push(p);
        }
        
        for (i = 0, l = empty.length; i < l; i++) {
            this.checkParents(empty[i]); //@todo this could be done more efficiently
        }
        
        var size, count;
        for (i = 0, l = parents.length; i < l; i++) {
            p = parents[i];
            
            do {
                size = 0, count = 0;
                for (var j = 0, lj = p.length; j < lj; j++) {
                    size  += p[j].size;
                    count += p[j].count;
                }
                p.size  = size;
                p.count = count;
            } while((p = p.parent));
        }
    },
    
    remove : function(index){
        
    },
    
    findSizeAtIndex : function(index){
        var count = 0, size = 0;
        
        var defSize = this.defaultSize;
        return (function recur(node){
            for (var n, i = 0, l = node.length; i < l; i++) {
                if ((n = node[i]).count + count > index) {
                    if (n.length) {
                        // Empty set
                        if (!n[0]) {
                            size += (index - count) * defSize;
                            return size;
                        }
                        // Find in filled set
                        return recur(n);
                    }
                    else return size;
                }
                else {
                    count += n.count;
                    size  += n.size;
                }
            }
        })(this.root);
    },
    
    /**
     * Returns an array of nodes that are within the viewport specified
     * @todo should return the start index of the first node as well
     */
    getRange : function(start, end, compIndex){
        if (!this.root.length) return false;
        
        var count = 0, size = 0, nodes = [], found, fsize, fcount;
        
        var defSize = this.defaultSize;
        (function recur(node){
            var n, i, l;
            
            if (!node[0]) {
                i = found ? 0 : (compIndex 
                    ? start - count
                    : Math.floor((start - size) / defSize));
                
                var offset = compIndex ? end - count : end - size;
                
                if (i !== 0) {
                    size  += i * defSize;
                    count += i;
                }

                l = compIndex
                    ? Math.min(node.length, offset + (found  ? 0 : start - count))
                    : Math.min(node.length, Math.ceil((offset + (found ? 0 : start - size)) / defSize));
                
                // It's in this set
                if (node.length >= i + 1) {
                    for (;i < l; i++) {
                        nodes.push({
                            size   : defSize,
                            empty  : true,
                            parent : node,
                            count  : 1,
                            index  : i
                        });
                        
                        if (!found) {
                            fcount = count;
                            fsize  = size;// + (i * defSize);
                            found  = true;
                        }
                        
                        size  += defSize;
                        count += 1;
                    }
                    return;
                }
                else {
                    return;
                }
            }
            
            for (i = 0, l = node.length; i < l; i++) {
                if (compIndex ? count >= end : size >= end)
                    return;
                    
                n = node[i];
                // Empty set
                if (found || (compIndex ? n.count + count : n.size + size) >= start) {
                    if (n.length) {
                        recur(n);
                        continue;
                    }
                    
                    nodes.push(n);
                    
                    if (!found) {
                        fcount = count;
                        fsize  = size;
                        found  = true;
                    }
                }
                
                size  += n.size;
                count += n.count;
            }
        })(this.root);
        
        nodes.size  = fsize || 0;
        nodes.count = fcount || 0;
        
        return nodes;
    },
    
    /**
     * Returns the node at some arbitrary total position
     * @param start {Number} the start position from where to find the node
     */
    findNodeAtStart : function(start){
        var size = 0;
        
        var defSize = this.defaultSize;
        return (function recur(node){
            for (var n, i = 0, l = node.length; i < l; i++) {
                if ((n = node[i]).size + size > start) {
                    if (n.length) {
                        // Empty set
                        if (!n[0]) {
                            return {
                                size   : defSize, 
                                empty  : true, 
                                count  : 1,
                                parent : n,
                                index  : Math.ceil((start - size) / defSize) - 1
                            };
                        }
                        return recur(n);
                    }
                    else return n;
                }
                else 
                    size += n.size;
            }
        })(this.root);
    },
    
    /**
     * Returns the node at some index
     * @param index {Number} the zero based index of the node, calculated sequentially.
     */
    findNodeByIndex : function(index){
        var count = 0;
        
        var defSize = this.defaultSize;
        return (function recur(node){
            for (var n, i = 0, l = node.length; i < l; i++) {
                if ((n = node[i]).count + count > index) {
                    if (n.length) {
                        // Empty set
                        if (!n[0]) {
                            return {
                                size   : defSize, 
                                empty  : true, 
                                count  : 1,
                                parent : n,
                                index  : index - count - 1
                            };
                        }
                        // Find in filled set
                        return recur(n);
                    }
                    else return n;
                }
                else 
                    count += n.count;
            }
        })(this.root);
    },
    
    /**
     * Returns the last node in the tree, sequentially
     */
    findLastNode : function(){
        return (function recur(node){
            if (node.length) return recur(node[node.length - 1]);
            else return node;
        })(this.root);
    },
    
    /**
     * Returns the first node in the tree, sequentially
     */
    findFirstNode : function(){
        return (function recur(node){
            if (node.length) return recur(node[0]);
            else return node;
        })(this.root);
    },
    
    /**
     * Return an array of all objects in tree, sequentially.
     * Each object has a size and value property
     */
    toArray : function(){
        var list = [];

        (function recur(node){
            for (var n, i = 0, l = node.length; i < l; i++) {
                if ((n = node[i]).length)
                    recur(n);
                else
                    list.push({size: n.size, value: n.value});
            }
        })(this.root);
        
        return list;
    }
};

module.exports = BTree;

});