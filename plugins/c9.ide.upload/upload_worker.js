onmessage = function(msg) {
    upload[msg.data.method].apply(upload, msg.data.args || []);
};            

function call(method, varargs) {
    postMessage({
        method: method,
        args: [].slice.call(arguments, 1)
    });    
}

var job = {
    _error: call.bind(null, "_error"),
    _setState: call.bind(null, "_setState"),
    _progress: call.bind(null, "_progress"),
};   

var xhr = new XMLHttpRequest();
var upload = {
    start: function(file, url) {    
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
    
        xhr.send(file);        
    },
    abort: function() {
        xhr && xhr.abort();
    }
};