define(function(require, module, exports) {
"use strict";
    
var SUPPORT_FOLDER_UPLOAD = (function() {
    var input = document.createElement("input");
    return "webkitdirectory" in input || "directory" in input;
})();

function Batch(files, entries) {
    this.files = files;
    this.entries = entries;
}

Batch.prototype.hasDirectories = function() {
    return this.files.some(function(file) {
        return !!file.isDirectory; 
    });
};

/**
 * remove all files within the given root folder of with the given root file name
 */
Batch.prototype.removeRoot = function(root) {
    this.files = this.files.filter(function(file) {
        return file.fullPath.split("/")[1] !== root;
    });
};

Batch.prototype.subTree = function(root) {
    return this.files.filter(function(file) {
        return file.fullPath.split("/")[1] === root;
    });
};

Batch.prototype.ignoreFiles = function(ignoredFilesMap) {
    this.files = this.files.filter(function(file) {
        return !ignoredFilesMap[file.name];
    });
};

Batch.prototype.getSizes = function() {
    var max = 0;
    var sum = this.files.reduce(function(sum, file) {
        if (file.size > max)
            max = file.size;
        return sum + file.size;
    }, 0);
    
    return {
        max: max,
        sum: sum,
        count: this.files.length
    };
};

Batch.prototype.getRoots = function() {
    return Object.keys(this.files.reduce(function(roots, file) {
        var root = file.fullPath.split("/")[1];
        if (root)
            roots[root] = 1;
        return roots;
    }, {}));
};

Batch.prototype._detectDirectories = function(callback) {
    forEach(this.files, function(file, next) {
        if (typeof file.size !== "number") {
            file.isDirectory = true;
            return next();
        }
        if (file.size > 17000) {
            file.isFile = true;
            return next();
        }
        try {
            var reader = new FileReader();
            reader.readAsArrayBuffer(file);
            reader.onloadend = function(e) {
                var error = reader.error;
                var hadError = error && (
                    error.name == "SecurityError" || // Firefox
                    error.name == "NotReadableError" || // Firefox
                    error.code == 4 || // Safari 
                    error.code == 1); // Chrome 
                    
                console.log(e, hadError, reader.error, file.size);
                
                if (hadError)
                    file.isDirectory = true;
                else
                    file.isFile = true;
                
                next();
            };
        } catch (e) {
            file.isDirectory = true;
            return next();
        }
    }, callback);
};

Batch.fromInput = function(inputEl, callback) {
    if (!inputEl.files)
        return new Batch([]);
        
    var files = [].slice.call(inputEl.files, 0);
    files.forEach(function(file) {
        var relativePath = file.relativePath || file.webkitRelativePath;
        file.fullPath = "/" + (relativePath ? relativePath : file.name);
    });
    
    var fromFolderUpload = 
        SUPPORT_FOLDER_UPLOAD && 
        inputEl.getAttribute && 
        (typeof inputEl.getAttribute("directory") === "string" || typeof inputEl.getAttribute("webkitdirectory") === "string");
    
    // folder uploads handle directories differently
    if (fromFolderUpload) {
        files = files.filter(function(file) {
            file.isFile = true;
            return file.name !== ".";
        });                
        return callback(null, new Batch(files));
    }
        
    var batch = new Batch(files);
    batch._detectDirectories(function(err) {
        callback(err, batch);
    });
};

Batch.fromFileApi = function(entries, callback) {
    var files = [];
    var skipped = {};
    
    forEach(entries, function(entry, next) {
        walkFiles(entry, function(entry, next) {
            // ignore directories
            if (entry.isDirectory)
                return next();

            entry.file(function(file) {
                file.fullPath = entry.fullPath;
                file.isFile = true;
                files.push(file);
                next();
            }, function(err) {
                skipped[entry.fullPath] = err;
                next();
            });
        }, function(err) {
            next();
        });
    }, function(err) {
        if (err) return callback(err);
        callback(null, new Batch(files, entries), skipped);
    });
};

Batch.fromDrop = function(dropEvent, callback) {
    var dataTransfer = dropEvent.dataTransfer;
    if (!dataTransfer)
        return callback(null, new Batch([]));
    
    if (dataTransfer.getFilesAndDirectories)
       return Batch.fromMozFileApi(dataTransfer, callback);
    
    if (!dataTransfer.items)
        return Batch.fromInput(dataTransfer, callback);
        
    if (!dataTransfer.items || dataTransfer.items.length === 0)
        return callback(null, new Batch([]));
    
    var first = dataTransfer.items[0];
    var getAsEntry = first.getAsEntry || first.webkitGetAsEntry;
        
    var entries = [].map.call(dataTransfer.items, function(item) {
        return getAsEntry.call(item);
    });
    
    Batch.fromFileApi(entries, callback);
};

Batch.fromMozFileApi = function(dataTransfer, callback) {
    var files = [];
    var pending = 0;
    // requires dom.input.dirpicker true in about:config
    var walkdDirs = function(entries, parentPath) {
        entries.forEach(function(entry) {
            var name = entry.name;
            if (parentPath == "/" && (name[0] == "\\" || name[0] == "//"))
                name = name.slice(1);
            var path = parentPath ? parentPath + name : "";
            if (typeof entry.getFilesAndDirectories === 'function') {
                pending++;
                entry.getFilesAndDirectories().then(function(entries) {
                    walkdDirs(entries, path + "/");
                    pending--;
                    done();
                });
            } else {
                entry.fullPath = path;
                entry.isFile = true;
                files.push(entry);
            }
        });
        done();
    };
    function done() {
        if (!pending)
            callback(null, new Batch(files));
    }
    walkdDirs([dataTransfer]);
};

function walkFiles(entry, onEntry, callback) {
    if (!entry) {
        return callback();
    }
    if (entry.isFile) {
        onEntry(entry, callback);
    } 
    else if (entry.isDirectory) {
        onEntry(entry, function(err) {
            if (err) return callback(err);
            
            var reader = entry.createReader();
            function handleEntries(entries) {
                if (!entries.length)
                    return callback();
                forEach(entries, function(entry, next) {
                    walkFiles(entry, onEntry, next);
                }, readMore);
            }
            function readMore() {
                // Keep calling readEntries() until no more results are returned.
                reader.readEntries(handleEntries, callback);
            }
            readMore();
        });
    }
}

function forEach(list, onEntry, callback) {
    (function loop(i) {
        if (i >= list.length)
            return callback();
            
        onEntry(list[i], function(err) {
            if (err) return callback(err);
            
            loop(i + 1);
        });
    })(0);
}

return {
    SUPPORT_FOLDER_UPLOAD: SUPPORT_FOLDER_UPLOAD,
    fromFileApi: Batch.fromFileApi,
    fromDrop: Batch.fromDrop,
    fromInput: Batch.fromInput
};

});