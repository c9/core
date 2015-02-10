/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2010, Ajax.org B.V.
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Ajax.org B.V. nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

if (typeof process !== "undefined") {
    require("amd-loader");
    require("./test/setup_paths");
}

define(function(require, exports, module) {
"use strict";

var TreeData = require("./data_provider");
var assert = require("ace/test/assertions");

module.exports = {
    "test: simple expand/collapse" : function() {
        var model = new TreeData([{label: "a"}]);
        assert.equal(model.visibleItems.length, 1);
        var first = model.visibleItems[0];
        assert.equal(first.$depth, 0);
        
        first.items = [{label: "x"}];
        
        model.expand(first);
        assert.equal(model.visibleItems.length, 2);
        var second = model.visibleItems[1];
        assert.equal(second.$depth, 1);
        model.collapse(first);
        
        assert.equal(model.visibleItems.length, 1);
        assert.equal(model.visibleItems[0], first);
        
        // console.log(model.visibleItems);
    },

    "test: async expand/collapse" : function() {
        var model = new TreeData([{label: "a"}]);
        assert.equal(model.visibleItems.length, 1);
        var first = model.visibleItems[0];
        assert.equal(first.$depth, 0);
        
        first.status = "pending";
        model.loadChildren = function(node, cb) {
            node.map = {x : {label: "x"}};
            cb(null);
        };
        
        model.expand(first);
        assert.equal(model.visibleItems.length, 2);
        var second = model.visibleItems[1];
        assert.equal(second.$depth, 1);
        
        // console.log(model.visibleItems);
    },
    
    "test alphanum sort" : function() {
        var alphanumCompare = TreeData.alphanumCompare
        assert.equal(
            ["w4y", "w4x", "a14", "a2", "A2"].sort(alphanumCompare) + "",
            ["a2","A2","a14","w4x","w4y"] + ""
        );
    }
};

});

if (typeof module !== "undefined" && module === require.main) {
    require("asyncjs").test.testcase(module.exports).exec();
}
