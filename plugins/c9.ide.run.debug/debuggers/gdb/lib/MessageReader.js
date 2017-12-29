/**
 * Ajax.org Code Editor (ACE)
 *
 * @copyright 2010, Ajax.org Services B.V.
 * @license LGPLv3 <http://www.gnu.org/licenses/lgpl-3.0.txt>
 * @author Fabian Jakobs <fabian AT ajax DOT org>
 */

define(function(require, exports, module) {
"use strict";

var MessageReader = module.exports = function(socket, callback) {
    this.$socket = socket;
    this.$callback = callback;

    this.$received = "";
    this.$cbReceive = this.$onreceive.bind(this);
    socket.on("data", this.$cbReceive);
};

(function() {

    this.$onreceive = function(data) {
        //this.$socket.clearBuffer();
        this.$received += data;

        var fullResponse;
        while (fullResponse = this.$checkForWholeMessage())
            this.$callback(fullResponse);
    };

    this.$checkForWholeMessage = function() {
        var i, c, l;
        var responseLength;
        var fullResponse = false;
        var received = this.$received;

        if ((i = received.indexOf("\r\n\r\n")) != -1) {
            if ((c = received.indexOf("Content-Length:")) != -1) {
                l = received.substring(c + 15);
                l = l.substring(0, l.indexOf("\r\n"));
                responseLength = i + 4 + parseInt(l, 10);
                if (responseLength <= received.length) {
                    fullResponse = received.substring(0, responseLength);
                    this.$received = received.substring(responseLength);
                }
            }
        }
        return fullResponse;
    };

    this.destroy = function() {
        this.$socket && this.$socket.removeListener("data", this.$cbReceive);
        delete this.$socket;
        delete this.$callback;
        this.$received = "";
    };

}).call(MessageReader.prototype);

});