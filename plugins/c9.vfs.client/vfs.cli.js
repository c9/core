define(function(require, module, exports) {
    main.consumes = ["c9", "ext"];
    main.provides = ["vfs"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var localFs = require("vfs-local");

        var vfs = new localFs({
            root: "/",
            nopty: true,
            defaultEnv: { CUSTOM: 43 }
        });

        c9.setStatus(c9.status | c9.STORAGE | c9.PROCESS);

        register(null, { vfs: vfs });
    }
});