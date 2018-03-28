/**
 * Return a function that ensures callback is 
 * not called more often ten once per tpms (times per ms)
 */
function throttle(tpms) {
    var last = Date.now();
    
    return function(callback) {
        var now = Date.now();
        var delay = Math.max(0, last - now);
        
        last = now + delay + tpms;

        setTimeout(callback, delay);
    };
}

module.exports = throttle;