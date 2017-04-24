define(function(require, module, exports) {
    var Stream = require("./stream").Stream;
    
    return {
        get: function(options, callback) {
            var request = new Stream();
            
            var xhr = new XMLHttpRequest();
            
            var url = (options.protocol || "http://") + options.host 
              + (options.port ? ":" + options.port : "") 
              + (options.path || "");
              
            xhr.open("GET", url, true);
            
            xhr.timeout = options.timeout || 1000;
            xhr.onload = function(e) {
                if (this.status - 200 < 100) {
                    var response = new Stream();
                    callback(response);
                    
                    response.emit("data", this.responseText);
                    response.emit("end");
                }
                else {
                    error();
                }
            };
            xhr.onerror = function () { 
                error();
            }; 
            
            function error() {
                var err = new Error(xhr.responseText);
                err.status = xhr.status;
                request.emit("error", err);
            }
            
            xhr.send(options.body || "");
            
            return request;
        }
    };
});