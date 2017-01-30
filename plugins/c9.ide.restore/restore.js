define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "Plugin", "ui", "vfs.endpoint", "vfs", "layout", "anims", "c9", 
        "c9.analytics", "layout"
    ];
    main.provides = ["restore"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var vfs = imports.vfs;
        var c9 = imports.c9;
        var anims = imports.anims;
        var layout = imports.layout;
        var endpoint = imports["vfs.endpoint"];
        var analytics = imports["c9.analytics"];
        
        /***** Initialization *****/
        
        var plugin = new Plugin("Ajax.org", main.consumes);
        var el, msgEl, detailsEl, descriptionEl, stickynoteEl, uiProgress;
        var timeoutTimer, timeoutEl;

        var MAX_HOT_WORKSPACES = "three";
        var TIMEOUT_TIME = 15 * 60 * 1000;

        var STATE_CREATED = 1;
        var STATE_READY = 2;
        var STATE_MIGRATING = 4;
        var STATE_MARKED_FOR_ARCHIVE = 20;
        var STATE_ARCHIVING = 21;
        var STATE_ARCHIVED = 22;
        var STATE_MARKED_FOR_RESTORE = 23;
        var STATE_RESTORING = 24;
        var STATE_RESIZING = 31;

        var stateMessages = {};
        stateMessages[STATE_CREATED] = "Creating your new workspace";
        stateMessages[STATE_READY] = "Starting your workspace";
        stateMessages[STATE_MIGRATING] = "Migrating your workspace to our new backend";
        stateMessages[STATE_MARKED_FOR_ARCHIVE] =
        stateMessages[STATE_ARCHIVING] = "Archiving your workspace";
        stateMessages[STATE_ARCHIVED] =
        stateMessages[STATE_MARKED_FOR_RESTORE] =
        stateMessages[STATE_RESTORING] = "Waking up your workspace from hibernation.";
        stateMessages[STATE_RESIZING] = "Resizing your workspace";
        var defaultStateMessage = "Opening your workspace";
        
        var description = 
            "<strong>You could be coding right now</strong>\n" +
            "<p>\n" +
            "In order to provide a free\n" +
            "service for everyone, we stop workspaces after a while.\n" +
            "<p>\n" +
            "Premium plans offer active workspaces, which ensure that the " + MAX_HOT_WORKSPACES + "\n" +
            "most recently used workspaces are never stopped.\n" +
            "<p>\n" +
            "<a class='restore-upsell' data-link-id='upsell-webide-migrate' href='" + options.ideBaseUrl + "/account/upgrade/webide' target='_blank'>Upgrade to premium now</a>";
            
        var premiumStoppedDescription =
            "<strong>Swapping in Workspace</strong>\n" +
            "<p>\n" +
            "This workspace is not one of your active workspaces and has been stopped.\n" +
            "<p>\n" +
            "The " + MAX_HOT_WORKSPACES + " most recently used workspaces are never stopped.\n" +
            "<p>\n" +
            "As part of a team plan you have more active workspaces.\n" +
            "<p>\n" +
            "<a class='restore-upsell' data-link-id='upsell-teams-migrate' href='" + options.ideBaseUrl + "/account/billing' target='_blank'>Upgrade to team plans now</a>";
            
        var migrateDescription = 
            "<strong>What's going on here?</strong>\n" +
            "<p>\n" +
            "We rolled out a completely new backend infrastructure with \n" +
            "improved performance and lots of new features.\n" +
            "<p>\n" +
            "With the new backend you get:\n" +
            "<ul>\n" +
            "<li>an Ubuntu VM</li>\n" +
            "<li>root access using sudo</li>\n" +
            "<li>ability to run services</li>\n" +
            "<li>ability to install packages</li>\n" +
            "</ul>\n" +
            "<p>\n" +
            "Please wait a moment while we move your workspace. It will\n" +
            "be just as you left it.\n";
        
        var premiumDescription =
            "<strong>What's going on here?</strong>\n" +
            "<p>\n" +
            "We're migrating your premium workspace to a new server \n" +
            "to ensure optimal performance.\n" +
            "<p>\n" +
            "Please wait a moment while we move your workspace. It will\n" +
            "be just as you left it.\n";
            
        var resizeDescription =
            "<strong>What's going on here?</strong>\n" +
            "<p>\n" +
            "We're resizing your workspace\n" +
            "to be exactly as you specified.\n" +
            "<p>\n" +
            "Please wait a moment while we resize your workspace.\n" +
            "It will be just as you left it.\n";

        var stateDescriptions = {
            free: { casual: [STATE_MIGRATING, STATE_RESIZING]},
            premium: { casual: [STATE_MIGRATING, STATE_MARKED_FOR_ARCHIVE, STATE_ARCHIVING, STATE_ARCHIVED, STATE_MARKED_FOR_RESTORE, STATE_RESTORING, STATE_RESIZING]},
        };
        
        stateDescriptions.free[STATE_CREATED] = "";
        stateDescriptions.free[STATE_READY] = description;
        stateDescriptions.free[STATE_MIGRATING] = migrateDescription; // different location
        stateDescriptions.free[STATE_MARKED_FOR_ARCHIVE] = description;
        stateDescriptions.free[STATE_ARCHIVING] = description;
        stateDescriptions.free[STATE_ARCHIVED] = description;
        stateDescriptions.free[STATE_MARKED_FOR_RESTORE] = description;
        stateDescriptions.free[STATE_RESTORING] = description;
        stateDescriptions.free[STATE_RESIZING] = resizeDescription; // different location

        stateDescriptions.premium[STATE_CREATED] = "";
        stateDescriptions.premium[STATE_READY] = premiumStoppedDescription;
        stateDescriptions.premium[STATE_MIGRATING] = migrateDescription; // different location
        stateDescriptions.premium[STATE_MARKED_FOR_ARCHIVE] = premiumDescription; // different location
        stateDescriptions.premium[STATE_ARCHIVING] = premiumDescription; // different location
        stateDescriptions.premium[STATE_ARCHIVED] = premiumDescription; // different location
        stateDescriptions.premium[STATE_MARKED_FOR_RESTORE] = premiumDescription; // different location
        stateDescriptions.premium[STATE_RESTORING] = premiumDescription; // different location
        stateDescriptions.premium[STATE_RESIZING] = resizeDescription; // different location

        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;
            
            endpoint.on("restore", showRestore);
            vfs.on("connect", hideRestore);
        }
        
        var drawn = false;
        function draw() {
            if (drawn) return false;
            drawn = true;
            
            ui.insertCss(require("text!./restore.css"), plugin);
            ui.insertHtml(null, require("text!./restore.html"), plugin);
            
            el = document.getElementById("c9_ide_restore");
            msgEl = document.querySelector("#c9_ide_restore .loading-msg");
            detailsEl = document.querySelector("#c9_ide_restore .loading-details");
            descriptionEl = document.querySelector("#c9_ide_restore .paper");
            stickynoteEl = document.querySelector("#c9_ide_restore .stickynote");
            uiProgress = document.querySelector("#progress_bar .ui-progress");
            timeoutEl = document.querySelector("#c9_ide_restore .timeout");
        }
        
        /***** Methods *****/
        
        var progress, maxProgress, run = 0, timer;
        
        function animateProgress(progress, callback) {
            anims.animate(uiProgress, {
                width: progress + "%",
                timingFunction: "cubic-bezier(.02, .01, .47, 1)",
                duration: "1s"
            }, callback);
        }
        
        function walk(loopId) {
            if (loopId != run) return;
            
            if (progress > 100)
                return;
                
            if (progress > maxProgress)
                return (timer = setTimeout(walk.bind(null, loopId), 500));
            
            animateProgress(progress++, function() { 
                timer = setTimeout(walk.bind(null, loopId), 10); 
            });
        }
        
        function showTimeout() {
            timeoutEl.style.display = "block";
        }
        
        function showRestore(state) {
            draw();
            
            c9.startLoadTime = -1;
            
            if (el.style.display != "block") {
                uiProgress.style.width = 0;
                progress = 6;
                maxProgress = 10;
            }
            
            var isDark = layout.theme.indexOf("dark") > -1;
            if (isDark)
                el.classList.add("dark");
            else
                el.classList.remove("dark");

            var descriptions = stateDescriptions[state.premium ? "premium" : "free"];
            var description = descriptions[state.projectState || STATE_ARCHIVED];
            msgEl.innerText = stateMessages[state.projectState || STATE_ARCHIVED] || defaultStateMessage;

            if (description) {
                descriptionEl.innerHTML = description;
                var link = descriptionEl.querySelector("a.restore-upsell");
                if (link)
                    link.addEventListener("click", trackLink, false);
                    
                stickynoteEl.style.display = "block";
                
                if (~descriptions.casual.indexOf(state.projectState || STATE_ARCHIVED))
                    stickynoteEl.classList.add("casual");
                else
                    stickynoteEl.classList.remove("casual");
            }
            else {
                stickynoteEl.style.display = "none";
            }
            
            // we did not receive JSON
            if (!state.progress || state.progress.nextProgress == 100)
                return hideRestore();
            
            // Display Message to the User
            if (!/^Internal/.test(state.progress.message))
                detailsEl.innerText = state.progress.message || "";
                
            // Update Progress Bar
            maxProgress = Math.max(maxProgress || 0, state.progress.nextProgress);
            progress = Math.max(progress || 0, state.progress.progress);
            
            walk(++run);
            
            // Show Restore Screen
            el.style.display = "block";
            // disable ide shortcuts
            window.addEventListener("keypress", stopEvent, true);
            window.addEventListener("keydown", stopEvent, true);
            window.addEventListener("keyup", stopEvent, true);
            
            
            clearTimeout(timeoutTimer);
            timeoutTimer = setTimeout(function() {
                showTimeout();
            }, TIMEOUT_TIME);
        }
        
        function trackLink(e) {
            var el = e.target;
            analytics.track("Clicked Internal Link", {
                href: el.href,
                linkId: el.dataset.linkId
            });
        }

        function hideRestore() {
            window.removeEventListener("keypress", stopEvent, true);
            window.removeEventListener("keydown", stopEvent, true);
            window.removeEventListener("keyup", stopEvent, true);
            
            if (!el) return;
            
            clearTimeout(timer);
            
            progress = 101;
            animateProgress(100, function() {
                setTimeout(function() {
                    anims.animate(el, {
                        opacity: 0
                    }, function() {
                        el.style.display = "none";
                        el.style.opacity = 1;
                        
                        timeoutEl.style.display = "";
                    });
                }, 100);
            });
            
        }
        
        function stopEvent(e) {
            e.stopPropagation();
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });

        /***** Register and define API *****/

        /**
         * 
         **/
        plugin.freezePublicAPI({
            show: showRestore,
            hide: hideRestore
        });
        
        register(null, { "restore": plugin });
    }
});
