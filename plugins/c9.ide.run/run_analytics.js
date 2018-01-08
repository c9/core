define(function(require, exports, module) {
    main.consumes = [
        "run", "output", "c9.analytics", "analytics.cookie"
    ];
    main.provides = ["run_analytics"];
    module.exports = main;
    
    return main;

    function main(options, imports, register) {
        var analytics = imports["c9.analytics"];
        var cookie = imports["analytics.cookie"];
        var run = imports.run;
        var output = imports.output;
        var COOKIE_RUNNERS_NAME = "c9_runners_timestamp"; 
        
        var analyticsOptions = {
            integrations: {
                "All": false
            }
        };
        
        run.on("create", function(e) {
            if (!e.process.runner)
                return;
            // Gets called whenever one creates a new process
            var runner = e.process.runner;
            var builtin = runner.$builtin;
            var runnerName = runner.caption;
            var cmdLength = runner.cmd && runner.cmd.length;
            var properties = {
                builtin: builtin,
                runnerName: runnerName,
                numParamsInCommand: cmdLength
            };
            
            // Once a day, if the Runner isn't used yet, track in all providers
            try {
                var rCookie = JSON.parse(cookie.get(COOKIE_RUNNERS_NAME));
                
                if (!rCookie[runnerName] || 
                    !rCookie[runnerName].lastTimeLogged || 
                    rCookie[runnerName].lastTimeLogged === "" || 
                    new Date(parseInt(rCookie[runnerName].lastTimeLogged, 
                        10)).getDate() != new Date().getDate()) {
                        sendToAllIntegrations(rCookie);
                }
            }
            catch (e) {
                sendToAllIntegrations(rCookie);
            }
            
            function sendToAllIntegrations(rCookie) {
                analyticsOptions.integrations["Mixpanel"] = true;
                
                rCookie = rCookie ? rCookie : {};
                rCookie[runnerName] = { lastTimeLogged: Date.now() };
                cookie.set(COOKIE_RUNNERS_NAME, JSON.stringify(rCookie), 1);
            }
        });

        // "runConfigSaved" is fired on every change & IDE load, so discarding
        // Send event when Runner Name changes, which is effectively saving a 
        // Runner Config
        output.on("runnerNameChanged", function(name) {
            analyticsOptions.integrations["Mixpanel"] = true;
            var properties = {
                runnerName: name
            };
            analytics.track("Runner Config Saved", properties, 
                analyticsOptions);
        });
        // Send event when CWD is set
        output.on("cwdSet", function(cwd) {
            // we don't want to send the exact CWD (privacy), but it's 
            // interesting to know if it differs from the root
            var properties = {
                isRoot: true
            };
            if (cwd != "/")
                properties.isRoot = false;
            analytics.track("CWD Set On Runner", properties, analyticsOptions);
        });
        // Send event when Environment variables are set
        output.on("envSet", function(envVariable, config) {
            var properties = {
                numEnvironmentVariables: Object.keys(config).length
            };
            analytics.track("Environment Variables Set On Runner", properties, 
                analyticsOptions);
        });
        
        register(null, {
            "run_analytics": {}
        });
    }
});
