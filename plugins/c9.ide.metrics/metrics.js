/**
 * Stub for collecting workspace/service metrics.
 * 
 * For logging metrics to a service like datadog.
 * 
 * Actual metrics are implemented by an external plugin that has
 * many dependencies, including dependencies on VFS.
 * VFS and other plugins have dependencies on "metrics".
 * This stub plugin breaks the dependency cycle.
 */
define(function(require, exports, module) {
    "use strict";

    main.consumes = ["Plugin"];
    main.provides = ["metrics"];
    return main;

    /**
     * Collects workspace/service metrics.
     */
    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var plugin = new Plugin("Ajax.org", main.consumes);
        
        var api;
        var delayedCalls = [];
        
        var apiFunction = options.hosted
            ? function(apiName, varArgs) {
                  var args = [].slice.apply(arguments);
                
                  if (!api)
                      return arguments[1] && delayedCalls.push(args);
                      
                  var name = args.shift();
                  return api[name].apply(api, args);
              }
            : function() {};
        
        function publishApi(newApi) {
            api = newApi;
            delayedCalls.forEach(function(args) {
                var name = args.shift();
                api[name].apply(api, args);
            });
            delayedCalls = [];
        }
        
        plugin.freezePublicAPI({
            /**
             * @internal @ignore
             */
            $publishApi: publishApi,
            
            $setRequestApi: apiFunction.bind(null, "$setRequestApi"),
            
            /**
             * Increment a metric value for this user/workspace,
             * e.g. increment the number of times the user was disconnected by 1.
             * 
             * These metrics get logged to a service like datadog,
             * namespaced in c9.ide.metrics.
             * 
             * Example:
             * 
             *     metrics.increment("disconnected", 1, true);
             * 
             * @param {String} name
             * @param {Number} [value]
             * @param {Boolean} [now]
             *      Whether to send it within 50ms (or
             *      when we have a connection) or some time between now
             *      and up to 5 min or so.
             */
            increment: apiFunction.bind(null, "increment"),
        
            /**
             * Set a metric value for this user/workspace,
             * e.g. the time it takes to load this workspace.
             * 
             * These metrics get logged to a service like datadog,
             * namespaced in c9.ide.metrics.
             * 
             * Example:
             * 
             *     metrics.log("load_workspace", Date.now() - start, [500, 1000, 5000]);
             * 
             * @param {String} name
             * @param {Number} value
             * @param {Number[]} [levels]
             *      If specified, splits up the metric into different levels, e.g.
             *      for [500, 1000, 5000], a 'value' of 600 would
             *      log a load_workspace_500 metric. A 'value' of 6000
             *      would log a load_workspace_over_5000 metric.
             * @param {Boolean} [now]
             *      Whether to send within 50ms (or
             *      when we have a connection) or some time between now
             *      and up to 5 min or so.
             */
            log: apiFunction.bind(null, "log"),

             /**
             * Get the latest metrics collected, or null if not available yet.
             * 
             * @internal
             * @ignore
             * @return {Number}
             */
            getLatest: apiFunction.bind(null, "getLatest"),
            
            /**
             * Get the last vfs ping time.
             * 
             * @return {Object}
             */
            getLastPing: apiFunction.bind(null, "getLastPing"),
        });
        
        register(null, { metrics: plugin });
    }
});