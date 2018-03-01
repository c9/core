define(function(require, exports, module) {
    function defineProp(obj, name, val) {
        Object.defineProperty(obj, name, {
            value: val,
            enumerable: false,
            writable: true,
            configurable: true,
        });
    }
    if (!String.prototype.startsWith) {
        defineProp(String.prototype, "startsWith", function(searchString, position) {
            position = position || 0;
            return this.lastIndexOf(searchString, position) === position;
        });
    }
    if (!String.prototype.endsWith) {
        // Taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
        defineProp(String.prototype, "endsWith", function(searchString, position) {
            var subjectString = this;
            if (position === undefined || position > subjectString.length) {
                position = subjectString.length;
            }
            position -= searchString.length;
            var lastIndex = subjectString.indexOf(searchString, position);
            return lastIndex !== -1 && lastIndex === position;
        });
    }
    if (!String.prototype.repeat) {
        defineProp(String.prototype, "repeat", function(count) {
            var result = "";
            var string = this;
            while (count > 0) {
                if (count & 1)
                    result += string;
        
                if (count >>= 1)
                    string += string;
            }
            return result;
        });
    }
    if (!String.prototype.includes) {
        defineProp(String.prototype, "includes", function(str, position) {
            return this.indexOf(str, position != -1);
        });
    }
    if (!Object.assign) {
        Object.assign = function (target) {
            if (target === undefined || target === null) {
                throw new TypeError('Cannot convert undefined or null to object');
            }

            var output = Object(target);
            for (var index = 1; index < arguments.length; index++) {
                var source = arguments[index];
                if (source !== undefined && source !== null) {
                    Object.keys(source).forEach(function(key) {
                        output[key] = source[key];
                    });
                }
            }
            return output;
        };
    }

});
