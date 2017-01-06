define(function(require, exports, module) {
    var oop = require("ace/lib/oop");
    var BaseClass = require("ace_tree/data_provider");
    var escapeHTML = require("ace/lib/lang").escapeHTML;

    function DataProvider(root) {
        BaseClass.call(this, root || {});

        this.rowHeight = 22;
        this.rowHeightInner = 20;
        this.expandedList = Object.create(null);
        this.selectedList = Object.create(null);

        Object.defineProperty(this, "loaded", {
            get: function() { return this.visibleItems.length; }
        });
    }

    oop.inherits(DataProvider, BaseClass);

    (function() {
        this.$sortNodes = false;

        this.getEmptyMessage = function() {
            return "Loading Members...";
        };

        this.getContentHTML = function (datarow) {
            var nameHTML = escapeHTML(datarow.name || "");
            
            if (datarow.type == "file")
                return "<span style='line-height:" + this.rowHeightInner + "px'>" + nameHTML + "</span>";
            if (!datarow.uid)
                return "<span class='root " + (datarow.className || "") + "'>" + nameHTML + "</span>";
            var access = datarow.acl || "r";
            var canAccessControl = this.iAmAdmin && !datarow.isAdmin;
            var disabledLabel = access == "r" ? "<div class='readbutton'>R</div>" : "<div class='writebutton'>RW</div>";
            var status = datarow.onlineStatus || "offline";
            var color = datarow.color || "transparent";
            
            var html = [
                "<span class='caption'>" + nameHTML + "</span>\n",
                "<span class='status ", status, "'></span>\n",
                "<span class='collaborator_color' style='background-color: ", color, ";'></span>\n",
                 canAccessControl
                    ? ("<div class='access_control " + access + "'>" +
                        "<div class='readbutton'>R</div>" +
                        "<div class='writebutton'>RW</div></div>" +
                    "<div class='kickout'></div>\n")
                    : ("<div class='access_control disabled'>" + disabledLabel + "</div>\n" +
                        (datarow.name == "You" && !datarow.isAdmin ? "<div class='kickout'></div>\n" : "")
                    ),
            ];

            return html.join("");
        };
        
        this.getClassName = function(node) {
            return (node.className || "");
        };
        
        this.setOpen = function(node, val) {
            if (!node.id)
                return (node.isOpen = val);
            if (val)
                this.expandedList[node.id] = val;
            else
                delete this.expandedList[node.id];
        };
        this.isOpen = function(node) {
            if (!node.id)
                return node.isOpen;
            return this.expandedList[node.id];
        };
        this.isSelected = function(node) {
            if (!node.id)
                return node.isSelected;
            return this.selectedList[node.id];
        };
        this.setSelected = function(node, val) {
            if (!node.id)
                return (node.isSelected = !!val);
            if (val)
                this.selectedList[node.id] = !!val;
            else
                delete this.selectedList[node.id];
        };
        this.loadChildren = function(node) {
        };
        this.shouldLoadChildren = function(node, ch) {
            return node.client ? node.client.status === "pending"
                : node.children && node.children.status === "pending";
        };
        
        this.hasChildren = function(node) {
            return node.children;
        };

    }).call(DataProvider.prototype);

    return DataProvider;
});