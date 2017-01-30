define(function(require, exports, module) {
    
module.exports = function(session, options) {
    // Dependencies for the collaboration features of Cloud9
    
    session.install({
        "name": "SQLite",
        "description": "SQLite Database and NPM module",
        "cwd": "~/.c9",
        "optional": true
    }, [
        {
            "npm": ["sqlite3@3.0.5"]
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
        "name": "Sequalize",
        "description": "Sequalize NPM module",
        "cwd": "~/.c9",
        "optional": true
    }, {
        "npm": ["sequelize@2.0.0-beta.0"]
    });
    
    session.install({
        "name": "Collab Server",
        "description": "A small Node.js collaboration server",
        "cwd": "~/.c9",
        "optional": true
    }, {
        "tar.gz": { 
            "url": "https://raw.githubusercontent.com/c9/install/master/packages/extend/c9-vfs-extend.tar.gz",
            "target": "~/.c9"
        }
    });

    // Show the installation screen
    session.start();
};

module.exports.version = 1;

});