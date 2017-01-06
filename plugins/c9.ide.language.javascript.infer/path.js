define(function(require, exports, module) {

function getBasePath(file, workspaceDir) {
    if (file.substr(0, workspaceDir.length) === workspaceDir)
        file = file.substr(workspaceDir.length + 1);
    return file.replace(/\/?[^\/]*$/, "");
}

function canonicalizePath(path, basePath) {
    if (basePath && isRelativePath(path))
        path = basePath + "/" + path;
    return normalizePath(path).replace(/^\.\//, "");
}

function isRelativePath(path) {
    return !!path.match(/^\.\.\/|^\.\//);
}

function isAbsolutePath(path) {
    return !!path.match(/^\//);
}

function uncanonicalizePath(path, basePath) {
    if (basePath === "")
        return "./" + path;
    var pathParts = path.split("/");
    var basePathParts = basePath.split("/");
    for (var common = 0; common < basePathParts.length; common++)
        if (basePathParts[common] !== pathParts[common])
            break;
    var dirsUp = pathParts.length - 1 - common;
    var resultParts = [];
    for (var i = 0; i < dirsUp; i++)
        resultParts.push("..");
    if (!dirsUp)
        resultParts.push(".");
    for (var j = common; j < pathParts.length; j++)
        resultParts.push(pathParts[j]);
    return resultParts.join("/");
}

function normalizePath(path) {
    var isAbsolute = path.charAt(0) === '/',
        trailingSlash = path.substr(-1) === '/';

    path = normalizePathArray(path.split('/').filter(function(p) {
        return !!p;
    }), !isAbsolute).join('/');

    if (!path && !isAbsolute) {
        path = '.';
    }
    if (path && trailingSlash) {
        path += '/';
    }

    return (isAbsolute ? '/' : '') + path;
}

function normalizePathArray(parts, allowAboveRoot) {
    // if the path tries to go above the root, `up` ends up > 0
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
        var last = parts[i];
        if (last === '.') {
            parts.splice(i, 1);
        }
        else if (last === '..') {
            parts.splice(i, 1);
            up++;
        }
        else if (up) {
            parts.splice(i, 1);
            up--;
        }
    }

    // if the path is allowed to go above the root, restore leading ..s
    if (allowAboveRoot) {
        for (; up--; up) {
            parts.unshift('..');
        }
    }

    return parts;
}

exports.canonicalizePath = canonicalizePath;
exports.uncanonicalizePath = uncanonicalizePath;
exports.getBasePath = getBasePath;
exports.isRelativePath = isRelativePath;
exports.isAbsolutePath = isAbsolutePath;
exports.normalizePath = normalizePath;

});
