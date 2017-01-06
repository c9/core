define(function(require, exports, module) {
    
module.exports = function(session, options) {
    // Dependencies for the collaboration features of Cloud9
    
    var win32 = options.platform == "win32";
    win32 || session.install({
        "name": "SQLite",
        "description": "SQLite Database and NPM module",
        "cwd": "~/.c9",
        "optional": true
    }, [
        {
            "npm": ["sqlite3@3.1.4"]
        },
        {
            "tar.gz": {
                "url": "https://raw.githubusercontent.com/c9/install/master/packages/sqlite3/linux/sqlite3.tar.gz",
                "target": "~/.c9/lib/sqlite3",
                "dir": "sqlite3"
            }
        },
        {
            "symlink": {
                "source": "~/.c9/lib/sqlite3/sqlite3",
                "target": "~/.c9/bin/sqlite3"
            }
        }
    ]);
    
    session.install({
        "name": "Sequelize",
        "description": "Sequelize NPM module",
        "cwd": "~/.c9",
        "optional": true
    }, {
        "npm": ["sequelize@2.0.0-beta.0"]
    });
    
    // Show the installation screen
    session.start();
};

module.exports.version = 1;

});