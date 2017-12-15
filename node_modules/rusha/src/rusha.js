/* eslint-env commonjs, browser */

const RushaCore = require('./core.sjs');
const {toHex, ceilHeapSize} = require('./utils');
const conv = require('./conv');

// Calculate the length of buffer that the sha1 routine uses
// including the padding.
const padlen = (len) => {
  for (len += 9; len % 64 > 0; len += 1);
  return len;
};

const padZeroes = (bin, len) => {
  const h8 = new Uint8Array(bin.buffer);
  const om = len % 4, align = len - om;
  switch (om) {
  case 0: h8[align + 3] = 0;
  case 1: h8[align + 2] = 0;
  case 2: h8[align + 1] = 0;
  case 3: h8[align + 0] = 0;
  }
  for (let i = (len >> 2) + 1; i < bin.length; i++) {
    bin[i] = 0;
  }
};

const padData = (bin, chunkLen, msgLen) => {
  bin[chunkLen>>2] |= 0x80 << (24 - (chunkLen % 4 << 3));
  // To support msgLen >= 2 GiB, use a float division when computing the
  // high 32-bits of the big-endian message length in bits.
  bin[(((chunkLen >> 2) + 2) & ~0x0f) + 14] = (msgLen / (1 << 29)) |0;
  bin[(((chunkLen >> 2) + 2) & ~0x0f) + 15] = msgLen << 3;
};

const getRawDigest = (heap, padMaxChunkLen) => {
  const io = new Int32Array(heap, padMaxChunkLen + 320, 5);
  const out = new Int32Array(5);
  const arr = new DataView(out.buffer);
  arr.setInt32(0, io[0], false);
  arr.setInt32(4, io[1], false);
  arr.setInt32(8, io[2], false);
  arr.setInt32(12, io[3], false);
  arr.setInt32(16, io[4], false);
  return out;
};

class Rusha {
  constructor(chunkSize) {
    chunkSize = chunkSize || 64 * 1024;
    if (chunkSize % 64 > 0) {
      throw new Error('Chunk size must be a multiple of 128 bit');
    }
    this._offset = 0;
    this._maxChunkLen = chunkSize;
    this._padMaxChunkLen = padlen(chunkSize);
    // The size of the heap is the sum of:
    // 1. The padded input message size
    // 2. The extended space the algorithm needs (320 byte)
    // 3. The 160 bit state the algoritm uses
    this._heap = new ArrayBuffer(ceilHeapSize(this._padMaxChunkLen + 320 + 20));
    this._h32 = new Int32Array(this._heap);
    this._h8 = new Int8Array(this._heap);
    this._core = new RushaCore({Int32Array: Int32Array}, {}, this._heap);
  }

  _initState(heap, padMsgLen) {
    this._offset = 0;
    const io = new Int32Array(heap, padMsgLen + 320, 5);
    io[0] = 1732584193;
    io[1] = -271733879;
    io[2] = -1732584194;
    io[3] = 271733878;
    io[4] = -1009589776;
  }

  _padChunk(chunkLen, msgLen) {
    const padChunkLen = padlen(chunkLen);
    const view = new Int32Array(this._heap, 0, padChunkLen >> 2);
    padZeroes(view, chunkLen);
    padData(view, chunkLen, msgLen);
    return padChunkLen;
  }

  _write(data, chunkOffset, chunkLen, off) {
    conv(data, this._h8, this._h32, chunkOffset, chunkLen, off || 0);
  }

  _coreCall(data, chunkOffset, chunkLen, msgLen, finalize) {
    let padChunkLen = chunkLen;
    this._write(data, chunkOffset, chunkLen);
    if (finalize) {
      padChunkLen = this._padChunk(chunkLen, msgLen);
    }
    this._core.hash(padChunkLen, this._padMaxChunkLen);
  }

  rawDigest(str) {
    const msgLen = str.byteLength || str.length || str.size || 0;
    this._initState(this._heap, this._padMaxChunkLen);
    let chunkOffset = 0, chunkLen = this._maxChunkLen;
    for (chunkOffset = 0; msgLen > chunkOffset + chunkLen; chunkOffset += chunkLen) {
      this._coreCall(str, chunkOffset, chunkLen, msgLen, false);
    }
    this._coreCall(str, chunkOffset, msgLen - chunkOffset, msgLen, true);
    return getRawDigest(this._heap, this._padMaxChunkLen);
  }

  digest(str) {
    return toHex(this.rawDigest(str).buffer);
  }

  digestFromString(str) {
    return this.digest(str);
  }

  digestFromBuffer(str) {
    return this.digest(str);
  }

  digestFromArrayBuffer(str) {
    return this.digest(str);
  }

  resetState() {
    this._initState(this._heap, this._padMaxChunkLen);
    return this;
  }

  append(chunk) {
    let chunkOffset = 0;
    let chunkLen = chunk.byteLength || chunk.length || chunk.size || 0;
    let turnOffset = this._offset % this._maxChunkLen;
    let inputLen;

    this._offset += chunkLen;
    while (chunkOffset < chunkLen) {
      inputLen = Math.min(chunkLen - chunkOffset, this._maxChunkLen - turnOffset);
      this._write(chunk, chunkOffset, inputLen, turnOffset);
      turnOffset += inputLen;
      chunkOffset += inputLen;
      if (turnOffset === this._maxChunkLen) {
        this._core.hash(this._maxChunkLen, this._padMaxChunkLen);
        turnOffset = 0;
      }
    }
    return this;
  }

  getState() {
    const turnOffset = this._offset % this._maxChunkLen;
    let heap;
    if (!turnOffset) {
      const io = new Int32Array(this._heap, this._padMaxChunkLen + 320, 5);
      heap = io.buffer.slice(io.byteOffset, io.byteOffset + io.byteLength);
    } else {
      heap = this._heap.slice(0);
    }
    return {
      offset: this._offset,
      heap: heap
    };
  }

  setState(state) {
    this._offset = state.offset;
    if (state.heap.byteLength === 20) {
      const io = new Int32Array(this._heap, this._padMaxChunkLen + 320, 5);
      io.set(new Int32Array(state.heap));
    } else {
      this._h32.set(new Int32Array(state.heap));  
    }
    return this;
  }

  rawEnd() {
    const msgLen = this._offset;
    const chunkLen = msgLen % this._maxChunkLen;
    const padChunkLen = this._padChunk(chunkLen, msgLen);
    this._core.hash(padChunkLen, this._padMaxChunkLen);
    const result = getRawDigest(this._heap, this._padMaxChunkLen);
    this._initState(this._heap, this._padMaxChunkLen);
    return result;
  }

  end() {
    return toHex(this.rawEnd().buffer);
  }
}

module.exports = Rusha;
module.exports._core = RushaCore;
