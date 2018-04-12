module.exports = function (vfs, register) {
    register(null, {
		add: function (a, b, callback) {
			callback(null, a + b);
		},
		multiply: function (a, b, callback) {
			callback(null, a * b);
		}
	});
};