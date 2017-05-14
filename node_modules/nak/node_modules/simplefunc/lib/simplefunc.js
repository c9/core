
'use strict';

var simplefunc = (function () {
    function encode(obj) {
        if (!obj)
            return obj;
            
        if (typeof obj === 'function')
            return encodeFunction(obj);

        if (typeof obj === 'object')
            return encodeObject(obj);

        return obj;
    };

    function decode(obj) {
        if (!obj)
            return obj;
            
        if (typeof obj === 'object') {
            if (obj._fn)
                return Function.constructor.apply(Function, obj._fn);

            if (obj._obj && obj._fns) {
                var result = obj._obj;

                for (var n in obj._fns)
                    result[n] = Function.constructor.apply(Function, obj._fns[n]);

                return result;
            }
        }

        return obj;
    };

    function encodeObject(obj) {
        var result = { _obj: { }, _fns: { } };
        var nfuncs = 0;

        for (var n in obj) {
            if (typeof obj[n] === 'function') {
                var fn = encodeFunction(obj[n]);
                result._fns[n] = fn._fn;
                nfuncs++;
            }
            else
                result._obj[n] = obj[n];
        }

        if (!nfuncs)
            return obj;

        return result;
    };

    function encodeFunction(func) {
        var text = func.toString();
        var p1 = text.indexOf('(');
        var p2 = text.indexOf(')');
        var args = text.substring(p1 + 1, p2).trim().split(',');
        p1 = text.indexOf('{');
        p2 = text.lastIndexOf('}');
        var code = text.substring(p1 + 1, p2).trim();

        if (args.length) {
            for (var n in args)
                args[n] = args[n].trim();

            args.push(code);

            return { _fn: args };
        }

        return { _fn: [code] };
    }

    return {
        encode: encode,
        decode: decode,
        toJson: function (obj) { return JSON.stringify(encode(obj)); },
        fromJson: function (json) { return decode(JSON.parse(json)); }
    }
})();

if (typeof window === 'undefined') {
	module.exports = simplefunc;
}
