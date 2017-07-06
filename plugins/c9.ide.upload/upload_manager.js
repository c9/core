define(function(require, module, exports) {
    "use strict";
    
    main.consumes = ["Plugin", "fs", "vfs"];
    main.provides = ["upload.manager"];
    return main;

    /** 
     * Browser notes:
     * 
     * 1. '/' in file names are replaces by ':'
     * 2. Drag and Drop sets e.files (FileList)
     * 3. Chrome also sets e.items in drag and drop, which supports folders
     * 4. Firefox does not support folder upload in any way
     * 5. Safari also doesn't support folder upload
     * 6. Folders will show up in a FileList but are almost impossible to destinguish from files
     */

    function main(options, imports, register) {
        var fs = imports.fs;
        var vfs = imports.vfs;
        var Plugin = imports.Plugin;
        
        var UploadBatch = require("./batch");
        var UploadJob = require("./upload_job");
        var path = require("path");
        
        /***** Initialization *****/
            
        var STATE_NEW = "new";
        var STATE_UPLOADING = "uploading";
        var STATE_PAUSED = "paused";
        var STATE_RESUME = "resume";
        var STATE_DONE = "done";
        var STATE_ERROR = "error";
        
        /***** Methods *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        var jobs, concurrentUploads, timer;

        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            jobs = [];
            concurrentUploads = options.concurrentUploads || 6;
        }
        
        function isSupported() {
            return (window.FormData);
        }
        
        function upload(targetPath, batch, dialog, callback) {
            forEach(batch.getRoots(), function(root, next) {
                fs.exists(path.join(targetPath, root), function(exists) {
                    if (!exists) 
                        return uploadFiles(root, false, next);
                    
                    getAction(batch, root, function(action) {
                        switch (action) {
                            case "replace":
                                uploadFiles(root, true, next);
                                break;
                            
                            case "no-replace":
                                batch.removeRoot(root);
                                return next();
                                
                            case "stop":
                                return callback();
                                
                            default:
                                throw new TypeError("Invalid replace action: " + action);
                        }
                    });
                });
            }, callback);
            
            var toAll = false;
            var action = "";
            function getAction(batch, root, callback) {
                if (toAll) return callback(action);
                
                dialog(batch, targetPath, root, function(_action, _toAll) {
                    toAll = _toAll;
                    action = _action;
                    
                    callback(action);
                });
            }
            
            function uploadFiles(root, doOverwrite, callback) {
                var files = batch.subTree(root);
                    
                var uploaded = 0;
                files.forEach(function(file) {
                    var job = uploadFile(file, path.join(targetPath, file.fullPath));
                    file.job = job;
                    job.checkOverwrite = doOverwrite && !toAll;
                    job.on("changeState", function(e) {
                        if (e.state == STATE_DONE || e.state == STATE_ERROR) {
                            uploaded++;
                            
                            if (uploaded == files.length)
                                emit("batchDone", { batch: batch });
                        }
                    });
                });
                
                callback();
            }
        }
        
        function _createJob(file, fullPath) {
            var job = new UploadJob(file, fullPath, plugin, options.workerPrefix);
            job.vfs = vfs;
            return job;
        }
        
        function uploadFile(file, fullPath) {
            var job = _createJob(file, fullPath);
            job.on("changeState", _checkAsync);
            
            jobs.push(job);
            emit("addJob", { job: job });
            
            // async to give caller a chance to attach event listeners
            _checkAsync();
            return job;
        }

        function batchFromInput(inputEl, callback) {
            return UploadBatch.fromInput(inputEl, callback);
        }
        
        function batchFromDrop(dropEvent, callback) {
            return UploadBatch.fromDrop(dropEvent, callback);
        }
        
        function batchFromFileApi(entries, callback) {
            return UploadBatch.fromFileApi(entries, callback);
        }
        
        function jobById(id) {
            for (var i = 0; i < jobs.length; i++) {
                var job = jobs[i];
                if (job.id == id) {
                    return job;
                }
            }
        }
        
        function checkSync() {
            var wip = [];
            var done = [];
            var candidates = [];
            for (var i = 0; i < jobs.length; i++) {
                var job = jobs[i];
                switch (job.state) {
                    case STATE_DONE:
                    case STATE_ERROR:
                        done.push(job);
                        jobs.splice(i, 1);
                        i--;
                        break;
                    case STATE_RESUME:
                        candidates.push(job);
                        break;
                    case STATE_NEW:
                        candidates.unshift(job);
                        break;
                    case STATE_UPLOADING:
                        wip.push(job);
                        break;
                    default:
                        break;
                }
            }

            if (done.length) {
                setTimeout(function() {
                    done.forEach(function(job) {
                        emit("removeJob", { job: job });
                    });
                }, 0);
            }

            for (var i = wip.length; i < concurrentUploads; i++) {
                var job = candidates.pop();
                if (!job)
                    break;
                    
                job._startUpload();
            }
            timer = null;
        }

        function _checkAsync() {
            if (!timer)
                timer = setTimeout(checkSync, 100);
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
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {
            
        });
        plugin.on("disable", function() {
            
        });
        plugin.on("unload", function() {
            loaded = false;
        });
        
        /***** Register and define API *****/
        
        /**
         * Object representing the upload of a single file.
         * @class upload.Job
         * @extends Object
         */
        /**
         * Aborts the upload of the file.
         * @method cancel
         */
        /**
         * The full path to the file to be uploaded.
         * @property {String} fullPath
         * @readonly
         */
        /**
         * An instance of the HTML5 File API.
         * @property {File} file
         * @readonly
         */
        /**
         * The upload manager responsible for this job.
         * @property {upload.manager} manager
         * @readonly
         */
        /**
         * Retrieves the state of the upload of the file. 
         * The value will be one of the following values: 
         * 
         * * "new"
         * * "uploading"
         * * "paused"
         * * "resume"
         * * "done"
         * * "error"
         * 
         * @property {String} state
         * @readonly
         */
        /**
         * A value between 0 and 1 specifying the portion of the file that has
         * been uploaded.
         * @property {Number} progress
         * @readonly
         */
        /**
         * Fires when the state of the job changes.
         * @event changeState
         * @param {Object} e
         * @param {String} e.state  The state of the job. See also {@link #state}.
         */
        /**
         * Fires when the progress of the file upload changes.
         * @event progress
         * @param {Object} e
         * @param {Number} e.progress  The progress of the job. See also {@link upload.Job#property-progress}
         */
        /**
         * Object representing the upload of a set of files or folders.
         * @class upload.Batch
         * @extends Object
         */
        /**
         * The upload manager handles all file uploads. It keeps a list of all
         * scheduled jobs and tracks their progress. The upload manager does not 
         * depend on any UI.
         * @singleton
         */
        plugin.freezePublicAPI({
            /**
             * Specifies whether the browser supports folder uploads
             * @property {Boolean} SUPPORT_FOLDER_UPLOAD
             * @readonly
             */
            SUPPORT_FOLDER_UPLOAD: UploadBatch.SUPPORT_FOLDER_UPLOAD,
            
            /**
             * Array of all active upload jobs
             * @property {upload.Job[]} jobs
             * @readonly
             */
            get jobs() { return jobs; },
            
            _events: [
                /** 
                 * Fires when an upload is started. Passes a Job instance
                 * @event addJob
                 * @param {Object} e
                 * @param {upload.Job} e.job
                 */
                "addJob",
                /**
                 * Fires when a job has finished uploading of failed to
                 *   upload. Passes the Job object
                 * @event removeJob 
                 * @param {Object} e
                 * @param {upload.Job} e.job 
                 */
                "removeJob",
                /**
                 * Fires when all files of an upload batch are uploaded
                 *   Passes the batch object.
                 * @event batchDone
                 * @param {Object} e
                 * @param {upload.Batch} e.batch  
                 */
                "batchDone"
            ],
            
            /**
             * Checks whether file upload API is supported
             * 
             * @returns {Boolean} whether the browser supports file uploads
             */
            isSupported: isSupported,
            
            /**
             * Uploads a batch of files to the server.
             * 
             * @param {String} targetPath Path on the server where to store
             *   the files
             * @param {upload.Batch} batch the batch of files to upload
             * @param dialog {function()}
             * @param {Function} callback The callback is called when all
             *   file uploads have been scheduled. It will not wait for the
             *   upload to complete
             */
            upload: upload,
            
            /**
             * Upload a single file
             * 
             * @param {File} file The file object from the file HTML5 API
             * @param {String} fullPath Target path of the file
             * @returns {upload.Job} the upload job to track the upload
             */
            uploadFile: uploadFile,
            
            /**
             * Extract the batch of files to upload from a file upload
             * input element.
             * 
             * @param {HTMLInputElement} inputEl The file upload input 
             *   element.
             * @param {Function} callback Callback returns the Batch object
             * @return {upload.Batch}
             */
            batchFromInput: batchFromInput,
            
            /**
             * Extract the batch of files to upload from a HTML5 native
             * drop event.
             * 
             * @param {DragEvent} dropEvent native DOM drop event
             * @param {Function} callback Callback returns the Batch object
             * @return {upload.Batch}
             */
            batchFromDrop: batchFromDrop,
            
            /**
             * Extract the batch of files to upload from a HTML5 FILE API 
             * directory entry.
             * 
             * @param {Object} entries HTML5 file API entries
             * @param {Function} callback Callback returns the Batch object
             * @return {upload.Batch}
             */
            batchFromFileApi: batchFromFileApi,
            
            /**
             * Find an upload job by its ID
             * 
             * @param {Number} id The job id 
             * @return {upload.Job} the associated job
             */
            jobById: jobById,
        });
        
        
        register(null, {
            "upload.manager": plugin
        });
    }
});