/*

 Copyright (c) 2013 SMB Phone Inc.
 All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 1. Redistributions of source code must retain the above copyright notice, this
 list of conditions and the following disclaimer.
 2. Redistributions in binary form must reproduce the above copyright notice,
 this list of conditions and the following disclaimer in the documentation
 and/or other materials provided with the distribution.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

 The views and conclusions contained in the software and documentation are those
 of the authors and should not be interpreted as representing official policies,
 either expressed or implied, of the FreeBSD Project.

*/

( // Module boilerplate to support browser globals, node.js and AMD.
  (typeof module !== "undefined" && function (m) { module.exports = m(); }) ||
  (typeof define === "function" && function (m) { define(m); }) ||
  (function (m) { window.cifre_sha1 = m(); })
)(function(){
  "use strict";

  var state = new Uint32Array(5);
  var bstate = new Uint8Array(state.buffer);

  // Create a buffer for each 80 word block.
  var block = new Uint32Array(80);

  function common(a, e, w, k, f) {
    return (f + e + w + k + ((a << 5) | (a >>> 27))) >>> 0;
  }

  function f1(a, b, c, d, e, w) {
    return common(a, e, w, 0x5A827999, d ^ (b & (c ^ d)));
  }

  function f2(a, b, c, d, e, w) {
    return common(a, e, w, 0x6ED9EBA1, b ^ c ^ d);
  }

  function f3(a, b, c, d, e, w) {
    return common(a, e, w, 0x8F1BBCDC, (b & c) | (d & (b | c)));
  }

  function f4(a, b, c, d, e, w) {
    return common(a, e, w, 0xCA62C1D6, b ^ c ^ d);
  }

  // function hex8(num) {
  //   var hex = num.toString(16).toUpperCase();
  //   return "00000000".substr(hex.length) + hex;
  // }

  function cycle(state, block) {
    var a = state[0],
        b = state[1],
        c = state[2],
        d = state[3],
        e = state[4];

    // console.log("\nInitial hash value:");
    // for (var i = 0; i < 5; i++) {
    //   console.log("  H[" + i + "] = " + hex8(state[i]));
    // }
    // console.log("\nBlock Contents:");
    // for (var i = 0; i < 16; i++) {
    //     console.log("  W[" + i + "] = " + hex8(block[i]));
    // }

    // console.log("\n          A         B         C         D         E");
    // Partially unroll loops so we don't have to shift variables.
    var fn = f1;;
    for (var i = 0; i < 80; i += 5) {
      if (i === 20) { fn = f2; }
      else if (i === 40) { fn = f3; }
      else if (i === 60) { fn = f4; }
      e = fn(a, b, c, d, e, block[i]);  b = ((b << 30) | (b >>> 2)) >>> 0;
      // console.log("t=%s: %s  %s  %s  %s  %s", i,
      //   hex8(e), hex8(a), hex8(b), hex8(c), hex8(d));
      d = fn(e, a, b, c, d, block[i + 1]);  a = ((a << 30) | (a >>> 2)) >>> 0;
      // console.log("t=%s: %s  %s  %s  %s  %s", i + 1,
      //   hex8(d), hex8(e), hex8(a), hex8(b), hex8(c));
      c = fn(d, e, a, b, c, block[i + 2]);  e = ((e << 30) | (e >>> 2)) >>> 0;
      // console.log("t=%s: %s  %s  %s  %s  %s", i + 2,
      //   hex8(c), hex8(d), hex8(e), hex8(a), hex8(b));
      b = fn(c, d, e, a, b, block[i + 3]);  d = ((d << 30) | (d >>> 2)) >>> 0;
      // console.log("t=%s: %s  %s  %s  %s  %s", i + 3,
      //   hex8(b), hex8(c), hex8(d), hex8(e), hex8(a));
      a = fn(b, c, d, e, a, block[i + 4]);  c = ((c << 30) | (c >>> 2)) >>> 0;
      // console.log("t=%s: %s  %s  %s  %s  %s", i + 4,
      //   hex8(a), hex8(b), hex8(c), hex8(d), hex8(e));
    }

    // console.log();
    // process.stdout.write("H[0] = " + hex8(state[0]) + " + " + hex8(a));
    state[0] += a;
    // console.log(" = " + hex8(state[0]));
    // process.stdout.write("H[1] = " + hex8(state[1]) + " + " + hex8(b));
    state[1] += b;
    // console.log(" = " + hex8(state[1]));
    // process.stdout.write("H[2] = " + hex8(state[2]) + " + " + hex8(c));
    state[2] += c;
    // console.log(" = " + hex8(state[2]));
    // process.stdout.write("H[3] = " + hex8(state[3]) + " + " + hex8(d));
    state[3] += d;
    // console.log(" = " + hex8(state[3]));
    // process.stdout.write("H[4] = " + hex8(state[4]) + " + " + hex8(e));
    state[4] += e;
    // console.log(" = " + hex8(state[4]));


  }

  // input is a Uint8Array bitstream of the data
  function sha1(input) {

    var inputLength = input.length;

    // Pad the input string length.
    var length = inputLength + 9;
    length += 64 - (length % 64);

    state[0] = 0x67452301;
    state[1] = 0xefcdab89;
    state[2] = 0x98badcfe;
    state[3] = 0x10325476;
    state[4] = 0xc3d2e1f0;

    for (var offset = 0; offset < length; offset += 64) {

      // Copy input to block and write padding as needed
      for (var i = 0; i < 64; i++) {
        var b = 0,
            o = offset + i;
        if (o < inputLength) {
          b = input[o];
        }
        else if (o === inputLength) {
          b = 0x80;
        }
        else {
          // Write original bit length as a 64bit big-endian integer to the end.
          var x = length - o - 1;
          if (x >= 0 && x < 4) {
            b = (inputLength << 3 >>> (x * 8)) & 0xff;
          }
        }

        // Interpret the input bytes as big-endian per the spec
        if (i % 4 === 0) {
          block[i >> 2] = b << 24;
        }
        else {
          block[i >> 2] |= b << ((3 - (i % 4)) * 8);
        }
      }

      // Extend the block
      for (var i = 16; i < 80; i++) {
        var w = block[i - 3] ^ block[i - 8] ^ block[i - 14] ^ block[i - 16];
        block[i] = (w << 1) | (w >>> 31);
      }

      cycle(state, block);

    }

    // Swap the bytes around since they are big endian internally
    return [
      bstate[3], bstate[2], bstate[1], bstate[0],
      bstate[7], bstate[6], bstate[5], bstate[4],
      bstate[11], bstate[10], bstate[9], bstate[8],
      bstate[15], bstate[14], bstate[13], bstate[12],
      bstate[19], bstate[18], bstate[17], bstate[16],
    ]
  }

  return sha1;
});
