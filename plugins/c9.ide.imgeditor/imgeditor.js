define(function(require, exports, module) {
    main.consumes = [
        "Editor", "editors", "ui", "save", "vfs", "layout", "watcher", 
        "settings", "dialog.error", "c9"
    ];
    main.provides = ["imgeditor"];
    return main;

    function main(options, imports, register) {
        var ui = imports.ui;
        var c9 = imports.c9;
        var vfs = imports.vfs;
        var save = imports.save;
        var layout = imports.layout;
        var watcher = imports.watcher;
        var Editor = imports.Editor;
        var editors = imports.editors;
        var settings = imports.settings;
        var showError = imports["dialog.error"].show;
        
        var event = require("ace/lib/event");
        var Pixastic = require("./lib_pixastic");
        
        var loadedFiles = {};
        
        /***** Initialization *****/
        
        var extensions = ["bmp", "djv", "djvu", "jpg", "jpeg", 
                          "pbm", "pgm", "png", "pnm", "ppm", "psd", "tiff", 
                          "xbm", "xpm"];
        
        var handle = editors.register("imgeditor", "Image Editor", ImageEditor, extensions);
        
        var drawn;
        handle.draw = function() {
            if (drawn) return;
            drawn = true;
            
            // Insert CSS
            ui.insertCss(require("text!./style.css"), null, handle);
        };
        
        // @todo revert to saved doesnt work (same for file watcher reload)
        // @todo getState/setState
        // @todo keep canvas reference on session and remove loadedFiles
        // @Todo for later - add undo stack
        function UndoItem(original, changed, apply) {
            this.getState = function() { };
            this.undo = function() { 
                apply(original);
            };
            this.redo = function() { 
                apply(changed);
            };
        }
        // undoManager.on("itemFind", function(e) {
        //     return new Item(e.state[0], e.state[1]);
        // });
        
        function ImageEditor() {
            var plugin = new Editor("Ajax.org", main.consumes, extensions);
            
            var BGCOLOR = { 
                "flat-light": "#F1F1F1", 
                "flat-dark": "#3D3D3D",
                "light": "#D3D3D3", 
                "light-gray": "#D3D3D3",
                "dark": "#3D3D3D",
                "dark-gray": "#3D3D3D" 
            };
            var img, canvas, activeDocument, rect, crop, zoom, smooth, info, rectinfo;
            var editor;
            
            plugin.on("draw", function(e) {
                handle.draw();
                
                ui.insertMarkup(e.tab, require("text!./imgeditor.xml"), plugin);
                
                var parent = plugin.getElement("parent");
                var btn1 = plugin.getElement("btn1");
                var btn3 = plugin.getElement("btn3");
                var btn4 = plugin.getElement("btn4");
                var btn5 = plugin.getElement("btn5");
                var btn6 = plugin.getElement("btn6");
                
                editor = plugin.getElement("imgEditor");
                crop = plugin.getElement("btn2");
                zoom = plugin.getElement("zoom");
                smooth = plugin.getElement("smooth");
                info = plugin.getElement("info");
                rectinfo = plugin.getElement("rectinfo");
                
                // Rectangle
                rect = document.createElement("div");
                editor.$ext.appendChild(rect);
                rect.className = "imgeditorrect";
                
                canvas = function() {
                    return editor.$ext.querySelector("canvas");
                };
                
                // Resize
                var mnuResize = plugin.getElement("resize-menu");
                btn1.setAttribute("submenu", mnuResize);
                plugin.addElement(mnuResize);
                
                var tbWidth = plugin.getElement("width");
                var tbHeight = plugin.getElement("height");
                var cbAspect = plugin.getElement("aspectratio");
                var btnResize = plugin.getElement("resize-button");
                
                btnResize.addEventListener("click", function() {
                    if (tbHeight.getValue() > 1 && tbWidth.getValue() > 1) {
                        exec("resize", {
                            width: tbWidth.getValue(),
                            height: tbHeight.getValue()
                        });
                    }
                });
                
                tbWidth.on("blur", function() {
                    if (cbAspect.checked) {
                        tbHeight.setAttribute("value", Math.round(canvas().offsetHeight 
                            * (tbWidth.getValue() / canvas().offsetWidth)));
                    }
                });
                tbHeight.on("blur", function() {
                    if (cbAspect.checked) {
                        tbWidth.setAttribute("value", Math.round(canvas().offsetWidth 
                            * (tbHeight.getValue() / canvas().offsetHeight)));
                    }
                });
                
                mnuResize.on("prop.visible", function(e) {
                    if (!e.value) return;
                    
                    tbWidth.setValue(canvas().offsetWidth);
                    tbHeight.setValue(canvas().offsetHeight);
                });
                
                // smooth
                smooth.on("afterchange", function(e) {
                    if (smooth.checked) {
                        ui.setStyleRule(".imgeditor canvas",
                            "-ms-interpolation-mode", "bicubic");
                        ui.setStyleRule(".imgeditor canvas",
                            "image-rendering", "auto");
                    }
                    else {
                        ui.setStyleRule(".imgeditor canvas",
                            "-ms-interpolation-mode", "nearest-neighbor");

                        ["-moz-crisp-edges", "-o-crisp-edges", 
                         "-webkit-optimize-contrast", "optimize-contrast",
                         "pixelated"].map(function(prop) {
                            ui.setStyleRule(".imgeditor canvas",
                                "image-rendering", prop);
                        });
                    }

                    var session = activeDocument.getSession();
                    session.smooth = smooth.checked;

                    settings.set("user/imgeditor/@smooth", smooth.checked);

                    clearRect();
                });

                // Zoom
                zoom.on("afterchange", function(e) {
                    ui.setStyleRule(".imgeditor canvas", 
                        apf.CSSPREFIX2 + "-transform", 
                        "scale(" + (zoom.value / 100) + ")");
                    
                    var session = activeDocument.getSession();
                    session.zoom = zoom.value;
                    
                    if (e.value) // User Change
                        settings.set("user/imgeditor/@zoom", zoom.value);
                    
                    clearRect();
                });
                
                // resize width/height
                crop.on("click", function() { exec("crop"); });
                btn3.on("click", function() { exec("rotate", { angle: -90 }); });
                btn4.on("click", function() { exec("rotate", { angle: 90 }); });
                btn5.on("click", function() { exec("fliph"); });
                btn6.on("click", function() { exec("flipv"); });
                
                editor.$ext.onmousemove = function(e) {
                    if (rect.style.display != "none")
                        return;
                    
                    var cnvs = canvas();
                    var pos = cnvs.getBoundingClientRect();
                    var left = e.clientX - pos.left;
                    var top = e.clientY - pos.top;
                    
                    var zoomLevel = zoom.value / 100;
                    if (left < 0 || top < 0 
                      || left > pos.width || top > pos.height)
                        left = top = 0;
                        
                    rectinfo.setAttribute("caption", 
                        "L: " + (left / zoomLevel) + "px, "
                        + "T: " + (top / zoomLevel) + "px");
                };
                
                editor.$ext.onmousedown = function(e) {
                    startRect(e);
                };
                
                function saveCanvas(path, value, callback) {
                    var dataURL = loadedFiles[path];
                    var blob = dataUriToBlob(dataURL); // atob(dataURL.split(',')[1]);
                    
                    // Alert watcher we are saving
                    watcher.ignore(path, 60000);
                    
                    // Save
                    vfs.rest(path, {
                        method: "PUT", 
                        body: blob
                    }, function(err, data, res) {
                        callback(err, data);
                        
                        watcher.ignore(path);
                    });
                }
                
                function dataUriToBlob(dataURI) {
                    // serialize the base64/URLEncoded data
                    var byteString;
                    if (dataURI.split(',')[0].indexOf('base64') >= 0) {
                        byteString = atob(dataURI.split(',')[1]);
                    }
                    else {
                        byteString = unescape(dataURI.split(',')[1]);
                    }
            
                    // parse the mime type
                    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
            
                    // construct a Blob of the image data
                    var array = [];
                    for (var i = 0; i < byteString.length; i++) {
                        array.push(byteString.charCodeAt(i));
                    }
                    return new Blob(
                        [new Uint8Array(array)],
                        { type: mimeString }
                    );
                }
                
                save.on("beforeSave", function(e) {
                    if (e.document.editor.type == "imgeditor") {
                        var path = e.document.tab.path;
                        
                        // Prevent unchanged files from being saved
                        if (!e.document.changed && path == e.path)
                            return false;
                        
                        if (e.document == activeDocument)
                            loadedFiles[e.path] = canvas().toDataURL();
                            
                        return saveCanvas;
                    }
                });
                
                // Not sure what this is supposed to do
                // save.on("afterSave", function(e) {
                //     console.log("afterfilesave");
                //     var path = e.document.tab.path;
                //     if (!path)
                //         return;
                    
                //     var newPath = e.doc && e.doc.getNode && e.doc.getNode().getAttribute("path");
                //     if (editor.value == e.oldpath && newPath !== e.oldpath) {
                //         var dataURL = _canvas.toDataURL();
                //         saveCanvas(newPath,dataURL);
                //         return false;
                //     }
                // });
        
                if (!editor.focus)
                    editor.focus = function() { return false;};
                
                editor.show();
            });
            
            /***** Method *****/
            
            function setPath(path, doc, callback) {
                if (!path) return;
                
                // Caption is the filename
                doc.title = path.substr(path.lastIndexOf("/") + 1);
                
                // Tooltip is the full path
                doc.tooltip = path;
                
                var fullpath = path.match(/^\w+:\/\//)
                    ? path
                    : vfs.url(path);
                    
                loadCanvas(doc.tab, fullpath, callback);
            }
            
            function loadCanvas(tab, path, callback) {
                var idx = tab.path;
                var cnvs = canvas();
                var ctx = cnvs.getContext("2d");
                var img = editor.$ext.querySelector("img");
                if (img) {
                    var src = img.src.replace(/\?[^?]+/, "");
                    if (src == path)
                        return;
                    img.parentNode.removeChild(img);
                }
                // TODO remove this when vfs sets correct cache headers on changed images
                path = path + "?" + Date.now();
                img = document.createElement("img");
                img.style.margin = "0 auto";
                editor.$ext.appendChild(img);
                
                // Enable CORS support
                if (c9.hosted)
                    img.crossOrigin = "Anonymous";
                
                if (path && !loadedFiles[idx]) {
                    tab.classList.add("connecting");
                    
                    var timer = setTimeout(function() {
                        img._cleanup();
                        showError("Image loading timed out");
                    }, 120 * 1000);
                    img.onload = function onLoad(e) {
                        var sizeCaption = "W:" + img.width + "px, H:" + img.height + "px";
                        info.setAttribute("caption", sizeCaption);
                        
                        cnvs.width = img.width;
                        cnvs.height = img.height;
                        cnvs.style.display = "inline-block";
                        img.style.display = "none";
                        
                        ctx.drawImage(img, 0, 0);
                        loadedFiles[idx] = cnvs.toDataURL();
                        
                        tab.classList.remove("connecting");
                        
                        img._cleanup();
                        
                        callback && callback(loadedFiles[idx]);
                    };
                    img.onerror = function() {
                        img._cleanup();
                        tab.classList.add("error");
                        
                        img.src = options.staticPrefix + "/images/sorry.jpg";
                        showError("Invalid or Unsupported Image Format");
                    };
                    img._cleanup = function() {
                        clearTimeout(timer);
                        img.onerror = img.onload = null;
                        if (img.parentNode)
                            img.parentNode.removeChild(img);
                        tab.classList.remove("connecting");
                    };

                    img.src = path;
                }
                else {
                    var tempImg = new Image();
                    tempImg.onload = function() {
                        cnvs.width = tempImg.width;
                        cnvs.height = tempImg.height;
                        cnvs.style.display = "inline-block";
                        
                        info.setAttribute("caption", 
                            "W:" + tempImg.width + "px, " +
                            "H:" + tempImg.height + "px");
                        
                        ctx.drawImage(tempImg, 0, 0);
                    };
                    
                    tempImg.src = loadedFiles[idx];
                    
                    callback && callback(loadedFiles[idx]);
                }
            }
            
            function startRect(e) {
                var container = rect.parentNode;
                var pos = container.getBoundingClientRect();
                var cnvs = canvas();
                var htmlNode = editor.$ext;
                
                var cnvsPos = cnvs.getBoundingClientRect();
                var xMin = cnvsPos.left - pos.left + htmlNode.scrollLeft;
                var yMin = cnvsPos.top - pos.top + htmlNode.scrollTop;
                var xMax = xMin + cnvsPos.width;
                var yMax = yMin + cnvsPos.height;
                function clampX(x) { return Math.min(Math.max(xMin, x), xMax); }
                function clampY(y) { return Math.min(Math.max(yMin, y), yMax); }
                
                var startX = clampX(e.clientX - pos.left + htmlNode.scrollLeft);
                var startY = clampY(e.clientY - pos.top + htmlNode.scrollTop);
                var moved, scrolled;
                
                event.capture(container, function onMove(e) {
                    var scrollLeft = htmlNode.scrollLeft;
                    var scrollTop = htmlNode.scrollTop;
                    var clientX = e.clientX - pos.left + scrollLeft;
                    var clientY = e.clientY - pos.top + scrollTop;
                    
                    if (scrolled) {
                        clearTimeout(scrolled);
                        scrolled = null;
                    }
                    
                    if (clientX > scrollLeft + pos.width) {
                        scrollLeft += clientX - scrollLeft - pos.width;
                        htmlNode.scrollLeft = scrollLeft;
                        if (scrollLeft < htmlNode.scrollWidth)
                            scrolled = true;
                    } else if (clientX < scrollLeft - 5) {
                        scrollLeft += clientX - scrollLeft;
                        htmlNode.scrollLeft = scrollLeft;
                        if (scrollLeft > 0)
                            scrolled = true;
                    }
                    if (clientY > scrollTop + pos.height) {
                        scrollTop += clientY - scrollTop - pos.height;
                        htmlNode.scrollTop = scrollTop;
                        if (scrollTop < htmlNode.scrollHeight)
                            scrolled = true;
                    } else if (clientY < scrollTop - 5) {
                        scrollTop += clientY - scrollTop;
                        htmlNode.scrollTop = scrollTop;
                        if (scrollTop > 0)
                            scrolled = true;
                    }
                    
                    if (scrolled) {
                        scrolled = setTimeout(function() { 
                            if (cnvs) onMove(e);
                        }, 20);
                    }
                    
                    clientX = clampX(clientX);
                    clientY = clampY(clientY);
                    
                    if (!moved) {
                        if (Math.abs(startX - e.clientX) + Math.abs(startY - e.clientY) > 5) {
                            moved = true;
                            rect.style.display = "block";
                        }
                        else return;
                    }
                    
                    if (startX > clientX) {
                        rect.style.left = clientX + "px";
                        rect.style.width = (startX - clientX) + "px";
                    }
                    else {
                        rect.style.left = startX + "px";
                        rect.style.width = (clientX - startX) + "px";
                    }
                    
                    if (startY > clientY) {
                        rect.style.top = clientY + "px";
                        rect.style.height = (startY - clientY) + "px";
                    }
                    else {
                        rect.style.top = startY + "px";
                        rect.style.height = (clientY - startY) + "px";
                    }
                    
                    var zoomLevel = zoom.value / 100;
                    rectinfo.setAttribute("caption", 
                        "L: " + ((rect.offsetLeft - cnvs.offsetLeft) / zoomLevel) + "px, "
                        + "T: " + ((rect.offsetTop - cnvs.offsetTop) / zoomLevel) + "px, "
                        + "W: " + (rect.offsetWidth / zoomLevel) + "px, "
                        + "H: " + (rect.offsetHeight / zoomLevel) + "px");
                    
                }, function() {
                    cnvs = null;
                    if (moved && parseInt(rect.style.width, 10) && parseInt(rect.style.height, 10)) {
                        activeDocument.getSession().rect = {
                            left: rect.style.left,
                            top: rect.style.top,
                            width: rect.style.width,
                            height: rect.style.height,
                        };
                        crop.enable();
                    }
                    else {
                        clearRect();
                    }
                });
                
                event.stopEvent(e);
            }
            
            function exec(action, options) {
                var cnvs = canvas();
                var url = cnvs.toDataURL();
                
                if (action == "crop") {
                    var zoomLevel = zoom.value / 100;
                    
                    options = {
                        left: (rect.offsetLeft - cnvs.offsetLeft) / zoomLevel,
                        top: (rect.offsetTop - cnvs.offsetTop) / zoomLevel,
                        width: (rect.offsetWidth) / zoomLevel,
                        height: (rect.offsetHeight) / zoomLevel
                    };
                }
                
                Pixastic.process(cnvs, action, options);
                clearRect();
                
                cnvs = canvas();
                info.setAttribute("caption", 
                    "W:" + cnvs.offsetWidth + "px, " +
                    "H:" + cnvs.offsetHeight + "px");
                
                //@todo
                var doc = activeDocument;
                doc.undoManager.add(new UndoItem(url, canvas().toDataURL(), function(url) {
                    loadedFiles[doc.tab.path] = url;
                    loadCanvas(doc.tab);
                }));
            }
            
            function clearRect() {
                rect.style.display = "none";
                delete activeDocument.getSession().rect;
                crop.disable();
            }
            
            plugin.on("documentLoad", function(e) {
                var doc = e.doc;
                var session = doc.getSession();
                
                doc.tab.on("setPath", function(e) {
                    setPath(e.path, doc);
                }, session);
                
                // Value Retrieval
                // doc.on("getValue", function get(e) { 
                //     return session.session
                //         ? session.session.getValue()
                //         : e.value;
                // }, session);
                
                // Value setting
                doc.on("setValue", function set(e) {
                    var path = doc.tab.path;
                    
                    // The first value that is set should clear the undo stack
                    // additional times setting the value should keep it.
                    if (doc.hasValue()) {
                        var lastValue = loadedFiles[path];
                        delete loadedFiles[path];
                        
                        // @todo this will go wrong and will be fixed when keeping canvas per session
                        setPath(path, doc, function(newValue) {
                            doc.undoManager.add(new UndoItem(lastValue, canvas().toDataURL(), function(url) {
                                loadedFiles[path] = url;
                                loadCanvas(doc.tab);
                            }));
                        });
                    } 
                    else {
                        setPath(path, doc);
                    }
                    
                    // doc.tab.classList.remove("loading");
                }, session);
                
                function setTheme(e) {
                    var tab = doc.tab;
                    var isDark = e.theme == "dark";
                    
                    tab.backgroundColor = BGCOLOR[e.theme];
                    
                    if (isDark) tab.classList.add("dark");
                    else tab.classList.remove("dark");
                }
                
                layout.on("themeChange", setTheme, doc);
                setTheme({ theme: settings.get("user/general/@skin") });
                
                canvas().style.display = "none";
                
                session.zoom = settings.getNumber("user/imgeditor/@zoom") || 100;
            });
            
            plugin.on("documentActivate", function(e) {
                var doc = e.doc;
                var session = doc.getSession();
                var path = doc.tab.path;
                
                activeDocument = doc;
                
                // Set Image
                setPath(path, doc);
                
                // Set Toolbar
                zoom.setValue(session.zoom || 100);
                zoom.dispatchEvent("afterchange");
                smooth.setValue(session.smooth);
                smooth.dispatchEvent("afterchange");
                
                // Set Rect
                if (session.rect) {
                    rect.style.display = "block";
                    rect.style.left = session.rect.left;
                    rect.style.top = session.rect.top;
                    rect.style.width = session.rect.width;
                    rect.style.height = session.rect.height;
                }
                else {
                    rect.style.display = "none";
                }
            });
            
            plugin.on("documentUnload", function(e) {
                delete loadedFiles[e.doc.tab.path];
            });
            
            /***** Register and define API *****/
            
            /**
             * The imgeditor handle, responsible for events that involve all 
             * ImageEditor instances. This is the object you get when you request 
             * the imgeditor service in your plugin.
             * 
             * Example:
             * 
             *     define(function(require, exports, module) {
             *         main.consumes = ["imgeditor"];
             *         main.provides = ["myplugin"];
             *         return main;
             *     
             *         function main(options, imports, register) {
             *             var imgeditorHandle = imports.imgeditor;
             *         });
             *     });
             * 
             * 
             * @class imgeditor
             * @extends Plugin
             * @singleton
             */
            /**
             * Read Only Image Viewer for Cloud9
             * 
             * Example of instantiating a new terminal:
             * 
             *     tabManager.openFile("/test.png", true, function(err, tab) {
             *         if (err) throw err;
             * 
             *         var imgeditor = tab.editor;
             *     });
             * 
             * @class imgeditor.ImageEditor
             * @extends Editor
             **/
            /**
             * The type of editor. Use this to create the terminal using
             * {@link tabManager#openEditor} or {@link editors#createEditor}.
             * @property {"imgeditor"} type
             * @readonly
             */
            plugin.freezePublicAPI({
                autoload: false
            });
            
            plugin.load(null, "imgeditor");
            
            return plugin;
        }
        ImageEditor.autoload = false;
        
        register(null, {
            imgeditor: handle
        });
    }
});
