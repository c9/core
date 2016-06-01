/**
 * Server-side support for A/B testing experiments.
 * 
 * Note that this plugin demands users and user IDs for most of its API,
 * where this is optional in the client-side implementation.
 */
main.consumes = ["analytics"];
main.provides = ["abtesting"];
module.exports = main;

function main(options, imports, register) {
    var analytics = imports["analytics"];
    var outplan = require("outplan");
        
    var MS_PER_DAY = 1000 * 60 * 60 * 24;
    
    outplan.configure({
        logFunction: function(e) {
            var label = e.name + " - " + e.event;
            analytics.track(label, { variation: e.params.name });
        }
    });
        
    function create(name, choices, options) {
        return outplan.create(name, choices, options);
    }
    
    function expose(experimentName, userId, options) {
        return outplan.expose(experimentName, userId, options);
    }
    
    function isUserCreatedAfter(experimentDate, user) {
        if (!user || !user.date_add)
            throw new Error("Expected: user");
        var diffDays = (experimentDate - Date.now()) / MS_PER_DAY;
        if (diffDays > 20) {
            // Sanity check: new Date() takes zero-based month argument, one-based day argument
            throw new Error("Passed a date far in the future to isUserCreatedAfter()");
        }
        return user.date_add > experimentDate;
    }

    register(null, {
        "abtesting": {
            /**
             * Create a new experiment. Alias for require("outplan").create()
             * 
             * @param {String} name
             *        The name of the experiment.
             * @param {String[]|Object[]} choices
             *        A list of variations, e.g. ["A", "B"],
             *        or variation objects, e.g. [{ name: "A", color: "#AAA" }, { name: "B", color: "#BBB" }]
             * @param {Object} [option]
             *        Options for the experiment. This may also include
             *        arguments for the distribution operator, e.g. weight.
             * @param {Function} [options.operator]
             *        The distribution operator, e.g. outplan.WeightedChoice.
             */
            create: create,
            
            /**
             * Get the selected variation of an experiment, and call the log function with
             * an "expose" event to track its exposure.
             * 
             * @param {String} name                 The experiment name.
             * @param {Number} userId               A unique identifier for the current user.
             * @param {Object} [options]            Options
             * @param {Boolean} [options.log=true]  Whether to log an "exposure event"
             */
            expose: expose,
            
            /**
             * Helper to determine if the current user was created after the start of an experiment.
             * 
             * @throws {Error} when a date in the future (~20 days from now) is passed.
             *         This error is thrown as a sanity check to make sure `new Date()`
             *         is called with a zero-based month argument (and a one-based day).
             * 
             * @param {Date} experimentDate
             * @param {Object} user               A user object
             * @param {Number} user.date_add
             */
            isUserCreatedAfter: isUserCreatedAfter,
        }
    });
}
