/* eslint-env commonjs, worker */

module.exports = () => {
  const Rusha = require('./rusha');

  const hashData = (hasher, data, cb) => {
    try {
      return cb(null, hasher.digest(data));
    } catch (e) {
      return cb(e);
    }
  };

  const hashFile = (hasher, readTotal, blockSize, file, cb) => {
    const reader = new self.FileReader();
    reader.onloadend = function onloadend () {
      if (reader.error) {
        return cb(reader.error);
      }
      const buffer = reader.result;
      readTotal += reader.result.byteLength;
      try {
        hasher.append(buffer);
      }
      catch (e) {
        cb(e);
        return;
      }
      if (readTotal < file.size) {
        hashFile(hasher, readTotal, blockSize, file, cb);
      } else {
        cb(null, hasher.end());
      }
    };
    reader.readAsArrayBuffer(file.slice(readTotal, readTotal + blockSize));
  };

  let workerBehaviourEnabled = true;

  self.onmessage = (event) => {
    if (!workerBehaviourEnabled) {
      return;
    }

    const data = event.data.data, file = event.data.file, id = event.data.id;
    if (typeof id === 'undefined') return;
    if (!file && !data) return;
    const blockSize = event.data.blockSize || (4 * 1024 * 1024);
    const hasher = new Rusha(blockSize);
    hasher.resetState();
    const done = (err, hash) => {
      if (!err) {
        self.postMessage({id: id, hash: hash});
      } else {
        self.postMessage({id: id, error: err.name});
      }
    };
    if (data) hashData(hasher, data, done);
    if (file) hashFile(hasher, 0, blockSize, file, done);
  };

  return () => {
    workerBehaviourEnabled = false;
  };
};
