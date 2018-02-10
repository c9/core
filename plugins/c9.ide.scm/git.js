define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "scm", "proc", "c9", "fs"
    ];
    main.provides = ["scm.git"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var scm = imports.scm;
        var proc = imports.proc;
        var fs = imports.fs;
        var c9 = imports.c9;
        
        var basename = require("path").basename;
        var dirname = require("path").dirname;
        var join = require("path").join;
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var workspaceDir = c9.workspaceDir;
        
        /***** Methods *****/
        
        /**
         * Detect whether the path has a git repository 
         */
        function detect(path, callback) {
            fs.exists(join(path, ".git"), function(exists) {
                return callback(null, exists);
            });
        }
        
        var ACTIONS = {
            "add": ["status.dirty"],
            "reset": ["status.dirty"],
            "pull": ["status.dirty", "log.dirty"],
            "checkout": ["status.dirty"],
            "stash": ["status.dirty"],
            "apply": ["status.dirty"],
            "commit": ["status.dirty", "log.dirty"]
        };
        
        function git(args, cb) {
            if (typeof args == "string")
                args = args.split(/\s+/);
                
            proc.spawn("git", {
                args: args,
                cwd: workspaceDir
            }, function(e, p) {
                // if (e) console.error(e);
                
                buffer(p, function(stdout, stderr) {
                    // console.log(e, stdout);
                    
                    var action = ACTIONS[args[0]];
                    if (action) action.forEach(emit);
                    
                    cb && cb(e, stdout, stderr);
                });
            });
        }
        
        function buffer(process, callback) {
            var stdout = "", stderr = "";
            process.stdout.on("data", function(c) {
                stdout += c;
            });
            process.stderr.on("data", function(c) {
                stderr += c;
            });
            process.on("exit", function(c) {
                callback(stdout, stderr);
            });
        }
        
        function addAll(callback) {
            git("add -u", callback);
        }
        
        function addFileToStaging(paths, callback) {
            git(["add", "-f", "--ignore-errors", "--"].concat(paths), callback);
        }
        
        function unstageAll(callback) {
            git("reset --mixed", callback);
        }
        
        function unstage(paths, callback) {
            git(["reset", "--mixed", "--"].concat(paths), callback);
        }
        
        function fetch(options, callback) {
            if (typeof options == "function")
                callback = options, options = {};
            
            var args = ["fetch", "-q"];
            if (options.prune) args.push("--prune");
            if (options.branch) args.push(options.branch);
            
            git(args, function(err, stdout, stderr) {
                if (stderr) {
                    var error = errors.detect(stderr);
                    if (error)
                        return callback(error);
                }
                
                if (err) return callback(err); // || stderr
                return callback();
            });
        }
        
        function pull(options, callback) {
            if (typeof options == "function")
                callback = options, options = {};
            
            var args = ["pull", "-q"];
            if (options.prune) args.push("--prune");
            if (options.branch) args.push(options.branch);
            
            git(args, function(err, stdout, stderr) {
                if (stderr) {
                    var error = errors.detect(stderr);
                    if (error)
                        return callback(error);
                }
                
                if (err) return callback(err); // || stderr
                return callback();
            });
        }
        
        function push(options, callback) {
            if (typeof options == "function")
                callback = options, options = {};
            
            var args = ["push", "-q"];
            if (options.force) args.push("--force");
            if (options.branch) args.push(options.branch);
            
            git(args, function(err, stdout, stderr) {
                if (stderr) {
                    var error = errors.detect(stderr);
                    if (error)
                        return callback(error);
                }
                
                if (err) return callback(err); // || stderr
                return callback();
            });
        }
        
        function getRemotes(callback) {
            git(["remote", "-v"], function(err, stdout, stderr) {
                if (err || stderr) return callback(err || stderr);
                
                var remotes = {};
                stdout.split("\n").forEach(function(line) {
                    var parts = line.split(/\s+/);
                    if (remotes[parts[0]] || !parts[0]) return;
                    remotes[parts[0]] = parts[1];
                });
                
                callback(null, remotes);
            });
        }
        
        function addRemote(name, url, callback) {
            git(["remote", "add", name, url], function(err, stdout, stderr) {
                if (err || stderr) return callback(err || stderr);
                return callback();
            });
        }
        
        function removeRemote(name, callback) {
            git(["remote", "remove", name], function(err, stdout, stderr) {
                if (err || stderr) return callback(err || stderr);
                return callback();
            });
        }
        
        function addBranch(name, basedOn, callback) {
            git(["update-ref", name, basedOn], function(err, stdout, stderr) {
                if (err || stderr) return callback(err || stderr);
                return callback();
            });
        }
        
        function removeBranch(name, callback) {
            // detect remote: git push origin :master
            var m;
            if (name.indexOf("refs/heads") === 0 || name.indexOf("refs/tags") === 0) {
                git(["update-ref", name, "-d"], function(err, stdout, stderr) {
                    if (err || stderr) return callback(err || stderr);
                    return callback();
                });
            }
            else if ((m = name.match(/refs\/remotes\/([^\/]+)\/(.*)/))) {
                git(["push", m[1], ":" + m[2], "-q"], function(err, stdout, stderr) {
                    // It was already deleted, so intent is success
                    if (stderr.indexOf("remote ref does not exist") > -1) {
                        git(["update-ref", name, "-d"], function(err, stdout, stderr) {
                            if (err || stderr) return callback(err || stderr);
                            return callback();
                        });
                        return;
                    }
                    
                    callback(err || stderr);
                });
            }
            else callback(new Error("Not Supported"));
        }
        
        function renameBranch(fromName, toName, callback) {
            if (fromName.indexOf("refs/heads") !== 0)
                return callback(new Error("Unable to rename remote branches"));
            
            addBranch(toName, fromName, function(err) {
                if (err) return callback(err);
                
                removeBranch(fromName, function(err) {
                    callback(err);
                });
            });
        }
        
        function getCurrentBranch(callback) {
            git(["branch"], function(err, stdout, stderr) {
                if (err || stderr) return callback(err || stderr);
                
                var current = (stdout.match(/^\* ([^\s]+)/m) || 0)[1];
                return callback(null, current || null);
            });
        }
        
        var errors = {
            detect: function(output) {
                for (var prop in errors) {
                    var err;
                    if (prop.substr(0, 2) == "is") {
                        err = errors[prop](output);
                        if (err) return err;
                    }
                }
                
                return false;
            }
        };
        [{ 
            name: "LocalChanges", 
            code: 100,
            detect: /Your local changes to the following files would be overwritten/
        }, {
            name: "UnknownBranch", 
            code: 101,
            detect: /did not match any file\(s\) known to git/
        }, {
            name: "NoPushDestination", 
            code: 102,
            detect: /fatal: No configured push destination/
        }, {
            name: "NoRemoteRepo", 
            code: 103,
            detect: /fatal: No remote repository specified/
        }, {
            name: "NotARepo", 
            code: 104,
            detect: /fatal: Not a git repository/
        }].forEach(function(def) {
            errors[def.name] = function(msg) { this.message = msg; };
            errors[def.name].prototype = new Error();
            errors[def.name].prototype.code = def.code;
            
            def.error = errors[def.name];
            errors["is" + def.name] = function(output) {
                if (def.detect.test(output))
                    return new errors[def.name](output);
            };
            
            errors[def.name.toUpperCase()] = def.code;
        });
        
        function checkout(name, callback) {
            name = name.replace(/^refs\/(?:remotes\/[^\/]+|heads)\//, "");
            git(["checkout", "-q", name], function(err, stdout, stderr) {
                if (stderr) {
                    var error = errors.detect(stderr);
                    if (error)
                        return callback(error);
                }
                
                if (err || stderr) return callback(err || stderr);
                return callback();
            });
        }
        
        function revert(path, callback) {
            git(["checkout", path], function(err, stdout, stderr) {
                if (err || stderr) return callback(err || stderr);
                return callback();
            });
        }
        
        function stash(callback) {
            git(["stash"], function(err, stdout, stderr) {
                if (err || stderr) return callback(err || stderr);
                return callback();
            });
        }
        
        function stashApply(callback) {
            git(["stash", "apply"], function(err, stdout, stderr) {
                if (err || stderr) return callback(err || stderr);
                return callback();
            });
        }
        
        function stashPop(callback) {
            git(["stash", "pop"], function(err, stdout, stderr) {
                if (err || stderr) return callback(err || stderr);
                return callback();
            });
        }
        
        function resetHard(callback) {
            git(["reset", "--hard"], function(err, stdout, stderr) {
                if (err || stderr) return callback(err || stderr);
                return callback();
            });
        }
        
        function removeAllLocalMerged(callback) {
            var script = 
                'git checkout master || { echo "Failed to switch to master. Aborting"; exit 1; }\n'
                + 'git branch --merged | grep -v "\*" | xargs -n 1 git branch -d';
            
            proc.spawn("bash", {
                args: ["-l", "-c", script],
                cwd: workspaceDir
            }, function(e, p) {
                if (e) return callback(e);
                
                buffer(p, function(stdout, stderr) {
                    if (stderr) return callback(stderr);
                    callback();
                });
            });
        }
        
        function getStatus(options, cb) {
            var args = [];
            var hash = options.hash;
            var base = options.base;
            if ((hash || base) && !options.twoWay) {
                args.push("diff", "--name-status", "-b", "-z", 
                    "--no-textconv", "--no-ext-diff", "--no-color",
                    "--find-renames"
                );
                if (hash == "staging")
                    hash = "--cached";
                if (base == "staging")
                    base = "--cached";
                if (hash === 0 || base === 0) {
                    args.push(base || hash);
                } else {
                    args.push(base || hash + "^1", hash);
                }
            } else {
                options.twoWay = true;
                args.push("status", "--porcelain", "-b", "-z");
                // if (!ignored.isOpen)
                    args.push("--untracked-files=no");
                if (options.untracked == "all")
                    args.push("--untracked-files=all");
                if (options.ignored)
                    args.push("--ignored");
            }
            
            args.push("--");
            
            if (options.path)
                args.push(options.path);
            
            proc.execFile("git", {
                args: args,
                cwd: workspaceDir
            }, function(err, stdout, stderr) {
                if (err) {
                    if (/fatal: bad revision/.test(err.message)) {
                        var EMPTY = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
                        if (options.base != EMPTY) {
                            options.base = EMPTY;
                            return getStatus(options, cb);
                        }
                    }
                    return cb(err);
                }
                // console.log(err, stdout);
                // console.log(t-Date.now(), stdout.length);
                var status = parseStatus(stdout, options.twoWay);
                
                if (options.twoWay)
                    emit("status", { status: status });
                    
                cb(err, status);
            });
        }
        
        function parseStatus(stdout, twoWay) {
            var status = (stdout || "").split("\x00");
            var results = {};
            console.log(status);
            
            var i, x, name;
            if (twoWay) {
                status.shift();
                
                if (status.length == 1 && status[0] == "")
                    return null;
                
                var changed = [];
                var staged = [];
                var ignored = [];
                var conflicts = [];
                var untracked = [];
                
                for (i = 0; i < status.length; i++) {
                    x = status[i];
                    name = x.substr(3);
                    if (!name) continue;
                    
                    if (x[0] == "U" || x[1] == "U") {
                        conflicts.push({
                            label: name,
                            path: name,
                            type: x[0] + x[1]
                        });
                        continue;
                    }
                    if (x[0] == "R") {
                        i++;
                        staged.push({
                            label: name,
                            path: name,
                            originalPath: status[i],
                            type: x[0]
                        });
                    }
                    else if (x[0] != " " && x[0] != "?") {
                        staged.push({
                            label: name,
                            path: name,
                            type: x[0]
                        });
                    }
                    if (x[1] == "?") {
                        untracked.push({
                            label: name,
                            path: name,
                            type: x[1],
                            isFolder: name.slice(-1) == "/"
                        });
                    }
                    else if (x[1] == "!") {
                        ignored.push({
                            label: name,
                            path: name,
                            type: x[1],
                            isFolder: name.slice(-1) == "/"
                        });
                    }
                    else if (x[1] != " ") {
                        changed.push({
                            label: name,
                            path: name,
                            type: x[1]
                        });
                    }
                }
                
                if (changed.length) results["changed"] = changed;
                if (staged.length) results["staged"] = staged;
                if (ignored.length) results["ignored"] = ignored;
                if (conflicts.length) results["conflicts"] = conflicts;
                if (untracked.length) results["untracked"] = untracked;
            }
            else {
                results.history = [];
                
                for (i = 0; i < status.length; i += 2) {
                    x = status[i];
                    name = status[i + 1];
                    if (!name) continue;
                    
                    if (x[0] == "R") {
                        i++;
                        results.history.push({
                            label: status[i + 1] + "(from " + name + ")",
                            path: name,
                            originalPath: status[i + 1],
                            type: x[0]
                        });
                    } else {
                        results.history.push({
                            label: name,
                            path: name,
                            type: x[0]
                        });
                    }
                }
            }
            
            return results;
        }
        
        function getLog(options, cb) {
            var t = Date.now();
            
            git(["rev-list", "HEAD", "--count"], function(err, stdout, stderr) {
                if (err) return cb(err);
                
                console.log(err, stdout);
                console.log(t - Date.now(), stdout.length);
                
                var args = ["log", "--topo-order", "--date=raw"];
                if (options.boundary !== false) args.push("--boundary");
                if (options.logOptions) args.push.apply(args, options.logOptions);
                // not using %D since it is missing on git 1.9
                args.push('--pretty=format:' + (options.format || "%h %p %d %B %an %ct %ae ").replace(/ /g, "%x00"));
                args.push("--all");
                args.push("HEAD");
                args.push("-n", options.count || 1000);
                if (options.from)
                    args.push("--skip=" + options.from);
                    
                args.push("--");
                if (options.path)
                    args.push(options.path);
                
                git(args, function(err, stdout, stderr) {
                    if (err) return cb(err);
                    
                    var data = stdout.trim().split("\x00\n");
                    // handle empty git history
                    if (data.length == 1 && !data[0]) {
                        data = [];
                    }
                    var root = [];
                    var head;
                    for (var i = 0; i < data.length; i++) {
                        var line = data[i].split("\x00");
                        var branches = line[2];
                        if (branches) {
                            // remove braces
                            branches = branches
                                .replace(/^\s*\(\s*/g, "")
                                .replace(/\s*\)\s*$/g, "");
                            if (/(^|, )HEAD[, ]/.test(branches))
                                head = line[0];
                        }
                        root.push({
                            hash: line[0],
                            parents: line[1],
                            message: line[3],
                            label: line[3].substring(0, line[3].indexOf("\n") + 1 || undefined),
                            branches: branches || undefined, // set to undefined to not keep in JSON.stringify
                            authorname: line[4],
                            date: line[5],
                            authoremail: line[6],
                        });
                    }
                    // console.log(err, x);
                    console.log(t - Date.now(), stdout.length);
                    root.unshift({
                        label: "// WIP",
                        hash: 0,
                        parents: head
                    });
                    
                    emit("log", root);
                    cb(null, root);
                });
                
            });
        }
        
        function getLastLogMessage(callback) {
            git(["log", "-n", "1", "--pretty=format:%s"], function(err, stdout, stderr) {
                if (err || stderr) return callback(err || stderr);
                return callback(null, stdout);
            });
        }
        
        function getFileAtHash(hash, path, cb) {
            var id = hash;
            if (path) {
                if (!hash) {
                    if (path[0] != "/")
                        path = "/" + path;
                    return proc.readfile(path, {}, cb);
                }
                if (hash == "staging")
                    hash = "";
                if (path[0] == "/")
                    path = path.substr(1);
                id = hash + ":" + path;
            }
            proc.execFile("git", {
                args: ["show", id],
                maxBuffer: 1000 * 1024,
                cwd: workspaceDir
            }, function(err, stdout, stderr) {
                cb(err, stdout, stderr);
            });
        }
        
        function loadDiff(options, callback) {
            var req = {};
            var args = ["diff"];
            
            if (options.context !== false)
                args.push("-U" + (options.context || 20000));
            
            var oldPath = options.oldPath || "";
            var newPath = options.newPath || "";
            
            if (oldPath.indexOf("refs") === 0 && !~oldPath.indexOf(":")) 
                oldPath += ":";
            if (newPath.indexOf("refs") === 0 && ~newPath.indexOf(":")) 
                newPath += ":";
            
            if (oldPath)
                args.push(oldPath);
            if (newPath)
                args.push(newPath);
            
            git(args, function(err, stdout, stderr) {
                if (err || !stdout) {
                    return getFileAtHash(options.oldPath, "", function(err, orig) {
                        getFileAtHash(options.newPath, "", function(err, edit) {
                            callback(err, {
                                request: req,
                                orig: orig || "",
                                edit: edit || ""
                            });
                        });
                    });
                }
                callback(null, {
                    request: req,
                    patch: stdout
                });
            });
            return req;
        }
        
        function addLinesToStaging(patch, cb) {
            proc.spawn("git", {
                args: ["apply", "--cached", "--unidiff-zero", "--whitespace=nowarn", "-"], // "--recount",
                cwd: workspaceDir
            }, function(err, p) {
                if (err) return cb(err);
                
                var process = p.process;
                var stderr = "";
                var stdout = "";
                process.stdout.on("data", function(e) {
                    stdout += e;
                });
                process.stderr.on("data", function(e) {
                    stderr += e;
                });
                process.on("exit", function(e) {
                    cb(e, stdout, stderr);
                });
                process.stdin.write(patch);
                process.stdin.end();
            });
        }
        
        // TODO reload
        function updateCommitStatus(ammend, callback) {
            var args = ["commit", "--dry-run", "--porcelain", "--branch", "-z"];
            if (ammend)
                args.push("--amend");
                
            git(args, callback);
        }
        
        function commit(options, callback) {
            if (!options.message) return;
            var args = ["commit", options.amend && "--amend", "-m", options.message].filter(Boolean);
            
            git(args, callback);
        }
        
        function listAllRefs(cb, name) {
            var args = ["for-each-ref", "--count=3000", "--sort=*objecttype", "--sort=-committerdate"];
            if (name) args.push(name);
            args.push(
                '--format=%(objectname:short) %(refname) %(upstream:trackshort) %(objecttype) %(subject) %(authorname) %(authoremail) %(committerdate:raw)'.replace(/ /g, "%00")
            );
            git(args, function(err, stdout) {
                if (err) return cb(err);
                
                var data = stdout.trim().split("\n").map(function(x) {
                    var parts = x.split("\x00");
                    return {
                        hash: parts[0],
                        name: parts[1],
                        upstream: parts[2],
                        type: parts[3],
                        subject: parts[4],
                        authorname: parts[5],
                        authoremail: parts[6],
                        committerdate: parts[7],
                    };
                });
                cb && cb(null, data);
            });
        }
        
        function listRef(name, cb) {
            listAllRefs(function(err, data) {
                if (err) return cb(err);
                cb(null, data[0]);
            }, name);
        }
        
        function getBlame(path, callback) {
            proc.spawn("git", {
                args: ["blame", "-wp", "--", basename(path)],
                cwd: c9.workspaceDir + "/" + dirname(path)
            }, function(err, process) {
                if (err) return callback(err);
                buffer(process, function(stdout, stderr) {
                    callback(stderr, stdout);
                });
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            if (scm.register)
                scm.register("git", plugin);
        });
        plugin.on("unload", function() {
            if (scm.register)
                scm.unregister("git", plugin);
        });
        
        /***** Register and define API *****/
        
        /**
         */
        plugin.freezePublicAPI({
            /**
             * 
             */
            get errors() { return errors; },
            
            /**
             * 
             */
            detect: detect,
            
            /**
             * 
             */
            addAll: addAll,
            
            /**
             * 
             */
            addFileToStaging: addFileToStaging,
            
            /**
             * 
             */
            unstageAll: unstageAll,
            
            /**
             * 
             */
            unstage: unstage,
            
            /**
             * 
             */
            fetch: fetch,
            
            /**
             * 
             */
            pull: pull,
            
            /**
             * 
             */
            git: git,
            
            /**
             * 
             */
            push: push,
            
            /**
             * 
             */
            buffer: buffer,
            
            /**
             * 
             */
            getRemotes: getRemotes,
            
            /**
             * 
             */
            addRemote: addRemote,
            
            /**
             * 
             */
            addBranch: addBranch,
            
            /**
             * 
             */
            removeBranch: removeBranch,
            
            /**
             * 
             */
            renameBranch: renameBranch,
            
            /**
             * 
             */
            getCurrentBranch: getCurrentBranch,
            
            /**
             * 
             */
            checkout: checkout,
            
            /**
             * 
             */
            removeRemote: removeRemote,
            
            /**
             * 
             */
            getStatus: getStatus,
            
            /**
             * 
             */
            getLog: getLog,
            
            /**
             * 
             */
            getFileAtHash: getFileAtHash,
            
            /**
             * 
             */
            loadDiff: loadDiff,
            
            /**
             * 
             */
            addLinesToStaging: addLinesToStaging,
            
            /**
             * 
             */
            updateCommitStatus: updateCommitStatus,
            
            /**
             * 
             */
            commit: commit,
            
            /**
             * 
             */
            listAllRefs: listAllRefs,
            
            /**
             * 
             */
            listRef: listRef,
            
            /**
             * 
             */
            getBlame: getBlame,
            
            /**
             * 
             */
            removeAllLocalMerged: removeAllLocalMerged,
            
            /**
             * 
             */
            stash: stash,
             
            /**
             * 
             */
            stashApply: stashApply,
             
            /**
             * 
             */
            stashPop: stashPop,
             
            /**
             * 
             */
            getLastLogMessage: getLastLogMessage,
             
            /**
             * 
             */
            resetHard: resetHard,
             
            /**
             * 
             */
            revert: revert
        });
        
        register(null, {
            "scm.git": plugin
        });
    }
});