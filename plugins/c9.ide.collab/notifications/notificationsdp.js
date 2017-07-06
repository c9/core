define(function(require, exports, module) {
    var oop = require("ace/lib/oop");
    var BaseClass = require("ace_tree/data_provider");

    function DataProvider(root) {
        BaseClass.call(this, root || {});

        this.rowHeight = 50;
        this.rowHeightInner = 48;

        Object.defineProperty(this, "loaded", {
            get: function() { return this.visibleItems.length; }
        });
    }

    oop.inherits(DataProvider, BaseClass);

    (function() {
        this.$sortNodes = false;
        this.emptyMessage = "Loading Notifications ...";

        this.setRoot = function(root) {
            if (Array.isArray(root))
                root = { items: root };
            this.root = root || {};
            this.visibleItems = [];
            this.open(this.root, true);

            this._signal("change");
        };

        this.getContentHTML = function (datarow) {
            return datarow.getHTML();
        };

    }).call(DataProvider.prototype);

    return DataProvider;
});