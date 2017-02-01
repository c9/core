define(function(require, module, exports) {
    main.consumes = ["dialog.question"];
    main.provides = ["dialog.fileremove"];
    return main;
    
    function main(options, imports, register) {
        var question = imports["dialog.question"].show;
        
        /***** Initialization *****/
        
        /***** Methods *****/
        
        function show(files, onremove) {
            if (files.confirmed === undefined)
                files.confirmed = false;
        
            if (files.confirmed)
                return true;
                
            function confirm(file) {
                var name = file.label;
                var type = file.isFolder ? "folder" : "file";
                question(
                    "Confirm Remove",
                    "You are about to remove the " + (type || "item") + " " + name,
                    "Do you want continue? (This change cannot be undone)",
                    function(all) { // Yes
                        files.confirmed = true;
                        onremove(file);
                        if (all) {
                            files.forEach(function (file) {
                                onremove(file);
                            });
                        }
                        files.confirmed = false;
                        
                        if (!all && files.length > 0)
                            confirm(files.shift());
                    },
                    function(all, cancel) { // No
                        if (!all && files.length > 0)
                            confirm(files.shift());
                    },
                    { all: files.length > 0 }
                );
            }
            confirm(files.shift());
            
            return false;
        }
        
        register("", {
            "dialog.fileremove": {
                show: show
            }
        });
    }
});