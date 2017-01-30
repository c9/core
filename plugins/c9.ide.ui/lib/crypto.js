define(function(require, module, exports) {
return function(apf) {
    

/*
 * Crypt.Barrett, a class for performing Barrett modular reduction computations in
 * JavaScript.
 *
 * Requires BigInt.js.
 *
 * Copyright 2004-2005 David Shapiro.
 *
 * You may use, re-use, abuse, copy, and modify this code to your liking, but
 * please keep this header.
 *
 * Thanks!
 * 
 * @author Dave Shapiro <dave AT ohdave DOT com>
 */
apf.crypto.Base64 = (function() {
    
    var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    
    // public method for encoding
    function encode(data) {
        var o1, o2, o3, h1, h2, h3, h4, bits, i = 0, ac = 0, enc = "",
            tmp_arr = [];

        if (!data)
            return data;

        data = apf.crypto.UTF8.encode(data + "");

        do { // pack three octets into four hexets
            o1 = data.charCodeAt(i++);
            o2 = data.charCodeAt(i++);
            o3 = data.charCodeAt(i++);

            bits = o1 << 16 | o2 << 8 | o3;

            h1 = bits >> 18 & 0x3f;
            h2 = bits >> 12 & 0x3f;
            h3 = bits >> 6 & 0x3f;
            h4 = bits & 0x3f;

            // use hexets to index into b64, and append result to encoded string
            tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3)
                + b64.charAt(h4);
        }
        while (i < data.length);

        enc = tmp_arr.join("");

        switch (data.length % 3) {
            case 1:
                enc = enc.slice(0, -2) + '==';
                break;
            case 2:
                enc = enc.slice(0, -1) + '=';
                break;
        }

        return enc;
    }
    
    // public method for decoding
    function decode(data) {
        var o1, o2, o3, h1, h2, h3, h4, bits, i = 0, ac = 0, tmp_arr = [];

        if (!data) {
            return data;
        }

        data += "";

        do {  // unpack four hexets into three octets using index points in b64
            h1 = b64.indexOf(data.charAt(i++));
            h2 = b64.indexOf(data.charAt(i++));
            h3 = b64.indexOf(data.charAt(i++));
            h4 = b64.indexOf(data.charAt(i++));

            bits = h1 << 18 | h2 << 12 | h3 << 6 | h4;

            o1 = bits >> 16 & 0xff;
            o2 = bits >> 8 & 0xff;
            o3 = bits & 0xff;

            if (h3 == 64)
                tmp_arr[ac++] = String.fromCharCode(o1);
            else if (h4 == 64)
                tmp_arr[ac++] = String.fromCharCode(o1, o2);
            else
                tmp_arr[ac++] = String.fromCharCode(o1, o2, o3);
        }
        while (i < data.length);

        return apf.crypto.UTF8.decode(tmp_arr.join(""));
    }
    
    return {
        decode: decode,
        encode: encode
    };
    
})();

apf.crypto.UTF8 = {
    // private method for UTF-8 encoding
    encode: function (string) {
        // Encodes an ISO-8859-1 string to UTF-8
        //
        // version: 905.1217
        // discuss at: http://phpjs.org/functions/utf8_encode
        // +   original by: Webtoolkit.info (http://www.webtoolkit.info/)
        // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // +   improved by: sowberry
        // +    tweaked by: Jack
        // +   bugfixed by: Onno Marsman
        // +   improved by: Yves Sucaet
        // +   bugfixed by: Onno Marsman
        // *     example 1: utf8_encode('Kevin van Zonneveld');
        // *     returns 1: 'Kevin van Zonneveld'
        string = (string + "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

        var tmp_arr = [],
            start = 0,
            end = 0,
            c1, enc;

        for (var n = 0, l = string.length; n < l; n++) {
            c1 = string.charCodeAt(n);
            enc = null;

            if (c1 < 128) {
                end++;
            }
            else if ((c1 > 127) && (c1 < 2048)) {
                enc = String.fromCharCode((c1 >> 6) | 192)
                    + String.fromCharCode((c1 & 63) | 128);
            }
            else {
                enc = String.fromCharCode((c1 >> 12) | 224) 
                    + String.fromCharCode(((c1 >> 6) & 63) | 128)
                    + String.fromCharCode((c1 & 63) | 128);
            }
            if (enc !== null) {
                if (end > start)
                    tmp_arr.push(string.substring(start, end));
                tmp_arr.push(enc);
                start = end = n + 1;
            }
        }

        if (end > start)
            tmp_arr.push(string.substring(start, string.length));

        return tmp_arr.join("");
    },

    // private method for UTF-8 decoding
    decode: function (str_data) {
        // Converts a UTF-8 encoded string to ISO-8859-1
        //
        // version: 905.3122
        // discuss at: http://phpjs.org/functions/utf8_decode
        // +   original by: Webtoolkit.info (http://www.webtoolkit.info/)
        // +      input by: Aman Gupta
        // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // +   improved by: Norman "zEh" Fuchs
        // +   bugfixed by: hitwork
        // +   bugfixed by: Onno Marsman
        // +      input by: Brett Zamir (http://brett-zamir.me)
        // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // *     example 1: utf8_decode('Kevin van Zonneveld');
        // *     returns 1: 'Kevin van Zonneveld'
        var tmp_arr = [], i = 0, ac = 0, c1 = 0, c2 = 0, c3 = 0;

        str_data += "";

        while (i < str_data.length) {
            c1 = str_data.charCodeAt(i);
            if (c1 < 128) {
                tmp_arr[ac++] = String.fromCharCode(c1);
                i++;
            }
            else if ((c1 > 191) && (c1 < 224)) {
                c2 = str_data.charCodeAt(i + 1);
                tmp_arr[ac++] = String.fromCharCode(((c1 & 31) << 6) | (c2 & 63));
                i += 2;
            }
            else {
                c2 = str_data.charCodeAt(i + 1);
                c3 = str_data.charCodeAt(i + 2);
                tmp_arr[ac++] = String.fromCharCode(((c1 & 15) << 12)
                    | ((c2 & 63) << 6) | (c3 & 63));
                i += 3;
            }
        }

        return tmp_arr.join('');
    }

};


/*
 * BigInt, a suite of routines for performing multiple-precision arithmetic in
 * JavaScript.
 *
 * Copyright 1998-2005 David Shapiro.
 *
 * You may use, re-use, abuse,
 * copy, and modify this code to your liking, but please keep this header.
 * Thanks!
 *
 * @author Dave Shapiro <dave AT ohdave DOT com>
 * @author Ian Bunning
 *
 * IMPORTANT THING: Be sure to set maxDigits according to your precision
 * needs. Use the setMaxDigits() function to do this. See comments below.
 *
 * Tweaked by Ian Bunning
 * Alterations:
 * Fix bug in function biFromHex(s) to allow
 * parsing of strings of length != 0 (mod 4)
 *
 * Changes made by Dave Shapiro as of 12/30/2004:
 *
 * The BigInt() constructor doesn't take a string anymore. If you want to
 * create a BigInt from a string, use biFromDecimal() for base-10
 * representations, biFromHex() for base-16 representations, or
 * biFromString() for base-2-to-36 representations.
 *
 * biFromArray() has been removed. Use biCopy() instead, passing a BigInt
 * instead of an array.
 *
 * The BigInt() constructor now only constructs a zeroed-out array.
 * Alternatively, if you pass <true>, it won't construct any array. See the
 * biCopy() method for an example of this.
 *
 * Be sure to set maxDigits depending on your precision needs. The default
 * zeroed-out array ZERO_ARRAY is constructed inside the setMaxDigits()
 * function. So use this function to set the variable. DON'T JUST SET THE
 * VALUE. USE THE FUNCTION.
 *
 * ZERO_ARRAY exists to hopefully speed up construction of BigInts(). By
 * precalculating the zero array, we can just use slice(0) to make copies of
 * it. Presumably this calls faster native code, as opposed to setting the
 * elements one at a time. I have not done any timing tests to verify this
 * claim.
 * Max number = 10^16 - 2 = 9999999999999998;
 *               2^53 = 9007199254740992;
 */
apf.crypto.MD5 = {
    /*
     * Configurable variables. You may need to tweak these to be compatible with
     * the server-side, but the defaults work in most cases.
     */
    hexcase: 0,  /* hex output format. 0 - lowercase; 1 - uppercase        */
    b64pad: "", /* base-64 pad character. "=" for strict RFC compliance   */
    chrsz: 8,  /* bits per input character. 8 - ASCII; 16 - Unicode      */

    /**
     * These are the functions you'll usually want to call
     * They take string arguments and return either hex or base-64 encoded strings
     * 
     * Example:
     * var hash = apf.crypto.MD5.hex_md5("uzza"); //fddb7463a72e6b000abf631f558cf034
     */
    
    hex_md5: function(s) {
        return this.binl2hex(this.core_md5(this.str2binl(s), s.length * this.chrsz));
    },
    b64_md5: function(s) {
        return this.binl2b64(this.core_md5(this.str2binl(s), s.length * this.chrsz));
    },
    str_md5: function(s) {
        return this.binl2str(this.core_md5(this.str2binl(s), s.length * this.chrsz));
    },
    hex_hmac_md5: function(key, data) {
        return this.binl2hex(this.core_hmac_md5(key, data));
    },
    b64_hmac_md5: function(key, data) {
        return this.binl2b64(this.core_hmac_md5(key, data));
    },
    str_hmac_md5: function(key, data) {
        return this.binl2str(this.core_hmac_md5(key, data));
    },
    /**
     * Calculate the MD5 of an array of little-endian words, and a bit length
     */
    core_md5: function(x, len) {
      /* append padding */
      x[len >> 5] |= 0x80 << ((len) % 32);
      x[(((len + 64) >>> 9) << 4) + 14] = len;

      var a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;

      for (var i = 0; i < x.length; i += 16) {
        var olda = a, oldb = b, oldc = c, oldd = d;

        a = this.md5_ff(a, b, c, d, x[i + 0], 7, -680876936);
        d = this.md5_ff(d, a, b, c, x[i + 1], 12, -389564586);
        c = this.md5_ff(c, d, a, b, x[i + 2], 17, 606105819);
        b = this.md5_ff(b, c, d, a, x[i + 3], 22, -1044525330);
        a = this.md5_ff(a, b, c, d, x[i + 4], 7, -176418897);
        d = this.md5_ff(d, a, b, c, x[i + 5], 12, 1200080426);
        c = this.md5_ff(c, d, a, b, x[i + 6], 17, -1473231341);
        b = this.md5_ff(b, c, d, a, x[i + 7], 22, -45705983);
        a = this.md5_ff(a, b, c, d, x[i + 8], 7, 1770035416);
        d = this.md5_ff(d, a, b, c, x[i + 9], 12, -1958414417);
        c = this.md5_ff(c, d, a, b, x[i + 10], 17, -42063);
        b = this.md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
        a = this.md5_ff(a, b, c, d, x[i + 12], 7, 1804603682);
        d = this.md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
        c = this.md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
        b = this.md5_ff(b, c, d, a, x[i + 15], 22, 1236535329);

        a = this.md5_gg(a, b, c, d, x[i + 1], 5, -165796510);
        d = this.md5_gg(d, a, b, c, x[i + 6], 9, -1069501632);
        c = this.md5_gg(c, d, a, b, x[i + 11], 14, 643717713);
        b = this.md5_gg(b, c, d, a, x[i + 0], 20, -373897302);
        a = this.md5_gg(a, b, c, d, x[i + 5], 5, -701558691);
        d = this.md5_gg(d, a, b, c, x[i + 10], 9, 38016083);
        c = this.md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
        b = this.md5_gg(b, c, d, a, x[i + 4], 20, -405537848);
        a = this.md5_gg(a, b, c, d, x[i + 9], 5, 568446438);
        d = this.md5_gg(d, a, b, c, x[i + 14], 9, -1019803690);
        c = this.md5_gg(c, d, a, b, x[i + 3], 14, -187363961);
        b = this.md5_gg(b, c, d, a, x[i + 8], 20, 1163531501);
        a = this.md5_gg(a, b, c, d, x[i + 13], 5, -1444681467);
        d = this.md5_gg(d, a, b, c, x[i + 2], 9, -51403784);
        c = this.md5_gg(c, d, a, b, x[i + 7], 14, 1735328473);
        b = this.md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);

        a = this.md5_hh(a, b, c, d, x[i + 5], 4, -378558);
        d = this.md5_hh(d, a, b, c, x[i + 8], 11, -2022574463);
        c = this.md5_hh(c, d, a, b, x[i + 11], 16, 1839030562);
        b = this.md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
        a = this.md5_hh(a, b, c, d, x[i + 1], 4, -1530992060);
        d = this.md5_hh(d, a, b, c, x[i + 4], 11, 1272893353);
        c = this.md5_hh(c, d, a, b, x[i + 7], 16, -155497632);
        b = this.md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
        a = this.md5_hh(a, b, c, d, x[i + 13], 4, 681279174);
        d = this.md5_hh(d, a, b, c, x[i + 0], 11, -358537222);
        c = this.md5_hh(c, d, a, b, x[i + 3], 16, -722521979);
        b = this.md5_hh(b, c, d, a, x[i + 6], 23, 76029189);
        a = this.md5_hh(a, b, c, d, x[i + 9], 4, -640364487);
        d = this.md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
        c = this.md5_hh(c, d, a, b, x[i + 15], 16, 530742520);
        b = this.md5_hh(b, c, d, a, x[i + 2], 23, -995338651);

        a = this.md5_ii(a, b, c, d, x[i + 0], 6, -198630844);
        d = this.md5_ii(d, a, b, c, x[i + 7], 10, 1126891415);
        c = this.md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
        b = this.md5_ii(b, c, d, a, x[i + 5], 21, -57434055);
        a = this.md5_ii(a, b, c, d, x[i + 12], 6, 1700485571);
        d = this.md5_ii(d, a, b, c, x[i + 3], 10, -1894986606);
        c = this.md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
        b = this.md5_ii(b, c, d, a, x[i + 1], 21, -2054922799);
        a = this.md5_ii(a, b, c, d, x[i + 8], 6, 1873313359);
        d = this.md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
        c = this.md5_ii(c, d, a, b, x[i + 6], 15, -1560198380);
        b = this.md5_ii(b, c, d, a, x[i + 13], 21, 1309151649);
        a = this.md5_ii(a, b, c, d, x[i + 4], 6, -145523070);
        d = this.md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
        c = this.md5_ii(c, d, a, b, x[i + 2], 15, 718787259);
        b = this.md5_ii(b, c, d, a, x[i + 9], 21, -343485551);

        a = this.safe_add(a, olda);
        b = this.safe_add(b, oldb);
        c = this.safe_add(c, oldc);
        d = this.safe_add(d, oldd);
      }
      return [a, b, c, d];
    },
    /*
     * These functions implement the four basic operations the algorithm uses.
     */
    md5_cmn: function(q, a, b, x, s, t) {
        return this.safe_add(this.bit_rol(this.safe_add(this.safe_add(a, q),
            this.safe_add(x, t)), s), b);
    },
    md5_ff: function(a, b, c, d, x, s, t) {
        return this.md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
    },
    md5_gg: function(a, b, c, d, x, s, t) {
        return this.md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
    },
    md5_hh: function(a, b, c, d, x, s, t) {
        return this.md5_cmn(b ^ c ^ d, a, b, x, s, t);
    },
    md5_ii: function(a, b, c, d, x, s, t) {
        return this.md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
    },
    /**
     * Calculate the HMAC-MD5, of a key and some data
     */
    core_hmac_md5: function(key, data) {
        var bkey = this.str2binl(key),
            ipad = Array(16),
            opad = Array(16);
        if (bkey.length > 16)
            bkey = this.core_md5(bkey, key.length * this.chrsz);

        for (var i = 0; i < 16; i++) {
            ipad[i] = bkey[i] ^ 0x36363636;
            opad[i] = bkey[i] ^ 0x5C5C5C5C;
        }

        return this.core_md5(opad.concat(
            this.core_md5(ipad.concat(this.str2binl(data)), 512 + data.length * this.chrsz)
        ), 512 + 128);
    },
    /**
     * Add integers, wrapping at 2^32. This uses 16-bit operations internally
     * to work around bugs in some JS interpreters.
     */
    safe_add: function(x, y) {
        var lsw = (x & 0xFFFF) + (y & 0xFFFF),
            msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xFFFF);
    },
    /**
     * Bitwise rotate a 32-bit number to the left.
     */
    bit_rol: function(num, cnt) {
        return (num << cnt) | (num >>> (32 - cnt));
    },
    /**
     * Convert a string to an array of little-endian words
     * If chrsz is ASCII, characters >255 have their hi-byte silently ignored.
     */
    str2binl: function(str) {
        var bin = [], i,
            mask = (1 << this.chrsz) - 1;
        for (i = 0; i < str.length * this.chrsz; i += this.chrsz)
            bin[i >> 5] |= (str.charCodeAt(i / this.chrsz) & mask) << (i % 32);
        return bin;
    },
    /**
     * Convert an array of little-endian words to a string
     */
    binl2str: function(bin) {
        var str = [], i,
            mask = (1 << this.chrsz) - 1;
        for (i = 0; i < bin.length * 32; i += this.chrsz)
            str.push(String.fromCharCode((bin[i >> 5] >>> (i % 32)) & mask));
        return str.join("");
    },
    /**
     * Convert an array of little-endian words to a hex string.
     */
    binl2hex: function(binarray) {
        var hex_tab = this.hexcase ? "0123456789ABCDEF" : "0123456789abcdef",
            str = [], i;
        for (i = 0; i < binarray.length * 4; i++) {
            str.push(hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xF) +
                     hex_tab.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0xF));
        }
        return str.join("");
    },
    /**
     * Convert an array of little-endian words to a base-64 string
     */
    binl2b64: function(binarray) {
        var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
            str = [], i;
        for (i = 0; i < binarray.length * 4; i += 3) {
            var triplet = (((binarray[i >> 2] >> 8 * (i % 4)) & 0xFF) << 16)
                    | (((binarray[i + 1 >> 2] >> 8 * ((i + 1) % 4)) & 0xFF) << 8)
                    | ((binarray[i + 2 >> 2] >> 8 * ((i + 2) % 4)) & 0xFF);
            for (var j = 0; j < 4; j++) {
                if (i * 8 + j * 6 > binarray.length * 32)
                    str.push(this.b64pad);
                else
                    str.push(tab.charAt((triplet >> 6 * (3 - j)) & 0x3F));
            }
        }
        return str.join("");
    }
};



/*
 * RSA, a suite of routines for performing RSA public-key computations in
 * JavaScript.
 *
 * Requires BigInt.js and Barrett.js.
 *
 * Copyright 1998-2005 David Shapiro.
 *
 * You may use, re-use, abuse, copy, and modify this code to your liking, but
 * please keep this header.
 *
 * Thanks!
 * 
 * @author Dave Shapiro <dave AT ohdave DOT com>
 */
function rotate_left(n, s) {
    var t4 = (n << s) | (n >>> (32 - s));
    return t4;
}

/*
function lsb_hex(val) { // Not in use; needed?
    var str="";
    var i;
    var vh;
    var vl;

    for ( i=0; i<=6; i+=2 ) {
        vh = (val>>>(i*4+4))&0x0f;
        vl = (val>>>(i*4))&0x0f;
        str += vh.toString(16) + vl.toString(16);
    }
    return str;
};
*/

function cvt_hex(val) {
    var str = "";
    var i;
    var v;

    for (i = 7; i >= 0; i--) {
        v = (val >>> (i * 4)) & 0x0f;
        str += v.toString(16);
    }
    return str;
}

apf.crypto.SHA1 = function(str) {
    // Calculate the sha1 hash of a string
    //
    // version: 905.3122
    // discuss at: http://phpjs.org/functions/sha1
    // +   original by: Webtoolkit.info (http://www.webtoolkit.info/)
    // + namespaced by: Michael White (http://getsprink.com)
    // +      input by: Brett Zamir (http://brett-zamir.me)
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // -    depends on: utf8_encode
    // *     example 1: sha1('Kevin van Zonneveld');
    // *     returns 1: '54916d2e62f65b3afa6e192e6a601cdbe5cb5897'
    var blockstart, i, j, W = new Array(80),
        H0 = 0x67452301,
        H1 = 0xEFCDAB89,
        H2 = 0x98BADCFE,
        H3 = 0x10325476,
        H4 = 0xC3D2E1F0,
        A, B, C, D, E, temp;

    str = apf.crypto.UTF8.encode(str);
    var str_len = str.length,
        word_array = [];

    for (i = 0; i < str_len - 3; i += 4) {
        j = str.charCodeAt(i) << 24 | str.charCodeAt(i + 1) << 16 |
            str.charCodeAt(i + 2) << 8 | str.charCodeAt(i + 3);
        word_array.push(j);
    }

    switch (str_len % 4) {
        case 0:
            i = 0x080000000;
            break;
        case 1:
            i = str.charCodeAt(str_len - 1) << 24 | 0x0800000;
            break;
        case 2:
            i = str.charCodeAt(str_len - 2) << 24 | str.charCodeAt(str_len - 1)
                << 16 | 0x08000;
            break;
        case 3:
            i = str.charCodeAt(str_len - 3) << 24 | str.charCodeAt(str_len - 2)
                << 16 | str.charCodeAt(str_len - 1) << 8 | 0x80;
            break;
    }

    word_array.push(i);

    while ((word_array.length % 16) != 14)
        word_array.push(0);

    word_array.push(str_len >>> 29);
    word_array.push((str_len << 3) & 0x0ffffffff);

    for (blockstart = 0; blockstart < word_array.length; blockstart += 16) {
        for (i = 0; i < 16; i++)
            W[i] = word_array[blockstart + i];
        for (i = 16; i <= 79; i++)
            W[i] = rotate_left(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);

        A = H0;
        B = H1;
        C = H2;
        D = H3;
        E = H4;

        for (i = 0; i <= 19; i++) {
            temp = (rotate_left(A, 5) + ((B & C) | (~B & D)) + E + W[i]
                + 0x5A827999) & 0x0ffffffff;
            E = D;
            D = C;
            C = rotate_left(B, 30);
            B = A;
            A = temp;
        }

        for (i = 20; i <= 39; i++) {
            temp = (rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + 0x6ED9EBA1)
                & 0x0ffffffff;
            E = D;
            D = C;
            C = rotate_left(B, 30);
            B = A;
            A = temp;
        }

        for (i = 40; i <= 59; i++) {
            temp = (rotate_left(A, 5) + ((B & C) | (B & D) | (C & D)) + E + W[i]
                + 0x8F1BBCDC) & 0x0ffffffff;
            E = D;
            D = C;
            C = rotate_left(B, 30);
            B = A;
            A = temp;
        }

        for (i = 60; i <= 79; i++) {
            temp = (rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + 0xCA62C1D6)
                & 0x0ffffffff;
            E = D;
            D = C;
            C = rotate_left(B, 30);
            B = A;
            A = temp;
        }

        H0 = (H0 + A) & 0x0ffffffff;
        H1 = (H1 + B) & 0x0ffffffff;
        H2 = (H2 + C) & 0x0ffffffff;
        H3 = (H3 + D) & 0x0ffffffff;
        H4 = (H4 + E) & 0x0ffffffff;
    }

    temp = cvt_hex(H0) + cvt_hex(H1) + cvt_hex(H2) + cvt_hex(H3) + cvt_hex(H4);
    return temp.toLowerCase();
};


};
});