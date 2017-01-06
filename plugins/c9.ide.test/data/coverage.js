// TODO docs, see data/breakpoint.js
define(function(require, exports, module) {
    
    var Data = require("./data");
    
    function Coverage(options) {
        this.data = options || {};
        this.type = "coverage";
    }
    
    Coverage.prototype = new Data(
        ["path"], 
        ["files"]
    );
    
    Coverage.prototype.equals = function(coverage) {
        return this.data.path == coverage.path;
    };
    
    module.exports = Coverage;
    
    /*
        Copyright (c) 2012, Yahoo! Inc. All rights reserved.
        Code licensed under the BSD License:
        http://yuilibrary.com/license/
    */
    Coverage.fromLCOV = function(lcovString, path) {
        var data = [], item;
    
        [ 'end_of_record' ].concat(lcovString.split('\n')).forEach(function(line) {
            line = line.trim();
            var allparts = line.split(':'),
                parts = [allparts.shift(), allparts.join(':')],
                lines, fn;
    
            switch (parts[0].toUpperCase()) {
                case 'TN':
                    // item.title = parts[1].trim();
                    break;
                case 'SF':
                    item.file = parts.slice(1).join(':').trim().replace(/\\/g, "/");
                    break;
                case 'FNF':
                    // item.functions.found = Number(parts[1].trim());
                    break;
                case 'FNH':
                    // item.functions.hit = Number(parts[1].trim());
                    break;
                case 'LF':
                    item.lines.found = Number(parts[1].trim());
                    break;
                case 'LH':
                    item.lines.hit = Number(parts[1].trim());
                    break;
                case 'DA':
                    lines = parts[1].split(',');
                    
                    if (Number(lines[1]))
                        item.lines.covered.push(Number(lines[0]));
                    else 
                        item.lines.uncovered.push(Number(lines[0]));
                    
                    // item.lines.details.push({
                    //     line: Number(lines[0]),
                    //     hit: Number(lines[1])
                    // });
                    break;
                case 'FN':
                    // fn = parts[1].split(',');
                    // item.functions.details.push({
                    //     name: fn[1],
                    //     line: Number(fn[0])
                    // });
                    break;
                case 'FNDA':
                    // fn = parts[1].split(',');
                    // item.functions.details.some(function(i, k) {
                    //     if (i.name === fn[1] && i.hit === undefined) {
                    //         item.functions.details[k].hit = Number(fn[0]);
                    //         return true;
                    //     }
                    // });
                    break;
                case 'BRDA':
                    // fn = parts[1].split(',');
                    // item.branches.details.push({
                    //     line: Number(fn[0]),
                    //     block: Number(fn[1]),
                    //     branch: Number(fn[2]),
                    //     taken: ((fn[3] === '-') ? 0 : Number(fn[3]))
                    // });
                    break;
                case 'BRF':
                    // item.branches.found = Number(parts[1]);
                    break;
                case 'BRH':
                    // item.branches.hit = Number(parts[1]);
                    break;
            }
    
            if (line.indexOf('end_of_record') > -1) {
                data.push(item);
                item = {
                  lines: {
                      found: 0,
                      hit: 0,
                      covered: [],
                      uncovered: []
                  }
                //   functions: {
                //       hit: 0,
                //       found: 0,
                //       details: []
                //   },
                //   branches: {
                //     hit: 0,
                //     found: 0,
                //     details: []
                //   }
                };
            }
        });
    
        data.shift();
    
        if (data.length) {
            return new Coverage({
                files: data,
                path: path
            });
        } 
        else {
            return false;
        }
    };
});