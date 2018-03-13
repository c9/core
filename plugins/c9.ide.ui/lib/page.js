define(function(require, module, exports) {
return function(apf) {


/**
 * A page in a pageable element (_i.e._ a page in {@link apf.tab}).
 *
 * #### Example
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *  <!-- startcontent -->
 *  <a:window 
 *    visible = "true" 
 *    width = "400" 
 *    height = "150" 
 *    title = "Simple Tab" >
 *      <a:tab anchors="10 10 10 10"> 
 *          <a:page caption="General"> 
 *              <a:checkbox>Example</a:checkbox> 
 *              <a:button>Example</a:button> 
 *          </a:page> 
 *          <a:page caption="Advanced"> 
 *              <a:checkbox>Test checkbox</a:checkbox> 
 *              <a:checkbox>Test checkbox</a:checkbox> 
 *              <a:checkbox>Test checkbox</a:checkbox> 
 *          </a:page> 
 *          <a:page caption="Ajax.org"> 
 *              <a:checkbox>This ok?</a:checkbox> 
 *              <a:checkbox>This better?</a:checkbox> 
 *          </a:page> 
 *      </a:tab> 
 *  </a:window>
 *  <!-- endcontent -->
 * </a:application>
 * ```
 * 
 * @class apf.page
 * @define  page
 * @container
 * @inherits apf.Presentation
 * @allowchild  {elements}, {anyaml}
 *
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.8
 */
apf.page = function(struct, tagName) {
    this.$init(tagName || "page", apf.NODE_VISIBLE, struct);
};

(function() {
    this.canHaveChildren = true;
    
    this.$focussable = false;
    this.closebtn = false;
    this.autofocus = true;

    

    
    /**
     * Sets the caption of the button of this element.
     * @param {String} caption The text displayed on the button of this element.
     */
    this.setCaption = function(caption) {
        this.setProperty("caption", caption, false, true);
    };

    /**
     * Sets the icon of the button of this element.
     * @param {String} icon The icon displayed on the button of this element.
     */
    this.setIcon = function(icon) {
        this.setProperty("icon", icon, false, true);
    };
    

    // *** Delayed Render Support *** //

    
    //Hack
    this.addEventListener("beforerender", function() {
        this.parentNode.dispatchEvent("beforerender", {
            page: this
        });
    });

    this.addEventListener("afterrender", function() {
        this.parentNode.dispatchEvent("afterrender", {
            page: this
        });
    });
     

    // *** Properties *** //

    this.$booleanProperties["visible"] = true;
    this.$booleanProperties["fake"] = true;
    this.$booleanProperties["closebtn"] = true;
    this.$booleanProperties["autofocus"] = true;
    this.$supportedProperties.push("fake", "caption", "icon", "tooltip",
        "type", "buttons", "closebtn", "trans-in", "trans-out", "autofocus");

    
    /**
     * @attribute {Boolean} closebtn Sets or gets whether this page's button shows a close button inside it.
     */
    this.$propHandlers["closebtn"] = function(value) {
        //if (!this.$amlLoaded || !this.parentNode.$hasButtons)
          //  return;
        var _self = this;
        
        if (value) {
            var btncontainer = this.parentNode.$getLayoutNode("button", "container", this.$button);
            
            this.parentNode.$getNewContext("btnclose");
            var elBtnClose = this.parentNode.$getLayoutNode("btnclose");

            if (elBtnClose) {
               // if (elBtnClose.nodeType == 1) {
                apf.setStyleClass(this.$button, "btnclose");
                
                elBtnClose.addEventListener("mousedown", function(e) {
                    apf.cancelBubble(e, apf.lookup(_self.$uniqueId));
                }, false);
                
                elBtnClose.addEventListener("click", function(e) {
                    var page = apf.lookup(_self.$uniqueId);
                    page.parentNode.remove(page, e);
                }, false);

                btncontainer.appendChild(elBtnClose);
            }
            
        }
    };
    

    /**
     * @attribute {String} caption Sets or gets the text displayed on the button of this element.
     */
    this.$propHandlers["tooltip"] = function(value) {
        if (!this.parentNode)
            return;

        var node = this.parentNode
            .$getLayoutNode("button", "caption", this.$button);

        (node.nodeType == 1 ? node : node.parentNode).setAttribute("title", value || "");
    };

    /**
     * @attribute {String} caption Sets or gets the text displayed on the button of this element.
     */
    this.$propHandlers["caption"] = function(value) {
        if (!this.parentNode)
            return;

        var node = this.parentNode
            .$getLayoutNode("button", "caption", this.$button);

        if (node.nodeType == 1)
            node.textContent = value;
        else
            node.nodeValue = value;
    };

    this.$propHandlers["icon"] = function(value) {
        if (!this.parentNode)
            return;

        var node = this.parentNode
            .$getLayoutNode("button", "icon", this.$button);

        if (node && node.nodeType == 1)
            apf.skins.setIcon(node, value, this.parentNode.iconPath);
    };

    this.$propHandlers["visible"] = function(value) {
        if (!this.parentNode)
            return;

        if (value) {
            if (this.$fake) {
                this.parentNode.set(this.$fake); 
                this.visible = false;
                return;
            }
            
            this.$ext.style.display = "";
            if (this.parentNode.$hasButtons)
                this.$button.style.display = "block";

            if (!this.parentNode.$activepage)
                this.parentNode.set(this);
        }
        else {
            if (this.$active) {
                this.$deactivate();

                // Try to find a next page, if any.
                var nextPage = this.parentNode.activepagenr + 1;
                var pages = this.parentNode.getPages();
                var len = pages.length;
                while (nextPage < len && !pages[nextPage].visible)
                    nextPage++;

                if (nextPage == len) {
                    // Try to find a previous page, if any.
                    nextPage = this.parentNode.activepagenr - 1;
                    while (nextPage >= 0 && len && !pages[nextPage].visible)
                        nextPage--;
                }

                if (nextPage >= 0)
                    this.parentNode.set(nextPage);
                else {
                    this.parentNode.activepage = 
                    this.parentNode.activepagenr =
                    this.parentNode.$activepage = null;
                }
            }

            this.$ext.style.display = "none";
            if (this.parentNode.$hasButtons)
                this.$button.style.display = "none";
        }
    };

    /**
     * @attribute {Boolean} fake Sets or gets whether this page actually contains elements or
     * only provides a button in the pageable parent element.
     */
    this.$propHandlers["fake"] = function(value) {
        if (this.$ext) {
            apf.destroyHtmlNode(this.$ext);
            this.$int = this.$ext = null;
        }
    };

    this.$propHandlers["type"] = function(value) {
        this.setProperty("fake", true);
        
        if (this.relPage && this.$active)
            this.relPage.$deactivate();
        
        this.relPage = this.parentNode.getPage(value);
        if (this.$active)
            this.$activate();
    };

    // *** DOM Hooks *** //

    this.addEventListener("DOMNodeRemoved", function(e) {
        if (e && e.currentTarget != this)
            return;
        
        if (this.$button) {
            if (this.$position & 1)
                this.parentNode.$setStyleClass(this.$button, "", ["firstbtn", "firstcurbtn"]);
            if (this.$position & 2)
                this.parentNode.$setStyleClass(this.$button, "", ["lastbtn"]);
        }

        if (!e.$doOnlyAdmin) {
            if (this.$button)
                this.$button.parentNode.removeChild(this.$button);

            if (this.parentNode && this.parentNode.$activepage == this) {
                if (this.$button)
                    this.parentNode.$setStyleClass(this.$button, "", ["curbtn"]);
                this.parentNode.$setStyleClass(this.$ext, "", ["curpage"]);
            }
        }
    });
    
    this.addEventListener("DOMNodeRemovedFromDocument", function(e) {
        if (this.fake && this.parentNode && this.parentNode.$activepage == this)
            this.$deactivate();
    });

    this.addEventListener("DOMNodeInserted", function(e) {
        if (e && e.currentTarget != this || !this.$amlLoaded) //|| !e.$oldParent
            return;
            
        if (!e.$isMoveWithinParent 
          && this.skinName != this.parentNode.skinName) {
            // this.$destroy(); //clean up button
            var skin = this.parentNode.skinName.split(":");
            this.$forceSkinChange(skin[1], skin[0]);
        }
        else if (this.$button && (!e.$oldParent || e.$oldParent.$hasButtons) && this.parentNode.$buttons)
            this.parentNode.$buttons.insertBefore(this.$button,
                e.$beforeNode && e.$beforeNode.$button || null);
        
        if (this.type)
            this.relPage = this.parentNode.getPage && this.parentNode.getPage(this.type);
        
    }, true);

    // *** Private state functions *** //

    this.$position = 0;
    this.$first = function(remove) {
        if (remove) {
            this.$isFirst = false;
            this.$position -= 1;
            this.parentNode.$setStyleClass(this.$button, "",
                ["firstbtn", "firstcurbtn"]);
        }
        else {
            this.$isFirst = true;
            this.$position = this.$position | 1;
            this.parentNode.$setStyleClass(this.$button, "firstbtn"
                + (this.parentNode.$activepage == this ? " firstcurbtn" : ""));
        }
    };

    this.$last = function(remove) {
        if (remove) {
            this.$isLast = false;
            this.$position -= 2;
            this.parentNode.$setStyleClass(this.$button, "", ["lastbtn"]);
        }
        else {
            this.$isLast = true;
            this.$position = this.$position | 2;
            this.parentNode.$setStyleClass(this.$button, "lastbtn");
        }
    };

    this.$deactivate = function(fakeOther) {
        this.$active = false;

        if (!this.parentNode)
            return;

        if (this.parentNode.$hasButtons) {
            if (this.$position > 0)
                this.parentNode.$setStyleClass(this.$button, "", ["firstcurbtn"]);
            this.parentNode.$setStyleClass(this.$button, "", ["curbtn"]);
        }

        if ((!this.fake || this.relPage) && !fakeOther) {
            this.parentNode.$setStyleClass(this.fake
                ? this.relPage.$ext
                : this.$ext, "", ["curpage"]);
            
            if (this.fake) {
                if (!this.relPage.visible)
                    this.relPage.$ext.style.display = "none";
                    
                this.relPage.dispatchEvent("prop.visible", { value: false });
            }
            
            this.dispatchEvent("prop.visible", { value: false });
        }
    };
    
    this.$deactivateButton = function() {
        if (this.parentNode && this.parentNode.$hasButtons) {
            if (this.$position > 0)
                this.parentNode.$setStyleClass(this.$button, "", ["firstcurbtn"]);
            this.parentNode.$setStyleClass(this.$button, "", ["curbtn"]);
        }
    };

    this.$activate = function() {
        this.$active = true;

        if (!this.$drawn) {
            var f;
            this.addEventListener("DOMNodeInsertedIntoDocument", f = function(e) {
                this.removeEventListener("DOMNodeInsertedIntoDocument", f);
                if (!this.$active)
                    return;
                    
                this.$activate();
            });
            return;
        }

        if (this.parentNode.$hasButtons) {
            if (this.$isFirst)
                this.parentNode.$setStyleClass(this.$button, "firstcurbtn");
            this.parentNode.$setStyleClass(this.$button, "curbtn");
        }

        if (!this.fake || this.relPage) {
            if (this.fake) {
                if (this.relPage) {
                    this.relPage.$ext.style.display = "";
                    this.parentNode.$setStyleClass(this.relPage.$ext, "curpage");
                    this.relPage.$prevFake = this.relPage.$fake;
                    this.relPage.$fake = this;

                    
                    if (this.relPage.$render)
                        this.relPage.$render();
                    
                    
                    this.relPage.dispatchEvent("prop.visible", { value: true });
                }
            }
            else {
                this.parentNode.$setStyleClass(this.$ext, "curpage");
            }
            
            
            if (apf.layout && this.relPage)
                apf.layout.forceResize(this.fake ? this.relPage.$int : this.$int);
            
        }

        
        if (this.$render)
            this.$render();
        
        
        if (!this.fake) {
            this.dispatchEvent("prop.visible", { value: true });
        }
    };
    
    this.$activateButton = function() {
        if (this.$active)
            return;

        if (!this.$drawn) {
            var f;
            this.addEventListener("DOMNodeInsertedIntoDocument", f = function(e) {
                this.removeEventListener("DOMNodeInsertedIntoDocument", f);
                this.$activateButton();
            });
            return;
        }
        
        if (this.parentNode && this.parentNode.$hasButtons) {
            if (this.$isFirst)
                this.parentNode.$setStyleClass(this.$button, "firstcurbtn");
            this.parentNode.$setStyleClass(this.$button, "curbtn");
        }
        
        
        if (this.$render)
            this.$render();
        
    };

    this.addEventListener("$skinchange", function() {
        if (this.caption)
            this.$propHandlers["caption"].call(this, this.caption);

        if (this.icon)
            this.$propHandlers["icon"].call(this, this.icon);
    });

    this.$enable = function() {
        if (this.$button)
            this.$setStyleClass(this.$button, null, ["btnDisabled"]);//@todo this.$baseCSSname + 
    };

    this.$disable = function() {
        if (this.$button)
            this.$setStyleClass(this.$button, "btnDisabled");//@todo this.$baseCSSname + 
    };
    
    function $btnSet(oHtml) {
        this.parentNode.set(this);
        if (this.autofocus)
            this.canHaveChildren = 2;
        this.$setStyleClass(oHtml, "down", null, true);
    }
    
    this.$btnDown = function(oHtml, htmlEvent) {
        if (this.disabled) 
            return;
            
        if (htmlEvent.button == 2) {
            return;
        }
        if (htmlEvent.button == 1) {
            apf.stopEvent(htmlEvent);
            return;
        }
        
        if (this.parentNode.dispatchEvent("tabselectclick", {
            page: this,
            htmlEvent: htmlEvent
        }) === false)
            return;
        
        this.$btnPressed = true;
        
        //if (!this.parentNode.$order)
            $btnSet.call(this, oHtml);
    };
    
    this.$btnUp = function(oHtml, htmlEvent) {
        this.parentNode.$setStyleClass(oHtml, "", ["down"], true);
        
        if (this.disabled) 
            return;
        
        
        if (htmlEvent.button == 1) {
            apf.stopEvent(htmlEvent);
            var page = apf.lookup(this.$uniqueId);
            page.parentNode.remove(page, htmlEvent);
            return;
        }
        
        if (false && this.parentNode.$order && this.$btnPressed) {
            this.$dragging = false;
            
            $btnSet.call(this, oHtml);
        }
        
        this.$btnPressed = false;
        
        this.parentNode.dispatchEvent("tabselectmouseup");
    };
    
    this.$btnOut = function(oHtml) {
        this.parentNode.$setStyleClass(oHtml, "", ["over"], true);
        
        this.canHaveChildren = true;
        this.$dragging = false;
        this.$btnPressed = false;
    };

    // *** Init *** //

    this.$canLeechSkin = true;
    
    this.addEventListener("prop.class", function(e) {
        apf.setStyleClass(this.$button, e.value, this.$lastClassValueBtn ? [this.$lastClassValueBtn] : null);
        this.$lastClassValueBtn = e.value;
    });
    
    this.$draw = function(isSkinSwitch) {
        this.skinName = this.parentNode.skinName;

        var sType = this.getAttribute("type");
        if (sType) {
            this.fake = true;
            this.relPage = this.parentNode.getPage(sType) || null;
        }

        if (this.parentNode.$hasButtons) {
            //this.parentNode.$removeEditable(); //@todo multilingual support is broken when using dom

            this.parentNode.$getNewContext("button");
            var elBtn = this.parentNode.$getLayoutNode("button");
            elBtn.setAttribute(this.parentNode.$getOption("main", "select") || "onmousedown",
                'apf.lookup(' + this.$uniqueId + ').$btnDown(this, event);');
            elBtn.setAttribute("onmouseup", 
                'apf.lookup(' + this.$uniqueId + ').$btnUp(this, event)');
            elBtn.setAttribute("onmouseover", 'var o = apf.lookup('
                + this.$uniqueId + ').parentNode;if(apf.lookup(' + this.$uniqueId
                + ') != o.$activepage' + (this.parentNode.overactivetab ? " || true" : "") + ') o.$setStyleClass(this, "over", null, true);');
            elBtn.setAttribute("onmouseout", 'var o = apf.lookup('
                + this.$uniqueId + ');o&&o.$btnOut(this, event);');

            this.$button = apf.insertHtmlNode(elBtn, this.parentNode.$buttons);
            
            var closebtn = this.closebtn = this.getAttribute("closebtn");
            if ((apf.isTrue(closebtn) || ((this.parentNode.buttons || "").indexOf("close") > -1 && !apf.isFalse(closebtn))))
                this.$propHandlers["closebtn"].call(this, true);
            

            if (!isSkinSwitch && this.nextSibling && this.nextSibling.$button)
                this.$button.parentNode.insertBefore(this.$button, this.nextSibling.$button);

            this.$button.host = this;
        }

        if (this.fake)
            return;

        if (this.$ext)
            this.$ext.parentNode.removeChild(this.$ext); //@todo mem leaks?

        this.$ext = this.parentNode.$getExternal("page",
            this.parentNode.oPages, null, this);
        this.$ext.host = this;

        this.$int = this.parentNode
            .$getLayoutNode("page", "container", this.$ext);
        //if (this.$int)
            //this.$int.setAttribute("id", this.$int.getAttribute("id"));

        //@todo this doesnt support hidden nodes.
        if (this.visible) {
            if (this.$isLast)
                this.$last();
            if (this.$isFirst)
                this.$first();
        }
        
        var _self = this;
        this.parentNode && this.parentNode.getPages().forEach(function(page) {
            if (page && page.type == _self.id) {
                page.relPage = _self;
                if (page.$active) {
                    _self.$prevFake = _self.$fake;
                    _self.$fake = page; 
                    page.$activate();
                }
                _self.$button.style.display = "none";
                _self.visible = false;
            }
        });
    };

    this.$destroy = function() {
        if (this.$button) {
            if (this.parentNode && !this.parentNode.$amlDestroyed
              && this.$button.parentNode)
                this.$button.parentNode.removeChild(this.$button);
            
            this.$button.host = null;
            this.$button = null;
        }
    };
    
    
}).call(apf.page.prototype = new apf.Presentation());

apf.aml.setElement("page", apf.page);



/**
 * Baseclass of a paged element. 
 *
 * @class apf.BaseTab
 * @baseclass
 * @allowchild page
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.8
 * @inherits apf.Presentation
 *
 */
/**
 * @event beforeswitch  Fires before this element switches to another page.
 * @cancelable Prevents the page to become active.
 * @param {Object} e The standard event object. It contains the following properties:
 *   - previous ([[String]] or [[Number]]): The name or number of the current page.
 *   - previousId ([[Number]]): The number of the current page.
 *   - previousPage ([[apf.page]]): The current page.
 *   - next ([[String]] or [[Number]]): The name or number of the page the will become active.
 *   - nextId ([[Number]]): The number of the page the will become active.
 *   - nextPage ([[apf.page]]): The page the will become active.
 */
/**
 *  @event afterswitch   Fires after this element has switched to another page.
 *  @param {Object} e The standard event object. It contains the following properties:
 *   - previous ([[String]] or [[Number]]): The name or number of the previous page.
 *   - previousId ([[Number]]): The number of the previous page.
 *   - previousPage ([[apf.page]]): The previous page.
 *   - next ([[String]] or [[Number]]): The name or number of the current page.
 *   - nextId ([[Number]]): The number of the the current page.
 *   - nextPage ([[apf.page]]): The the current page.   
 */
apf.BaseTab = function() {
    this.$init(true);
};

(function() {
    this.isPaged = true;
    this.$focussable = apf.KEYBOARD;
    this.length = 0;
    this.isLoading = {};
    this.inited = 
    this.ready = false;
    this.$scroll = true;

    /**
     * Sets the current page of this element.
     * @param {String | Number}    page     The name or number of the page which is made active.
     * @param {Function} callback The function called after setting the page. Especially handy when using the `src` attribute.
     */
    this.set = function(page, callback, noEvent) {
        if (noEvent || this.src && !this.$findPage(page, {})) {
            return this.$propHandlers["activepage"].call(
                this, page, null, null, callback, noEvent);
        }
        
        if (this.activepage == (page.name || page))
            return callback && callback(this.getPage(page));

        this.$lastCallback = callback;
        this.setProperty("activepage", page);
    };

    // *** Properties and Attributes *** //

    this.$supportedProperties.push("activepage", "activepagenr", "length",
        "src", "loading", "trans-in", "trans-out");

    /**
     * @property {Number} [SCROLL_LEFT=1] The constant representing the "scroll left" button
     * @readonly
     */
    /**
     * @property {Number} [SCROLL_RIGHT=2] The constant representing the "scroll right" button
     * @readonly
     */
    /**
     * @property {Number} [SCROLL_BOTH=4] The constant representing the "scroll left" and "scroll right" buttons
     * @readonly
     */
    /**
     * @attribute {Number} activepagenr Sets or gets the child number of the active page.
     * 
     * #### Example
     *
     * This example uses property binding to maintain consistency between a
     * dropdown which is used as a menu, and a pages element
     * 
     * ```xml
     *  <a:dropdown id="ddMenu" value="0">
     *      <a:item value="0">Home</a:item>
     *      <a:item value="1">General</a:item>
     *      <a:item value="2">Advanced</a:item>
     *  </a:dropdown>
     * 
     *  <a:pages activepagenr="{ddMenu.value}">
     *      <a:page>
     *          <h1>Home Page</h1>
     *      </a:page>
     *      <a:page>
     *          <h1>General Page</h1>
     *      </a:page>
     *      <a:page>
     *          <h1>Advanced Page</h1>
     *      </a:page>
     *  </a:pages>
     * ```
     */
    this.$propHandlers["activepagenr"] =

    /**
     * @attribute {String} activepage Sets or gets the name of the active page.
     *  
     * #### Example
     *
     * ```xml
     *  <a:tab activepage="general" width="250" height="100">
     *      <a:page id="home" caption="Home">
     *      ...
     *      </a:page>
     *      <a:page id="advanced" caption="Advanced">
     *          ...
     *      </a:page>
     *      <a:page id="general" caption="General">
     *          ...
     *      </a:page>
     *   </a:tab>
     * ```
     */
    this.$propHandlers["activepage"] = function(next, prop, force, callback, noEvent) {
        if (!this.inited || apf.isNot(next) || next == -1) return;

        if (!callback) {
            callback = this.$lastCallback;
            delete this.$lastCallback;
        }

        var page, info = {};
        page = this.$findPage(next, info);

        if (!page) {
            if (this.src) {
                if (this.isLoading[next])
                    return;
                
                if (this.$findPage("loading", {}))
                    this.$propHandlers["activepage"].call(this, "loading");
                
                this.setProperty("loading", true);
                this.isLoading[next] = true;

                page = this.ownerDocument.createElementNS(apf.ns.apf, "page");
                page.setAttribute("id", next);
                this.appendChild(page);

                var _self = this;
                page.insertMarkup(this.src, {
                    page: next,
                    //@todo apf3.0 change callback arguments in xinclude
                    callback: function(options) {
                        delete _self.isLoading[next];
                    
                        if (!options.xmlNode) {
                            var oError = new Error(apf.formatErrorString(0, null,
                                "Loading new page", "Could not load new page: "
                                + _self.src));
                                
                            _self.setProperty("loading", false);
                            
                            if (this.dispatchEvent("error", apf.extend({
                                error: oError,
                                bubbles: true
                            }, options)) === false)
                                return true;
                            
                            throw oError;
                        }
                        else {
                            //for success
                            _self.setProperty("activepage", next);
                            
                            //Needs to be after set
                            if (callback)
                                callback(options.amlNode);
    
                            _self.setProperty("loading", false);
                        }
                    }
                });
                return;
            }
            
            

            return false;
        }

        if (page.parentNode != this) {
            

            return false;
        }

        if (!page.visible || page.disabled) {
            

            return false;
        }

        //If page is given as first argument, let's use its position
        if (next.tagName) {
            next = info.position;
            this.activepage = page.name || next;//page.type || 
        }

        //Call the onbeforeswitch event;
        if (!noEvent) {
            var oEvent = {
                previous: this.activepage,
                previousId: this.activepagenr,
                previousPage: this.$activepage,
                next: next,
                nextId: info.position,
                nextPage: page
            };

            if (this.dispatchEvent("beforeswitch", oEvent) === false) {
                //Loader support
                if (this.hideLoader)
                    this.hideLoader();

                return false;
            }
        }

        //Maintain an activepagenr property (not reentrant)
        this.activepagenr = info.position;
        this.setProperty("activepagenr", info.position);

        //Deactivate the current page, if any,  and activate the new one
        if (this.$activepage)
            this.$activepage.$deactivate();

        page.$activate();

        

        this.$activepage = page;
        
        //this.scrollIntoView(page);
        

        //Loader support
        if (this.hideLoader) {
            if (page.$rendered !== false) {
                this.hideLoader();
            }
            else {
                //Delayed rendering support
                page.addEventListener("afterrender", function() {
                    this.parentNode.hideLoader();
                 });
            }
        }

        if (!noEvent) {
            if (page.$rendered !== false)
                this.dispatchEvent("afterswitch", oEvent);
            else {
                //Delayed rendering support
                page.addEventListener("afterrender", function() { 
                    this.parentNode.dispatchEvent("afterswitch", oEvent);
                });
             }
        }
        
        if (typeof callback == "function") 
            callback(page);

        return true;
    };
    
    /**
     * @attribute {String} buttons Sets or gets the modifier for tab page buttons, seperated by a `|` character
     *   
     * Possible values include:
     *   - `close`:   The button has a close button inside it
     *   - `scale`:  The buttons are scaled to make room for more buttons
     *   - `scroll`:  When the buttons take too much space, scroll buttons are displayed
     */
    this.$propHandlers["buttons"] = function(value) {
        //this.buttons = value;
        this.$scale = value.indexOf("scale") > -1;
        this.$scroll = !this.$scale;
        this.$order = value.indexOf("order") > -1;
        
        
        //@todo skin change
        //@todo buttons on the side
        if (this.$scale) {
            this.$maxBtnWidth = parseInt(this.$getOption("button", "maxwidth")) || 150;
            this.$minBtnWidth = parseInt(this.$getOption("button", "minwidth")) || 10;
            this.$setStyleClass(this.$buttons, "scale");
            this.addEventListener("resize", scalersz);
            
            // this.minwidth = this.$minBtnWidth * this.getPages().length + 10;
            // this.$ext.style.minWidth = Math.max(0, this.minwidth - apf.getWidthDiff(this.$ext)) + "px";
        }
        else {
            this.$setStyleClass(this.$buttons, "", ["scale"]);
            this.removeEventListener("resize", scalersz);
        }
        
    };
    
    
    function visCheck() {
        scalersz.call(this);
    }
    
    this.anims = "add|remove|sync";

    //Add an element
    function animAddTab(tab, callback) {
        var t = tab.$button;

        var animateWidth = (t.offsetWidth 
            - apf.getWidthDiff(t)) < parseInt(apf.getStyle(t, "maxWidth"));
        
        if (animateWidth) {
            var p = tab.parentNode.getPages()[0] == tab 
                ? null 
                : tab.previousSibling.$button;
            var tb = p 
                ? (p.offsetWidth - apf.getWidthDiff(p)) 
                : parseInt(apf.getStyle(t, "maxWidth"));
            t.style.maxWidth = "0px";
        }

        t.style.marginTop = (t.offsetHeight + 2) + "px";
        
        function animateToTop() {
            t.style.marginTop = "0px";
            
            setTimeout(function() {
                t.style[apf.CSSPREFIX + "TransitionProperty"] = "";
                t.style[apf.CSSPREFIX + "TransitionDuration"] = "";
                t.style[apf.CSSPREFIX + "TimingFunction"] = "";
                
                t.style.marginTop = "";
                
                if (animateWidth)
                    t.style.maxWidth = "";
                
                callback(tab);
            }, 150);
        }
        
        setTimeout(function() {
            t.style[apf.CSSPREFIX + "TransitionProperty"] = "margin-top, max-width";
            t.style[apf.CSSPREFIX + "TransitionDuration"] = "100ms, 50ms";
            t.style[apf.CSSPREFIX + "TimingFunction"] = "cubic-bezier(.10, .10, .25, .90), cubic-bezier(.10, .10, .25, .90)";
            
            if (animateWidth) {
                t.style.maxWidth = tb + "px";
                setTimeout(animateToTop, 50);
            }
            else animateToTop();
        });
    }
    
    //Remove an element
    function animRemoveTab(tab, isLast, isContracted, callback, isOnly) {
        var t = tab.$button;
        if (!t) return;
        var tb = t.offsetHeight;
        
        var diff = t.offsetWidth;
        
        t.style[apf.CSSPREFIX + "TransitionProperty"] = "margin-top, max-width, padding";
        t.style[apf.CSSPREFIX + "TransitionDuration"] = (isOnly ? ".2" : ".15") + "s, .1s, .1s";
        t.style[apf.CSSPREFIX + "TimingFunction"] = "linear, ease-out, ease-out";
        
        t.style.marginTop = (tb + 2) + "px";

        var p = t.parentNode;
        if (apf.isGecko) p = p.parentNode;
        
        p.style[apf.CSSPREFIX + "TransitionProperty"] = "padding-right";
        p.style[apf.CSSPREFIX + "TransitionDuration"] = ".2s";
        p.style[apf.CSSPREFIX + "TimingFunction"] = "ease-out";
        
            setTimeout(function() {
                if (isLast)
                    p.style.paddingRight = "";
                else {
                    var cur = parseInt(apf.getStyle(p, "paddingRight"));
                    p.style.paddingRight = (cur + diff - (apf.tabRightDelta || 15)) + "px";
                }
                
                t.className += " destroyed";
                
                end();
            }, isOnly ? 150 : 100);
        
        function end() {
            setTimeout(function() {
                p.style[apf.CSSPREFIX + "TransitionProperty"] = "";
                p.style[apf.CSSPREFIX + "TransitionDuration"] = "";
                p.style[apf.CSSPREFIX + "TimingFunction"] = "";
                
                t.style[apf.CSSPREFIX + "TransitionProperty"] = "";
                t.style[apf.CSSPREFIX + "TransitionDuration"] = "";
                t.style[apf.CSSPREFIX + "TimingFunction"] = "";
                
                t.style.display = "none";
                
                callback(tab);
            }, 150);
        }
    }
    
    this.$scaleinit = function(node, type, callback, force) {
        var _self = this;
        
        var pg = this.getPages();
        var l = pg.length;
        if (!l) return;
        
        // this.minwidth = this.$minBtnWidth * l + 10; //@todo padding + margin of button container
        // this.$ext.style.minWidth = Math.max(0, this.minwidth - apf.getWidthDiff(this.$ext)) + "px";
        
        if (force && !this.$ext.offsetWidth && !this.$ext.offsetHeight
          || this.anims.indexOf(type) == -1 || this.skipAnimOnce) {
            scalersz.call(this);
            
            this.skipAnimOnce = false;
              
            if (type == "add")
                node.dispatchEvent("afteropen");
            else if (type == "remove") {
                if (node.dispatchEvent("afterclose") !== false)
                    callback();
            }
            
            return;
        }
        
        if (!apf.window.vManager.check(this, "tabscale", visCheck))
            return;
        
        if (!type)
            return scalersz.call(this);
        
        function btnMoHandler(e) {
            var pos = apf.getAbsolutePosition(this);
            if (e.clientX <= pos[0] || e.clientY <= pos[1] 
              || e.clientX >= pos[0] + this.offsetWidth 
              || e.clientY >= pos[1] + this.offsetHeight) {
                apf.removeListener(_self.$buttons, "mouseout", btnMoHandler);
                    delete _self.$waitForMouseOut;
                    _self.$scaleinit(null, "sync");
            }
        }
        
        if (type == "add") {
            animAddTab(node, function() {
                node.dispatchEvent("afteropen");
            });
        }
        else if (type == "sync") {
            scalersz.call(this);
        }
        else if (type == "remove") {
            var onfinish = function() {
                if (node.dispatchEvent("afterclose") === false)
                    return;
                    
                callback();

                if (!isLast && isContracted) {
                    var pages = _self.getPages();
                    for (var i = 0, l = pages.length; i < l; i++) {
                        var page = pages[i];
                        page.$button.style.minWidth = "";
                        page.$button.style.maxWidth = "";
                    }
                }
                
                if (_self.$waitForMouseOut == 2) {
                    apf.removeListener(_self.$buttons, "mouseout", btnMoHandler);
                    delete _self.$waitForMouseOut;
                }
                else if (isLast)
                    delete _self.$waitForMouseOut;
            };
            
            var pages = this.getPages();
            
            var lNode = pages[pages.length - 1];
            while (lNode && (!lNode.$button || lNode.$button.style.top)) {
                lNode = lNode.previousSibling;
            }
            if (!lNode || !node.$button) return;
            
            var isLast = lNode == node;
            var isContracted = (node.$button.offsetWidth - apf.getWidthDiff(node.$button) 
                != parseInt(apf.getStyle(node.$button, "maxWidth")));
            
            if (!isLast && isContracted) {
                for (var i = 0, l = pages.length; i < l; i++) {
                    var page = pages[i];
                    page.$button.style.minWidth = 
                    page.$button.style.maxWidth = (page.$button.offsetWidth 
                        - (apf.isGecko ? 0 : apf.getWidthDiff(page.$button))) 
                        + "px";
                }
            }
            
            var isCur = this.$activepage == node;
                
            //Set activetab if the current one is lost
            if (_self.nextTabInLine) {
                _self.set(_self.nextTabInLine);
                delete _self.nextTabInLine;
            }
            else if (_self.$activepage == node) {
                var ln = node.nextSibling;
                while (ln && (!ln.$first || !ln.visible))
                    ln = ln.nextSibling;
                var rn = node.previousSibling;
                while (rn && (!rn.$last || !rn.visible))
                    rn = rn.previousSibling;
                if (ln || rn)
                    _self.set(ln || rn);
            }
            
            if (isCur) {
                apf.setStyleClass(node.$button, "curbtn");
                if (node.$button)
                    node.$button.style.zIndex = 0;
            }
            
            if (!(node.relPage || node).$ext) return onfinish();
            
            if (pages.length == 1)
                (node.relPage || node).$ext.style.display = "none";
            
            animRemoveTab(node, isLast, isContracted, onfinish, pages.length == 1);
            
            this.$waitForMouseOut = true;
            if (!isLast)
                apf.addListener(_self.$buttons, "mouseout", btnMoHandler);
        }
    };
    
    /*
     * Update the size of the tab container
     */
    function scalersz(e, excl) {
        if (!this.length && !this.getPages().length || this.$waitForMouseOut)
            return;
        
        var p = apf.isGecko ? this.$buttons.parentNode : this.$buttons;
        
        p.style[apf.CSSPREFIX + "TransitionProperty"] = "padding-right";
        p.style[apf.CSSPREFIX + "TransitionDuration"] = this.length < 4 ? ".4s" : ".2s";
        p.style[apf.CSSPREFIX + "TimingFunction"] = "ease-out";
        
        if (apf.isGecko) {
            p.style.paddingRight = apf.getWidthDiff(this.$buttons) + "px";
        }
        else {
            p.style.paddingRight = "";
        }
        
        setTimeout(function() {
            p.style[apf.CSSPREFIX + "TransitionProperty"] = "";
            p.style[apf.CSSPREFIX + "TransitionDuration"] = "";
            p.style[apf.CSSPREFIX + "TimingFunction"] = "";
        }, 250);
    }
    

    // *** Public methods *** //

    

    /**
     * Retrieves an array of all the page elements of this element.
     * @returns {Array} An array of all the {apf.page} elements
     */
    this.getPages = function() {
        var r = [], nodes = this.childNodes;
        if (!nodes) return r;
        for (var i = 0, l = nodes.length; i < l; i++) {
            if ("page|case".indexOf(nodes[i].localName) > -1 && nodes[i].visible !== false)
                r.push(nodes[i]);
        }
        return r;
    };

    /**
     * Retrieves a page element by its name or child number.
     * @param {String | Number} nameOrId The name or child number of the page element to retrieve.
     * @return {apf.page} The found page element.
     */
    this.getPage = function(nameOrId) {
        if (apf.isNot(nameOrId))
            return this.$activepage;
        else
            return this.$findPage(nameOrId);
    };

    /**
     * Adds a new page element
     * @param {String} [caption] The text displayed on the button of the page
     * @param {String} [name]    The name of the page which is can be referenced by
     * @param {String} [type]    The type of the page
     * @param {apf.page} [insertBefore]   The page to insert ahead of; `null` means to put it at the end
     * @param {Function} [callback]   A callback to call and pass the new page to
     * @return {apf.page} The created page element.
     */
    this.add = function(caption, name, type, before, callback) {
        var page = this.ownerDocument.createElementNS(apf.ns.aml, "page");
        if (name)
            page.setAttribute("id", name);
        if (type)
            page.setAttribute("type", type);
        if (caption)
            page.setAttribute("caption", caption);
        
        if (callback)
            callback(page);
            
        this.insertBefore(page, before);
        
        
        //this.scrollIntoView(page);
        
        return page;
    };

    /**
     * Removes a page element from this element. This function destroys ALL children
     * of this page. To simple remove the page from the DOM tree, use the
     * [[apf.AmlNode.removeNode]] method.
     *
     * @param {Mixed} nameOrId The name or child number of the page element to remove
     * @return {apf.page} The removed page element
     */
    this.remove = function(nameOrId, force, noAnimation) {
        var page = typeof nameOrId == "object" 
            ? nameOrId 
            : this.$findPage(nameOrId);
        if (!page)
            return false;

        var e = { page: page };
        if (typeof force == "object") {
            e.htmlEvent = force;
            force = false;
        }

        if (!force && this.dispatchEvent("close", e) === false)
            return;

        if (this.$scale && !noAnimation) {
            this.$scaleinit(page, "remove", function() {
                //page.removeNode();
                page.destroy(true, true);
            }, true);
        }
        else 
        
        {
            //page.removeNode();
            if (page.dispatchEvent("afterclose") !== false)
                page.destroy(true, true);
            
            
            //@todo this is wrong, we can also use removeChild
            //this.setScrollerState();
            
        }
        
        return page;
    };
    

    // *** DOM Hooks *** //

    this.addEventListener("DOMNodeRemoved", function(e) {
        var amlNode = e.currentTarget;
        if (e.$doOnlyAdmin || e.relatedNode != this 
          || amlNode.localName != "page")
            return;
        
        if ((this.activepage || this.activepage == 0) && this.activepage != -1) {
            if (!this.getPage(this.nextTabInLine))
                this.nextTabInLine = null;
            
            if (this.nextTabInLine)
                this.set(this.nextTabInLine);
            
            if (!this.nextTabInLine && this.$activepage == amlNode) {
                var ln = amlNode.nextSibling;
                while (ln && (!ln.$first || !ln.visible))
                    ln = ln.nextSibling;
                var rn = amlNode.previousSibling;
                while (rn && (!rn.$last || !rn.visible))
                    rn = rn.previousSibling;
        
                if (this.firstChild == amlNode && ln)
                    ln && ln.$first();
                if (this.lastChild == amlNode && rn)
                    rn && rn.$last();
                
                if (ln || rn)
                    this.set(ln || rn);
                else {
                    amlNode.$deactivate();
                    
                    
                    //this.setScrollerState();
                    
                    this.$activepage = 
                    this.activepage = 
                    this.activepagenr = null;
                    this.setProperty("activepage", null);
                }
            }
            else {
                
                //if (this.$scroll) 
                    //this.setScrollerState();
                
                
                if (this.$scale) 
                    this.$scaleinit();
                
            }
            
            delete this.nextTabInLine;
        }

        
        this.setProperty("length", this.getPages().length - 1);
        
    });

    this.addEventListener("DOMNodeInserted", function(e) {
        var amlNode = e.currentTarget;

        if (amlNode.localName != "page" || e.relatedNode != this || amlNode.nodeType != 1)
            return;

        var pages = this.getPages();

        if (!e.$beforeNode) {
            var lastChild, pg = pages;
            if (lastChild = pg[pg.length - 2])
                lastChild.$last(true);
            amlNode.$last();
        }
    
        var p2, p = pages[0]; //@todo $beforeNode doesnt have to be a page
        if (amlNode == p) {
            if (p2 = this.getPage(1))
                p2.$first(true);
            amlNode.$first();
        }

        if (this.$activepage) {
            var info = {};
            this.$findPage(this.$activepage, info);

            if (this.activepagenr != info.position) {
                if (parseInt(this.activepage) == this.activepage) {
                    this.activepage = info.position;
                    this.setProperty("activepage", info.position);
                }
                this.activepagenr = info.position;
                this.setProperty("activepagenr", info.position);
            }
        }
        else if (!this.activepage && !this.$activepage 
          && !amlNode.render || amlNode.$rendered) {
            this.set(amlNode);
        }
        
        
        if (this.$scale && amlNode.visible && !e.$isMoveWithinParent) 
            this.$scaleinit(amlNode, "add");
        else 
        
        {
            amlNode.dispatchEvent("afteropen");
        }
        
        
        this.setProperty("length", this.getPages().length);
        
    });

    // *** Private state handling functions *** //

    this.$findPage = function(nameOrId, info) {
        var node, nodes = this.childNodes;
        if (!nodes) return;
        
        if (nameOrId.localName) {
            for (var t = 0, i = 0, l = nodes.length; i < l; i++) {
                node = nodes[i];
                if ("page|case".indexOf(node.localName) > -1 && (++t) && node == nameOrId) {
                    if (info)
                        info.position = t - 1;
                    return node;
                }
            }
        }
        else {
            for (var t = 0, i = 0, l = nodes.length; i < l; i++) {
                node = nodes[i];
                if ("page|case".indexOf(node.localName) > -1 && (t++ == nameOrId
                  || node.name == nameOrId)) {
                    if (info)
                        info.position = t - 1;
                    return node;
                }
            }
        }
        
        return null;
    };

    this.$enable = function() {
        var nodes = this.childNodes;
        for (var i = 0, l = nodes.length; i < l; i++) {
            if (nodes[i].enable)
                nodes[i].enable();
        }
    };

    this.$disable = function() {
        var nodes = this.childNodes;
        for (var i = 0, l = nodes.length; i < l; i++) {
            if (nodes[i].disable)
                nodes[i].disable();
        }
    };

    // *** Keyboard support *** //

    

    

    

    // *** Init *** //

    this.$loadChildren = function(callback) {
        var page = false,
            _self = this,
            i, j, l, node, nodes;

        this.inited = true;

        if (this.$hasButtons) {
            this.$buttons = this.$getLayoutNode("main", "buttons", this.$ext);
            this.$buttons.setAttribute("id", this.$uniqueId + "_buttons");
            
            if (false && apf.isGecko && !this.$gotContainer) {
                var div = this.$ext.appendChild(document.createElement("div"));
                div.style.backgroundImage = apf.getStyle(this.$buttons, "backgroundImage");
                div.style.backgroundColor = apf.getStyle(this.$buttons, "backgroundColor");
                div.style.position = "absolute";
                div.style.left = 0;
                div.style.top = 0;
                div.style.right = 0;
                div.style.overflow = "hidden";
                div.style.height = this.$buttons.offsetHeight + "px";
                div.appendChild(this.$buttons);
                this.$buttons.style.width = "100%";
                div.style.paddingRight = apf.getWidthDiff(this.$buttons) + "px";
                
                this.$gotContainer = true;
            }
        }

        this.oPages = this.$getLayoutNode("main", "pages", this.$ext);
        
        //Skin changing support
        if (this.$int) {
            this.$int = this.oPages;
            page = true;

            //@todo apf3.0 skin change?
            nodes = this.childNodes;
            for (i = 0; i < nodes.length; i++) {
                node = nodes[i];
                if (node.nodeType != 1)
                    continue;
                node.$draw(true);
                if (node.$skinchange)
                    node.$skinchange();
                node.$loadAml();
            }
        }
        else {
            this.$int = this.oPages;

            //Build children
            nodes = this.getPages();
            if (nodes.length) {
                nodes[0].$first();
                (node = nodes[nodes.length - 1]).$last();
            }
        }

        //Set active page
        if (node) {
            this.activepage = (typeof this.activepage != "undefined"
                ? this.activepage
                : this.activepagenr) || 0;
            page = this.getPage(this.activepage);
            if (!page.render || page.$rendered)
                this.$propHandlers.activepage.call(this, this.activepage);
        }
        else {
            this.isPages = false;
        }

        
        this.setProperty("length", this.getPages().length);
        

        this.ready = true;
        

        if (!this.activepage && this.getAttribute("src")) {
            this.src = this.getAttribute("src");
            this.$propHandlers["activepage"].call(this);
        }
    };
    
    this.$destroy = function(bSkinChange) {
        if (bSkinChange || !this.oScroller)
            return;
    };
}).call(apf.BaseTab.prototype = new apf.Presentation());





/**
 * An element displaying a page and several buttons allowing a
 * user to switch between the pages. Each page can contain
 * arbitrary AML. Each page can render its content during
 * startup of the application, or when the page is activated.
 *
 * #### Example
 *
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 * <!-- startcontent -->
 *  <a:tab id="tab" width="300" height="100">
 *      <a:page caption="General">
 *          <a:checkbox>Example</a:checkbox>
 *          <a:button>Example</a:button>
 *      </a:page>
 *      <a:page caption="Advanced">
 *          <a:checkbox>Test checkbox</a:checkbox>
 *          <a:checkbox>Test checkbox</a:checkbox>
 *          <a:checkbox>Test checkbox</a:checkbox>
 *      </a:page>
 *      <a:page caption="Ajax.org">
 *          <a:checkbox>This ok?</a:checkbox>
 *          <a:checkbox>This better?</a:checkbox>
 *      </a:page>
 *  </a:tab>
 * <!-- endcontent -->
 * </a:application>
 * ```
 *
 * @class apf.tab
 * @define tab
 * @container
 * @allowchild page
 *
 *
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.1
 *
 * @inherits apf.BaseTab
 */

apf["switch"] = function(struct, tagName) {
    this.$hasButtons = false;
    this.$init(tagName || "switch", apf.NODE_VISIBLE, struct);
};

apf.pages = function(struct, tagName) {
    this.$hasButtons = false;
    this.$init(tagName || "pages", apf.NODE_VISIBLE, struct);
    
    this.$focussable = false;
};

apf.tab = function(struct, tagName) {
    this.$hasButtons = true;
    this.$init(tagName || "tab", apf.NODE_VISIBLE, struct);
};

(function() {
    this.$focussable = apf.KEYBOARD; // This object can get the focus from the keyboard

    // *** Init *** //

    this.$draw = function(bSkinChange) {
        //Build Main Skin
        this.$ext = this.$getExternal();
        this.$loadChildren();
    };
}).call(apf.tab.prototype = new apf.BaseTab());

apf["switch"].prototype =
apf.pages.prototype = apf.tab.prototype;

apf.aml.setElement("switch", apf["switch"]);
apf.aml.setElement("pages", apf.pages);
apf.aml.setElement("tab", apf.tab);



};
});