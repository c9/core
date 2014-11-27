define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "menus", "info", "layout", "http", "util",
        "vfs.endpoint", "auth", "dialog.alert", "c9"
    ];
    main.provides = ["login"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var c9 = imports.c9;
        var menus = imports.menus;
        var layout = imports.layout;
        var http = imports.http;
        var util = imports.util;
        var info = imports.info;
        var auth = imports.auth;
        var alert = imports["dialog.alert"].show;

        var vfsEndpoint = imports["vfs.endpoint"];

        /***** Initialization *****/

        var ideBaseUrl = options.ideBaseUrl;
        var dashboardUrl = options.dashboardUrl;
        var lastUser;

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();

        var loaded = false;
        function load() {
            if (loaded) return false;
            loaded = true;

            info.getUser(function(err, user) {
                updateButton({user: user});
            });

            auth.on("relogin", onReLogin);
        }

        /***** Methods *****/
        
        function updateButton(e) {
            var user = e.user;
            if (lastUser && lastUser.id == user.id)
                return;
            plugin.cleanUp();
            info.on("change", updateButton, plugin);
            createButton(user);
            lastUser = user;
        }

        function createButton(user) {
            // todo cleanup seems to not work well
            // without this menu is empty after logging out and back in
            if (lastUser)
                menus.remove(lastUser.fullname);
            menus.remove(user.fullname);
            
            var name = user.fullname;
            var parent = layout.findParent(plugin);
            
            // Insert CSS
            ui.insertCss(require("text!./login.css"), plugin);
            
            // Create Menu
            var mnuUser = new ui.menu();
            plugin.addElement(mnuUser);
            
            // Add named button
            var icon = util.getGravatarUrl(user.email, 32, "");
            menus.addItemByPath(name + "/", mnuUser, 110000, plugin);
            
            // Add Divider
            ui.insertByIndex(parent, new ui.divider({ 
                skin: "c9-divider-double", 
                "class" : "extrasdivider" 
            }), 870, plugin);
            
            // Add sub menu items
            var c = 500;
            menus.addItemByPath(name + "/Dashboard", new ui.item({
                onclick: function() { window.open(dashboardUrl); }
            }), c += 100, plugin);
            menus.addItemByPath(name + "/Home", new ui.item({
                onclick: function() { window.open(ideBaseUrl); }
            }), c += 100, plugin);

            if (!options.noLogout) {
                menus.addItemByPath(name + "/~", new ui.divider(), c += 100, plugin);
                menus.addItemByPath(name + "/Log out", new ui.item({
                    onclick: function() {
                        if (!c9.local)
                            return signout();
                        auth.logout(function() {
                            info.login(true);
                        });
                    }
                }), c += 100, plugin);
            }

            var button = menus.get(name).item;
            button.setAttribute("class", "btnName");
            button.setAttribute("icon", icon);
            button.setAttribute("iconsize", "16px 16px");
            // button.removeAttribute("caption");
            ui.insertByIndex(parent, button, 600, plugin);

            if (c9.local) {
                function minimize(){
                    apf.document.documentElement.appendChild(button);
                    ui.setStyleClass(button.$ext, "titlebar");
                }
                function restore(){
                    ui.insertByIndex(parent, button, 870, plugin);
                    ui.setStyleClass(button.$ext, "", ["titlebar"]);
                }

                menus.on("minimize", minimize, plugin);
                menus.on("restore", restore, plugin);

                if (menus.minimized)
                    minimize();
            }

            emit.sticky("ready", { name: name }, plugin);
        }

        function signout() {
            vfsEndpoint.clearCache();
            auth.logout(function() { location.href = ideBaseUrl; });
        }

        function onReLogin() {
            if (!c9.local) {
                alert("Logged out",
                  "You have been logged in as a different user",
                  "Please hit OK to reload the IDE.",
                  function() {
                      vfsEndpoint.clearCache();
                       auth.logout(function() {
                          document.location.reload();
                      });
                  });
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
        });

        /***** Register and define API *****/

        /**
         *
         **/
        plugin.freezePublicAPI({
            _events: [
                /**
                 * @event ready
                 */
                "ready"
            ],
            createButton: createButton,
            updateButton: updateButton
        });

        register(null, {
            login: plugin
        });
    }
});