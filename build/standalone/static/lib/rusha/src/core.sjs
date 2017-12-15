macro rol1  { rule { ($v:expr) } => { ($v <<  1 | $v >>> 31) } }
macro rol5  { rule { ($v:expr) } => { ($v <<  5 | $v >>> 27) } }
macro rol30 { rule { ($v:expr) } => { ($v << 30 | $v >>>  2) } }

macro extended {
  rule { ($H, $j:expr) } => {
    rol1($H[$j-12>>2] ^ $H[$j-32>>2] ^ $H[$j-56>>2] ^ $H[$j-64>>2])
  }
}

macro F0 { rule { ($b,$c,$d) } => { ($b & $c | ~$b & $d) } }
macro F1 { rule { ($b,$c,$d) } => { ($b ^ $c ^ $d) }}
macro F2 { rule { ($b,$c,$d) } => { ($b & $c | $b & $d | $c & $d) }}

macro swap {
  rule { ($y0, $y1, $y2, $y3, $y4, $t0) } => {
    $y4 = $y3;
    $y3 = $y2;
    $y2 = rol30($y1);
    $y1 = $y0;
    $y0 = $t0;
  }
}

macro roundL { rule { ($y0, $f:expr) } => { (rol5($y0) + $f |0) } }
macro roundR { rule { ($y4, $t1) }     => { ($t1 + $y4 |0) } }

// The low-level RushCore module provides the heart of Rusha,
// a high-speed sha1 implementation working on an Int32Array heap.
// At first glance, the implementation seems complicated, however
// with the SHA1 spec at hand, it is obvious this almost a textbook
// implementation that has a few functions hand-inlined and a few loops
// hand-unrolled.
module.exports = function RushaCore (stdlib, foreign, heap) {
  'use asm';

  var H = new stdlib.Int32Array(heap);

  function hash (k, x) { // k in bytes

    k = k|0;
    x = x|0;
    var i = 0, j = 0,
        y0 = 0, z0 = 0, y1 = 0, z1 = 0,
        y2 = 0, z2 = 0, y3 = 0, z3 = 0,
        y4 = 0, z4 = 0, t0 = 0, t1 = 0;

    y0 = H[x+320>>2]|0;
    y1 = H[x+324>>2]|0;
    y2 = H[x+328>>2]|0;
    y3 = H[x+332>>2]|0;
    y4 = H[x+336>>2]|0;

    for (i = 0; (i|0) < (k|0); i = i + 64 |0) {

      z0 = y0;
      z1 = y1;
      z2 = y2;
      z3 = y3;
      z4 = y4;

      for (j = 0; (j|0) < 64; j = j + 4 |0) {
        t1 = H[i+j>>2]|0;
        t0 = roundL(y0, F0(y1, y2, y3)) + (roundR(y4, t1) + 1518500249 |0) |0;
        swap(y0, y1, y2, y3, y4, t0)
        H[k+j>>2] = t1;
      }

      for (j = k + 64 |0; (j|0) < (k + 80 |0); j = j + 4 |0) {
        t1 = extended(H, j);
        t0 = roundL(y0, F0(y1, y2, y3)) + (roundR(y4, t1) + 1518500249 |0) |0;
        swap(y0, y1, y2, y3, y4, t0)
        H[j>>2] = t1;
      }

      for (j = k + 80 |0; (j|0) < (k + 160 |0); j = j + 4 |0) {
        t1 = extended(H, j);
        t0 = roundL(y0, F1(y1, y2, y3)) + (roundR(y4, t1) + 1859775393 |0) |0;
        swap(y0, y1, y2, y3, y4, t0)
        H[j>>2] = t1;
      }

      for (j = k + 160 |0; (j|0) < (k + 240 |0); j = j + 4 |0) {
        t1 = extended(H, j);
        t0 = roundL(y0, F2(y1, y2, y3)) + (roundR(y4, t1) - 1894007588 |0) |0;
        swap(y0, y1, y2, y3, y4, t0)
        H[j>>2] = t1;
      }

      for (j = k + 240 |0; (j|0) < (k + 320 |0); j = j + 4 |0) {
        t1 = extended(H, j);
        t0 = roundL(y0, F1(y1, y2, y3)) + (roundR(y4, t1) - 899497514 |0) |0;
        swap(y0, y1, y2, y3, y4, t0)
        H[j>>2] = t1;
      }

      y0 = y0 + z0 |0;
      y1 = y1 + z1 |0;
      y2 = y2 + z2 |0;
      y3 = y3 + z3 |0;
      y4 = y4 + z4 |0;

    }

    H[x+320>>2] = y0;
    H[x+324>>2] = y1;
    H[x+328>>2] = y2;
    H[x+332>>2] = y3;
    H[x+336>>2] = y4;

  }

  return {hash: hash};
};
