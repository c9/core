
const ASSERT = require("assert");
const DEMO_SERVER = require("../demo/server");
const REQUEST = require("request");


function main(callback) {

	var port = parseInt(process.env.PORT || 8080, 10);

	console.log("Port: " + port);

	DEMO_SERVER.main("default", function(err, app) {
		if (err) return callback(err);

		REQUEST("http://localhost:" + port, function (error, response, body) {
			if (error || response.statusCode !== 200) {
				ASSERT.fail("Did not get status 200!");
				return;
			}

			ASSERT.equal(body, "HelloWorld");

			callback(null);
		});
	});
}


if (require.main === module) {
	main(function(err) {
		if (err) {
			console.error(err.stack);
			process.exit(1);
		}
		console.log("OK");
		process.exit(0);
	});
}
