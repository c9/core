const shajs = require('sha.js');
const forge = require('node-forge');

const Rusha = require('../dist/rusha.min.js');

suite('SHA1 4MB', () => {
  const bytes = new Uint8Array(2 * 1024 * 1024);

  benchmark('rusha', () => {
    Rusha.createHash().update(bytes).digest();
  });

  benchmark('sha.js', () => {
    shajs('sha1').update(bytes).digest();
  });

  benchmark('node-forge', () => {
    const md = forge.md.sha1.create();
    md.update(bytes);
    md.digest();
  });
});
