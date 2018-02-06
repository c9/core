define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "Plugin", "c9", "ui", "ace", "tabManager", "settings", "menus", 
        "commands", "save", "layout", "util"
    ];
    main.provides = ["timeslider"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var c9 = imports.c9;
        var ui = imports.ui;
        var ace = imports.ace;
        var util = imports.util;
        var tabs = imports.tabManager;
        var settings = imports.settings;
        var menus = imports.menus;
        var layout = imports.layout;
        var commands = imports.commands;
        var save = imports.save;

        var html = require("text!./timeslider.html");
        var css = require("text!./timeslider.css");
        var dom = require("ace/lib/dom");

        var isLoading;

        var tsVisibleKey = "user/collab/@timeslider-visible";
        // timeslider keyboard handler
        var timesliderKeyboardHandler = {
            handleKeyboard: function(data, hashId, keystring) {
                if (keystring == "esc") {
                    forceHideSlider();
                    return { command: "null" };
                }
            }
        };

        // UI elements
        var container, timeslider, timesliderClose, slider;
        var sliderBar, handle, playButton, playButtonIcon, revisionInfo;
        var revisionDate, revisionLabel, leftStep, rightStep, revertButton;
        var sliderProgress, activeDocument;

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        var sliderLength = 1000;
        var sliderPos = 0;
        var sliderActive = false;
        var savedRevisions = [];
        var savedRevisionNums = [];
        var sliderPlaying = false;
        // This number is calibrated from UI experimentation
        var LEFT_PADDING = 64;

        var loaded = false;
        function load(callback) {
            if (loaded) return false;
            loaded = true;

            commands.addCommand({
                name: "toggleTimeslider",
                exec: toggleTimeslider,
                isAvailable: timesliderAvailable
            }, plugin);

            commands.addCommand({
                name: "forceToggleTimeslider",
                exec: function() {
                    var isVisible = settings.getBool(tsVisibleKey);
                    settings.set(tsVisibleKey, !isVisible);
                    toggleTimeslider();
                },
                isAvailable: timesliderAvailable
            }, plugin);

            menus.addItemByPath("File/Show File Revision History", new ui.item({
                type: "check",
                checked: "" + tsVisibleKey + "",
                command: "toggleTimeslider"
            }), 1240, plugin);
            
            menus.addItemByPath("File/~", new ui.divider(), 1250, plugin);

            settings.on("read", function () {
                // force-hide-timeslider with initial loading
                settings.set(tsVisibleKey, false);
            }, plugin);

            // right click context item in ace
            var mnuCtxEditorFileHistory = new ui.item({
                caption: "File History",
                command: "forceToggleTimeslider"
            }, plugin);

            ace.getElement("menu", function(menu) {
                menus.addItemToMenu(menu, mnuCtxEditorFileHistory, 500, plugin);
                menus.addItemToMenu(menu, new ui.divider(), 550, plugin);
                menu.on("prop.visible", function(e) {
                    // only fire when visibility is set to true
                    if (e.value) {
                        var editor = tabs.focussedTab.editor;
                        if (timesliderAvailable(editor))
                            mnuCtxEditorFileHistory.enable();
                        else
                            mnuCtxEditorFileHistory.disable();
                    }
                });
            });

            tabs.on("paneDestroy", function (e) {
                if (!tabs.getPanes(tabs.container).length)
                    forceHideSlider();
            }, plugin);

            tabs.on("focusSync", function(e) {
                util.nextFrame(function() {
                    var doc = getTabCollabDocument(e.tab);
                    if (activeDocument && isVisible) {
                        if (activeDocument == doc) return;
                        hide();
                        isVisible = true;
                    }
                    activeDocument = doc;
                    if (!isVisible)
                        return;
                    if (!doc)
                        return forceHideSlider();
                    show();
                    doc.loadRevisions();
                });
            }, plugin);

            save.on("beforeSave", function(e) {
                if (isVisible)
                    return false;
            }, plugin);

            plugin.on("slider", function (revNum) {
                if (!activeDocument || !isVisible)
                    return;
                schedule(revNum);
            });
        }
        
        var scheduled, lastRevNum;
        function schedule(revNum) {
            lastRevNum = revNum;
            if (scheduled) return;

            util.nextFrame(function() {
                lastRevNum && activeDocument.updateToRevision(lastRevNum);
                scheduled = false;
            });
        }

        var drawn = false;
        function draw () {
            if (drawn) return;
            drawn = true;

            ui.insertHtml(null, html, plugin);
            ui.insertCss(css, null, plugin);

            function $(id) {
                return document.getElementById(id);
            }

            var ext = $("timeslider-top");
            timeslider = $("timeslider");
            timesliderClose = $("timeslider_close");
            slider = $("timeslider-slider");
            sliderBar = $("ui-slider-bar");
            sliderProgress = $("ui-slider-progress");
            handle = $("ui-slider-handle");
            playButton = $("playpause_button");
            playButtonIcon = $("playpause_button_icon");
            revisionInfo = $("revision_info");
            revisionDate = $("revision_date");
            revisionLabel = $("revision_label");
            leftStep = $("leftstep");
            rightStep = $("rightstep");
            revertButton = $("revert_to_rev");

            var tbcont = tabs.container;
            var box = new ui.vsplitbox({});
            tbcont.parentNode.insertBefore(box, tbcont.nextSibling);
            container = box.appendChild(new ui.bar({ height: 64 }));
            container.$ext.appendChild(ext);
            box.appendChild(tbcont);
            box.$ext.style.top = 0; // Works around an APF bug

            timesliderClose.addEventListener("click", forceHideSlider);

            disableSelection(playButton);
            disableSelection(timeslider);

            layout.on("resize", function() {
                updateSliderElements();
            }, plugin);

            slider.addEventListener("mousedown", function(evt) {
                if (evt.target.className == "star" && !sliderActive)
                    onBarMouseDown(evt);
            });
            
            sliderBar.addEventListener("mousedown", onBarMouseDown);

            // Slider dragging
            handle.addEventListener("mousedown", onHandleMouseDown);

            // play/pause toggling
            playButton.addEventListener("mousedown", function(evt) {
                playButton.addEventListener("mouseup", function onMouseUp(evt2) {
                    playButton.removeEventListener("mouseup", onMouseUp);
                    playpause();
                });
                document.addEventListener("mouseup", function onMouseUp(evt2) {
                    document.removeEventListener("mouseup", onMouseUp);
                });
            });

            revertButton.addEventListener("click", function() {
                if (!isRevertAvailable())
                    return console.log("Revert not available");
                console.log("Revert", activeDocument.id, "to rev", sliderPos);
                hide();
                activeDocument.revertToRevision(sliderPos);
            });

            // next/prev revisions and changeset
            var steppers = [leftStep, rightStep];
            steppers.forEach(function (stepper) {
                stepper.addEventListener("mousedown", function(evt) {
                    var origcss = stepper.style["background-position"];
                    if (!origcss)
                        origcss = stepper.style["background-position-x"].split("px")[0] + " " + stepper.style["background-position-y"].split("px")[0];
                    var origpos = parseInt(origcss.split(" ")[1], 10);
                    var newpos = origpos - 43;
                    if (newpos < 0)
                        newpos += 87;

                    var newcss = (origcss.split(" ")[0] + " " + newpos + "px");
                    if (stepper.style.opacity != 1.0)
                        newcss = origcss;

                    stepper.style["background-position"] = newcss;

                    var pos, nextStar, i;

                    stepper.addEventListener("mouseup", function onMouseUp(evt2) {
                        stepper.style["background-position"] = origcss;
                        stepper.removeEventListener("mouseup", onMouseUp);
                        // document.removeEventListener("mouseup", onMouseUp);
                    });
                    document.addEventListener("mouseup", function onMouseUp(evt2) {
                        stepper.style["background-position"] = origcss;
                        document.removeEventListener("mouseup", onMouseUp);
                        // stepper.removeEventListener("mouseup", onMouseUp);
                    });
                    
                    var id = stepper.id;
                    if (id == "leftstep") {
                        setSliderPosition(sliderPos - 1);
                    }
                    else if (id == "rightstep") {
                        setSliderPosition(sliderPos + 1);
                    }
                    else if (id == "leftstar") {
                        nextStar = 0; // default to first revision in document
                        for (i = 0; i < savedRevisionNums.length; i++) {
                            pos = savedRevisionNums[i];
                            if (pos < sliderPos && nextStar < pos)
                                nextStar = pos;
                        }
                        setSliderPosition(nextStar);
                    }
                    else if (id == "rightstar") {
                        nextStar = sliderLength; // default to last revision in document
                        for (i = 0; i < savedRevisionNums.length; i++) {
                            pos = savedRevisionNums[i];
                            if (pos > sliderPos && nextStar > pos)
                                nextStar = pos;
                        }
                        setSliderPosition(nextStar);
                    }
                });
            });

            emit("draw");
        }

        /***** Methods *****/

        function disableSelection(element) {
            element.onselectstart = function() {
                return false;
            };
            element.unselectable = "on";
            element.style.MozUserSelect = "none";
            element.style.cursor = "default";
        }

        function cumulativeOffset(element) {
            var top = 0, left = 0;
            do {
                top += element.offsetTop || 0;
                left += element.offsetLeft || 0;
                element = element.offsetParent;
            } while (element);

            return {
                top: top,
                left: left
            };
        }
        
        function setHandleLeft(pos) {
            handle.style.left = pos + "px";
            sliderProgress.style.width = (pos - sliderBar.offsetLeft + 10) + "px";
        }

        function onBarMouseDown(evt) {
            var newloc = evt.clientX - cumulativeOffset(sliderBar).left;
            var newSliderPos = Math.round(newloc * sliderLength / (sliderBar.offsetWidth - 2));
            setHandleLeft(calcHandlerLeft(newSliderPos));
            onHandleMouseDown(evt);
        }

        function onHandleMouseDown(evt) {
            var startLoc = evt.clientX;
            var currentLoc = parseInt(handle.style.left.split("px")[0], 10);
            sliderActive = true;
            
            function calcSliderPos(clientX) {
                var newloc = currentLoc + (clientX - startLoc) - LEFT_PADDING;
                if (newloc < 0)
                    newloc = 0;
                var barWidth = sliderBar.offsetWidth - 2;
                if (newloc > barWidth)
                    newloc = barWidth;
                return Math.round(newloc * sliderLength / barWidth);
            }
            
            function clamp(clientX) {
                var newloc = currentLoc + (clientX - startLoc);
                var handleOverflow = (handle.offsetWidth / 2);
                if (newloc < sliderBar.offsetLeft - handleOverflow + 1)
                    newloc = sliderBar.offsetLeft - handleOverflow + 1;
                if (newloc > sliderBar.offsetLeft + sliderBar.offsetWidth - handleOverflow - 1)
                    newloc = sliderBar.offsetLeft + sliderBar.offsetWidth - handleOverflow - 1;
                return newloc;
            }

            function onMouseMove(evt2) {
                handle.style.pointer = "move";
                handle.style.transition = "none";
                sliderProgress.style.transition = "none";
                
                var newSliderPos = calcSliderPos(evt2.clientX);
                revisionLabel.textContent = "Version " + newSliderPos;
                setHandleLeft(clamp(evt2.clientX));
                if (sliderPos != newSliderPos) {
                    sliderPos = newSliderPos;
                    emit("slider", newSliderPos);
                }
            }

            function onMouseUp(evt2) {
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
                sliderActive = false;
                var newSliderPos = calcSliderPos(evt2.clientX);
                currentLoc = calcHandlerLeft(newSliderPos);
                setHandleLeft(currentLoc);
                // if (sliderPos != Math.round(newloc * sliderLength / ($("#ui-slider-bar").width()-2)))
                setSliderPosition(newSliderPos);
                
                handle.style.transition = "left .1s";
                sliderProgress.style.transition = "width .1s";
            }

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        }

        function isRevertAvailable() {
            return !sliderPlaying && !sliderActive &&
                !isLoading && activeDocument &&
                sliderLength && sliderPos !== sliderLength;
        }

        var starWidth = 15;
        function updateSliderElements() {
            var prevX, prevStar, firstHidden;
            for (var i = 0; i < savedRevisions.length; i++) {
                var star = savedRevisions[i];
                var position = parseInt(star.pos, 10);
                var x = calcHandlerLeft(position) - 1;
                if (x - prevX < 2 * starWidth) {
                    if (prevStar)
                        prevStar.style.opacity = 0.15;
                    prevStar = star;
                    if (!firstHidden) {
                        firstHidden = x;
                    } else if (x - firstHidden > 5 * starWidth) {
                        firstHidden = prevStar = null;
                    }
                } else {
                    firstHidden = prevStar = null;
                }
                prevX = x;
                star.style.left = x + "px";
                star.style.opacity = 1;
            }
            setHandleLeft(calcHandlerLeft(sliderPos));
        }

        function addSavedRevision(revision) {
            var position = revision.revNum;
            var newSR = document.createElement("div");
            newSR.className = "star";
            newSR.title = "File Saved on " + dateFormat(revision.updated_at);
            newSR.pos = position;
            newSR.style.left = (calcHandlerLeft(position) - 1) + "px";
            slider.appendChild(newSR);
            newSR.addEventListener("mouseup", function() {
                setSliderPosition(position);
            });
            savedRevisions.push(newSR);
            savedRevisionNums.push(position);
            if (position === sliderPos)
                setSliderPosition(position);
        }

        function setSavedRevisions(revisions) {
            toArray(slider.getElementsByClassName("star")).forEach(function (star) {
                star.remove();
            });
            savedRevisions = [];
            savedRevisionNums = [];
            revisions.forEach(function(revision) {
                addSavedRevision(revision);
            });
        }

        function toArray(arg) {
            return Array.prototype.slice.apply(arg);
        }

        function zpad(str, length) {
            str = str + "";
            while (str.length < length)
            str = "0" + str;
            return str;
        }

        function dateFormat(time) {
            var date = new Date(time);
            var month = ["Jan", "Feb", "March", "April", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"][date.getMonth()];
            var day = zpad(date.getDate(), 2);
            var year = date.getFullYear();
            var hours = zpad(date.getHours(), 2);
            var minutes = zpad(date.getMinutes(), 2);
            var seconds = zpad(date.getSeconds(), 2);
            return ([month, " ", day, ", ", year, " ", hours, ":", minutes, ":", seconds].join(""));
        }

        function updateTimer(time) {
            revisionDate.textContent = dateFormat(time);
        }

        function calcHandlerLeft(pos) {
            var left = pos * (sliderBar.offsetWidth - 2) / (sliderLength * 1.0);
            left = (left || 0) + LEFT_PADDING;
            return left;
        }

        function setSliderPosition(newpos) {
            newpos = Number(newpos);
            if (newpos < 0 || newpos > sliderLength) return;

            setHandleLeft(calcHandlerLeft(newpos));

            if (savedRevisionNums.indexOf(newpos) === -1) {
                revisionLabel.textContent = "Version " + newpos;
                revisionLabel.className = "revision_label";
            }
            else {
                revisionLabel.textContent = "Saved Version " + newpos;
                revisionLabel.className = "revision_label saved";
            }

            if (newpos === 0)
                leftStep.className = "stepper disabled";
            else
                leftStep.className = "stepper";

            if (newpos == sliderLength)
                rightStep.className = "stepper disabled";
            else
                rightStep.className = "stepper";

            sliderPos = newpos;
            updateRevertVisibility();

            emit("slider", newpos);
        }

        function updateRevertVisibility() {
            if (isRevertAvailable())
                revertButton.className = "revert";
            else
                revertButton.className = "revert disabled";
        }

        function getSliderLength() {
            return sliderLength;
        }

        function setSliderLength(newlength) {
            sliderLength = newlength;
            updateSliderElements();
        }

        function playButtonUpdater() {
            if (sliderPlaying) {
                if (sliderPos + 1 > sliderLength) {
                    dom.toggleCssClass(playButtonIcon, "pause");
                    sliderPlaying = false;
                    return;
                }
                setSliderPosition(sliderPos + 1);

                setTimeout(playButtonUpdater, 100);
            }
        }

        function playpause() {
            if (!isVisible)
                return console.error("[Timeslider] Can't playpause while not visible");
            dom.toggleCssClass(playButtonIcon, "pause");

            if (!sliderPlaying) {
                if (sliderPos == sliderLength) setSliderPosition(0);
                sliderPlaying = true;
                playButtonUpdater();
            }
            else {
                sliderPlaying = false;
                updateRevertVisibility();
            }
        }

        function getCodeEditorTab() {
            return $(".codeditorHolder .hsplitbox");
        }

        var isVisible = false;
        var resizeInterval;
        
        function useStoredState(e) {
            if (e.state.filter && e.doc.meta.$storedState1)
                e.state = e.doc.meta.$storedState1;
            else if (!e.state.filter && e.doc.meta.$storedState0)
                e.state = e.doc.meta.$storedState0;
        }

        function show() {
            draw();
            container.show();

            clearInterval(resizeInterval);
            var oldWidth = timeslider.offsetWidth;
            resizeInterval = setInterval(function () {
                if (timeslider.offsetWidth !== oldWidth) {
                    updateSliderElements();
                    oldWidth = timeslider.offsetWidth;
                }
            }, 100);
            isVisible = true;

            if (activeDocument) {
                var tab = activeDocument.original.tab;
                var aceEditor = tab.editor.ace;
                aceEditor.setReadOnly(true);
                aceEditor.keyBinding.addKeyboardHandler(timesliderKeyboardHandler);
                aceEditor.renderer.onResize(true);
                
                var doc = activeDocument.original;
                doc.meta.$storedState0 = doc.getState();
                doc.meta.$storedState1 = doc.getState(true);
                doc.on("getState", useStoredState);
            }

            emit("visible", isVisible);
        }

        function hide() {
            draw();
            if (sliderPlaying)
                playpause();

            container.hide();
            clearInterval(resizeInterval);
            isVisible = false;

            if (activeDocument) {
                if (activeDocument.loaded)
                    activeDocument.updateToRevision();

                var tab = activeDocument.original.tab;
                var aceEditor = tab.editor.ace;
                aceEditor.keyBinding.removeKeyboardHandler(timesliderKeyboardHandler);
                aceEditor.setReadOnly(!!c9.readonly);
                aceEditor.renderer.onResize(true);
                
                var doc = activeDocument.original;
                delete doc.meta.$storedState0;
                delete doc.meta.$storedState1;
                doc.off("getState", useStoredState);
            }

            emit("visible", isVisible);
        }

        function getTabCollabDocument(tab) {
            var session = tab.path && tab.document.getSession();
            if (!session) return false;
            var aceSession = session.session;
            return aceSession && aceSession.collabDoc;
        }

        function toggleTimeslider() {
            if (isVisible) {
                activeDocument && activeDocument.loaded && activeDocument.updateToRevision();
                lastRevNum = null;
                hide();
            }
            else {
                // ide.dispatchEvent("track_action", {type: "timeslider"});
                show();
                lastRevNum = null;
                activeDocument && activeDocument.loadRevisions();
            }
        }

        function timesliderAvailable(editor) {
            if (!editor || editor.type !== "ace")
                return false;
            var aceEditor = editor.ace;
            var collabDoc = aceEditor.session.collabDoc;
            return !!collabDoc;
        }

        function forceHideSlider() {
            var tsVisible = isVisible || settings.getBool(tsVisibleKey);
            if (tsVisible) {
                settings.set(tsVisibleKey, false);
                toggleTimeslider();
            }
        }

        function setLoading(loading) {
            if (loading === isLoading)
                return;
            isLoading = loading;

            if (loading) {
                // playButton.style["background-image"] = "url("+ staticPrefix + "/images/loading.gif)";
                // playButton.style.margin = "7px 0px 0px 5px";
                // playButtonIcon.style.display = revisionInfo.style.display = "none";
                setSavedRevisions([]);
            }
            else {
                // playButton.style["background-image"] = "url(" + staticPrefix + "/images/play_depressed.png)";
                // playButton.style.margin = "";
                // playButtonIcon.style.display = revisionInfo.style.display = "block";
            }
        }

        /***** Lifecycle *****/
        plugin.on("load", function() {
            load();
        });
        plugin.on("enable", function() {

        });
        plugin.on("disable", function() {

        });
        plugin.on("unload", function() {
            loaded = false;
            drawn = false;
        });

        /***** Register and define API *****/

        /**
         * The timeslider allowing users to naigate through the file revision history, revert, step back and forth
         * @singleton
         */
        plugin.freezePublicAPI({
            /**
             * Specifies wether the timeslider is visible or not
             * @property {Boolean} visible
             */
            get visible() { return isVisible; },
            /**
             * Specifies wether the timeslider is in a loading state
             * If true, then: the collab document is fetching the revisions from the collab server
             * @property {Boolean} loading
             */
            get loading() { return isLoading; },
            /**
             * Sets the loading state of the timeslider to match its active document's revisions fetching
             * @property {Boolean} loading
             */
            set loading(value) { setLoading(value); },
            /**
             * Gets the timeslider's active document or null, if not any
             * @property {Document} activeDocument
             */
            get activeDocument() { return activeDocument; },
            /**
             * Gets the timeslider's slider length
             * @property {Number} sliderLength
             */
            get sliderLength() { return getSliderLength(); },
            /**
             * Sets the timeslider's slider length
             * @property {Number} sliderLength
             */
            set sliderLength(len) { setSliderLength(len); },
            /**
             * Gets the timeslider's slider position
             * @property {Number} sliderPosition
             */
            get sliderPosition() { return sliderPos; },
            /**
             * Sets the timeslider's slider position
             * @property {Number} sliderPosition
             */
            set sliderPosition(pos) { setSliderPosition(pos); },
            /**
             * Update the revision timer element on the slider
             * @param {Date} time
             */
            updateTimer: updateTimer,
            /**
             * Update the saved revisions to be displayed as stars on the slider
             * @param [{Revision}] revisions
             */
            setSavedRevisions: setSavedRevisions,
            /**
             * Show the timeslider and load the current focussed tab's revisions into the UI
             */
            show: show,
            /**
             * Hide the timeslider element and revert the activeDocument contents to the latest revision
             */
            hide: hide,
            /**
             * Trigger the play or pause on the timeslider
             */
            playpause: playpause,
            /**
             * Add a just-saved star revision to the timeslider
             * @param {Revision} revision
             */
            addSavedRevision: addSavedRevision
        });

        register(null, {
            timeslider: plugin
        });
    }
});
