define(function(require, exports, module) {
    
module.exports = function(session, options) {
    session.install({
        "name": "c9",
        "description": "The Cloud9 command line interface",
        "optional": true
    }, {
        "npm-g": ["c9"]
    });

    // Show the installation screen
    session.start();
};


});