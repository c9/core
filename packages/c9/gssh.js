 "use strict";

 var childProcess = require("child_process");
 var debug = require("debug")("abuse:abuse");
 var fs = require("fs");
 var assert = require("assert");
 
 
 var GSSH_SCRIPT_PATH = __dirname + "/../../scripts/gssh";
 var GSCP_SCRIPT_PATH = __dirname + "/../../scripts/gscp";
 var SSH_TIMEOUT = 120 * 1000; // Must be higher than gssh ssh timeout
 
 assert(fs.existsSync(GSSH_SCRIPT_PATH), "GSSH_SCRIPT_PATH exists");
 assert(fs.existsSync(GSCP_SCRIPT_PATH), "GSSH_SCRIPT_PATH exists");

 function gssh(args, options, callback) {
     if (!callback && typeof options == "function") {
         callback = options;
         options = {};
     }

     args.unshift(options.prepareCache ? "--no-cache" : "--cache-only");
     args.unshift("-q");

     debug("Running gssh with args %s", args);
     options.timeout = options.timeout || SSH_TIMEOUT;

     childProcess.execFile(
         GSSH_SCRIPT_PATH,
         args, {
             maxBuffer: 100 * 1000 * 1024
         },
         done
     );
     

     var timeout = !options.testing && setTimeout(function() {
         if (!callback)
             return;
         var err = new Error("Timeout during gssh for one or more servers");
         err.code = "TIMEOUT";
         done(err);
     }, options.timeout);

     function done(err, stdout, stderr) {
         if (!callback)
             return;

         callback(err, stdout, stderr);
         callback = null;
         clearTimeout(timeout);
     }
 }

 module.exports.gssh = gssh;

 function gscp(args, options, callback) {
     if (!callback && typeof options == "function") {
         callback = options;
         options = {};
     }

     options.timeout = options.timeout || SSH_TIMEOUT;

     childProcess.execFile(
         GSCP_SCRIPT_PATH,
         args, {
             maxBuffer: 100 * 1000 * 1024
         },
         done
     );

     var timeout = !options.testing && setTimeout(function() {
         if (!callback)
             return;
         console.log('GSCP timeout:', args);
         var err = new Error("Timeout during gscp for one or more servers");
         err.code = "TIMEOUT";
         done(err);
     }, options.timeout);

     function done(err, stdout, stderr) {
         if (!callback)
             return;

         callback(err, stdout, stderr);
         callback = null;
         clearTimeout(timeout);
     }
 }

 module.exports.gscp = gscp;
 