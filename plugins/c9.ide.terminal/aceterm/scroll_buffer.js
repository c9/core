define(function(require, exports, module) {
    var ScrollBuffer = module.exports = function ScrollBuffer() {
        this.lines = [];
        this.ybase = 0;
    };
    
    (function() {
        this.toBufferLine = function(screenLine) {
            var line = [], token = "", attr;
            for (var i = 0; i < screenLine.length; i++) {
                var data = screenLine[i];
                if (data[0] === attr) {
                    token += data[1];
                } else {
                    if (token)
                        line.push(attr, token);
                    attr = data[0];
                    token = data[1];
                }
            }
            if (token)
                line.push(attr, token);
            line.wrapped = screenLine.wrapped;
            return line;
        };
        this.toScreenLine = function(line) {
            var screenLine = [], token = "", attr;
            for (var i = 0; i < line.length; i += 2) {
                token = line[i + 1];
                attr = line[i];
                
                for (var j = 0; j < token.length; j++) {
                    screenLine.push([attr, token[j]]);
                }
            }
            screenLine.wrapped = line.wrapped;
            return screenLine;
        };
        
        this.scroll = function() {
            
        };
        this.clear = function() {
            
        };
        this.resize = function() {
            
        };
        
    }).call(ScrollBuffer.prototype);
});