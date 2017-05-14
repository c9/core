define(function(require, module, exports) {
return function(apf) {

apf.StandardBinding = apf.Presentation;
apf.MultiSelect = apf.StandardBinding;



/**
 * An element allowing a user to select a value from a list, which is 
 * displayed when the user clicks a button.
 * 
 * #### Example: Simple Dropdown
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:dropdown initial-message="Choose a country" skin="black_dropdown">
 *       <a:item>America</a:item>
 *       <a:item>Armenia</a:item>
 *       <a:item>The Netherlands</a:item>
 *   </a:dropdown>
 *   <!-- endcontent -->
 * </a:application>
 * ```
 * 
 * #### Example: Loading Items From XML
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:dropdown model="../resources/xml/friends.xml" each="[friend]" caption="[@name]" skin="black_dropdown" />
 *   <!-- endcontent -->
 * </a:application>
 * ```
 * 
 * #### Example: Capturing and Emitting Events
 *
 * A databound dropdown using the bindings element
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <a:table columns="100, 100, 100, 100" cellheight="19" padding="5">
 *   <!-- startcontent -->
 *       <a:model id="mdlDD5">
 *           <data>
 *               <friend name="Arnold"></friend>
 *               <friend name="Carmen"></friend>
 *               <friend name="Giannis"></friend>
 *               <friend name="Mike"></friend>
 *               <friend name="Rik"></friend>
 *               <friend name="Ruben"></friend>
 *           </data>
 *       </a:model>
 *       <a:textbox id="txtAr"></a:textbox>
 *       <a:dropdown
 *         id = "friendDD"
 *         model = "mdlDD5"
 *         each = "[friend]"
 *         caption = "[@name]"
 *         onslidedown = "txtAr.setValue('slide down')"
 *         onslideup = "txtAr.setValue('slide up')" />
 *       <a:button onclick="friendDD.slideDown()">Slide Down</a:button>
 *       <a:button onclick="friendDD.slideUp()">Slide Up</a:button>
 *   <!-- endcontent -->
 *   </a:table>
 * </a:application>
 * ```
 * 
 * #### Example: Dynamically Adding Entries
 *
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:model id="friendMdl">
 *       <data>
 *           <friend name="Arnold" />
 *           <friend name="Carmen" />
 *           <friend name="Giannis" />
 *           <friend name="Mike" />
 *           <friend name="Rik" />
 *           <friend name="Ruben" />
 *       </data>
 *   </a:model>
 *   <a:dropdown
 *     id = "dd"
 *     model = "friendMdl"
 *     each = "[friend]"
 *     caption = "[@name]">
 *   </a:dropdown>
 *   <a:button width="110" onclick="dd.add('&lt;friend name=&quot;Lucas&quot; />')">New Name?</a:button>
 *   <!-- endcontent -->
 * </a:application>
 * ```
 *
 * @class apf.dropdown
 * @define dropdown
 * @form
 * @allowchild item, {smartbinding}
 *
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.4
 */
/**
 * @event slidedown Fires when the dropdown slides open.
 * @cancelable Prevents the dropdown from sliding open
 */
/**
 *  @event slideup   Fires when the dropdown slides up.
 *  @cancelable Prevents the dropdown from sliding up
 *
 */
apf.dropdown = function(struct, tagName) {
    this.$init(tagName || "dropdown", apf.NODE_VISIBLE, struct);
};

(function() {
    this.$animType = 1;
    this.$animSteps = 5;
    this.$animSpeed = 20;
    this.$itemSelectEvent = "onmouseup";
    
    // *** Properties and Attributes *** //
    
    this.dragdrop = false;
    this.reselectable = true;
    this.$focussable = apf.KEYBOARD;
    this.autoselect = false;
    this.multiselect = false;
    this.disableremove = true;
    this.delayedselect = false;
    this.maxitems = 5;
    
    this.$booleanProperties["disableremove"] = true;
    this.$supportedProperties.push("maxitems", "disableremove", 
        "initial-message", "fill");
    
    /**
     * @attribute {String} initial-message Sets or gets the message displayed by this element
     * when it doesn't have a value set. This property is inherited from parent 
     * nodes. When none is found it is looked for on the appsettings element. 
     *
     */
     /**
     * @attribute {Number} maxitems Sets or gets the number of items that are shown at the 
     * same time in the container.
     */
    this.$propHandlers["maxitems"] = function(value) {
        this.sliderHeight = value 
            ? (Math.min(this.maxitems || 100, value) * this.itemHeight)
            : 10;
        this.containerHeight = value
            ? (Math.min(this.maxitems || 100, value) * this.itemHeight)
            : 10;
        /*if (this.containerHeight > 20)
            this.containerHeight = Math.ceil(this.containerHeight * 0.9);*/
    };
    
    this.addEventListener("prop.class", function(e) {
        this.$setStyleClass(this.oSlider, e.value);
    });
    
    
    this.$propHandlers["value"] = function(value) {
        var items = this.items || this.childNodes;
        for (var i = 0; i < items.length; i++) {
            var x = items[i];
            var itemValue = x.value;
            if (itemValue == undefined && x.getAttribute)
                itemValue = x.getAttribute("value");
            if (isValueEqual(value, itemValue)) {
                this.$setLabel(x.caption || (x.getAttribute && x.getAttribute("caption")) || value);
                return;
            }
        }
        this.$setLabel(String(value));
    };
    
    function isValueEqual(v1, v2) {
        if (v1 == v2) return true;
        if (typeof v1 != "object" && typeof v2 != "object")
            return v1 + "" == v2 + "";
    }

    this.$updateChildren = function() {
        var items = this.items;
        var children = this.childNodes;
        if (items) {
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var ch = children[i];
                if (!ch) {
                    ch = new apf.item(item);
                    this.appendChild(ch);
                    ch.item = item;
                } else if (ch.item != item) {
                    ch.item = item;
                    ch.setAttribute("value", item.value);
                    ch.setAttribute("caption", item.caption);
                }
            }
            
            while (i < children.length) {
                children[i].destroy(true, true);
            }
        }
        
        this.$int = this.$container;
        for (var i = 0; i < children.length; i++) {
            ch = children[i];
            if (ch.$pHtmlNode != this.$int)
                ch.dispatchEvent("DOMNodeInsertedIntoDocument", {});
            if (isValueEqual(ch.getAttribute("value"), this.value))
                ch.$ext && ch.$ext.classList.add("selected");
            else
                ch.$ext && ch.$ext.classList.remove("selected");
        }
    };
    
    // *** Public methods *** //
    
    /*
     * Toggles the visibility of the container with the list elements. It opens
     * or closes it using a slide effect.
     * @private
     */
    this.slideToggle = function(e, userAction) {
        if (!e) e = event;
        if (userAction && this.disabled)
            return;

        if (this.isOpen)
            this.slideUp();
        else
            this.slideDown(e);
    };

    /*
     * Shows the container with the list elements using a slide effect.
     * @private
     */
    this.slideDown = function(e) {
        if (this.dispatchEvent("slidedown") === false)
            return false;
        
        this.isOpen = true;
        this.$updateChildren();

        this.$propHandlers["maxitems"].call(this, this.xmlRoot && this.each 
            ? this.getTraverseNodes().length : this.childNodes.length); //@todo apf3.0 count element nodes
        
        this.oSlider.style.display = "block";
        if (!this.ignoreOverflow) {
            this.oSlider.style.overflowY = "visible";
            this.$container.style.overflowY = "hidden";
        }
        
        this.oSlider.style.display = "";

        this.$setStyleClass(this.$ext, this.$baseCSSname + "Down");
        
        //var pos = apf.getAbsolutePosition(this.$ext);
        this.oSlider.style.height = (this.sliderHeight - 1) + "px";
        this.oSlider.style.width = (this.$ext.offsetWidth - 2 - this.widthdiff) + "px";

        var _self = this;
        var _popupCurEl = apf.popup.getCurrentElement();
        apf.popup.show(this.$uniqueId, {
            x: 0,
            y: this.$ext.offsetHeight,
            zindextype: "popup+",
            animate: true,
            container: this.$getLayoutNode("container", "contents", this.oSlider),
            ref: this.$ext,
            width: this.$ext.offsetWidth - this.widthdiff,
            height: this.containerHeight,
            allowTogether: (_popupCurEl && apf.isChildOf(_popupCurEl.$ext, _self.$ext)),
            callback: function(container) {
                if (!_self.ignoreOverflow) {
                    _self.$container.style.overflowY = "auto";
                }
            }
        });
    };
    
    /*
     * Hides the container with the list elements using a slide effect.
     * @private
     */
    this.slideUp = function() {
        if (this.isOpen == 2) return false;
        if (this.dispatchEvent("slideup") === false) return false;
        
        this.isOpen = false;
        this.$setStyleClass(this.$ext, '', [this.$baseCSSname + "Down"]);
        if (apf.popup.last == this.$uniqueId)
            apf.popup.hide();
        return false;
    };
    
    this.select = function(value) {
        this.setValue(value);
    };
    
    // *** Private methods and event handlers *** //

    //@todo apf3.0 why is this function called 6 times on init.
    this.$setLabel = function(value) {
        this.oLabel.textContent = value || this["initial-message"] || "";
        
        this.$setStyleClass(this.$ext, value ? "" : this.$baseCSSname + "Initial",
            !value ? [] : [this.$baseCSSname + "Initial"]);
    };

    // Private functions
    this.$blur = function() {
        this.slideUp();
        if (!this.isOpen)
            this.$setStyleClass(this.$ext, "", [this.$baseCSSname + "Over"]);
        
        this.$setStyleClass(this.$ext, "", [this.$baseCSSname + "Focus"]);
    };
    
    
    this.$setClearMessage = function(msg) {
        this.$setLabel(msg);
    };
    
    this.$removeClearMessage = function() {
        this.$setLabel("");
    };

    this.addEventListener("popuphide", this.slideUp);
    
    this.load =
    this.setChildren = function(data) {
        this.items = data;
        if (this.isOpen)
            this.$updateChildren();
         this.$propHandlers["value"].call(this, this.value);
    };
    
    this.change =
    this.setValue = function(value) {
        if (this.value != value) {
            this.setAttribute("value", value);
            this.dispatchEvent("afterchange", { value: value });
        }
    };
    this.getValue = function() { return this.value; };
    // *** Keyboard Support *** //
    
    this.getSelectedNode = function() {
        if (!this.isOpen)
            this.$updateChildren();
        var items = this.childNodes;
        for (var i = 0; i < items.length; i++) {
            var x = items[i];
            var itemValue = x.value;
            if (itemValue == undefined && x.getAttribute)
                itemValue = x.getAttribute("value");
            if (isValueEqual(this.value, itemValue)) {
                return x;
            }
        }
    };
    
    this.addEventListener("keydown", function(e) {
        var key = e.keyCode;
        var node;
        
        switch (key) {
            case 32:
                this.slideToggle(e.htmlEvent);
            break;
            case 38:
                //UP
                if (e.altKey)
                    return this.slideToggle(e.htmlEvent);
                node = this.getSelectedNode();
                if (node)
                    node = node.previousSibling;
                if (node)
                    this.select(node.value);
            break;
            case 40:
                //DOWN
                if (e.altKey) {
                    this.slideToggle(e.htmlEvent);
                    return;
                }
                node = this.getSelectedNode();
                if (node)
                    node = node.nextSibling;
                if (node)
                    this.select(node.value);
            break;
            default:
                if (key == 9 || !this.xmlRoot) return;  
            
                //if(key > 64 && key < 
                if (!this.lookup || new Date().getTime() - this.lookup.date.getTime() > 1000)
                    this.lookup = {
                        str: "",
                        date: new Date()
                    };

                this.lookup.str += String.fromCharCode(key);
                
            return;
        }

        return false;
    }, true);
    
    this.addEventListener("itemclick", function(e) {
        this.select(e.value);
        this.slideUp();
    }, true);
    
    // *** Init *** //
    
    this.$draw = function() {
        this.$getNewContext("main");
        this.$getNewContext("container");
        
        this.$animType = this.$getOption("main", "animtype") || 1;
        this.clickOpen = this.$getOption("main", "clickopen") || "button";

        //Build Main Skin
        this.$ext = this.$getExternal(null, null, function(oExt) {
            oExt.setAttribute("onmouseover", 'var o = apf.lookup(' + this.$uniqueId
                + ');o.$setStyleClass(o.$ext, o.$baseCSSname + "Over", null, true);');
            oExt.setAttribute("onmouseout", 'var o = apf.lookup(' + this.$uniqueId
                + ');if(o.isOpen) return;o.$setStyleClass(o.$ext, "", [o.$baseCSSname + "Over"], true);');
            
            //Button
            var oButton = this.$getLayoutNode("main", "button", oExt);
            if (oButton) {
                oButton.setAttribute("onmousedown", 'apf.lookup('
                    + this.$uniqueId + ').slideToggle(event, true);');
            }
            
            //Label
            var oLabel = this.$getLayoutNode("main", "label", oExt);
            if (this.clickOpen == "both") {
                oLabel.parentNode.setAttribute("onmousedown", 'apf.lookup('
                    + this.$uniqueId + ').slideToggle(event, true);');
            }
        });
        this.oLabel = this.$getLayoutNode("main", "label", this.$ext);
        
        
        if (this.oLabel.nodeType == 3)
            this.oLabel = this.oLabel.parentNode;
        
        
        this.oIcon = this.$getLayoutNode("main", "icon", this.$ext);
        if (this.$button)
            this.$button = this.$getLayoutNode("main", "button", this.$ext);
        
        this.oSlider = apf.insertHtmlNode(this.$getLayoutNode("container"),
            document.body);
        this.$container = this.$getLayoutNode("container", "contents", this.oSlider);
        this.$container.host = this;
        
        //Set up the popup
        this.$pHtmlDoc = apf.popup.setContent(this.$uniqueId, this.oSlider);
        
        //Get Options form skin
        //Types: 1=One dimensional List, 2=Two dimensional List
        this.listtype = parseInt(this.$getLayoutNode("main", "type")) || 1;
        
        this.itemHeight = this.$getOption("main", "item-height") || 18.5;
        this.widthdiff = this.$getOption("main", "width-diff") || 0;
        this.ignoreOverflow = apf.isTrue(this.$getOption("main", "ignore-overflow")) || false;
    };
    
    this.addEventListener("DOMNodeInsertedIntoDocument", function() {
        if (typeof this["initial-message"] == "undefined")
            this.$setInheritedAttribute("initial-message");
        
        if (!this.selected && this["initial-message"])
            this.$setLabel();
    });
    
    this.$destroy = function() {
        apf.popup.removeContent(this.$uniqueId);
        apf.destroyHtmlNode(this.oSlider);
        this.oSlider = null;
    };

    
}).call(apf.dropdown.prototype = new apf.Presentation());

apf.config.$inheritProperties["initial-message"] = 1;

apf.aml.setElement("dropdown", apf.dropdown);






};

});