define(function(require, module, exports) {
    main.consumes = [];
    main.provides = ["aml"];
    return main;

    function main(options, imports, register) {

// AMLElement

        /**
         * Base class for all Cloud9 UI Elements (aka AMLElements). This 
         * base class exposes an API similar to the HTML DOM.
         *
         * Here's a basic window using AML syntax: 
         *
         *     <a:window id="winExample" title="Example" visible="true">
         *         <a:button id="tstButton" />
         *     </a:window>
         *
         * Here's an example of using some of the DOM APIs:
         *
         *     var winExample = plugin.getElement("winExample");
         *     winExample.setAttribute("title", "Example");
         *     winExample.setAttribute("icon", "icoFolder.gif");
         *     winExample.setAttribute("left", "100");
         *     
         *     var tstButton = plugin.getElement("tstButton");
         *     tstButton.setAttribute("caption", "Click me");
         *     tstButton.addEventListener("click", function(e) {
         *         alert(1);
         *     });
         *
         * @class AMLElement
         * @extends Object
         */
        /**
         * Retrieves all the child nodes of this element.
         * @property {Array} childNodes
         */
        /**
         * The name of the element (i.e. "window" or "button").
         * @property {String} localName
         */
        /**
         * The element that has an index, one higher than this element in the
         * list of child elements to this parent.
         * @property {String} nextSibling
         */
        /**
         * The element that has an index, one lower than this element in the
         * list of child elements to this parent.
         * @property {String} previousSibling
         */
        /**
         * The identifier of this element. This id is used to retrieve a
         * reference to this element in your code.
         * 
         * Lets say this is our aml (in markup.xml):
         *
         *     <a:bar id="barExample" />
         * 
         * You can load markup.xml in your plugin like this:
         * 
         *     ui.insertMarkup(null, require("text!./markup.xml"), plugin);
         * 
         * And then access the elements using:
         * 
         *     var barExample = plugin.getElement("barExample");
         *     alert(barExample);
         * 
         * @property {String} id 
         */
        /**
         * Sets an attribute on this element.
         * @method setAttribute
         * @param {String} name The name of the attribute to which the value is set
         * @param {String} value The new value of the attribute.
         * @param {Boolean} [noTrigger] If specified, does not emit events 
         * {@link #DOMNodeInsertedIntoDocument} and {@link #DOMNodeInserted}.
         */
        /**
         * Removes an attribute from this element. 
         * @method removeAttribute
         * @param {String} name The name of the attribute to remove.
         * @return {AMLElement} The modified element.
         */
        /**
         * Retrieves the value of an attribute of this element.
         * @method getAttribute
         * @param  {String}  name       The name of the attribute for which to return the value.
         * @param  {Boolean} [inherited] if specified, takes into consideration that the attribute is inherited
         * @return {String} The value of the attribute, or `null` if none was found with the name specified.
         */
        /**
         * Serializes the node reference and optionally it's children to markup.
         * @method serialize
         * @param {Boolean} shallow  When set to true the markup will only 
         *   contain the element itself.
         * @return {String}
         */
        /**
         * Fires when a DOM node is inserted.
         * @event DOMNodeInserted
         * @param {Object}     e
         * @param {AMLElement} e.currentTarget  The element that is being inserted.
         */
        /** 
         * Fires when a DOM node is inserted into the document.
         * @event DOMNodeInsertedIntoDocument
         * @param {Object}     e
         * @param {AMLElement} e.currentTarget  The element that is being inserted.
         */
        /** 
         * Fires when a DOM node is removed.
         * @event DOMNodeRemoved
         * @param {Object}     e
         * @param {AMLElement} e.currentTarget  The element that is being removed.
         */
        /** 
         * Fires when a DOM node is removed from a document.
         * @event DOMNodeRemovedFromDocument
         * @param {Object}     e
         * @param {AMLElement} e.currentTarget  The element that is being removed.
         */
        /**
         * Inserts an element before another element in the list of children of this
         * element. If the element was already a child of another element it is
         * removed from that parent before adding it this element.
         *
         * @method insertBefore
         * @param  {AMLElement}  AMLElement     The element to insert as child of this element.
         * @param  {AMLElement}  beforeNode  The element which determines the insertion position of the element.
         * @return  {AMLElement}  The inserted node
         */
        /**
         * Appends an element in the list of children of this
         * element. If the element was already a child of another element it is
         * removed from that parent before adding it this element.
         *
         * @method appendChild
         * @param  {AMLElement}  AMLElement     The element to insert as child of this element.
         * @return  {AMLElement}  The inserted node
         */
        /**
         * Removes this element from the document hierarchy. Call-chaining is
         * supported.
         * @method removeNode
         */
        /**
         * Removes a child from the node list of this element. Call-chaining is
         * supported.
         * @method removeChild
         * @param {AMLElement} childNode The child node to remove
         */
        /**
         * Clones this element, creating an exact copy of it--but does not insert
         * it in the document hierarchy.
         *
         * @method cloneNode
         * @param {Boolean} deep Specifies whether the elements are cloned recursively.
         * @return {AMLElement} The cloned element.
         */
         
        /**
         * @cfg {Mixed} left
         * Sets or retrieves the left position of this element. Depending
         * on the choosen layout method the unit can be pixels, a percentage or an
         * expression.
         */
        /**
         * @cfg {Mixed} top
         * Sets or retrieves the top position of this element. Depending
         * on the choosen layout method the unit can be pixels, a percentage or an
         * expression.
         */
        /**
         * @cfg {Mixed} right
         * Sets or retrieves the right position of this element. Depending
         * on the choosen layout method the unit can be pixels, a percentage or an
         * expression.
         */
        /**
         * @cfg {Mixed} bottom
         * Sets or retrieves the bottom position of this element. Depending
         * on the choosen layout method the unit can be pixels, a percentage or an
         * expression.
         */
        /**
         * @cfg {Mixed} width
         * Sets or retrieves the different between the left edge and the
         * right edge of this element. Depending on the choosen layout method the
         * unit can be pixels, a percentage or an expression.
         * 
         * #### Remarks
         *
         * When used as a child of a grid element the width can also be set as '*'. 
         * This will fill the rest space.
         */
        /**
         * @cfg {Mixed} height
         * Sets or retrieves the different between the top edge and the
         * bottom edge of this element. Depending on the choosen layout method the
         * unit can be pixels, a percentage or an expression.
         * 
         * #### Remarks
         *
         * When used as a child of a grid element the height can also be set as '*'. 
         * This will fill the rest space.
         */
        /**
         * @event resize Fires when the element changes width or height. 
         */
        /** 
         * @event contextmenu Fires when the user requests a context menu, either
         * using the keyboard or mouse.
         * @bubbles
         * @cancellable Prevents the default context menu from appearing.
         * @param {Object} e
         * @param {Number} e.x          The x coordinate where the contextmenu is requested on
         * @param {Number} e.y          The y coordinate where the contextmenu is requested on
         * @param {Event}  e.htmlEvent  The HTML event object that triggered this event from being called
         */
        /**  
         * @event focus       Fires when this element receives focus.
         */
        /** 
         * @event blur        Fires when this element loses focus.
         */
        /**  
         * @event keydown     Fires when this element has focus and the user presses a key on the keyboard.
         * @bubbles
         * @cancellable Prevents the default key action.
         * @param {Object}  e
         * @param {Boolean} e.ctrlKey      Specifies whether the [[keys: Ctrl]] key was pressed
         * @param {Boolean} e.shiftKey     Specifies whether the [[keys: Shift]] key was pressed
         * @param {Boolean} e.altKey       Specifies whether the [[keys: Alt ]] key was pressed
         * @param {Number}  e.keyCode      Indicates which key was pressed. This is an ascii number
         * @param {Event}   e.htmlEvent    the HTML event object that triggered this event from being called
         * 
         */
        /**
         * @cfg {Boolean} draggable
         * If true, the element can be dragged around the screen.
         */    
        /**
         * @cfg {Boolean} resizable
         * If true, the element can by resized by the user.
         * 
         */
        /**
         * @cfg {Number} minwidth
         * Sets or retrieves the minimum width for this element.
         */
        /**
         * @cfg {Number} maxwidth
         * Sets or retrieves the maximum width for this element.
         */
        /**
         * @cfg {Number} minheight
         * Sets or retrieves the minimum height for this element.
         */
        /**
         * @cfg {Number} maxheight
         * Sets or retrieves the maximum height for this element.
         */
        /**
         * @cfg {Boolean} focussable
         * Sets or retrieves whether this element can receive the focus.
         * The focused element receives keyboard event.
         */
        /**
         * @cfg {Number} tabindex
         * Sets or retrieves the tab index for this element.
         */
        /**
         * @cfg {Number} zindex
         * Sets or retrieves the z ordered layer in which this element is
         * drawn.
         */
        /**
         * @cfg {Boolean} visible
         * Sets or retrieves whether this element is shown.
         */
        /**
         * @cfg {Boolean} disabled
         * Sets or retrieves whether this element's functions are active.
         * For elements that can contain other `apf.NODE_VISIBLE` elements, this
         * attribute applies to all its children.
         */
        /**
         * @cfg {String}  tooltip
         * Sets or retrieves the text displayed when a user hovers with 
         * the mouse over the element.
         */
        /**
         * @cfg {String} contextmenu
         * Sets or retrieves the name of the menu element that will
         * be shown when the user right clicks or uses the context menu keyboard
         * shortcut.
         *
         * Example:
         * 
         *     <a:menu id="mnuExample">
         *         <a:item>test</a:item>
         *         <a:item>test2</a:item>
         *     </a:menu>
         *      
         *     <a:list 
         *       contextmenu = "mnuExample" 
         *       width = "200" 
         *       height = "150" />
         *     <a:bar 
         *       contextmenu = "mnuExample" 
         *       width = "200" 
         *       height = "150" />
         */
        /**
         * @cfg {String} skin
         * Sets or retrieves the name of the skin in the skinset that defines 
         * how this element is rendered. When a skin is changed, the full state of the
         * element is kept, including all the
         * AML attributes, loaded data, and focus and disabled states.
         *
         * Example using AML:
         *
         *     <a:button id="btn" skin="ui-button" />
         * 
         * Example using JavaScript:
         *
         *      var btn = plugin.getElement("btn");
         *      btn.setAttribute("skin", "toolbarbutton");
         */
        /**
         * @cfg {String} skinset
         * Sets or retrieves the skinset for
         * this element. When not not defined, the default skinset
         * is used.
         * 
         * Example:
         *
         *      <a:button skinset="perspex" />
         */
        /**
         * @cfg {String} style
         * Sets or retrieves the CSS style applied to the this element. This can be a string containing one or more CSS rules.
         */
        /**
         * @cfg {String/Number} border
         * Sets or retrieves border values. Set these sizes as a quarter of strings, in the usual top, right, bottom, left sequence, or pass an empty string to turn off borders.
         */
        /**
         * @cfg {String/Number} margin 
         * Sets or retrieves margin values. Set these sizes as a quarter of strings, in the usual top, right, bottom, left sequence, or pass an empty string to turn off margins.
         */
        /**
         * @cfg {String} class
         * Sets or retrieves the name of the CSS style class applied to this element.
         */

// ui.button

        /**
         * A basic Button implementation for use in the Cloud9 UI.
         * 
         * Example:
         * 
         *     <a:button id="btnDelete" width="100" class="ui-btn-red">Delete</a:button>
         * 
         * Example:
         * 
         *     var button = new ui.button({
         *         id      : "btnDelete",
         *         width   : 100,
         *         "class" : "ui-btn-red"
         *         caption : "Delete"
         *     });
         *     plugin.addElement(button);
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.button
         * @extends AMLElement
         */
        /**
         * @cfg {String}  icon
         * Sets or retrieves the url from which the icon image is loaded.
         */
        /**
         * @cfg {Boolean} state
         * Sets or retrieves whether this boolean is a multi state button.
         */
        /**
         * @cfg {String}  value
         * Sets or retrieves the initial value of a state button.
         */
        /**
         * @cfg {String}  caption
         * Sets or retrieves the text displayed on this element indicating the action when the button is pressed.
         */
        /**
         * @cfg {Number}  default
         * Sets or retrieves the search depth for which this button is the default action. `1` specifies the direct parent, `2` specifies the parent of this parent, _.e.t.c._
         */
        /**
         * @cfg {String}  submenu
         * Sets or retrieves the name of the contextmenu to display when the button is pressed.
         */
        /**
         * @cfg {String}  command
         * 
         */
        /**
         * @cfg {String}  skin
         * 
         * Sets or retrieves the name of the skin in the skinset that defines 
         * how this element is rendered. When a skin is changed, the full state of the
         * element is kept, including all the
         * AML attributes, loaded data, and focus and disabled states.
         *
         * Example using AML:
         *
         *     <a:button id="btn" skin="ui-button" />
         * 
         * Example using JavaScript:
         *
         *     var btn = plugin.getElement("btn");
         *     btn.setAttribute("skin", "toolbarbutton");
         * 
         * <table>
         * <tr><td>Name</td><td>  Description</td></tr>
         * <tr><td valign="top">"button" (Default)</td><td>
         * 
         * Use the following class names (class="name") to alter the appearance
         * of the default button skin:
         * 
         * <ul>
         *  <li>ui-btn-darkgreen</li>
         *  <li>ui-btn-greenfont</li>
         *  <li>ui-btn-green</li>
         *  <li>smallbtn</li>
         *  <li>ui-btn-red</li>
         *  <li>ui-btn-blue</li>
         *  <li>ui-btn-blue2</li>
         *  <li>ui-btn-blue3</li>
         *  <li>ui-btn-orange</li>
         *  <li>ui-btn-yellow</li>
         * </ul>
         * 
         * </td></tr>
         * <tr><td>"btn_console_open"</td><td></td></tr>
         * <tr><td>"btn_icon_only"</td><td></td></tr>
         * <tr><td>"toolbarbutton"</td><td></td></tr>
         * <tr><td>"c9-menu-btn"</td><td></td></tr>
         * <tr><td>"c9-simple-btn"</td><td></td></tr>
         * <tr><td>"c9-toolbarbutton-light"</td><td></td></tr>
         * <tr><td>"c9-toolbarbutton"</td><td></td></tr>
         * <tr><td>"c9-toolbarbutton-glossy"</td><td></td></tr>
         * <tr><td valign="top">"btn-default-css3"</td><td>
         * Use the following class names (class="name") to alter the appearance
         * of the default button skin:
         * 
         * <ul>
         *   <li>btn-green</li>
         *   <li>btn-red</li>
         * </ul>
         * 
         * </td></tr>
         * <tr><td>"blackbutton"</td><td></td></tr>
         * </table>
         */
        /**
         * If this button is a submenu, this method shows it.
         * @method showMenu
         */    
        /**
         * If this button is a submenu, this method hides it.
         * @method hideMenu
         */
         
// ui.menu

        /**
         * A menu implementation for use in the Cloud9 UI.
         * 
         * *N.B. In almost all cases you should use the {@link Menu} class
         * to create menus. Internally, that class uses ui.item, 
         * but it offers a more convenient API.*
         * 
         * Example:
         * 
         *     <a:menu id="menu1">
         *         <a:item>Tutorials</a:item>
         *         <a:item icon="email.png">Contact</a:item>
         *         <a:divider />
         *         <a:item 
         *           icon = "application_view_icons.png"
         *           onclick = "alert('You did it')">
         *           Tutorials</a:item>
         *         <a:divider />
         *         <a:item disabled="true">Visit http://www.c9.io</a:item>
         *         <a:item>Exit</a:item>
         *     </a:menu>
         * 
         * Example:
         * 
         *     var button = new ui.button({
         *         id      : "btnDelete",
         *         width   : 100,
         *         "class" : "ui-btn-red"
         *         caption : "Delete"
         *     });
         *     plugin.addElement(button);
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.menu
         * @extends AMLElement
         */
        /**
         * Fires when the contextmenu is shown.
         * @event display
         */
        /**
         * Fires when a user presses the mouse button while over a child of this element.
         * @event itemclick 
         * @param {Object} e 
         * @param {String} e.value the value of the clicked element.
         */

// ui.item

        /**
         * A menu item implementation for use in the Cloud9 UI.
         * 
         * *N.B. In almost all cases you should use the {@link MenuItem} class
         * to create menu items. Internally, that class uses ui.item, 
         * but it offers a more convenient API.*
         * 
         * Example:
         * 
         *     <a:menu>
         *         <a:item type="check">Status Bar</a:button>
         *     </a:menu>
         * 
         * Example:
         * 
         *     var item = new ui.item({
         *         type  : "check",
         *         label : "Status Bar"
         *     });
         *     menu.appendChild(item);
         *     plugin.addElement(item);
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.item
         * @extends AMLElement
         */
        /**
         * Fires when a user presses the mouse button while over this element.
         * @event click 
         * @param {Object} e
         * @param {AMLElement} e.opener      The element that was clicked upon when showing the context menu.
         */
        /**
         * @cfg {String} submenu
         * Sets or retrieves the id of the menu that is shown
         * when the user hovers over this menu item.
         * 
         * Example:
         * 
         *     <a:menu id="msub">
         *         <a:item icon="tbicons:12">test</a:item>
         *         <a:item icon="tbicons:14">test2</a:item>
         *     </a:menu>
         *   
         *     <a:menu id="mmain">
         *         <a:item submenu="msub">Sub menu</a:item>
         *     </a:menu>
         *     
         *     <a:toolbar>
         *         <a:menubar>
         *             <a:button submenu="mmain">File</a:button>
         *         </a:menubar>
         *     </a:toolbar>
         */
        /**
         * @cfg {String} value
         * Sets or retrieves the value of this element.
         */
        /**
         * @cfg {String} [group]
         * Sets or retrieves the name of the group this item belongs
         * to.
         * 
         * Example:
         * 
         *     <a:menu>
         *         <a:item type="radio" group="example">item 1</a:item>
         *         <a:item type="radio" group="example">item 2</a:item>
         *         <a:item type="radio" group="example">item 3</a:item>
         *         <a:item type="radio" group="example">item 4</a:item>
         *     </a:menu>
         */
         /**
         * @cfg {String} icon
         * Sets or retrieves the URL of the image used as an icon or
         * a reference to an iconmap.
         */
        /**
         * @cfg {String} command
         */
        /**
         * @cfg {String} caption
         * Sets or retrieves the text displayed on the item.
         */
        /**
         * @cfg {String} type
         * Sets or retrieves the function of this item.
         * 
         * Possible values include:
         * 
         * - `"item"`
         * - `"check"`
         * - `"radio"`
         */
        /**
         * @cfg {Boolean} checked
         * Sets or retrieves whether the item is checked.
         */
        /**
         * @cfg {Boolean} selected
         * Sets or retrieves whether the item is selected.
         */
    
// ui.bar

        /**
         * Draws a rectangle in the UI that can contain other AML and HTML elements.
         * 
         * Example:
         * 
         *     <a:bar width="100" height="100">
         *         Hello World!
         *     </a:bar>
         * 
         * Example:
         * 
         *     var bar = new ui.bar({
         *         width   : 100,
         *         height  : 100
         *     });
         *     plugin.addElement(bar);
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.bar
         * @extends AMLElement
         */

// ui.divider

        /**
         * A divider implementation for use in the Cloud9 UI.
         * 
         * *N.B. In almost all cases you should use the {@link Divider} class
         * to create menu dividers. Internally, that class uses ui.divider, 
         * but it offers a more convenient API.*
         * 
         * Example:
         * 
         *     <a:menu>
         *         <a:item type="check">Status Bar</a:button>
         *         <a:divider />
         *         <a:item command="run">Run...</a:button>
         *     </a:menu>
         * 
         * Example:
         * 
         *     var div = new ui.divider();
         *     menu.appendChild(div);
         *     plugin.addElement(div);
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.divider
         * @extends AMLElement
         */

// ui.toolbar

        /**
         * A toolbar implementation for use in the Cloud9 UI.
         * 
         * Example:
         * 
         *      <a:toolbar>
         *          <a:button>Preview</a:button>
         *          <a:button>Save</a:button>
         *      </a:toolbar>
         * 
         * Example:
         * 
         *     var tb = new ui.toolbar();
         *     tb.appendChild(new ui.button({ caption: "Preview" }));
         *     tb.appendChild(new ui.button({ caption: "Save" }));
         *     plugin.addElement(tb);
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.toolbar
         * @extends AMLElement
         */

// ui.tab

        /**
         * A tab pane implementation for use in the Cloud9 UI.
         * 
         * Example:
         * 
         *     <a:tab id="tab" width="300" height="100">
         *         <a:page caption="General">
         *             <a:checkbox>Example</a:checkbox>
         *             <a:button>Example</a:button>
         *         </a:page>
         *         <a:page caption="Advanced">
         *             <a:checkbox>Test checkbox</a:checkbox>
         *             <a:checkbox>Test checkbox</a:checkbox>
         *             <a:checkbox>Test checkbox</a:checkbox>
         *         </a:page>
         *     </a:tab>
         * 
         * Example:
         * 
         *     var tab = new ui.tab({
         *         id      : "tab",
         *         width   : 300,
         *         height  : 100
         *     });
         *     
         *     tab.appendChild(new ui.page({ caption: "General" });
         *     tab.appendChild(new ui.page({ caption: "Advanced" });
         *     
         *     plugin.addElement(tab);
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.tab
         * @extends AMLElement
         */
        /**
         * Fires before this element switches to another page.
         * @event beforeswitch
         * @cancellable Prevents the page to become active.
         * @param {Object}          e
         * @param {String/Number}   e.previous      The name or number of the current page.
         * @param {Number}          e.previousId    The number of the current page.
         * @param {page}            e.previousPage  The current page.
         * @param {String/Number}   e.next          The name or number of the page the will become active.
         * @param {Number}          e.nextId        The number of the page the will become active.
         * @param {page}            e.nextPage      The page the will become active.
         */
        /**
         * Fires after this element has switched to another page. 
         * @event afterswitch
         * @param {Object} e
         * @param {String/Number} e.previous   The name or number of the previous page.
         * @param {Number} e.previousId        The number of the previous page.
         * @param {page} e.previousPage        The previous page.
         * @param {String/Number} e.next       The name or number of the current page.
         * @param {Number} e.nextId            The number of the the current page.
         * @param {page} e.nextPage            The the current page.   
         */
        /**
         * Sets the current page of this element.
         * @param {String/Number}    page     The name or number of the page which is made active.
         * @param {Function} callback The function called after setting the page. Especially handy when using the `src` attribute.
         * @method set
         */
        /**
         * @cfg {String} activepage
         * Sets or retrieves the name of the active page.
         *  
         * Example:
         *
         *     <a:tab activepage="general" width="250" height="100">
         *         <a:page id="home" caption="Home">
         *         </a:page>
         *         <a:page id="advanced" caption="Advanced">
         *         </a:page>
         *         <a:page id="general" caption="General">
         *         </a:page>
         *     </a:tab>
         */
        /**
         * @cfg {String} buttons
         * Sets or retrieves the modifier for tab page buttons, seperated by a `|` character
         *   
         * Possible values include:
         * 
         * - `close`:   The button has a close button inside it
         * - `scale`:  The buttons are scaled to make room for more buttons
         * - `scroll`:  When the buttons take too much space, scroll buttons are displayed
         */
        /**
         * Retrieves an array of all the page elements of this element.
         * @returns {ui.page[]} An array of all the {@link ui.page page} elements
         * @method getPages
         */
        /**
         * Retrieves a page element by its name or child number.
         * @param {String/Number} nameOrId The name or child number of the page element to retrieve.
         * @method getPage
         * @return {ui.page} The found page element.
         */

// ui.page

        /**
         * A tab page implementation for use in the Cloud9 UI.
         * 
         * Example:
         * 
         *     <a:tab anchors="10 10 10 10"> 
         *         <a:page caption="General"> 
         *             <a:checkbox>Example</a:checkbox> 
         *             <a:button>Example</a:button> 
         *         </a:page> 
         *         <a:page caption="Advanced"> 
         *             <a:checkbox>Test checkbox</a:checkbox> 
         *             <a:checkbox>Test checkbox</a:checkbox> 
         *             <a:checkbox>Test checkbox</a:checkbox> 
         *         </a:page> 
         *         <a:page caption="Ajax.org"> 
         *             <a:checkbox>This ok?</a:checkbox> 
         *             <a:checkbox>This better?</a:checkbox> 
         *         </a:page> 
         *     </a:tab> 
         * 
         * Example:
         * 
         *     var page = new ui.page({
         *         caption: "General"
         *     });
         *     tab.appendChild(page);
         *     plugin.addElement(page);
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.page
         * @extends AMLElement
         */
        /**
         * @cfg {Boolean} closebtn 
         * Sets or retrieves whether this page's button shows a close button inside it.
         */
        /**
         * @cfg {String} tooltip 
         * Sets or retrieves the text displayed when hovering over the button of this element.
         */
        /**
         * @cfg {String} caption 
         * Sets or retrieves the text displayed on the button of this element.
         */
         
// ui.textbox

        /**
         * A textbox implementation for use in the Cloud9 UI.
         * 
         * Example:
         * 
         *     <a:textbox id="name" width="100" />
         * 
         * Example:
         * 
         *     var textbox = new ui.textbox({
         *         id      : "name",
         *         width   : 100
         *     });
         *     plugin.addElement(textbox);
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.textbox
         * @extends AMLElement
         */
        /**
         * Fires when the user clicks on this element
         * @event click
         */
        /**
         * Fires when the user lets go of a mousebutton while over this element. 
         * @event mouseup
         */
        /**
         * Fires when the user presses a mousebutton while over this element. 
         * @event mousedown
         */
        /**
         * Fires when the user lets go of a keyboard button while this element is focussed. 
         * @event keyup
         * @param {Object} e
         * @param {Number} e.keyCode  Specifies which key was pressed, expressed as an ascii number.
         */
        /**
         * Fires when the content of this element is cleared. 
         * @event clear
         */
        /**
         * @cfg {String} value 
         * Sets or retrieves the text of this element
         * 
         */
        /**
         * @cfg {String} initial-message 
         * Sets or retrieves the message displayed by this element
         * when it doesn't have a value set. 
         */
        /**
         * @cfg {Boolean} focusselect 
         * Sets or retrieves whether the text in this element is
         * selected when this element receives focus.
         */

// ui.password

        /**
         * A password input implementation for use in the Cloud9 UI.
         * 
         * Example:
         * 
         *     <a:password id="txtPassword" />
         * 
         * Example:
         * 
         *     var password = new ui.password({
         *         id: "txtPassword"
         *     });
         *     plugin.addElement(password);
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.password
         * @extends AMLElement
         */
        /**
         * Fires when the user clicks on this element
         * @event click
         */
        /**
         * Fires when the user lets go of a mousebutton while over this element. 
         * @event mouseup
         */
        /**
         * Fires when the user presses a mousebutton while over this element. 
         * @event mousedown
         */
        /**
         * Fires when the user lets go of a keyboard button while this element is focussed. 
         * @event keyup
         * @param {Object} e
         * @param {Number} e.keyCode  Specifies which key was pressed, expressed as an ascii number.
         */
        /**
         * Fires when the content of this element is cleared. 
         * @event clear
         */
        /**
         * @cfg {String} value 
         * Sets or retrieves the text of this element
         * 
         */
        /**
         * @cfg {String} initial-message 
         * Sets or retrieves the message displayed by this element
         * when it doesn't have a value set. 
         */
        /**
         * @cfg {Boolean} focusselect 
         * Sets or retrieves whether the text in this element is
         * selected when this element receives focus.
         */

// ui.textarea

        /**
         * A textarea implementation for use in the Cloud9 UI.
         * 
         * Example:
         * 
         *     <a:textarea id="comments" rows="20" cols="10" />
         * 
         * Example:
         * 
         *     var textbox = new ui.textarea({
         *         id   : "comments",
         *         rows : 20,
         *         cols : 10
         *     });
         *     plugin.addElement(textbox);
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.textarea
         * @extends AMLElement
         */
        /**
         * @cfg {Number} rows 
         * Sets or retrieves the row length for a text area.
         */
        /**
         * @cfg {Number} cols 
         * Sets or retrieves the column height for a text area.
         */
        /**
         * Fires when the user clicks on this element
         * @event click
         */
        /**
         * Fires when the user lets go of a mousebutton while over this element. 
         * @event mouseup
         */
        /**
         * Fires when the user presses a mousebutton while over this element. 
         * @event mousedown
         */
        /**
         * Fires when the user lets go of a keyboard button while this element is focussed. 
         * @event keyup
         * @param {Object} e
         * @param {Number} e.keyCode  Specifies which key was pressed, expressed as an ascii number.
         */
        /**
         * Fires when the content of this element is cleared. 
         * @event clear
         */
        /**
         * @cfg {String} value 
         * Sets or retrieves the text of this element
         * 
         */
        /**
         * @cfg {String} initial-message 
         * Sets or retrieves the message displayed by this element
         * when it doesn't have a value set. 
         */
        /**
         * @cfg {Boolean} focusselect 
         * Sets or retrieves whether the text in this element is
         * selected when this element receives focus.
         */

// ui.radiobutton

        /**
         * A radiobutton implementation for use in the Cloud9 UI.
         * 
         * Example:
         * 
         *     <a:radiobutton group="lineend" value="win">Window</a:radiobutton> 
         *     <a:radiobutton group="lineend" value="unix">Unix</a:radiobutton> 
         *     <a:radiobutton group="lineend" value="auto">Auto</a:radiobutton>
         * 
         * Example:
         * 
         *     var rb1 = new ui.radiobutton({
         *         group : "lineend"
         *         value : "win"
         *     });
         *     var rb2 = new ui.radiobutton({
         *         group : "lineend"
         *         value : "unix"
         *     });
         *     var rb3 = new ui.radiobutton({
         *         group : "lineend"
         *         value : "auto"
         *     });
         *     plugin.addElement(rb1, rb2, rb3);
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.radiobutton
         * @extends AMLElement
         */
        /**
         * Fires when the user clicks on this element.
         * @event click
         */
        /**
         * @cfg {String} group 
         * Sets or retrieves the name of the group to which this radio
         * button belongs. Only one item in the group can be selected at the same
         * time. 
         * When no group is specified the parent container functions as the
         * group; only one radiobutton within that parent can be selected.
         */
        /**
         * @cfg {String} tooltip 
         * Sets or retrieves the tooltip of this radio button.
         */
        /**
         * @cfg {String} icon 
         * Sets or retrieves the icon for this radiobutton
         */
        /**
         * @cfg {String} label 
         * Sets or retrieves the label for this radiobutton
         */
        /**
         * @cfg {Boolean} selected 
         * Sets or retrieves  whether this radiobutton is the selected one in 
         * the group it belongs to.
         */

// ui.checkbox

        /**
         * A checkbox implementation for use in the Cloud9 UI.
         * 
         * Example:
         * 
         *     <a:checkbox id="btnAllow">Allow users to edit this</a:button>
         * 
         * Example:
         * 
         *     var button = new ui.button({
         *         id    : "btnAllow",
         *         label : "Allow users to edit this"
         *     });
         *     plugin.addElement(button);
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.checkbox
         * @extends AMLElement
         */
        /**
         * @cfg {String}  value
         * Sets or gets the value of this element.
         */
        /**
         * @cfg {Boolean} checked
         * Sets or gets whether the element is in the checked state.
         */
        /**
         * @cfg {String}  label
         * Sets or gets the caption of the label explaining what
         * the meaning of the checked state of this element is.
         */
        /**
         * @cfg {String}  values
         * Sets or gets a pipe seperated list of two values which
         * correspond to the two states of the checkbox. The first for the checked
         * state, the second for the unchecked state. The default is "true|false".
         */
        /**
         * Sets the checked state (and related value).
         * @method check
         */
        /**
         * Sets the unchecked state (and related value).
         * @method uncheck
         */

// ui.hsplitbox

        /**
         * Splits a rectangular area in two horizontal parts. This element 
         * can have none, one or two child elements.
         * 
         * Example:
         * 
         *     <a:hsplitbox edge="10">
         *         <a:bar width="60%" />
         *         <a:bar />
         *     </a:hsplitbox>
         * 
         * Example:
         * 
         *     var hsplitbox = new ui.hsplitbox({
         *         edge : "10",
         *         childNodes : [
         *             new ui.bar({ width: "60%" }),
         *             new ui.bar()
         *         ]
         *     });
         *     plugin.addElement(hsplitbox);
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.hsplitbox
         * @extends AMLElement
         */
        /**
         * @cfg {String}  [padding="2"]
         * Sets or retrieves the space between each element.
         */
        /**
         * @cfg {String}  [edge="5 5 5 5"]
         * Sets or retrieves the space between the container and the elements, 
         * space seperated in pixels for each side. Similar to CSS in the 
         * sequence of `top right bottom left`.
         */
        /**
         * @cfg {String}  [splitter=false]
         * Sets or retrieves whether there is a splitter bar between the two 
         * child elements.
         */

// ui.vsplitbox

        /**
         * Splits a rectangular area in two vertical parts. This element 
         * can have none, one or two child elements.
         * 
         * Example:
         * 
         *     <a:vsplitbox edge="10">
         *         <a:bar height="60%" />
         *         <a:bar />
         *     </a:vsplitbox>
         * 
         * Example:
         * 
         *     var vsplitbox = new ui.vsplitbox({
         *         edge : "10",
         *         childNodes : [
         *             new ui.bar({ height: "60%" }),
         *             new ui.bar()
         *         ]
         *     });
         *     plugin.addElement(vsplitbox);
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.vsplitbox
         * @extends AMLElement
         */
        /**
         * @cfg {String}  [padding="2"]
         * Sets or retrieves the space between each element.
         */
        /**
         * @cfg {String}  [edge="5 5 5 5"]
         * Sets or retrieves the space between the container and the elements, 
         * space seperated in pixels for each side. Similar to CSS in the 
         * sequence of `top right bottom left`.
         */
        /**
         * @cfg {String}  [splitter=false]
         * Sets or retrieves whether there is a splitter bar between the two 
         * child elements.
         */

// ui.label

        /**
         * A label implementation for use in the Cloud9 UI.
         * 
         * Example:
         * 
         *     <a:label width="100">Name: </a:label>
         * 
         * Example:
         * 
         *     var label = new ui.label({
         *         width   : 100,
         *         caption : "Name: "
         *     });
         *     plugin.addElement(label);
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.label
         * @extends AMLElement
         */
        /** 
         * @cfg {String} caption
         * Sets or retrieves the text displayed in the area defined by this 
         * element. Using the value attribute provides an alternative to using
         * the text using a text node.
         *
         */
        /**
         * @cfg {String} for
         * Sets or retrieves the id of the element that receives the focus 
         * when the label is clicked on.
         */
        /**
         * @cfg {String} textalign
         * Sets or retrieves the text alignment value for the label.
         */

// ui.spinner

        /**
         * A spinner implementation for use in the Cloud9 UI.
         * 
         * Example:
         * 
         *     <a:spinner value="5" min="1" max="10" />
         * 
         * Example:
         * 
         *     var spinner = new ui.spinner({
         *         value : 5,
         *         min   : 1,
         *         max   : 10
         *     });
         *     plugin.addElement(spinner);
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.spinner
         * @extends AMLElement
         */
        /**
         * Fires when the user presses a mousebutton while over this element and then lets the mousebutton go. 
         * @event click
         */
        /**
         * Fires when the user lets go of a mousebutton while over this element. 
         * @event mouseup
         */
        /**
         * Fires when the user presses a mousebutton while over this element. 
         * @event mousedown
         */
        /**
         * @cfg {Number}   [max=64000]
         * Sets or retrieves the maximum allowed value
         */
        /**
         * @cfg {Number}   [min=-64000]
         * Sets or retrieves the minimal allowed value
         */
        /**
         * @cfg {Number}   value
         * Sets or retrieves the actual value displayed in component
         */
        /**
         * Increments the spinner by one.
         * @method increment
         */
        /**
         * Decrements the spinner by one.
         * @method decrement
         */  

// ui.dropdown

        /**
         * A dropdown implementation for use in the Cloud9 UI.
         * 
         * Example:
         * 
         *     <a:dropdown id="ddCountries">
         *         <a:item>United States of America</a:item>
         *         <a:item>The Netherlands</a:item>
         *         <a:item>France</a:item>
         *         <a:item>China</a:item>
         *     </a:dropdown>
         * 
         * Example:
         * 
         *     var dropdown = new ui.dropdown({
         *         id         : "ddCountries",
         *         childNodes : [
         *             new ui.item({ caption: "United States of America" }),
         *             new ui.item({ caption: "The Netherlands" }),
         *             new ui.item({ caption: "France" }),
         *             new ui.item({ caption: "China" })
         *         ]
         *     });
         *     plugin.addElement(dropdown);
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.dropdown
         * @extends AMLElement
         */
        /**
         * @event slidedown Fires when the dropdown slides open.
         * @cancellable Prevents the dropdown from sliding open
         */
        /**
         * @event slideup   Fires when the dropdown slides up.
         * @cancellable Prevents the dropdown from sliding up
         */
        /**
         * @cfg {String} initial-message 
         * Sets or retrieves the message displayed by this element
         * when it doesn't have a value set. This property is inherited from parent 
         * nodes. When none is found it is looked for on the appsettings element. 
         *
         */
        /**
         * @cfg {Number} maxitems 
         * Sets or retrieves the number of items that are shown at the 
         * same time in the container.
         */
        /**
         * @cfg {String} fill 
         * Sets or retrieves the set of items that should be loaded into this
         * element. Items are seperated by a comma (`,`). Ranges are specified 
         * by a start and end value seperated by a dash (`-`).
         *
         * Example:
         *
         * This example loads a list with items starting at 1980 and ending at 
         * 2050. It also loads several other items and ranges.
         *
         *     <a:dropdown fill="1980-2050" />
         *     <a:dropdown fill="red,green,blue,white" />
         *     <a:dropdown fill="None,100-110,1000-1100" /> <!-- 101, 102...110, 1000,1001, e.t.c. -->
         *     <a:dropdown fill="01-10" /> <!-- 01, 02, 03, 04, e.t.c. -->
         *     <a:dropdown fill="1-10" /> <!-- // 1 2 3 4 e.t.c. -->
         */

// ui.colorbox

        /**
         * A form element that allows a user to choose a color.
         * 
         * Example:
         * 
         *     <a:colorbox value="#FF00FF" />
         * 
         * Example:
         * 
         *     var colorbox = new ui.colorbox({
         *         value : "#FF00FF"
         *     });
         *     plugin.addElement(colorbox);
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.colorbox
         * @extends AMLElement
         */

// ui.frame

        /**
         * A frame implementation for use in the Cloud9 UI.
         * 
         * Example:
         * 
         *     <a:frame caption="General">
         *         <!-- child elements -->
         *     </a:frame>
         * 
         * Example:
         * 
         *     var frame = new ui.frame({
         *         caption : "General"
         *     });
         *     plugin.addElement(frame);
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.frame
         * @extends AMLElement
         */
        /**
         * @cfg {String} caption 
         * Sets or retrieves the caption text. 
         */
        /**
         * @cfg {String} icon 
         * Sets or retrieves the location of the icon.
         */

// ui.window

        /**
         * A window implementation for use in the Cloud9 UI.
         * 
         * Example:
         * 
         *     <a:window id="winExample" title="Example" visible="true">
         *         <a:button id="tstButton" />
         *     </a:window>
         *
         * Example:
         *
         *     var winExample = plugin.getElement("winExample");
         *     winExample.setAttribute("title", "Example");
         *     winExample.setAttribute("icon", "icoFolder.gif");
         *     winExample.setAttribute("left", "100");
         *     
         *     var tstButton = plugin.getElement("tstButton");
         *     tstButton.setAttribute("caption", "Click me");
         *     tstButton.addEventListener("click", function(e) {
         *         alert(1);
         *     });
         * 
         * #### About AML elements
         * 
         * The Cloud9 UI consists of a set of elements that you can combine to
         * create your UI. You can build a UI via a javascript API or using 
         * markup. 
         * 
         * UI Elements are generally created in a private draw function in the
         * plugin. See the {@link Template} source code for a full example.
         * 
         *     var drawn = false;
         *     function draw(){
         *         if (drawn) return;
         *         drawn = true;
         *         
         *         // Import Skin
         *         ui.insertSkin({
         *             name         : "myplugin",
         *             data         : require("text!./skin.xml"),
         *             "media-path" : options.staticPrefix + "/images/",
         *             "icon-path"  : options.staticPrefix + "/icons/"
         *         }, plugin);
         *         
         *         // Create UI elements
         *         ui.insertMarkup(null, require("text!./markup.xml", plugin);
         * 
         *         var button = plugin.getElement("btnDelete");
         *         button.addEventListener("click", someAction);
         *     
         *         emit("draw");
         *     }
         * 
         * See {@link ui#insertMarkup} for more information on how to
         * load your markup into your plugin.
         * 
         * @class ui.window
         * @extends AMLElement
         */
        /**
         * @event show          Fires when the window is opened.
         */
         /**
         * @event close         Fires when the window is closed.
         */
         /**
         * @event statechange   Fires after the state of this window changed.
         * @param e {Object} The standard event object. The following properties are available:
         * 
         *   - `minimized` ([[Boolean]]):   Specifies whether the window is minimized.
         *   - `maximized` ([[Boolean]]):   Specifies whether the window is maximized.
         *   - `normal` ([[Boolean]]):      Specifies whether the window has it's normal size and position.
         *   - `edit` ([[Boolean]]):        Specifies whether the window is in the edit state.
         *   - `closed` ([[Boolean]]):      Specifies whether the window is closed.
         */
        /**
         * @cfs {Boolean} modal Specifies whether the window prevents access to the
         * layout below it.
         */
        /**
         * @cfs {Boolean} center Centers the window relative to its parent's
         * containing rect when shown.
         */
        /**
         * @cfs {String} title Specifies the text of the title.
         */
        /**
         * @cfs {String} icon Specifies the location of the image.
         */
        /**
         * Close the window. It can be reopened by using {@link AMLElement#visible}
         * @method close
         * @chainable
         */
        /**
         * Minimize the window. The window will become the height of the title of
         * the parent window.
         * @method minimize
         * @chainable
         */
        /**
         * Maximize the window. The window will become the width and height of the
         * browser window.
         * @method maxmimize
         * @chainable
         */
        /**
         * Restore the size of the window. The window will become the width and
         * height it had before it was minimized or maximized.
         * @method restore
         * @chainable
         */
        /**
         * @cfs {String} state Sets or gets the state of the window. The state can be a
         * combination of multiple states, seperated by a pipe (`'|'`) character.
         *   
         * The possible values include:
         *
         *   `"normal"`:     The window has its normal size and position. This is the default value.
         *   `"minimized"`:  The window is minimized.
         *   `"maximized"`:  The window is maximized.
         *   `"edit"`:       The window is in the edit state.
         *   `"closed"`:     The window is closed.
         */
        /**
         * @cfs {String} buttons Sets or gets the buttons that the window displays. This
         * can be multiple values seperated by a pipe (`'|'`) character.
         *   
         * The possible values include:
         *
         *   `"min"`:    The button that minimizes the window.
         *   `"max"`:    The button that maximizes the window.
         *   `"close"`:  The button that closes the window.
         *   `"edit"`:   The button that puts the window into the edit state.
         */

        plugin.freezePublicAPI({
            
        });
    }
});