/**
 * This implements speculative echo for the terminal, i.e.
 * printing characters when they are typed without waiting for the server
 * to echo them.
 *
 * @extends Plugin
 * @singleton
 */
define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "Plugin", "editors", "c9", "vfs.ping", "util", "error_handler"
    ];
    main.provides = ["terminal.predict_echo"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var editors = imports.editors;
        var c9 = imports.c9;
        var BaseTerminal = require("./aceterm/libterm");
        var assert = require("assert");
        var vfsPing = imports["vfs.ping"];
        var errorHandler = imports.error_handler;
        
        var BASH_ONLY = true;
        var DEBUG = false;
        
        var MIN_PREDICTION_WAIT = 500;
        var PING_DEVIATION = 500;
        var INSERTABLE_CHARS = /^[A-Za-z0-9!"#$%&'()*+,-\.\/\\:;<=>?!@[\] ^_`{|}~]+$/;
        var INPUT_BACKSPACE = "\u007F";
        var ESC = "\u001B";
        var OUTPUTS_BACKSPACE_ALL = ["\b" + ESC + "[K", "\b" + ESC + "[1K"];
        var OUTPUTS_BACKSPACE_CHAR = ["\b" + ESC + "[P", "\b" + ESC + "[1P"];
        var OUTPUTS_ERASE_BACK_CHAR = ["\b \b"];
        var OUTPUTS_DELETE_CHAR = [ESC + "[P", ESC + "[1P"];
        var OUTPUTS_DELETE_ALL = [ESC + "[K", ESC + "[1K"];
        var OUTPUT_CURSOR_START = ESC + "[H";
        var INPUT_LEFT = ESC + "[D";
        var INPUT_DELETE = ESC + "[3~";
        var OUTPUTS_LEFT = ["\b", ESC + "[D", ESC + "[1D"];
        var INPUTS_HOME = [ESC + "[1~", ESC + "[~", "\u0001"];
        var INPUT_RIGHT = ESC + "[C";
        var OUTPUTS_RIGHT = [ESC + "[C", ESC + "[1C"];
        var STATE_PREDICT = 0;
        var STATE_WAIT_FOR_PROMPT_OR_ECHO = 1;
        var STATE_WAIT_FOR_PROMPT = 2;
        var STATE_INITING = 3;
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        var lastPings = [MIN_PREDICTION_WAIT, MIN_PREDICTION_WAIT, MIN_PREDICTION_WAIT];
        var pendingPings = [];
        
        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            editors.on("create", function(e) {
                if (!e.editor || e.editor.type !== "terminal")
                    return;
                var terminal = e.editor;
                terminal.on("documentLoad", function(e) {
                    var session = e.doc.getSession();
                    var predictor = new Predictor(terminal, session);
                    session.$predictor = predictor;
                }, plugin);
                terminal.on("beforeWrite", function(e) {
                    return e.session.$predictor.onBeforeWrite(e);
                }, plugin);
                terminal.on("afterWrite", function(e) {
                    return e.session.$predictor.onAfterWrite(e);
                }, plugin);
                terminal.on("input", function(e) {
                    DEBUG && console.log(">", e.data.replace("\r", "\\r").replace("\u007F", "\\bs"));
                    return e.session.$predictor.onInput(e);
                }, plugin);
            }, plugin);
        }
        
        function Predictor(terminal, session) {
            var predictions = [];
            var predictLine = "";
            var predictIndex = 0;
            var predictStartX = 0;
            var predictStartY = 0;
            var nonPredictStartY = 0;
            var state = STATE_WAIT_FOR_PROMPT_OR_ECHO;
            var lastInput = null;
            
            // We maintain a copy of the terminal state without predictions
            var nonPredictTerminal = new BaseTerminal(terminal.rows, terminal.cols);
            nonPredictTerminal.scrollback = 1;
            session.terminal.on("resize", function(e) {
                nonPredictTerminal.resize(e.x, e.y);
            });
            session.terminal.on("clear", function() {
                nonPredictTerminal.clear();
            });

            function onInput(e) {
                if (!c9.has(c9.NETWORK) || !c9.connected) {
                    DEBUG && console.log("!", "nopredict: not connected");
                    return;
                }
                
                // Store last input to check later if we could predict it
                lastInput = e.data.length === 1 && INSERTABLE_CHARS.test(e.data)
                    ? e.data
                    : null;
                
                if (session.terminal.cursorState !== 1 || state !== STATE_PREDICT) {
                    DEBUG && console.log("!", "nopredict: state =", state);
                    return;
                }
                
                if (isPossibleConnectionGone()) {
                    DEBUG && console.log("!", "nopredict: connection gone?");
                    state = STATE_WAIT_FOR_PROMPT_OR_ECHO;
                    return;
                }
                
                var prediction =
                       InsertCommand.tryCreate(e.data)
                    || CursorLeftCommand.tryCreate(e.data)
                    || CursorRightCommand.tryCreate(e.data)
                    || BackspaceCommand.tryCreate(e.data)
                    || DeleteCommand.tryCreate(e.data)
                    || HomeCommand.tryCreate(e.data);

                if (!prediction) {
                    DEBUG && console.log("!", "nopredict:", e.data.replace(/\r/g, "\\r"));
                    state = STATE_WAIT_FOR_PROMPT;
                    return;
                }
                
                // predictStartX = session.terminal.x - predictIndex;
                // predictStartY = nonPredictTerminal.ybase + nonPredictTerminal.y;
                
                if (Array.isArray(prediction))
                    return prediction.forEach(addCommand);
                
                addCommand(prediction);
                
                function addCommand(command) {
                    predictions.push(command);
                    pendingPings.unshift(Date.now());
                    
                    command.before = { predict: predictLine, predictIndex: predictIndex };
                    command.do();
                    command.after = { predict: predictLine, predictIndex: predictIndex };
                    command.sent = Date.now();
                    
                    if (DEBUG) {
                        var alreadyEchoed = predictions[0].before.predict;
                        console.log("!" + debugPromptSuffix()
                            + predictLine.substr(0, alreadyEchoed.length)
                            + "%c" + predictLine.substr(alreadyEchoed.length),
                            "color: lightblue"
                        );
                    }
                    
                    // DEBUG && console.log("!="
                    //     + session.terminal.$debugCharsAt(predictStartY - session.terminal.ybase).join(""));
                    
                    command.timeout = setTimeout(function panic() {
                        if (!c9.has(c9.NETWORK) || !c9.connected) {
                            state = STATE_WAIT_FOR_PROMPT_OR_ECHO;
                            c9.once("connect", function() {
                                command.timeout = setTimeout(panic, MIN_PREDICTION_WAIT);
                            });
                            return;
                        }
                        if (isPossibleConnectionGone()) {
                            vfsPing.ping(function(err, result) {
                                // ignore err
                                pong();
                                panic();
                            });
                            return;
                        }
                        
                        // Aww, prediction not confirmed in time :( Rollback
                        if (predictions.indexOf(command) > -1)
                            undoPredictions();
                    }, Math.max(MIN_PREDICTION_WAIT, getAveragePing() * 3 + PING_DEVIATION));
                }
            }
            
            function debugPromptSuffix() {
                return nonPredictTerminal.$debugCharsAt(nonPredictTerminal.y)
                    .slice(0, predictStartX).slice(-3)
                    .map(function(c) { return c || " "; }).join("");
            }
            
            function isPossibleConnectionGone() {
                if (!pendingPings.length)
                    return;
                
                var avgPing = getAveragePing();
                var nextPing = Date.now() - pendingPings[0];
                if (nextPing > avgPing * 3 + PING_DEVIATION)
                    return true;
            }
            
            function onBeforeWrite(e) {
                if (!e.$startX) { // make sure we're reentrant for debuggers
                    e.$startY = nonPredictTerminal.y;
                    e.$startX = nonPredictTerminal.x;
                    nonPredictTerminal.write(e.data);
                }
                
                DEBUG && console.log(
                    "<"
                    + (state == STATE_PREDICT
                        ? debugPromptSuffix() +
                          nonPredictTerminal.$debugCharsAt(e.$startY).slice(predictStartX).join("")
                        : "")
                    + "%c < " + e.data,
                    "color: lightblue"
                );
                
                if (!predictions.length) {
                    if (state == STATE_PREDICT && nonPredictStartY !== nonPredictTerminal.ybase + nonPredictTerminal.y) {
                        DEBUG && console.log("  ^ disabled predictions: (row changed)");
                        state = STATE_WAIT_FOR_PROMPT_OR_ECHO;
                    }
                    tryEnablePrediction(e.data);
                    emit("nopredict", { data: e.data, session: session });
                    return;
                }
                
                pong();
                
                chopPredictions(e, predictions, function(err, results, line) {
                    if (err || !results) {
                        DEBUG && console.log("[predict_echo] mispredict?", e.data.replace(/\r/g, "\\r")
                            + "\n!=" + session.terminal.$debugCharsAt(predictStartY - session.terminal.ybase).join("")
                            + "\n<=" + nonPredictTerminal.$debugCharsAt(e.$startY).join(""));
                        emit("mispredict", {
                            data: e.data,
                            line: charsOf(line),
                            predictions: predictions,
                            session: session
                        });
                        undoPredictions();
                    }
                    // I would try to enable predictions here,
                    // but we may be doing that on a response that precedes
                    // data we couldn't predict, like a \r
                    //
                    // else if (!predictions.length) {
                    //     tryEnablePrediction(e.data);
                    // }
                });
                
                writePredictData(e.data, e.$startX);
                return true;
            }
            
            /**
             * Temporarily restore the unpredict terminal state to allow
             * writing incoming data, including small anomalies that may
             * not have been predicted but still passed our sanity checks.
             */
            function writePredictData(data, startX) {
                var predictTerminal = session.terminal;
                var predictX = predictTerminal.x;
                var predictY = predictTerminal.ybase + predictTerminal.y;
                var predictChars = predictTerminal.lines[predictY].slice();
                predictTerminal.x = startX;
                copyTerminalLineTo(predictTerminal);
                
                session.terminal.write(data);
                
                for (var x = predictStartX; predictChars[x]; x++) {
                    predictTerminal.lines[predictY][x] = predictChars[x];
                }
                
                predictTerminal.x = predictX;
            }
            
            /**
             * Register a "pong" event; we just got some data form the server.
             */
            function pong() {
                if (pendingPings[0])
                    pendingPings[0] = Date.now();
            }
            
            function undoPredictions() {
                DEBUG && console.log("Prediction undo");
                DEBUG && chopPredictions(
                    {},
                    predictions.slice(),
                    function() {
                        console.log("chop result: ", arguments);
                    }
                );
                DEBUG && console.log("Restoring nonpredict line; from",
                    session.terminal.$debugCharsAt(predictStartY - session.terminal.ybase).join(""),
                    "to",
                    nonPredictTerminal.$debugCharsAt(nonPredictStartY - nonPredictTerminal.ybase).join("")
                );
                
                pendingPings = [];
                predictions = [];
                state = STATE_WAIT_FOR_PROMPT_OR_ECHO;
                copyTerminalLineTo(terminal);
                session.terminal.x = nonPredictTerminal.x;
                lastInput = null; // avoid immediately enabling again
            }
            
            /**
             * @param target      The target terminal, i.e. terminal or nonPredictTerminal.
             */
            function copyTerminalLineTo(target) {
                var predictTerminal = session.terminal;
                var predictChars = predictTerminal.lines[predictStartY];
                var nonPredictChars = nonPredictTerminal.lines[nonPredictStartY];
                var fromChars = target === nonPredictTerminal ? predictChars : nonPredictChars;
                var toChars = target === nonPredictTerminal ? nonPredictChars : predictChars;
                
                if (!predictChars) { // terminal likely just refreshed, never mind copying to it
                    state = STATE_WAIT_FOR_PROMPT;
                    return;
                }
                if (!fromChars || !toChars) {
                    state = STATE_WAIT_FOR_PROMPT;
                    errorHandler.reportError(new Error("Warning: can't copy terminal line: "), {
                        fromChars: fromChars, toChars: toChars
                    });
                    if (DEBUG) debugger;
                    return;
                }
                
                for (var i = predictStartX; i < toChars.length; i++) {
                    toChars[i] = fromChars[i] || toChars[i];
                }
                
                predictTerminal.updateRange(predictStartY - predictTerminal.ybase);
            }

            /**
             * Perform a sanity text on the string that precedes the current
             * prediction buffer.
             * @return {Boolean} true if the sanity check passes
             */
            function checkTextBeforePrediction() {
                var predictTerminal = session.terminal;
                var predictLine = predictTerminal.lines[predictStartY];
                var line = nonPredictTerminal.lines[nonPredictStartY];
                if (!predictLine || !line)
                    return false;
                
                for (var i = 0; i < predictStartX; i++) {
                    assert(predictLine[i].length === 2);
                    if (predictLine[i][0] !== line[i][0] || predictLine[i][1] !== line[i][1])
                        return false;
                }
                return true;
            }
            
            /**
             * Check if an event matches what we predicted. Any succesful
             * predictions are removed (chopped) from the prediction array.
             *
             * @param {Object} e
             * @param {Object[]} predictions    
             * @param {Function} callback
             * @param {Error} callback.err
             * @param {Object[]|Boolean} callback.results  A list of matching predictions, or `false`
             */
            function chopPredictions(e, predictions, callback) {
                var line = nonPredictTerminal.lines[nonPredictStartY];
                var rowChanged = nonPredictStartY !== nonPredictTerminal.y + nonPredictTerminal.ybase;
                
                if (!checkTextBeforePrediction())
                    return done(null, false);
                
                // Check if predictions became true
                var matchedOneOff = false;
                for (var i = predictions.length - 1; i >= 0; i--) {
                    if (rowChanged && i !== predictions.length - 1)
                        break; // satisfy all predictions or bail
                    
                    var prediction = predictions[i];
                    if (matchPrediction(prediction)) {
                        DEBUG && console.log("  ^ confirmed:", prediction.after.predict + " (saved " + (Date.now() - prediction.sent) + "ms)");
                        lastPings.push(Date.now() - prediction.sent);
                        lastPings.shift();
                        
                        // Cleanup timeouts
                        for (var j = 0; j <= i; j++) {
                            clearTimeout(predictions[j].timeout);
                            pendingPings.pop();
                        }
                        
                        // Cleanup predictions array
                        var duplicate = getDuplicateIndex(prediction, predictions);
                        var predict;
                        if (duplicate !== -1) {
                            // We found a duplicate state. We can't be sure if we're
                            // in state predictions[i] or predictions[duplicate]
                            // (see "duplicate states" test)
                            for (var j = duplicate + 1; j <= i; j++) {
                                predictions[j].optional = true;
                            }
                            predict = predictions.splice(0, duplicate + 1);
                        }
                        else {
                            predict = predictions.splice(0, i + 1);
                        }
                        
                        return done(null, predict);
                    }
                }
                
                // No matches. But one got really close.
                if (matchedOneOff)
                    return done(null, []);
                
                // No matches. Return if our predictions were optional.
                if (isOptionalOnly(predictions))
                    return done(null, []);
                    
                // No matches. But it seems we got a noop input. Our predictions likely happen later.
                if (matchPrediction(NoopCommand.tryCreate()))
                    return done(null, []);
                
                // No matches for our predictions :( We likely made a mistake.
                // Reporting false here ensures we catch mistakes early.
                return done(null, false);
                
                function done(err, result) {
                    if (result) {
                        emit("predict", {
                            data: e.data,
                            session: session,
                            predictions: predict
                        });
                    }
                    callback(err, result, line);
                }
                
                function matchPrediction(prediction) {
                    var predict = prediction.after.predict;
                    var oneOff = false;
                    
                    if (nonPredictTerminal.x !== predictStartX + prediction.after.predictIndex
                        // If we changed to a new row, we don't care about the column
                        && !rowChanged)
                        return false;
                    
                    for (var i = predictStartX; i < line.length; i++) {
                        if (i < predictStartX + predict.length) {
                            if (line[i][1] !== predict[i - predictStartX]) {
                                if (line[i][1] === " " && !oneOff) {
                                    // Sometimes applications will clear a character with a space
                                    // before writing the desired char.
                                    oneOff = true;
                                    continue;
                                }
                                return false;
                            }
                        }
                        else {
                            if (line[i][1] !== "" && line[i][1] !== " ")
                                return false;
                        }
                    }
                    if (oneOff) {
                        matchedOneOff = true;
                        return false;
                    }
                    return true;
                }
                
                function getDuplicateIndex(prediction, predictions) {
                    for (var j = 0; j < i; j++) {
                        if (predictions[j].after.predict === prediction.after.predict
                            && predictions[j].after.predictIndex === prediction.after.predictIndex)
                            return j;
                    }
                    return -1;
                }
            }
            
            function isOptionalOnly(predictions) {
                return predictions.reduce(function(prev, p) {
                    return prev && p.optional;
                }, true);
            }
            
            function tryEnablePrediction(data) {
                if (state === STATE_PREDICT ||
                    (predictions.length && !isOptionalOnly(predictions)))
                    return;
                
                // Enable prediction when we see a prompt
                if ((state == STATE_WAIT_FOR_PROMPT || state === STATE_WAIT_FOR_PROMPT_OR_ECHO)
                    && data.match(/[$#] $/)) {
                    if (DEBUG) console.log("  ^ re-enabled predictions: (prompt)");
                    return startPredict();
                }
                
                // Enable prediction when we see echoing
                if (lastInput
                    && (state === STATE_WAIT_FOR_PROMPT_OR_ECHO)
                    && lastInput === data.substr(data.length - lastInput.length)
                    && (!BASH_ONLY || isBashActive())) {
                    if (DEBUG) console.log("  ^ re-enabled predictions:", lastInput);
                    return startPredict();
                }
                
                // Enable predictions when we see echoing *and* a prompt
                if (lastInput
                    && state == STATE_WAIT_FOR_PROMPT
                    && lastInput === data.substr(data.length - lastInput.length)
                    && isBashActive()) {
                    if (DEBUG) console.log("  ^ re-enabled predictions:", lastInput);
                    return startPredict();
                }
            }
            
            function startPredict() {
                predictIndex = 0;
                predictLine = "";
                predictStartX = nonPredictTerminal.x;
                nonPredictStartY = nonPredictTerminal.y + nonPredictTerminal.ybase;
                predictStartY = session.terminal.y + session.terminal.ybase;
                state = STATE_INITING;
            }
            
            function onAfterWrite(e) {
                if (state !== STATE_INITING)
                    return;
                    
                predictStartY = session.terminal.y + session.terminal.ybase;
                state = STATE_PREDICT;
                if (!checkTextBeforePrediction()) {
                    // Appears to happen when tmux or shell unexpectedly sends a new line
                    console.log("[predict_echo] Unable to init predictions; will try again later");
                    state = STATE_WAIT_FOR_PROMPT;
                }
            }
            
            function isBashActive() {
                var x = nonPredictTerminal.x - 1;
                for (var y = nonPredictTerminal.y; y >= 0; y--) {
                    var line = nonPredictTerminal.lines[y + nonPredictTerminal.ybase];
                    if (!line) {
                        errorHandler.reportError(new Error("Warning: predict echo line is missing "), {
                            lines: nonPredictTerminal.lines.length,
                            ybase: nonPredictTerminal.ybase,
                            startY: nonPredictTerminal.y,
                            y: y
                        });
                        return false;
                    }
                    while (x >= 0) {
                        var char = line[x] && line[x][1];
                        if ((char === "$" || char === "#") && line[x + 1] && line[x + 1][1] === " ")
                            return true;
                        x--;
                    }
                    x = nonPredictTerminal.cols - 1;
                    var prevLineEnd = nonPredictTerminal.getCharAt(y - 1, x - 1);
                    if (!prevLineEnd || !prevLineEnd[1])
                        return false;
                }
                return false;
            }
            
            function peek(offset) {
                offset = offset || 0;
                var char = session.terminal.getCharAt(
                    session.terminal.y, session.terminal.x + offset);
                return char && char[1];
            }
            
            function peekAttr(offset) {
                offset = offset || 0;
                var char = session.terminal.getCharAt(
                    session.terminal.y, session.terminal.x + offset);
                return char && char[0];
            }
            
            function peekSuffix(offset) {
                offset = offset || 0;
                var result = "";
                for (var x = session.terminal.x + offset; x < session.terminal.cols; x++) {
                    var char = session.terminal.getCharAt(
                        session.terminal.y, x);
                    result += (char && char[1]) || "";
                }
                return result;
            }
            
            function echo(data) {
                session.terminal.write(data);
            }
            
            /**
             * Character insertion command. Factory method: tryCreate().
             */
            InsertCommand.tryCreate = function(inputText) {
                var afterLength = predictLine.length - predictIndex;
                if (INSERTABLE_CHARS.test(inputText)
                    // Avoid accidentally overwriting text
                    && (peek(afterLength) === "" || peek(afterLength) === " " && peekSuffix(afterLength).match(/^[ │·]*$/))
                    // Cowardly refuse to predict a newline
                    && session.terminal.x + inputText.length < session.terminal.cols
                    // Watch out with color codes
                    && peekAttr() === session.terminal.curAttr) {
                    // Split into multiple commands to track partial predection successes
                    return inputText.split("").map(function(i) {
                        return new InsertCommand(i);
                    });
                }
            };
            function InsertCommand(inputText) {
                return {
                    $outputText: inputText,
                    do: function() {
                        var after = predictLine.substr(predictIndex);
                        var outputText =
                            inputText + (after
                               ? after + getCursorLeft(after.length)
                               : "");
                        predictLine = predictLine.substr(0, predictIndex) + inputText + after;
                        predictIndex += inputText.length;
                        echo(outputText);
                    },
                };
            }
            
            /**
             * Backspace command. Factory method: tryCreate().
             */
            BackspaceCommand.tryCreate = function(inputText) {
                if (inputText === INPUT_BACKSPACE && predictIndex > 0
                    && INSERTABLE_CHARS.test(peek(-1)))
                    return new BackspaceCommand();
            };
            function BackspaceCommand() {
                var after = predictLine.substr(predictIndex);
                var outputText = OUTPUTS_BACKSPACE_CHAR[0];
                return {
                    $outputText: outputText,
                    do: function() {
                        predictLine = predictLine.substr(0, predictIndex - 1) + after;
                        predictIndex--;
                        echo(outputText);
                    }
                };
            }
            
            /**
             * Delete command. Factory method: tryCreate().
             */
            DeleteCommand.tryCreate = function(inputText) {
                if (inputText === INPUT_DELETE && predictIndex < predictLine.length)
                    return new DeleteCommand();
            };
            function DeleteCommand() {
                var after = predictLine.substr(predictIndex + 1);
                return {
                    $outputText: OUTPUTS_DELETE_CHAR[0],
                    do: function() {
                        predictLine = predictLine.substr(0, predictIndex) + after;
                        echo(OUTPUTS_DELETE_CHAR[0]);
                    }
                };
            }
            
            /**
             * Cursor left command. Factory method: tryCreate().
             */
            CursorLeftCommand.tryCreate = function(inputText) {
                if (inputText === INPUT_LEFT)
                    return new CursorLeftCommand();
            };
            function CursorLeftCommand() {
                return {
                    $outputText: OUTPUTS_LEFT[0],
                    do: function() {
                        if (predictIndex === 0) {
                            clearTimeout(this.timeout);
                            return;
                        }
                        echo(OUTPUTS_LEFT[0]);
                        predictIndex--;
                    }
                };
            }
            
            /**
             * Cursor right command. Factory method: tryCreate().
             */
            CursorRightCommand.tryCreate = function(inputText) {
                if (inputText === INPUT_RIGHT && predictIndex < predictLine.length)
                    return new CursorRightCommand();
            };
            function CursorRightCommand() {
                return {
                    $outputText: OUTPUTS_RIGHT[0],
                    do: function() {
                        echo(OUTPUTS_RIGHT[0]);
                        predictIndex++;
                    }
                };
            }
            
            /**
             * Home command. Factory method: tryCreate().
             */
            HomeCommand.tryCreate = function(inputText) {
                if (INPUTS_HOME.indexOf(inputText) > -1
                    // Only attempt home if we'd jump to the start of a prompt
                    && (peek(-predictIndex - 1) === "$" || peek(-predictIndex - 2) === "$"))
                    return new HomeCommand();
            };
            function HomeCommand() {
                var outputText = predictIndex ? getCursorLeft(predictIndex) : "";
                return {
                    $outputText: outputText,
                    do: function() {
                        echo(outputText);
                        predictIndex = 0;
                    }
                };
            }
            
            /**
             * Noop command. Factory method: tryCreate().
             */
            NoopCommand.tryCreate = function() {
                var result = new NoopCommand();
                result.before = { predict: predictLine, predictIndex: predictIndex };
                result.after = { predict: predictLine, predictIndex: predictIndex };
                return result;
            };
            function NoopCommand() {
                var outputText = predictIndex ? getCursorLeft(predictIndex) : "";
                return {
                    $outputText: outputText,
                    do: function() {
                        echo(outputText);
                        predictIndex = 0;
                    }
                };
            }
            
            // Predictor API
            return {
                get state() { return state; },
                set state(value) {
                    if (value === STATE_PREDICT && state !== STATE_PREDICT) {
                        startPredict();
                        state = STATE_PREDICT;
                    }
                    state = value;
                },
                get predictions() { return predictions; },
                undoPredictions: undoPredictions,
                onInput: onInput,
                onBeforeWrite: onBeforeWrite,
                onAfterWrite: onAfterWrite,
            };
        }
            
        function charsOf(line) {
            return line.map(function(c) { return c[1] }).join("");
        }
        
        function getCursorLeft(n) {
            return ESC + "[" + n + "D";
        }
            
        function getAveragePing() {
            return (lastPings[0] + lastPings[1] + lastPings[2]) / 3;
        }
        
        plugin.on("load", function() {
            load();
        });
        
        plugin.on("unload", function() {
            lastPings = [MIN_PREDICTION_WAIT, MIN_PREDICTION_WAIT, MIN_PREDICTION_WAIT];
            pendingPings = [];
            loaded = false;
        });
        
        /**
         * @ignore
         */
        plugin.freezePublicAPI({
            $setTestTimeouts: function() {
                PING_DEVIATION = 30000;
                MIN_PREDICTION_WAIT = 10000;
            },

            set DEBUG(value) { DEBUG = value; },
            
            get DEBUG() { return DEBUG; },
            
            _events: [
                "predict",
                "mispredict",
                "nopredict"
            ]
        });
        
        register(null, { "terminal.predict_echo": plugin });
    }
});
