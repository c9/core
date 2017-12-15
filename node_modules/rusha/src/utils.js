/* eslint-env commonjs, browser */

//
// toHex
//

const precomputedHex = new Array(256);
for (let i = 0; i < 256; i++) {
  precomputedHex[i] = (i < 0x10 ? '0' : '') + i.toString(16);
}

module.exports.toHex = (arrayBuffer) => {
  const binarray = new Uint8Array(arrayBuffer);
  const res = new Array(arrayBuffer.byteLength);
  for (let i = 0; i < res.length; i++) {
    res[i] = precomputedHex[binarray[i]];
  }
  return res.join('');
};

//
// ceilHeapSize
//

module.exports.ceilHeapSize = (v) => {
  // The asm.js spec says:
  // The heap object's byteLength must be either
  // 2^n for n in [12, 24) or 2^24 * n for n ≥ 1.
  // Also, byteLengths smaller than 2^16 are deprecated.
  let p = 0;
  // If v is smaller than 2^16, the smallest possible solution
  // is 2^16.
  if (v <= 65536) return 65536;
  // If v < 2^24, we round up to 2^n,
  // otherwise we round up to 2^24 * n.
  if (v < 16777216) {
    for (p = 1; p < v; p = p << 1);
  } else {
    for (p = 16777216; p < v; p += 16777216);
  }
  return p;
};
