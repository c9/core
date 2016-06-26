function hoi() {
    console.log(arguments);
}

setInterval(function() {
    hoi("daar", "wereld");
}, 2000);

module.exports.hoi = hoi;

exports.hoi2 = hoi;

