/* eslint-env commonjs, browser */

const Rusha = require('./rusha');
const {toHex} = require('./utils');

class Hash {
  constructor() {
    this._rusha = new Rusha();
    this._rusha.resetState();
  }

  update(data) {
    this._rusha.append(data);
    return this;
  }

  digest(encoding) {
    const digest = this._rusha.rawEnd().buffer;
    if (!encoding) {
      return digest;
    }
    if (encoding === 'hex') {
      return toHex(digest);
    }
    throw new Error('unsupported digest encoding');
  }
}

module.exports = () => {
  return new Hash();
};
