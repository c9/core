var mergesort = module.exports = function(array) {
    var len = array.length;

    if (len < 2) {
      return array;
    }
    var pivot = Math.ceil(len/2);
    return merge(mergesort(array.slice(0,pivot)), mergesort(array.slice(pivot)));
};

function merge (left, right) {
    var result = [];

    // lowercasing left[0] & right[0] takes a lot of time...
    while((left.length) && (right.length)) {
      if ( left[0].toLowerCase() > right[0].toLowerCase()) {
        result.push(right.shift());
      }
      else {
        result.push(left.shift());
      }
    }

    result = result.concat(left, right);
    return result;
}