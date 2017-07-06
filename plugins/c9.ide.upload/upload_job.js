define(function(require, module, exports) {
"use strict";

var EventEmitter = require("events").EventEmitter;
var path = require("path");

var STATE_NEW = "new";
var STATE_UPLOADING = "uploading";
var STATE_PAUSED = "paused";
var STATE_RESUME = "resume";
var STATE_DONE = "done";
var STATE_ERROR = "error";

function UploadJob(file, fullPath, manager, workerPrefix) {
    this.fullPath = fullPath;
    this.file = file;
    this.manager = manager;
    this.state = STATE_NEW;
    this.progress = 0;
    this.id = UploadJob.ID++;
    this.workerPrefix = workerPrefix;
    
    var emitter = new EventEmitter();
    this.on = emitter.on.bind(emitter);
    this.off = emitter.off.bind(emitter);
    this._emit = emitter.emit.bind(emitter);
}

UploadJob.ID = 1;

UploadJob.prototype.cancel = function() {
    if (this.xhr)
        this.xhr.abort();
        
    this._setState(STATE_ERROR);
};

UploadJob.prototype._setState = function(state) {
    this.state = state;
    this._emit("changeState", { state: state, job: this });
};

UploadJob.prototype._error = function(code, message) {
    this.error = {
        code: code,
        message: message
    };
    this._setState(STATE_ERROR);
};

UploadJob.prototype._progress = function(progress) {
    this.progress = progress;
    this._emit("progress", { progress: progress, job: this });
};

UploadJob.prototype._startUpload = function() {
    var job = this;
    job._setState(STATE_UPLOADING);
    
    if (job.vfs) {
        return job.vfs.rest(job.fullPath, {
            method: "PUT", 
            body: job.file,
            timeout: 0,
            progress: function(loaded, total) {
                job._progress(loaded / total);
            }
        }, function(err, data, res) {
            job._progress(1);
            if (err)
                job._error(err.status, err.message);
            else
                job._setState("done");
        });
    } else {
        var url = path.join(job.manager.filesPrefix, job.fullPath);
    
        var xhr = new XMLHttpRequest();
        xhr.open("PUT", url, true);
        xhr.onload = function(e) { 
            job._progress(1);
            if (xhr.status >= 400)
                job._error(xhr.status, xhr.statusText);
            else
                job._setState("done");
            xhr = null;
        };
        xhr.upload.onprogress = function(e) {
            if (e.lengthComputable) {
                job._progress(e.loaded / e.total);
            }
        };
        xhr.send(job.file);
    }
};

UploadJob.prototype._startUploadWorker = function() {
    var job = this;
    job._setState(STATE_UPLOADING);
                    
    var url = path.join(job.manager.filesPrefix, job.fullPath);
    
    var worker = new Worker(path.join(this.workerPrefix, "upload_worker.js"));
    worker.postMessage({ method: "start", args: [job.file, url]});
    
    this.xhr = {
        abort: worker.postMessage.bind(worker, { method: "abort" })
    };
    
    worker.onmessage = function(msg) {
        var method = msg.data.method;
        var args = msg.data.args || [];
        if (method == "_setState") {
            this.xhr = null;
            worker.terminate();
        }
            
        job[method].apply(job, args);
    };        
};

return UploadJob;

});