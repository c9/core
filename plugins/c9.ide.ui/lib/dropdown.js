define(function(require, module, exports) {
return function(apf) {
var $setTimeout = setTimeout;
var $setInterval = setInterval;





apf.model = function(struct, tagName) {
    console.trace()
    this.$init(tagName || "model", apf.NODE_HIDDEN, struct);
    
    this.$amlNodes = {};
    this.$propBinds = {};
    
    this.$listeners = {};
    this.$proplisteners = {};
    
    this.data = [];
};

(function() {
    /**
     * Loads data into this model.
     *
     * @param  {Mixed} [xmlNode]  The data to load in this model. A string specifies the data instruction how to retrieve the data, which can be an XML string. `null` will clear the data from this model.
     * @param {Object} [options] Additional options to pass. This can contain the following properties:
     *   
     *   - `xmlNode` ([[XMLElement]]):   the {@link term.datanode data node} that provides context to the data instruction.
     *   - `callback` ([[Function]]): the code executed when the data request returns.
     *   - `[]` (`Mixed`): custom properties available in the data instruction.
     *   - `[nocopy]` ([[Boolean]]): specifies whether the data loaded will not overwrite the reset point.
     */
    this.load = function(data, options) {
        if (typeof data == "string" || options) {
            debugger
            }
        this.data = data;
    };
    
    this.update = function(data, options) {
        debugger
        }
        
    this.$destroy = function() {
    };
}).call(apf.model.prototype = new apf.AmlElement());

apf.aml.setElement("model", apf.model);







/**
 * The baseclass for all standard data binding rules.
 *
 * @class apf.StandardBinding
 * @private
 * @baseclass
 * @inherits apf.DataBinding
 */
apf.StandardBinding = apf.Presentation;






apf.MultiSelect = apf.StandardBinding;





apf.__CHILDVALUE__ = 1 << 27;


apf.ChildValue = function(){
    if (!this.$childProperty)
        this.$childProperty = "value";
    
    this.$regbase = this.$regbase | apf.__CHILDVALUE__;
    
    var f, re = /^[\s\S]*?>(<\?lm)?([\s\S]*?)(?:\?>)?<[^>]*?>$/;
    this.addEventListener("DOMCharacterDataModified", f = function(e) {
        if (e && (e.currentTarget == this 
          || e.currentTarget.nodeType == 2 && e.relatedNode == this)
          || this.$amlDestroyed)
            return;

        if (this.getAttribute(this.$childProperty))
            return;
        
        //Get value from xml (could also serialize children, but that is slower
        var m = this.serialize().match(re),
            v = m && m[2] || "";
        if (m && m[1])
            v = "{" + v + "}";

        this.$norecur = true;

        
        if (this[this.$childProperty] != v)
            this.setProperty(this.$childProperty, v);
       
        this.$norecur = false;
    });
    
    //@todo Should be buffered
    this.addEventListener("DOMAttrModified", f);
    this.addEventListener("DOMNodeInserted", f);
    this.addEventListener("DOMNodeRemoved", f);
    
    this.addEventListener("$skinchange", function(e) {
       this.$propHandlers[this.$childProperty].call(this, this.caption || "");
    });
    
    this.$init(function() {
       this.addEventListener("prop." + this.$childProperty, function(e) {
           if (!this.$norecur && !e.value && !this.hasAttribute(this.$childProperty))
               f.call(this);
       });
    });

    this.addEventListener("DOMNodeInsertedIntoDocument", function(e) {
        var hasNoProp = typeof this[this.$childProperty] == "undefined";
        
        //this.firstChild.nodeType != 7 && 
        if (hasNoProp
          && !this.getElementsByTagNameNS(this.namespaceURI, "*", true).length 
          && (this.childNodes.length > 1 || this.firstChild 
          && (this.firstChild.nodeType == 1 
          || this.firstChild.nodeValue.trim().length))) {
            //Get value from xml (could also serialize children, but that is slower
            var m = (this.$aml && this.$aml.xml || this.serialize()).match(re),
                v = m && m[2] || "";
            if (m && m[1])
                v = "{" + v + "}";
            
            this.setProperty(this.$childProperty, apf.html_entity_decode(v)); //@todo should be xml entity decode
        }
        else if (hasNoProp)
            this.$propHandlers[this.$childProperty].call(this, "");
    });
};












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

        this.$propHandlers["maxitems"].call(this, this.xmlRoot && this.each 
            ? this.getTraverseNodes().length : this.childNodes.length); //@todo apf3.0 count element nodes
        
        this.oSlider.style.display = "block";
        if (!this.ignoreOverflow) {
            this.oSlider.style[apf.supportOverflowComponent
                ? "overflowY"
                : "overflow"] = "visible";
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
        if (this.selected) {
            var htmlNode = apf.xmldb.findHtmlNode(this.selected, this);
            if (htmlNode) this.$setStyleClass(htmlNode, '', ["hover"]);
        }
        
        this.$setStyleClass(this.$ext, '', [this.$baseCSSname + "Down"]);
        if (apf.popup.last == this.$uniqueId)
            apf.popup.hide();
        return false;
    };
    
    
    this.load = function(data, options) {
        if (typeof data == "string" || options) {
            debugger
        }
        this.data = data;
    };
    
    this.select = function(value) {
        var caption = "";
        this.childNodes.some(function(x) { 
            if (x.getAttribute("value") == value) {
                caption = x.getAttribute("caption") || value;
                return true;
            }
        });
        this.$setLabel(caption);
        "afterselect"
    };
    
    // *** Private methods and event handlers *** //

    //@todo apf3.0 why is this function called 6 times on init.
    this.$setLabel = function(value) {
        this.oLabel.innerHTML = value || this["initial-message"] || "";
        

        this.$setStyleClass(this.$ext, value ? "" : this.$baseCSSname + "Initial",
            !value ? [] : [this.$baseCSSname + "Initial"]);
    };

    this.addEventListener("afterselect", function(e) {
        debugger
    //     if (!e) e = event;

    //     this.slideUp();
    //     if (!this.isOpen)
    //         this.$setStyleClass(this.$ext, "", [this.$baseCSSname + "Over"]);
        
    //     this.$setLabel(e.selection.length
    //       ? this.$applyBindRule("caption", this.selected)
    //       : "");
    });
    
    function setMaxCount() {
        if (this.isOpen == 2)
            this.slideDown();
    }

    this.addEventListener("afterload", setMaxCount);
    this.addEventListener("xmlupdate", function() {
        setMaxCount.call(this);
        this.$setLabel(this.$applyBindRule("caption", this.selected));
    });
    
    // Private functions
    this.$blur = function() {
        this.slideUp();
        //this.$ext.dispatchEvent("mouseout")
        if (!this.isOpen)
            this.$setStyleClass(this.$ext, "", [this.$baseCSSname + "Over"])
        
        this.$setStyleClass(this.$ext, "", [this.$baseCSSname + "Focus"]);
    };
    
    /*this.$focus = function(){
        apf.popup.forceHide();
        this.$setStyleClass(this.oFocus || this.$ext, this.$baseCSSname + "Focus");
    }*/
    
    this.$setClearMessage = function(msg) {
        this.$setLabel(msg);
    };
    
    this.$removeClearMessage = function() {
        this.$setLabel("");
    };

    this.addEventListener("popuphide", this.slideUp);
    
    this.setChildren = function(data) {
        
    };
    
    this.setValue = function() {
        
    };
    // *** Keyboard Support *** //
    
    
    this.addEventListener("keydown", function(e) {
        debugger
        var key = e.keyCode;
        
        var node;
        
        switch (key) {
            case 32:
                this.slideToggle(e.htmlEvent);
            break;
            case 38:
                //UP
                if (e.altKey) {
                    this.slideToggle(e.htmlEvent);
                    return;
                }
                
                if (!this.selected) 
                    return;
                    
                node = this.getNextTraverseSelected(this.caret
                    || this.selected, false);

                if (node)
                    this.select(node);
            break;
            case 40:
                //DOWN
                if (e.altKey) {
                    this.slideToggle(e.htmlEvent);
                    return;
                }
                
                if (!this.selected) {
                    node = this.getFirstTraverseNode();
                    if (!node) 
                        return;
                } 
                else
                    node = this.getNextTraverseSelected(this.selected, true);
                
                if (node)
                    this.select(node);
                
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
                
                var caption, nodes = this.getTraverseNodes();
                for (var i = 0; i < nodes.length; i++) {
                    caption = this.$applyBindRule("caption", nodes[i]);
                    if (caption && caption.indexOf(this.lookup.str) > -1) {
                        this.select(nodes[i]);
                        return;
                    }
                }
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
        this.$pHtmlDoc = apf.popup.setContent(this.$uniqueId, this.oSlider,
            apf.skins.getCssString(this.skinName));
        
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