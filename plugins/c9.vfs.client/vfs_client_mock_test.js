/*global describe it before after bar*/

"use client";

require(["lib/architect/architect", "lib/chai/chai", "configs/ide/default"], function(architect, chai) {
    var expect = chai.expect;
    
    function offlineConfig() {
        var plugins = require("configs/ide/default")({
            staticPrefix: "/static",
            workspaceDir: "/",
            workspaceId: "/",
            workspaceName: "/",
            home: "/",
            platform: "linux",
            installPath: "/",
            manifest: {},
            project: {},
            user: {},
            standalone: true,
            previewUrl: "",
            dashboardUrl: "",
            themePrefix: "/static/standalone/skin/default",
        });
        var excludes = [
            "plugins/c9.ide.immediate/evaluators/debugnode",
            "plugins/c9.ide.test.mocha/mocha",
            "plugins/c9.ide.find/find.nak",
            "plugins/c9.ide.terminal/terminal",
            "plugins/c9.ide.test/all",
            "plugins/c9.ide.find/find",
            "plugins/c9.ide.terminal/link_handler",
            "plugins/c9.ide.test/coverage",
            "plugins/c9.ide.test/coverage",
            "plugins/c9.ide.test/results",
            "plugins/c9.ide.test/testrunner",
            
            "plugins/c9.ide.find.infiles/findinfiles",
            "plugins/c9.ide.language.codeintel/codeintel",
            "plugins/c9.ide.language.go/go",
            "plugins/c9.ide.language.python/python",
            "plugins/c9.ide.test/coverageview",
            "plugins/c9.cli.bridge/bridge_commands",
            "plugins/c9.ide.ace.keymaps/cli",
            "plugins/c9.ide.configuration/configure",
            "plugins/c9.ide.plugins/manager",
            "plugins/c9.ide.ace.keymaps/keymaps",
            "plugins/c9.ide.ace/themes",
        ];
        plugins = plugins.filter(function(p) {
            var packagePath = typeof p == "string" ? p : p.packagePath;
            if (/\/c9.ide.run/.test(packagePath)) return false;
            if (/\/c9.ide.collab/.test(packagePath)) return false;
            if (/\/c9.ide.installer/.test(packagePath)) return false;
            if (/\/c9.vfs.client/.test(packagePath)) return false;
            if (/\/c9.ide.plugins/.test(packagePath)) return false;
            if (/\/c9.ide.scm/.test(packagePath)) return false;
            if (/\/c9.ide.welcome/.test(packagePath)) return false;
            if (excludes.indexOf(packagePath) != -1) return false;
            
            if (packagePath == "plugins/c9.fs/fs")
                p.cli = true;
            if (packagePath == "plugins/c9.core/settings")
                p.testing = 1;
                
            if (packagePath == "plugins/c9.ide.console/console")
                p.defaultState = { type: "pane", nodes: [] }; // prevent console from opening terminal
            
            return true;
        });
        plugins.push({
            packagePath: "plugins/c9.vfs.client/vfs_client_mock",
            storage: false
        });
        plugins.push({
            provides: ["find", "installer"],
            consumes: [],
            setup: function(options, imports, register) {
                function noop() {}
                register(null, {
                    find: { on: noop, once: noop, getFileList: noop },
                    installer: {},
                });
            }
        });
        window.plugins = plugins;
        return plugins;
    }
    
    expect.setupArchitectTest(offlineConfig().concat([
        {
            consumes: ["tabManager", "ace", "commands", "outline", "language", "ui", "menus"],
            provides: [],
            setup: main
        }
    ]), architect);
    
    function main(options, imports, register) {
        var tabs = imports.tabManager;
        var commands = imports.commands;
        var outline = imports.outline;
        var language = imports.language;
        var menus = imports.menus;
        var ui = imports.ui;
        
        var img = "<img onerror='window.xss=1' src=':error'>";
        
        describe("xss", function() {
            this.timeout(10000);
            
            it("should open a markdown file with outline", function(done) {
                tabs.openFile("/README.md", function(err, tab) {
                    expect(err).to.not.ok;
                    expect(tabs.getTabs()).length(1);
                    expect(window.xss).to.not.ok;
                    
                    tab.editor.ace.setValue("# " + img);
                    tab.editor.ace.resize(true);
                    expect(tab.editor.ace.renderer.scroller.textContent).to.equal("# " + img);
                    language.getWorker(function(err, worker) {
                        expect(err).to.not.ok;
                    	worker.once("outline", function() {
                    	    setTimeout(function() {
                    	        outline.tree.resize(true);
                                expect(outline.tree.container.textContent.trim()).to.equal(img);
                                expect(window.xss).to.not.ok;
                                setTimeout(function() {
                                    expect(window.xss).to.not.ok;
                                    done();
                                });
                    	    });
                        });
                        outline.show();
                    });
                });
            });
            
            it("should open immediate window", function(done) {
                tabs.open({ focus: true, editorType: "immediate" }, function(err, tab) {
                    expect(err).to.not.ok;
                    expect(window.xss).to.not.ok;
                    tab.editor.ace.insert("top.a = {" + JSON.stringify(img) + ":" + JSON.stringify(img) + "};");
                    tab.editor.ace.repl.eval(true);
                    setTimeout(function() {
                        expect(window.xss).to.not.ok;
                        done();
                    });
                });
            });
            
            it("should add menu item", function(done) {
                commands.addCommand({
                    name: img,
                    bindKey: img
                }, menus);
                menus.setRootMenu(img, 16000, menus);
                menus.addItemByPath(img + "/" + img, new ui.item({
                    command: img
                }), 16, menus);
                setTimeout(function() {
                    expect(window.xss).to.not.ok;
                    done();
                });
            });
        });
        
        register();
    }
});