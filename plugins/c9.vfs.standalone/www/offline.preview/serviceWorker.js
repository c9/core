/*global clients, BroadcastChannel*/

var root = new URL(this.registration.scope);
var bc = new BroadcastChannel("livePreview"); 
var id = 0;
var callbacks = {};
var callBc = function(data, callback) {
    data.id = id++;
    callbacks[data.id] = callback;
    bc.postMessage(data);
};
bc.onmessage = function(e) {
    var data = e.data;
    if (data.action == "callback") {
        var callback = callbacks[data.id];
        if (!callback) return;
        delete callbacks[data.id];
        callback(data.error, data.value);
    }
};
this.onfetch = function(event) {
    var url = new URL(event.request.url);
    if (url.origin == root.origin) {
        var path = url.searchParams.get("u");
        if (!path) path = url.pathname;
        if (path.startsWith(root.pathname))
            path = path.substr(root.pathname.length - 1);
        if (path) {
            event.respondWith(
                new Promise(function(resolve, reject) {
                    callBc({ action: "getFile", path: path }, function(e, v) {
                        if (e) reject(e);
                        resolve(v);
                    });
                }).then(function(v) {
                    return new Response(v, {
                        headers: {
                            "Content-Type": getMime(path)
                        }
                    });
                }, function(err) {
                    return new Response("error fetching " + path + " " + err, {
                        status: 400,
                        statusText: "Failure",
                        headers: {
                            "Content-Type": "text/x-error"
                        }
                    });
                })
            );
        }
    }
};


function getMime(path) {
    if (path.endsWith(".html")) return "text/html";
    if (path.endsWith(".js")) return "text/javascript";
    if (path.endsWith(".css")) return "text/css";
    if (path.endsWith(".svg")) return "image/svg+xml";
}