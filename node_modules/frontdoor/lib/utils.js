exports.flatten = function(arr, ret){
    if (!Array.isArray(arr))
        return [arr];
    
    ret = ret || [];
    for (var i = 0; i < arr.length; ++i) {
        if (Array.isArray(arr[i])) {
          exports.flatten(arr[i], ret);
        } else {
          ret.push(arr[i]);
        }
    }
    return ret;
};