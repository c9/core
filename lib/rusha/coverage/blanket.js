var path = require('path');
var srcDir = path.join(__dirname, '..', 'rusha.js');

require('blanket')({
  pattern: srcDir
});