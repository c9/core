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


define(function(require, exports, module) {
"use strict";

var Renderer = require("ace/virtual_renderer").VirtualRenderer;
var Editor = require("ace/editor").Editor;

var Evaluator = function() {
};

(function() {
    this.canEvaluate = function(str) {
        return !!str.trim();
    };

    this.evaluate = function(str, cell, cb) {
        if (/table|ace/.test(str)) {
            cb("");
            var editor = new Editor(new Renderer);
            editor.setValue("command " + str);
            editor.container.addEventListener("mousedown", function(e) {
                e.stopPropagation();
            });
            cell.addWidget({ rowCount: 8, el: editor.container, editor: editor });
            setTimeout(function() {
                editor.resize(true);
            }, 80);
        } else if (/repl/.test(str)) {
            cb("");
            var editor = new Editor(new Renderer);
            cell.session.repl.constructor.fromEditor(editor, {
                mode: "repl_demo/logiql_command_mode",
                evaluator: this,
                message: "welcome to inner Repl!"
            });

            editor.container.addEventListener("mousedown", function(e) {
                e.stopPropagation();
            });
            cell.addWidget({ rowCount: 12, el: editor.container, editor: editor });
            setTimeout(function() {
                editor.resize(true);
            }, 80);
        } else if (/logo/.test(str)) {
            setTimeout(function() {
                cb("");
                cell.addWidget({ rowCount: 6, html: "<img src='http://martin.bravenboer.name/logo-trans-85.png'>" });
            }, 300);
        } else if (/lorem/.test(str)) {
            var a = [];
            for (var i = 0; i < 100; i++) {
                a.push(i);
            }
            cb(a.join("\n"));
        } else if (/\n|slow/.test(str)) {
            setTimeout(function() {
                cb("evaluated slow command:" + str);
            }, 1000);
        } else {
            cb("evaluated command: " + str);
        }
    };
}).call(Evaluator.prototype);
exports.Evaluator = Evaluator;

});