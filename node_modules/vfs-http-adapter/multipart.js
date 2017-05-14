// Simple multipart parser for file uploads
// Based loosly on Felix's node-formidable library
// https://github.com/felixge/node-formidable

var Stream = require('stream').Stream;
var EventEmitter = require('events').EventEmitter;

// Given an http request, it returns an event emitter that emits readable streams.
module.exports = newParser
function newParser(req, str) {
    var boundary = new Buffer(str);
    return new Parser(req, boundary);
};

// Parser states
var DONE                     = 0x00;
var BOUNDARY_START           = 0x01;
var BOUNDARY                 = 0x02;
var BOUNDARY_END             = 0x03;
var HEADER_FIELD             = 0x11;
var HEADER_VALUE             = 0x12;
var HEADER_VALUE_END         = 0x13;
var HEADERS_ALMOST_DONE      = 0x14;
var PART_DATA                = 0x21;
var PART_END                 = 0x22;
var END                      = 0x31;

var states = {};
states[DONE] = "DONE";
states[BOUNDARY_START] = "BOUNDARY_START";
states[BOUNDARY] = "BOUNDARY";
states[BOUNDARY_END] = "BOUNDARY_END";
states[HEADER_FIELD] = "HEADER_FIELD";
states[HEADER_VALUE] = "HEADER_VALUE";
states[HEADER_VALUE_END] = "HEADER_VALUE_END";
states[HEADERS_ALMOST_DONE] = "HEADERS_ALMOST_DONE";
states[PART_DATA] = "PART_DATA";
states[PART_END] = "PART_END";
states[END] = "END";

var inherits = require('util').inherits;

inherits(PartStream, Stream);
function PartStream(input, headers) {
    this.headers = headers;
    this.readable = true;
    this.input = input;
    this.events = [];
}

PartStream.prototype.pause = function pause() {
    this.input.pause();
};

PartStream.prototype.resume = function resume() {
    this.input.resume();
};

inherits(Parser, EventEmitter);
function Parser(input, boundary) {
    this.boundary = boundary;
    this.input = input;
    this.state = BOUNDARY_START;
    this.offset = 0; // The current offset in the entire stream
    this.index = 0; // index of bytes in current substream
    this.chunks = [];
    input.on("data", this.onData.bind(this));
    input.on("end", this.onEnd.bind(this));
}
Parser.prototype.error = function error(message) {
    this.emit("error", new Error(message));
};
// Flush the buffer
Parser.prototype.flush = function flush() {
    for (var i = 0, l = this.chunks.length; i < l; i++) {
        this.stream.emit("data", this.chunks[i]);
    }
    this.chunks.length = 0;
};
Parser.prototype.onData = function onData(chunk) {

    var boundary = this.boundary;
    var stream = this.stream;
    var len = chunk.length;
    var start; // offset within chunk of start of current piece
    var partStart; // offset within chunk of data start
    var partEnd;
    var leftover;
    if (this.leftover !== undefined) {
        leftover = this.leftover;
        this.leftover = undefined;
        start = 0;
    }

    for (var i = 0; i < len; i++,this.offset++) {
        var c = chunk[i];
        // console.log({i:i,c:new Buffer([c]).toString(),s:states[this.state],l:leftover,ch:this.chunks});
        switch (this.state) {
        
        case BOUNDARY_START: // Matches the "--" prefix before the boundary string
            if (c !== 0x2d) {
                if (partEnd !== undefined) {
                    partEnd = undefined;
                    this.state = PART_DATA;
                }
                if (this.chunks.length) {
                    this.flush();  // Flush any pending chunks that we weren't sure about
                    this.state = PART_DATA;
                }
                if (this.state === PART_DATA) {
                    i--;
                    continue;
                }
                return this.error("Missing -- before boundary " + this.index);
            }
            if (this.index === 1) {
                this.state = BOUNDARY;
                this.index = 0;
            } else {
                this.index++;
            }
            break;
        
        case BOUNDARY: // Matches the boundary string
            if (c !== boundary[this.index]) {
                if (partEnd !== undefined) {
                    partEnd = undefined;
                    this.state = PART_DATA;
                }
                if (this.chunks.length) {
                    this.flush();  // Flush any pending chunks that we weren't sure about
                    this.state = PART_DATA;
                }
                if (this.state === PART_DATA) {
                    i--;
                    continue;
                }
                return this.error("Boundary mismatch " + this.index);
            }
            if (this.index === boundary.length - 1) {
                this.chunks.length = 0; // It was a boundary, throw away the buffer
                if (partEnd !== undefined) {
                    partStart = partStart || 0;
                    if (partStart < partEnd) {
                        stream.emit("data", chunk.slice(partStart, partEnd));
                    }
                    partStart = undefined;
                    partEnd = undefined;
                }
                if (stream) {
                    stream.emit("end");
                    this.stream = undefined;
                    stream = undefined;
                }
                this.state = BOUNDARY_END;
                this.index = 0;
            } else {
                this.index++;
            }
            break;

        case BOUNDARY_END: // Matches the \r\n after the boundary
            if (c === 0x2d) { // -
                this.state = END;
                this.index = 0;
                continue;
            }
            if (c !== (this.index === 0 ? 0x0d : 0x0a)) {
                return this.error("Missing \\r\\n after boundary " + this.index);
            }
            if (this.index === 1) {
                this.state = HEADER_FIELD;
                this.index = 0;
                this.headers = {};
                start = i + 1;
            } else {
                this.index++;
            }
            break;

        case HEADER_FIELD:
            if (start === i && c === 0x0d) { // \r
                this.state = HEADERS_ALMOST_DONE;
                start = undefined;
                continue;
            }
            if (c !== 0x3a) continue; // Eat everything up to :
            var field = chunk.toString("ascii", start, i);
            if (leftover !== undefined) {
                field = leftover + field;
                leftover = undefined;
            }
            this.field = field;
            this.state = HEADER_VALUE;
            start = i + 1;
            break;

        case HEADER_VALUE:

            if (c === 0x20 && start === i && !leftover) {
                start = i + 1; // left trim
            } 
            if (c !== 0x0d) continue; // Eat everything up to \r

            var value = chunk.toString("ascii", start, i);
            if (leftover !== undefined) {
                value = leftover + value;
                leftover = undefined;
            }
            this.headers[this.field.toLowerCase()] = value;
            this.field = undefined;
            start = undefined;
            this.state = HEADER_VALUE_END;
            break;

        case HEADER_VALUE_END:
            if (c !== 0x0a) {
                return this.error("Missing \\r\\n after header");
            }
            start = i + 1;
            this.state = HEADER_FIELD;
            break;

        case HEADERS_ALMOST_DONE:
            if (c !== 0x0a) {
                return this.error("Missing \\r\\n after headers");
            }
            stream = new PartStream(this.input, this.headers);
            this.stream = stream;
            this.headers = undefined;
            this.emit("part", stream);

            this.state = PART_DATA;
            partStart = i + 1;
            break;

        case PART_DATA:
            if (c !== 0x0d) continue; // \r
            // This might be the end of the data, we're not sure yet
            partEnd = i; 
            // Start checking if this is the end of the body
            this.state = PART_END;
            break;
        case PART_END:
            if (c === 0x0a) {
                this.state = BOUNDARY_START;
                this.index = 0;
            } else {
                if (partEnd !== undefined) {
                    partEnd = undefined;
                }
                if (this.chunks.length) {
                    this.flush();  // Flush any pending chunks that we weren't sure about
                }
                this.state = PART_DATA;
                i--;
            }
            break;
        case END:
            if (c !== (this.index === 0 ? 0x2d : this.index === 1 ? 0x0d : 0x0a)) {
                return this.error("Missing --\r\n after closing boundary");
            }
            if (this.index === 2) {
                this.state = DONE;
                continue;
            }
            this.index++;
            break;

        case DONE:
            return this.error("Trailing data after end");

        default:
            this.error("Unknown parser state " + this.state);
            break;
        }
    }

    // At end of input chunk, we need to handle leftovers.

    // If we were parsing a body, just emit what we got.
    if (this.state === PART_DATA) {
        if (!partStart) { // The entire chunk was data
            stream.emit("data", chunk);
        } else if (partStart < chunk.length) { // The data started within this chunk
            stream.emit("data", chunk.slice(partStart));
        }
    } else {
        // We're still checking to see if chunk bytes are boundary or data
        if (partEnd !== undefined) { 
            // Flush the part we're sure is body
            partStart = partStart || 0;
            if (partStart < partEnd) {
                stream.emit("data", chunk.slice(partStart, partEnd));
            }
            // Buffer the rest
            if (partEnd < chunk.length) {
                this.chunks.push(chunk.slice(partEnd));
            }
        } else if (this.chunks.length) {
            this.chunks.push(chunk);
        }
    }

    if (start !== undefined) {
        this.leftover = (leftover || "") + chunk.toString("ascii", start);
    } else if (leftover) {
        this.leftover = leftover;
    }
};

Parser.prototype.onEnd = function onEnd() {
    if (this.state !== DONE) {
        this.error("Unexpected EOF in input stream");
    }
    this.emit("end");
};
