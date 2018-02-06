// TODO use Buffer instead of this
function readBytes(str, start, bytes) {
    // returns the byte length of an utf8 string
    var consumed = 0;
    for (var i = start; i < str.length; i++) {
        var code = str.charCodeAt(i);
        if (code < 0x7f) consumed++;
        else if (code > 0x7f && code <= 0x7ff) consumed += 2;
        else if (code > 0x7ff && code <= 0xffff) consumed += 3;
        if (code >= 0xD800 && code <= 0xDBFF) i++; // leading surrogate
        if (consumed >= bytes) { i++; break; }
    }
    return { bytes: consumed, length: i - start };
}

var MessageReader = function(socket, callback) {
    this.$socket = socket;
    this.$callback = callback;

    this.$received = "";
    this.$expectedBytes = 0;
    this.$offset = 0;
    this.$cbReceive = this.$onreceive.bind(this);
    socket.on("data", this.$cbReceive);
};

(function() {

    this.$onreceive = function(data) {
        this.$received += data;

        var fullResponse;
        while ((fullResponse = this.$checkForWholeMessage()) !== false)
            this.$callback(fullResponse);
    };

    this.$checkForWholeMessage = function() {
        var fullResponse = false;
        var received = this.$received;
        if (!this.$expectedBytes) { // header
            var i = received.indexOf("\r\n\r\n");
            if (i !== -1) {
                var c = received.lastIndexOf("Content-Length:", i);
                if (c != -1) {
                    var l = received.indexOf("\r\n", c);
                    var len = parseInt(received.substring(c + 15, l), 10);
                    this.$expectedBytes = len;
                }
                this.headerOffset = this.$offset = i + 4;
            }
        }
        if (this.$expectedBytes) { // body
            var result = readBytes(received, this.$offset, this.$expectedBytes);
            this.$expectedBytes -= result.bytes;
            this.$offset += result.length;
        }
        if (this.$offset && this.$expectedBytes <= 0) {
            fullResponse = received.substring(this.headerOffset || 0, this.$offset);
            this.$received = received.substr(this.$offset);
            this.$offset = this.$expectedBytes = 0;
        }
        // console.log("RECEIVE>", fullResponse, this.$received.length);
        return fullResponse;
    };
    
    this.destroy = function() {
        this.$socket && this.$socket.removeListener("data", this.$cbReceive);
        delete this.$socket;
        delete this.$callback;
        this.$received = "";
    };

}).call(MessageReader.prototype);


module.exports = MessageReader;
