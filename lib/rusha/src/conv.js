/* eslint-env commonjs, browser */

let reader;
if (typeof self !== 'undefined' && typeof self.FileReaderSync !== 'undefined') {
  reader = new self.FileReaderSync();
}

// Convert a binary string and write it to the heap.
// A binary string is expected to only contain char codes < 256.
const convStr = (str, H8, H32, start, len, off) => {
  let i, om = off % 4, lm = (len + om) % 4, j = len - lm;
  switch (om) {
  case 0: H8[off] = str.charCodeAt(start+3);
  case 1: H8[off+1-(om<<1)|0] = str.charCodeAt(start+2);
  case 2: H8[off+2-(om<<1)|0] = str.charCodeAt(start+1);
  case 3: H8[off+3-(om<<1)|0] = str.charCodeAt(start);
  }
  if (len < lm + (4-om)) {
    return;
  }
  for (i = 4 - om; i < j; i = i + 4 | 0) {
    H32[off+i>>2] = str.charCodeAt(start+i)   << 24 |
                    str.charCodeAt(start+i+1) << 16 |
                    str.charCodeAt(start+i+2) <<  8 |
                    str.charCodeAt(start+i+3);
  }
  switch (lm) {
  case 3: H8[off+j+1|0] = str.charCodeAt(start+j+2);
  case 2: H8[off+j+2|0] = str.charCodeAt(start+j+1);
  case 1: H8[off+j+3|0] = str.charCodeAt(start+j);
  }
};

// Convert a buffer or array and write it to the heap.
// The buffer or array is expected to only contain elements < 256.
const convBuf = (buf, H8, H32, start, len, off) => {
  let i, om = off % 4, lm = (len + om) % 4, j = len - lm;
  switch (om) {
  case 0: H8[off] = buf[start + 3];
  case 1: H8[off+1-(om<<1)|0] = buf[start+2];
  case 2: H8[off+2-(om<<1)|0] = buf[start+1];
  case 3: H8[off+3-(om<<1)|0] = buf[start];
  }
  if (len < lm + (4-om)) {
    return;
  }
  for (i = 4 - om; i < j; i = i + 4 | 0) {
    H32[off+i>>2|0] = buf[start+i]   << 24 |
                      buf[start+i+1] << 16 | 
                      buf[start+i+2] <<  8 | 
                      buf[start+i+3];
  }
  switch (lm) {
  case 3: H8[off+j+1|0] = buf[start+j+2];
  case 2: H8[off+j+2|0] = buf[start+j+1];
  case 1: H8[off+j+3|0] = buf[start+j];
  }
};

const convBlob = (blob, H8, H32, start, len, off) => {
  let i, om = off % 4, lm = (len + om) % 4, j = len - lm;
  const buf = new Uint8Array(reader.readAsArrayBuffer(blob.slice(start, start + len)));
  switch (om) {
  case 0: H8[off] = buf[3];
  case 1: H8[off+1-(om<<1)|0] = buf[2];
  case 2: H8[off+2-(om<<1)|0] = buf[1];
  case 3: H8[off+3-(om<<1)|0] = buf[0];
  }
  if (len < lm + (4-om)) {
    return;
  }
  for (i = 4 - om; i < j; i = i + 4 | 0) {
    H32[off+i>>2|0] = buf[i]   << 24 | 
                      buf[i+1] << 16 |
                      buf[i+2] <<  8 |
                      buf[i+3];
  }
  switch (lm) {
  case 3: H8[off+j+1|0] = buf[j + 2];
  case 2: H8[off+j+2|0] = buf[j + 1];
  case 1: H8[off+j+3|0] = buf[j];
  }
};

module.exports = (data, H8, H32, start, len, off) => {
  if (typeof data === 'string') {
    return convStr(data, H8, H32, start, len, off);
  }
  if (data instanceof Array) {
    return convBuf(data, H8, H32, start, len, off);
  }
  if (global.Buffer && global.Buffer.isBuffer(data)) {
    return convBuf(data, H8, H32, start, len, off);
  }
  if (data instanceof ArrayBuffer) {
    return convBuf(new Uint8Array(data), H8, H32, start, len, off);
  }
  if (data.buffer instanceof ArrayBuffer) {
    return convBuf(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), H8, H32, start, len, off);
  }
  if (data instanceof Blob) {
    return convBlob(data, H8, H32, start, len, off);
  }
  throw new Error('Unsupported data type.');
};
