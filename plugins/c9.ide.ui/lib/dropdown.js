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

        
        if (v.indexOf("{") > -1 || v.indexOf("[") > -1)
            this.$setDynamicProperty(this.$childProperty, v);
        else
        
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
           if (!this.$norecur && !e.value && !this.getAttributeNode(this.$childProperty))
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

            
            if (v.indexOf("{") > -1 || v.indexOf("[") > -1)
                this.$setDynamicProperty(this.$childProperty, v);
            else
            
                this.setProperty(this.$childProperty, apf.html_entity_decode(v)); //@todo should be xml entity decode
        }
        else if (hasNoProp)
            this.$propHandlers[this.$childProperty].call(this, "");
    });
};







apf.__DATAACTION__ = 1 << 25;


/**
 * A [[term.baseclass baseclass]] that adds data action features to this element.
 * @class apf.DataAction
 */
apf.DataAction = function(){};



apf.__CACHE__ = 1 << 2;


apf.GuiElement.propHandlers["caching"] = function(value) {
    debugger
};













/**
 * The baseclass of elements that allows the user to select one or more items
 * out of a list.
 *
 * @class apf.BaseList
 * @baseclass
 *
 * @inherits apf.MultiSelect
 * @inherits apf.Cache
 * @inherits apf.DataAction
 * @inheritsElsewhere apf.XForms
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.8
 * @default_private
 *
 */
/**
 * @binding caption  Determines the caption of a node.
 */
/**
 * @binding icon     Determines the icon of a node. 
*
 * This binding rule is used
 * to determine the icon displayed when using a list skin. The {@link baseclass.baselist.binding.image image binding}
 * is used to determine the image in the thumbnail skin.
 */
/**
 * @binding image    Determines the image of a node. 
 * 
 * This binding rule is used
 * to determine the image displayed when using a thumbnail skin. The {@link baseclass.baselist.binding.icon icon binding}
 * is used to determine the icon in the list skin.
 *
 * #### Example
 *
 * In this example, the image URL is read from the thumbnail attribute of the data node.
 *
 * ```xml
 *  <a:thumbnail>
 *      <a:model>
 *          <data>
 *              <image caption="Thumb 1" thumbnail="img1" />
 *              <image caption="Thumb 2" thumbnail="img2" />
 *              <image caption="Thumb 3" />
 *          </data>
 *      </a:model>
 *      <a:bindings>
 *          <a:caption match="[@caption]" />
 *          <a:image match="[@thumbnail]" value="images/slideshow_img/[@thumbnail]_small.jpg" />
 *          <a:image value="images/slideshow_img/img29_small.jpg" />
 *          <a:each match="[image]" />
 *      </a:bindings>
 *  </a:thumbnail>
 * ```
 *
 */
/**
 * @binding css      Determines a CSS class for a node.
 *
 * #### Example
 *
 * In this example a node is bold when the folder contains unread messages:
 *
 * ```xml
 *  <a:tree>
 *      <a:model>
 *          <data>
 *              <folder caption="Folder 1">
 *                  <message unread="true" caption="message 1" />
 *              </folder>
 *              <folder caption="Folder 2" icon="email.png">
 *                  <message caption="message 2" />
 *              </folder>
 *              <folder caption="Folder 3">
 *                  <message caption="message 3" />
 *                  <message caption="message 4" />
 *              </folder>
 *          </data>
 *      </a:model>
 *      <a:bindings>
 *          <a:caption match="[@caption]" />
 *          <a:css match="[message[@unread]]" value="highlighUnread" />
 *          <a:icon match="[@icon]" />
 *          <a:icon match="[folder]" value="Famfolder.gif" />
 *          <a:each match="[folder|message]" />
 *      </a:bindings>
 *  </a:tree>
 * ```
 *
 */
/**
 * @binding tooltip  Determines the tooltip of a node. 
 */
/**
 * @event notunique Fires when the `more` attribute is set and an item is added that has a caption that already exists in the list.
 * @param {Object} e The standard event object, with the following properties:
 *                    - value ([[String]]): The value that was entered
 */
apf.BaseList = function() {
    this.$init(true);
    
    
    this.$dynCssClasses = [];
    
    
    this.listNodes = [];
};

(function() {
    
    this.implement(
        
        apf.DataAction,
        
        
        apf.K
    );
    

    // *** Properties and Attributes *** //

    this.$focussable = true; // This object can get the focus
    this.$isWindowContainer = -1;
    
    this.multiselect = true; // Initially Disable MultiSelect

    /**
     * @attribute {String} fill Sets or gets the set of items that should be loaded into this
     * element. Items are seperated by a comma (`,`). Ranges are specified by a start and end value seperated by a dash (`-`).
     *
     * #### Example
     *
     * This example loads a list with items starting at 1980 and ending at 2050. It also loads several other items and ranges.
     *
     * ```xml
     *  <a:dropdown fill="1980-2050" />
     *  <a:dropdown fill="red,green,blue,white" />
     *  <a:dropdown fill="None,100-110,1000-1100" /> <!-- 101, 102...110, 1000,1001, e.t.c. -->
     *  <a:dropdown fill="01-10" /> <!-- 01, 02, 03, 04, e.t.c. -->
     *  <a:dropdown fill="1-10" /> <!-- // 1 2 3 4 e.t.c. -->

     * ```
     */
    this.$propHandlers["fill"] = function(value) {
        if (value)
            this.loadFillData(this.getAttribute("fill"));
        else
            this.clear();
    };
    
    
    
    /**
     * @attribute {String} mode Sets or gets the way this element interacts with the user.
     *  
     * The following values are possible:
     *
     *   - `check`: the user can select a single item from this element. The selected item is indicated.
     *   - `radio`: the user can select multiple items from this element. Each selected item is indicated.
     */
    this.$mode = 0;
    this.$propHandlers["mode"] = function(value) {
        if ("check|radio".indexOf(value) > -1) {
            if (!this.hasFeature(apf.__MULTICHECK__))
                this.implement(apf.MultiCheck);
            
            this.addEventListener("afterrename", $afterRenameMode); //what does this do?
            
            this.multicheck = value == "check"; //radio is single
            this.$mode = this.multicheck ? 1 : 2;
        }
        else {
            this.removeEventListener("afterrename", $afterRenameMode);
            //@todo unimplement??
            this.$mode = 0;
        }
    };
    
    //@todo apf3.0 retest this completely
    function $afterRenameMode() {
    }
    
    

    // *** Keyboard support *** //

    

    //Handler for a plane list
    this.$keyHandler = function(e) {
        var key = e.keyCode,
            ctrlKey = e.ctrlKey,
            shiftKey = e.shiftKey,
            selHtml = this.$caret || this.$selected;

        if (e.returnValue == -1 || !selHtml || this.renaming) //@todo how about allowdeselect?
            return;

        var selXml = this.caret || this.selected,
            oExt = this.$ext,
            // variables used in the switch statement below:
            node, margin, items, lines, hasScroll, hasScrollX, hasScrollY;

        switch (key) {
            case 13:
                if (this.$tempsel)
                    this.$selectTemp();

                if (this.ctrlselect == "enter")
                    this.select(this.caret, true);

                this.choose(this.selected);
                break;
            case 32:
                if (ctrlKey || !this.isSelected(this.caret))
                    this.select(this.caret, ctrlKey);
                break;
            case 109:
            case 46:
                //DELETE
                if (this.disableremove)
                    return;

                if (this.$tempsel)
                    this.$selectTemp();

                this.remove();
                break;
            case 36:
                //HOME
                var node = this.getFirstTraverseNode();
                
                
                if (this.hasFeature(apf.__VIRTUALVIEWPORT__))
                    return this.$viewport.scrollIntoView(node);
                
                    
                this.select(node, false, shiftKey);
                this.$container.scrollTop = 0;
                break;
            case 35:
                //END
                var node = this.getLastTraverseNode();
                
                
                if (this.hasFeature(apf.__VIRTUALVIEWPORT__))
                    return this.$viewport.scrollIntoView(node, true);
                
                
                this.select(node, false, shiftKey);
                this.$container.scrollTop = this.$container.scrollHeight;
                break;
            case 107:
                //+
                if (this.more)
                    this.startMore();
                break;
            case 37:
                //LEFT
                if (!selXml && !this.$tempsel)
                    return;

                node = this.$tempsel
                    ? apf.xmldb.getNode(this.$tempsel)
                    : selXml;
                margin = apf.getBox(apf.getStyle(selHtml, "margin"));
                items = selHtml.offsetWidth
                    ? Math.floor((oExt.offsetWidth
                        - (hasScroll ? 15 : 0)) / (selHtml.offsetWidth
                        + margin[1] + margin[3]))
                    : 1;

                //margin = apf.getBox(apf.getStyle(selHtml, "margin"));

                node = this.getNextTraverseSelected(node, false);
                if (node)
                    this.$setTempSelected(node, ctrlKey, shiftKey, true);
                else
                    return;

                selHtml = apf.xmldb.findHtmlNode(node, this);
                if (selHtml.offsetTop < oExt.scrollTop) {
                    oExt.scrollTop = Array.prototype.indexOf.call(this.getTraverseNodes(), node) < items
                        ? 0
                        : selHtml.offsetTop - margin[0];
                }
                break;
            case 38:
                //UP
                if (!selXml && !this.$tempsel)
                    return;

                node = this.$tempsel
                    ? apf.xmldb.getNode(this.$tempsel)
                    : selXml;

                margin = apf.getBox(apf.getStyle(selHtml, "margin"));
                hasScroll = oExt.scrollHeight > oExt.offsetHeight;
                items = selHtml.offsetWidth
                    ? Math.floor((oExt.offsetWidth
                        - (hasScroll ? 15 : 0)) / (selHtml.offsetWidth
                        + margin[1] + margin[3]))
                    : 1;

                node = this.getNextTraverseSelected(node, false, items);
                if (node)
                    this.$setTempSelected (node, ctrlKey, shiftKey, true);
                else
                    return;
                
                
                if (this.hasFeature(apf.__VIRTUALVIEWPORT__))
                    return this.$viewport.scrollIntoView(node);
                
                
                selHtml = apf.xmldb.findHtmlNode(node, this);
                if (selHtml.offsetTop < oExt.scrollTop) {
                    oExt.scrollTop = Array.prototype.indexOf.call(this.getTraverseNodes(), node) < items
                        ? 0
                        : selHtml.offsetTop - margin[0];
                }
                break;
            case 39:
                //RIGHT
                if (!selXml && !this.$tempsel)
                    return;

                node = this.$tempsel
                    ? apf.xmldb.getNode(this.$tempsel)
                    : selXml;
                margin = apf.getBox(apf.getStyle(selHtml, "margin"));
                node = this.getNextTraverseSelected(node, true);
                if (node)
                    this.$setTempSelected (node, ctrlKey, shiftKey);
                else
                    return;

                selHtml = apf.xmldb.findHtmlNode(node, this);
                if (selHtml.offsetTop + selHtml.offsetHeight
                  > oExt.scrollTop + oExt.offsetHeight) {
                    oExt.scrollTop = selHtml.offsetTop
                        - oExt.offsetHeight + selHtml.offsetHeight
                        + margin[0];
                }
                break;
            case 40:
                //DOWN
                if (!selXml && !this.$tempsel)
                    return;

                node = this.$tempsel
                    ? apf.xmldb.getNode(this.$tempsel)
                    : selXml;

                margin = apf.getBox(apf.getStyle(selHtml, "margin"));
                hasScroll = oExt.scrollHeight > oExt.offsetHeight;
                items = selHtml.offsetWidth
                    ? Math.floor((oExt.offsetWidth
                        - (hasScroll ? 15 : 0)) / (selHtml.offsetWidth
                        + margin[1] + margin[3]))
                    : 1;

                node = this.getNextTraverseSelected(node, true, items);
                if (node)
                    this.$setTempSelected (node, ctrlKey, shiftKey);
                else
                    return;

                
                if (this.hasFeature(apf.__VIRTUALVIEWPORT__))
                    return this.$viewport.scrollIntoView(node, true);
                
                
                selHtml = apf.xmldb.findHtmlNode(node, this);
                if (selHtml.offsetTop + selHtml.offsetHeight
                  > oExt.scrollTop + oExt.offsetHeight) { // - (hasScroll ? 10 : 0)
                    oExt.scrollTop = selHtml.offsetTop
                        - oExt.offsetHeight + selHtml.offsetHeight
                        + margin[0]; //+ (hasScroll ? 10 : 0)
                }
                break;
            case 33:
                //PGUP
                if (!selXml && !this.$tempsel)
                    return;

                node = this.$tempsel
                    ? apf.xmldb.getNode(this.$tempsel)
                    : selXml;

                margin = apf.getBox(apf.getStyle(selHtml, "margin"));
                hasScrollY = oExt.scrollHeight > oExt.offsetHeight;
                hasScrollX = oExt.scrollWidth > oExt.offsetWidth;
                items = Math.floor((oExt.offsetWidth
                    - (hasScrollY ? 15 : 0)) / (selHtml.offsetWidth
                    + margin[1] + margin[3]));
                lines = Math.floor((oExt.offsetHeight
                    - (hasScrollX ? 15 : 0)) / (selHtml.offsetHeight
                    + margin[0] + margin[2]));

                node = this.getNextTraverseSelected(node, false, items * lines);
                if (!node)
                    node = this.getFirstTraverseNode();
                if (node)
                    this.$setTempSelected (node, ctrlKey, shiftKey, true);
                else
                    return;
                
                
                if (this.hasFeature(apf.__VIRTUALVIEWPORT__))
                    return this.$viewport.scrollIntoView(node);
                
                
                selHtml = apf.xmldb.findHtmlNode(node, this);
                if (selHtml.offsetTop < oExt.scrollTop) {
                    oExt.scrollTop = Array.prototype.indexOf.call(this.getTraverseNodes(), node) < items
                        ? 0
                        : selHtml.offsetTop - margin[0];
                }
                break;
            case 34:
                //PGDN
                if (!selXml && !this.$tempsel)
                    return;

                node = this.$tempsel
                    ? apf.xmldb.getNode(this.$tempsel)
                    : selXml;

                margin = apf.getBox(apf.getStyle(selHtml, "margin"));
                hasScrollY = oExt.scrollHeight > oExt.offsetHeight;
                hasScrollX = oExt.scrollWidth > oExt.offsetWidth;
                items = Math.floor((oExt.offsetWidth - (hasScrollY ? 15 : 0))
                    / (selHtml.offsetWidth + margin[1] + margin[3]));
                lines = Math.floor((oExt.offsetHeight - (hasScrollX ? 15 : 0))
                    / (selHtml.offsetHeight + margin[0] + margin[2]));

                node = this.getNextTraverseSelected(selXml, true, items * lines);
                if (!node)
                    node = this.getLastTraverseNode();
                if (node)
                    this.$setTempSelected (node, ctrlKey, shiftKey);
                else
                    return;
                
                
                if (this.hasFeature(apf.__VIRTUALVIEWPORT__))
                    return this.$viewport.scrollIntoView(node, true);
                
                
                selHtml = apf.xmldb.findHtmlNode(node, this);
                if (selHtml.offsetTop + selHtml.offsetHeight
                  > oExt.scrollTop + oExt.offsetHeight) { // - (hasScrollY ? 10 : 0)
                    oExt.scrollTop = selHtml.offsetTop
                        - oExt.offsetHeight + selHtml.offsetHeight
                        + margin[0]; //+ 10 + (hasScrollY ? 10 : 0)
                }
                break;

            default:
                if (key == 65 && ctrlKey) {
                    this.selectAll();
                }
                else if (this.$hasBindRule("caption")) {
                    if (!this.xmlRoot || this.autorename) return;

                    //this should move to a onkeypress based function
                    if (!this.lookup || new Date().getTime()
                      - this.lookup.date.getTime() > 300) {
                        this.lookup = {
                            str: "",
                            date: new Date()
                        };
                    }

                    this.lookup.str += String.fromCharCode(key);

                    var nodes = this.getTraverseNodes(); //@todo start at current indicator
                    for (var v, i = 0; i < nodes.length; i++) {
                        v = this.$applyBindRule("caption", nodes[i]);
                        if (v && v.substr(0, this.lookup.str.length)
                          .toUpperCase() == this.lookup.str) {

                            if (!this.isSelected(nodes[i])) {
                                this.select(nodes[i]);
                            }

                            if (selHtml) {
                                this.$container.scrollTop = selHtml.offsetTop
                                    - (this.$container.offsetHeight
                                    - selHtml.offsetHeight) / 2;
                            }
                            return;
                        }
                    }
                    return;
                }
                break;
        }

        this.lookup = null;
        return false;
    };

    

    // *** Private databinding functions *** //

    this.$deInitNode = function(xmlNode, htmlNode) {
        if (!htmlNode) return;

        //Remove htmlNodes from tree
        htmlNode.parentNode.removeChild(htmlNode);
    };

    this.$updateNode = function(xmlNode, htmlNode, noModifier) {
        //Update Identity (Look)
        var elIcon = this.$getLayoutNode("item", "icon", htmlNode);

        if (elIcon) {
            if (elIcon.nodeType == 1) {
                elIcon.style.backgroundImage = "url(" + 
                  apf.getAbsolutePath(this.iconPath,
                      this.$applyBindRule("icon", xmlNode)) + ")";
            }
            else {
                elIcon.nodeValue = apf.getAbsolutePath(this.iconPath,
                    this.$applyBindRule("icon", xmlNode));
            }
        }
        else {
            //.style.backgroundImage = "url(" + this.$applyBindRule("image", xmlNode) + ")";
            var elImage = this.$getLayoutNode("item", "image", htmlNode);
            if (elImage) {
                if (elImage.nodeType == 1) {
                    elImage.style.backgroundImage = "url(" + 
                        apf.getAbsolutePath(apf.hostPath,
                            this.$applyBindRule("image", xmlNode)) + ")";
                }
                else {
                    elImage.nodeValue = apf.getAbsolutePath(apf.hostPath, 
                        this.$applyBindRule("image", xmlNode));
                }
            }
        }

        var elCaption = this.$getLayoutNode("item", "caption", htmlNode);
        if (elCaption) {
            if (elCaption.nodeType == 1) {
                
                    elCaption.innerHTML = this.$applyBindRule("caption", xmlNode);
            }
            else
                elCaption.nodeValue = this.$applyBindRule("caption", xmlNode);
        }
        
        
        //@todo
        

        htmlNode.title = this.$applyBindRule("title", xmlNode) || "";

        
        var cssClass = this.$applyBindRule("css", xmlNode);

        if (cssClass || this.$dynCssClasses.length) {
            this.$setStyleClass(htmlNode, cssClass, this.$dynCssClasses);
            if (cssClass && !this.$dynCssClasses.contains(cssClass)) {
                this.$dynCssClasses.push(cssClass);
            }
        }
        

        if (!noModifier && this.$updateModifier)
            this.$updateModifier(xmlNode, htmlNode);
    };

    this.$moveNode = function(xmlNode, htmlNode) {
        if (!htmlNode) return;

        var oPHtmlNode = htmlNode.parentNode;
        var nNode = this.getNextTraverse(xmlNode); //@todo could optimize because getTraverseNodes returns array indexOf
        var beforeNode = nNode
            ? apf.xmldb.findHtmlNode(nNode, this)
            : null;

        oPHtmlNode.insertBefore(htmlNode, beforeNode);
        //if(this.emptyMessage && !oPHtmlNode.childNodes.length) this.setEmpty(oPHtmlNode);
    };

    this.$add = function(xmlNode, Lid, xmlParentNode, htmlParentNode, beforeNode) {

    };
    
    this.addEventListener("$skinchange", function(e) {
        if (this.more)
            delete this.moreItem;
    });

    this.$fill = function() {
        if (this.more && !this.moreItem) {
            this.$getNewContext("item");
            var Item = this.$getLayoutNode("item"),
                elCaption = this.$getLayoutNode("item", "caption"),
                elSelect = this.$getLayoutNode("item", "select");

            Item.setAttribute("class", this.$baseCSSname + "More");
            elSelect.setAttribute("onmousedown", 'var o = apf.lookup(' + this.$uniqueId
                + ');o.clearSelection();o.$setStyleClass(this, "more_down", null, true);');
            elSelect.setAttribute("onmouseout", 'apf.lookup(' + this.$uniqueId
                + ').$setStyleClass(this, "", ["more_down"], true);');
            elSelect.setAttribute("onmouseup", 'apf.lookup(' + this.$uniqueId
                + ').startMore(this, true)');

            if (elCaption)
                apf.setNodeValue(elCaption,
                    this.more.match(/caption:(.*)(;|$)/i)[1]);
            this.listNodes.push(Item);
        }

        apf.insertHtmlNodes(this.listNodes, this.$container);
        this.listNodes.length = 0;

        if (this.more && !this.moreItem) {
            this.moreItem = this.$container.lastChild;
        }
            
    };

    /**
     * Adds a new item to the list, and lets the users type in the new name.
     *
     * This functionality is especially useful in the interface when
     * the list mode is set to `check` or `radio`--for instance in a form.
     */
    this.startMore = function(o, userAction) {
        if (userAction && this.disabled)
            return;

        this.$setStyleClass(o, "", ["more_down"]);

        var xmlNode;
        if (!this.$actions["add"]) {
            if (this.each && !this.each.match(/[\/\[]/)) {
                xmlNode = "<" + this.each + (this.each.match(/^a:/) 
                    ? " xmlns:a='" + apf.ns.aml + "'" 
                    : "") + " custom='1' />";
            }
            else {
                
                //return false;
                xmlNode = "<item />";
            }
        }

        this.add(xmlNode, null, null, function(addedNode) {
            this.select(addedNode, null, null, null, null, true);
            if (this.morePos == "begin")
                this.$container.insertBefore(this.moreItem, this.$container.firstChild);
            else
                this.$container.appendChild(this.moreItem);
    
            var undoLastAction = function() {
                this.getActionTracker().undo(this.autoselect ? 2 : 1);
    
                this.removeEventListener("stoprename", undoLastAction);
                this.removeEventListener("beforerename", removeSetRenameEvent);
                this.removeEventListener("afterrename", afterRename);
            }
            var afterRename = function() {
                //this.select(addedNode);
                this.removeEventListener("afterrename", afterRename);
            };
            var removeSetRenameEvent = function(e) {
                this.removeEventListener("stoprename", undoLastAction);
                this.removeEventListener("beforerename", removeSetRenameEvent);
    
                //There is already a choice with the same value
                var xmlNode = this.findXmlNodeByValue(e.args[1]);
                if (xmlNode || !e.args[1]) {
                    if (e.args[1] && this.dispatchEvent("notunique", {
                        value: e.args[1]
                    }) === false) {
                        this.startRename();
                        
                        this.addEventListener("stoprename", undoLastAction);
                        this.addEventListener("beforerename", removeSetRenameEvent);
                    }
                    else {
                        this.removeEventListener("afterrename", afterRename);
                        
                        this.getActionTracker().undo();//this.autoselect ? 2 : 1);
                        if (!this.isSelected(xmlNode))
                            this.select(xmlNode);
                    }
                    
                    return false;
                }
            };
    
            this.addEventListener("stoprename", undoLastAction);
            this.addEventListener("beforerename", removeSetRenameEvent);
            this.addEventListener("afterrename", afterRename);
    
            
            this.startDelayedRename({}, 1);
            
        });
    };

    // *** Selection *** //

    this.$calcSelectRange = function(xmlStartNode, xmlEndNode) {
        var r = [],
            nodes = this.hasFeature(apf.__VIRTUALVIEWPORT__)
                ? this.xmlRoot.selectNodes(this.each)
                : this.getTraverseNodes(),
            f, i;
        for (f = false, i = 0; i < nodes.length; i++) {
            if (nodes[i] == xmlStartNode)
                f = true;
            if (f)
                r.push(nodes[i]);
            if (nodes[i] == xmlEndNode)
                f = false;
        }

        if (!r.length || f) {
            r = [];
            for (f = false, i = nodes.length - 1; i >= 0; i--) {
                if (nodes[i] == xmlStartNode)
                    f = true;
                if (f)
                    r.push(nodes[i]);
                if (nodes[i] == xmlEndNode)
                    f = false;
            }
        }

        return r;
    };

    this.$selectDefault = function(XMLRoot) {
        this.select(this.getTraverseNodes()[0], null, null, null, true);
    };

    /**
     * Generates a list of items based on a string.
     * @param {String} str The description of the items. Items are seperated by a comma (`,`). Ranges are specified by a start and end value seperated by a dash (`-`).
     *
     * #### Example
     *
     * This example loads a list with items starting at 1980 and ending at 2050.
     *
     * #### ```xml
     *  lst.loadFillData("1980-2050");
     *  lst.loadFillData("red,green,blue,white");
     *  lst.loadFillData("None,100-110,1000-1100"); // 101, 102...110, 1000,1001, e.t.c.
     *  lst.loadFillData("1-10"); // 1 2 3 4 e.t.c.
     *  lst.loadFillData("01-10"); //01, 02, 03, 04, e.t.c.
     * ```
     */
    this.loadFillData = function(str) {
        var len, start, end, parts = str.splitSafe(","), data = [];
        
        for (var p, part, i = 0; i < parts.length; i++) {
            if ((part = parts[i]).match(/^\d+-\d+$/)) {
                p = part.split("-");
                start = parseInt(p[0]);
                end = parseInt(p[1]);
                
                if (p[0].length == p[1].length) {
                    len = Math.max(p[0].length, p[1].length);
                    for (var j = start; j < end + 1; j++) {
                        data.push("<item>" + (j + "").pad(len, "0") + "</item>");
                    }
                }
                else {
                    for (var j = start; j < end + 1; j++) {
                        data.push("<item>" + j + "</item>");
                    }
                }
            }
            else {
                data.push("<item>" + part + "</item>");
            }
        }
        
        //@todo this is all an ugly hack (copied from item.js line 486)
        //this.$preventDataLoad = true;//@todo apf3.0 add remove for this
        
        this.$initingModel = true;
        
        this.each = "item";
        this.$setDynamicProperty("caption", "[label/text()|@caption|text()]");
        this.$setDynamicProperty("eachvalue", "[value/text()|@value|text()]");
        this.$canLoadDataAttr = false;

        this.load("<data>" + data.join("") + "</data>");
    };

}).call(apf.BaseList.prototype = new apf.MultiSelect());








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
 * @inherits apf.BaseList
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

    
}).call(apf.dropdown.prototype = new apf.BaseList());

apf.config.$inheritProperties["initial-message"] = 1;

apf.aml.setElement("dropdown", apf.dropdown);














/**
 * This element displays a skinnable list of options which can be selected.
 * 
 * Selection of multiple items is allowed. Items can be renamed
 * and removed. The list can be used as a collection of checkboxes or 
 * radiobuttons. This is especially useful for use in forms.
 * 
 * This element is one of the most often used elements. It can display lists
 * of items in a CMS-style interface, or display a list of search results in 
 * a more website like interface.
 * 
 * #### Example: A Simple List
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:list>
 *      <a:item>The Netherlands</a:item>
 *      <a:item>United States of America</a:item>
 *      <a:item>United Kingdom</a:item> 
 *   </a:list>
 *   <!-- endcontent -->
 * </a:application>
 * ```
 * 
 * #### Example: Loading from a Model
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:list 
 *     model = "/api/resources/xml/friends.xml"
 *     each = "[friend]"
 *     caption = "[@name]"
 *     icon = "[@icon]"
 *     width = "300">
 *   </a:list>
 *   <!-- endcontent -->
 * </a:application>
 * ```
 * 
 * #### Example: Using XPaths
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:list model="/api/apf/resources/xml/friends.xml" width="300">
 *       <a:each match="[friend]">
 *           <a:caption match="[@name]" />
 *           <a:icon 
 *             match = "[node()[@name='Ruben' or @name='Matt']]" 
 *             value = "/api/apf/resources/icons/medal_gold_1.png" />
 *           <a:icon value="/api/apf/resources/icons/medal_silver_1.png" />
 *       </a:each>
 *   </a:list>
 *   <!-- endcontent -->
 * </a:application>
 * ```
 * @class apf.list
 * @define list
 * @allowchild {smartbinding}
 *
 * @selection
 * @inherits apf.BaseList
 * @inherits apf.Rename
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.4
 */
/**
 * @event click Fires when a user presses a mouse button while over this element.
 */

apf.list = function(struct, tagName) {
    this.$init(tagName || "list", apf.NODE_VISIBLE, struct);
};

(function() {
    this.morePos = "end";
    
    
    
    this.$getCaptionElement = function() {
        if (!(this.$caret || this.$selected))
            return;
        
        var x = this.$getLayoutNode("item", "caption", this.$caret || this.$selected);
        if (!x) 
            return;
        return x.nodeType == 1 ? x : x.parentNode;
    };
    
    
    
    
    
    
    
    // *** Properties and Attributes *** //
    
    this.$supportedProperties.push("appearance", "mode", "more", "thumbsize", "morepos");
    
    this.$propHandlers["morepos"] = function(value) {
        this.morePos = value; 
    };
    
    this.$propHandlers["thumbsize"] = function(value) {
        var className = this.thumbclass;
        
        apf.setStyleRule(className, "width", value + "px");
        apf.setStyleRule(className, "height", value + "px");
    };
    
    
    /**
     * @attribute {String} appearance Sets or gets the type of select this element is. 
     * This is an xforms property and only available if APF is compiled 
     * with `__WITH_XFORMS` set to `1`.
     *   
     * Possible values include:
     * 
     *   - `"full"` :    depending on the tagName this element is either a list of radio options or of checked options.
     *   - `"compact"`:  this elements functions like a list with multiselect off.
     *   - `"minimal"`:  this element functions as a dropdown element.
     */
    this.$propHandlers["appearance"] = function(value) {
        
    };
    
    
    /**
     * @attribute {String} more Adds a new item to the list and lets the users 
     * type in the new name. This is especially useful in the interface when 
     * the mode is set to check or radio--for instance in a form.
     * 
     * #### Example
     * 
     * This example shows a list in form offering the user several options. The
     * user can add a new option. A server script could remember the addition
     * and present it to all new users of the form.
     * 
     * ```xml
     *  <a:model id="mdlSuggestions">
     *      <suggestions>
     *          <question key="krant">
     *              <answer>Suggestion 1</answer>
     *              <answer>Suggestion 2</answer>
     *          </question>
     *      </suggestions>
     * </a:model>
     * <a:label>Which newspapers do you read?</a:label>
     * <a:list value="[krant]" 
     *   more = "caption:Add new suggestion" 
     *   model = "[mdlSuggestions::question[@key='krant']]">
     *     <a:bindings>
     *         <a:caption match="[text()]" />
     *         <a:value match="[text()]" />
     *         <a:each match="[answer]" />
     *     </a:bindings>
     *     <a:actions>
     *         <a:rename match="[node()[@custom='1']]" />
     *         <a:remove match="[node()[@custom='1']]" />
     *         <a:add>
     *             <answer custom="1">New Answer</answer>
     *         </a:add>
     *     </a:actions>
     *  </a:list>
     * ```
     */
    this.$propHandlers["more"] = function(value) {
        if (value) {
            this.delayedselect = false;
            this.addEventListener("xmlupdate", $xmlUpdate);
            this.addEventListener("afterload", $xmlUpdate);
            //this.addEventListener("afterrename", $afterRenameMore);
            //this.addEventListener("beforeselect", $beforeSelect);
            
            this.$addMoreItem = function(msg) {
                if (!this.moreItem)
                    this.$fill();
                if (this.morePos == "begin")
                    this.$container.insertBefore(this.moreItem, this.$container.firstChild);
                else
                    this.$container.appendChild(this.moreItem);
            };
            this.$updateClearMessage = function(){}
            this.$removeClearMessage = function() {};
        }
        else {
            this.removeEventListener("xmlupdate", $xmlUpdate);
            this.removeEventListener("afterload", $xmlUpdate);
            //this.removeEventListener("afterrename", $afterRenameMore);
            //this.removeEventListener("beforeselect", $beforeSelect);
        }
    };
    
    function $xmlUpdate(e) {
        if ((!e.action || "insert|add|synchronize|move".indexOf(e.action) > -1) && this.moreItem) {
            if (this.morePos == "begin")
                this.$container.insertBefore(this.moreItem, this.$container.firstChild);
            else
                this.$container.appendChild(this.moreItem);
        }
    }
    
    /*function $afterRenameMore(){
        var caption = this.$applyBindRule("caption", this.caret)
        var xmlNode = this.findXmlNodeByValue(caption);

        var curNode = this.caret;
        if (xmlNode != curNode || !caption) {
            if (xmlNode && !this.isSelected(xmlNode)) 
                this.select(xmlNode);
            this.remove(curNode);
        }
        else 
            if (!this.isSelected(curNode)) 
                this.select(curNode);
    }
    
    function $beforeSelect(e) {
        //This is a hack
        if (e.xmlNode && this.isSelected(e.xmlNode) 
          && e.xmlNode.getAttribute('custom') == '1') {
            this.setCaret(e.xmlNode);
            this.selected = e.xmlNode;
            $setTimeout(function(){
                _self.startRename()
            });
            return false;
        }
    }*/
    
    
    // *** Keyboard support *** //
    
    
    this.addEventListener("keydown", this.$keyHandler, true);
    
    
    // *** Init *** //
    
    this.$draw = function() {
        this.appearance = this.getAttribute("appearance") || "compact";

        //Build Main Skin
        this.$ext = this.$getExternal();
        this.$container = this.$getLayoutNode("main", "container", this.$ext);
        
        var _self = this;
        this.$ext.onclick = function(e) {
            _self.dispatchEvent("click", {
                htmlEvent: e || event
            });
        }
        
        
        
        //Get Options form skin
        //Types: 1=One dimensional List, 2=Two dimensional List
        this.listtype = parseInt(this.$getOption("main", "type")) || 1;
        //Types: 1=Check on click, 2=Check independent
        this.behaviour = parseInt(this.$getOption("main", "behaviour")) || 1; 
        
        this.thumbsize = this.$getOption("main", "thumbsize");
        this.thumbclass = this.$getOption("main", "thumbclass");
    };
    
    this.$loadAml = function(x) {
    };
    
    this.$destroy = function() {
        if (this.$ext)
            this.$ext.onclick = null;
        apf.destroyHtmlNode(this.oDrag);
        this.oDrag = null;
    };
}).call(apf.list.prototype = new apf.BaseList());

apf.aml.setElement("list", apf.list);





};

});