define(function(require, exports, module) {
    
    var guidToShortString = exports.guidToShortString = function(guid) {
        var result = guid && guid.replace(/^[^:]+:(([^\/]+)\/)*?([^\/]*?)(\[\d+[^\]]*\])?(\/prototype)?$|.*/, "$3");
        return result && result !== "Object" ? result : "";
    };

    var guidToLongString = exports.guidToLongString = function(guid, name) {
        if (guid.substr(0, 6) === "local:")
            return guidToShortString(guid);
        var result = guid && guid.replace(/^[^:]+:(([^\/]+\/)*)*?([^\/]*?)$|.*/, "$1$3");
        if (!result || result === "Object")
            return "";
        result = result.replace(/\//g, ".").replace(/\[\d+[^\]]*\]/g, "");
        if (name !== "prototype")
            result = result.replace(/\.prototype$/, "");
        return result;
    };

    function addStylesheetRule(cssText) {
        var s = document.styleSheets[document.styleSheets.length - 1];
        s.insertRule(cssText, s.cssRules.length);
    }
    
    var iconClass = {};
    function defineIcon(icon) {
        var path = (this.staticUrl || "/static") + "/plugins/c9.ide.language/images/";
            
        iconClass[icon] = "lang-icon-" + icon;
        
        var cssText = "." + iconClass[icon] + "{"
            + "background-image:url('" + path + icon + ".png')"
            + "}";
        //console.log(cssText)    
        addStylesheetRule(cssText);
        return iconClass[icon];
    }
    

    function tokenizeRow() {
        return [];
    }
    function renderLine(lineEl, row, foldLine) {
        var match = this.popup.data[row];
        
        var icon = this.dom.createElement("span");
        icon.className = "completer-img " + (match.icon 
            ? iconClass[match.icon] || this.popup.$defineIcon(match.icon)
            : "");
        lineEl.appendChild(icon);
        
        if (match.type) {
            var shortType = guidToShortString(match.type);
            if (shortType)
                match.meta = shortType;
        }
        
        var name = match.name;
        var prefix = match.identifierRegex
            ? this.popup.calcPrefix(match.identifierRegex)
            : name.substr(0, this.popup.prefix.length);
        
        var trim = match.meta ? " maintrim" : "";
        if (!this.ignoreGenericMatches || !match.isGeneric) {
            var simpleName = match.replaceText.replace("^^", "").replace(/\(\)$/, "");
            if (name.indexOf(simpleName) === 0) {
                this.dom.buildDom([["span", { class: "main" + trim }, 
                    ["u", prefix], simpleName.substring(prefix.length)],
                    ["span", { class: "deferred" }, name.substring(Math.max(simpleName.length, prefix.length))]
                ], lineEl);
            }
            else {
                this.dom.buildDom(["span", { class: "main" + trim }, 
                    ["u", prefix], name.substring(prefix.length)
                ], lineEl);
            }
        }
        else {
            this.dom.buildDom(["span", { class: "main" + trim }, 
                ["span", { class: "deferred" }, ["u", prefix], name.substring(prefix.length)]
            ], lineEl);
        }
        
        if (match.meta) {
            this.dom.buildDom(["span", { class: "meta"}, match.meta], lineEl);
        }
    }
    
    exports.initPopup = function(popup, staticUrl) {
        popup.session.bgTokenizer.popup = popup;
        popup.session.bgTokenizer.$tokenizeRow = tokenizeRow;
        popup.renderer.$textLayer.popup = popup;
        popup.$defineIcon = defineIcon;
        popup.renderer.$textLayer.$renderLine = renderLine;
        popup.staticUrl = staticUrl;
    };
});
