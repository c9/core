define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "settings", "info", "tabManager", "guide"
    ];
    main.provides = ["guide.default"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var tabManager = imports.tabManager;
        var info = imports.info;
        var guide = imports.guide;
        
        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        var RIGHT = 1 << 1;
        var LEFT = 1 << 2;
        var BOTTOM = 1 << 3;
        var TOP = 1 << 4;
        var FEATURE_DEPLOYED = new Date(2016, 2, 3).getTime();
        
        var allThingies = [
            {
                name: "workspace", 
                query: ".workspace",
                width: 340,
                attachment: LEFT,
                where: RIGHT,
                wherePopup: RIGHT | BOTTOM,
                color: "blue",
                title: "Manage and upload files & folders",
                body: "Here's where all of your project files are. Double click a file to open it and right click for additional options. You can also create, delete, and move files around. <br /><br />Click the settings icon in the top right corner of the Workspace panel for additional options. Drag and drop to upload files and download them by right-clicking.<br /><br /><a href='https://docs.c9.io/docs/file-revision-history' target='_blank'>Read about Restoring Deleted Files</a>"
            },
            {
                name: "navigate", 
                query: ".navigate",
                width: 300,
                attachment: LEFT,
                where: RIGHT,
                color: "green",
                title: "Quickly navigate to files",
                body: "The Navigate panel allows for quick searching and opening of files. Use ${key:navigate} to open the panel then navigate to any file in the file system by typing part of the filename or path.<br /><br /><a href='https://docs.c9.io/docs/navigate' target='_blank'>More about the Navigate Panel</a>"
            },
            {
                name: "new tab", 
                query: ".plus_tab_button",
                width: 360,
                attachment: LEFT,
                where: BOTTOM,
                color: "green",
                title: "Open a file, terminal, or recent tabs",
                body: "Click the plus button to open a new tab for a file or terminal instance. You can also open an immediate window for testing Javascript expressions or reopen recently closed tabs.<br /><br /><a href='https://docs.c9.io/docs/immediate-window' target='_blank'>More about the Immediate Window</a>"
            },
            {
                name: "terminal", 
                query: function() {
                    var t;
                    if (!tabManager.getTabs().some(function(tab) {
                            if (tab.editorType == "terminal") {
                                t = tab;
                                return true;
                            }
                        })) return;
                    return t.aml.$button;
                },
                width: 300,
                attachment: BOTTOM,
                where: TOP,
                title: "Full Linux terminal",
                color: "blue",
                body: "With full sudo access in the terminal, you can create files, run code, and install software. Open a new terminal at any time with ${key:openterminal}.<br /><br /><b>Pro Tip</b>: Your workspace layout is fully customizable, making split screen simple. Try dragging this terminal tab and dropping it all over the screen. This works for many tabs and many layouts.<br /><br /><a href='https://docs.c9.io/docs/terminal' target='_blank'>More about the Terminal</a>"
            },
            {
                name: "preview", 
                query: ".preview",
                width: 350,
                attachment: TOP,
                where: BOTTOM,
                color: "orange",
                title: "Preview your app as you code",
                body: "Click Preview to open the current file in a raw preview, like for HTML or Markdown, or to see it as it's running on the server. To preview your running application, you'll need to first run it with the Run button or by executing a command from the terminal.<br /><br /><a href='https://docs.c9.io/docs/run-an-application#section--pre-view-your-application' target='_blank'>More about Previewing Your Application</a>"
            },
            {
                name: "run", 
                query: ".runbtn",
                width: 310,
                attachment: TOP,
                where: BOTTOM,
                color: "green",
                title: "Run your app or file",
                body: "Running from here will use the default run configuration for the file or type of project you're using. Always make sure to run your app on port 8080. Once it's running, view your app by clicking Preview or by going straight to your application URL (found in the Share dialogue).<br /><br /><a href='https://docs.c9.io/docs/running-and-debugging-code' target='_blank'>More about Running Your Application</a>"
            },
            {
                name: "share", 
                query: ".c9-share",
                width: 300,
                attachment: TOP,
                where: BOTTOM,
                color: "orange",
                title: "Share your work with anyone",
                body: "Click here to invite others to view or edit your code. Here you'll also find your application URL, which you can use to view or share your running app.<br /><br /><a href='https://docs.c9.io/docs/share-a-workspace' target='_blank'>More about Sharing a Workspace</a>"
            },
            {
                name: "collaborate", 
                query: ".collab",
                width: 400,
                attachment: RIGHT,
                where: LEFT,
                color: "orange",
                title: "Follow and chat with other collaborators",
                body: "From the Collaboration panel, you can control all users' access to the workspace, see what files users are working on, and use real-time chat.<br /><br /><a href='https://docs.c9.io/docs/share-a-workspace' target='_blank'>More about Sharing a Workspace</a>"
            },
            {
                name: "outline", 
                query: ".outline",
                width: 320,
                attachment: RIGHT,
                where: LEFT,
                color: "blue",
                title: "Get an outline of your code",
                body: "The Outline panel shows a full list of functions and definitions in your file so you can quickly navigate through your file without reading every line of code. Use ${key:outline} to open the panel and navigate to any definition file system by typing part of the name. The outline view has support for over a dozen languages.<br /><br /><a href='https://docs.c9.io/docs/supported-languages' target='_blank'>See All Supported Languages</a>"
            },
            {
                name: "debugger", 
                query: ".debugger",
                width: 320,
                attachment: RIGHT,
                where: LEFT,
                color: "green",
                title: "Built-in step-through debugging",
                body: "Set a breakpoint in a Node, PHP, Go, or C++ file by clicking next to the appropriate line number in your file. Then when you run your program, the debug panel will open up and you can see what variables are set and execute your code one line at a time. <br /><br /><a href='https://docs.c9.io/docs/debugging-your-code' target='_blank'>More about Debugging</a>"
            },
            {
                name: "preview-chooser",
                query: ".btn-preview-choice",
                width: 340,
                attachment: TOP,
                where: BOTTOM,
                color: "green",
                title: "Preview your files in various ways",
                body: "When previewing your application, you may choose from a variety of different browsers to test your application in.<br /><br /><a href='https://docs.c9.io/docs/browser-testing' target='_blank'>More about Testing in Different Browsers</a>"
            }
        ];

        function load() {
            guide.add(allThingies);
            
            guide.on("hide", function(e) {
                settings.set("user/tour/@default-complete", true);
            });
            
            guide.on("close", function(e) {
                var completed = settings.getJson("user/tour/default") || {};
                completed[e.name] = 1;
                settings.setJson("user/tour/default", completed);
            });
            
            settings.on("read", function() {
                settings.setDefaults("user/tour", [["default-complete", false]]);
                
                if (!settings.getBool("user/tour/@default-complete") && info.getUser().date_add > FEATURE_DEPLOYED)
                    guide.show(settings.getJson("user/tour/default"));
            });
        }

        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
        });

        /***** Register and define API *****/

        plugin.freezePublicAPI({});

        register(null, {
            "guide.default": plugin
        });
    }
});
