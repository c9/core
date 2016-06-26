define(function(require, module, exports) {
return function(apf) {
var $setTimeout  = setTimeout;
var $setInterval = setInterval;





/**
 * This element functions as the central access point for XML data. Data can be
 * retrieved from any data source using data instructions. Data can also be
 * submitted using data instructions in a similar way to HTML form posts. 
 *
 * The modal can be reset to its original state. It has support for offline use and
 * synchronization between multiple clients.
 * 
 * #### Example: Loading A Model 
 * 
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *  <!-- startcontent -->
 *  <a:model id="mdl1">
 *      <data>
 *          <row content="This is a row 1" />
 *          <row content="This is a row 2" />
 *          <row content="This is a row 3" />
 *      </data>
 *  </a:model>
 *  <a:hbox height="20">
 *      <a:label>List component:</a:label>
 *  </a:hbox>
 *  <a:list 
 *    model = "mdl1" 
 *    each = "[row]"
 *    caption = "[@content]" 
 *    icon = "[@icon]" 
 *    width = "400">
 *  </a:list>
 *  <a:hbox height="30" margin="7 0 3 0">
 *      <a:label>Datagrid component:</a:label>
 *  </a:hbox>
 *  <a:datagrid width="400" height="100" model="mdl1">
 *      <a:each match="[row]">
 *          <a:column 
 *            caption = "Name" 
 *            value = "[@content]" 
 *            width = "100%" />
 *      </a:each>
 *  </a:datagrid>
 *  <!-- endcontent -->
 * </a:application>
 * 
 * #### Example
 *
 * A small form where the bound data is submitted to a server using a model:
 * 
 * ```xml, demo
 * <a:application xmlns:a="http://ajax.org/2005/aml">
 *   <!-- startcontent -->
 *   <a:model id="mdlForm" submission="save_form.asp">
 *       <data name="Lukasz" address="Poland"></data>
 *   </a:model>
 *  
 *   <a:frame model="mdlForm">
 *       <a:label>Name</a:label>
 *       <a:textbox value="[@name]" />
 *       <a:label>Address</a:label>
 *       <a:textarea 
 *         value = "[@address]" 
 *         width = "100" 
 *         height = "50" />
 *       <a:button 
 *         default = "true" 
 *         action = "submit">Submit</a:button>
 *   </a:frame>
 *   <!-- endcontent -->
 * </a:application>
 * ```
 *
 * @class apf.model
 * @inherits apf.AmlElement
 * @define model
 * @logic
 * @allowchild [cdata], instance, load, submission
 *
 * 
 * 
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.8
 * 
 */
/**
 * @attribute  {String}  src          Sets or gets the data instruction on how to load data from the data source into this model.
 */
/**
 * @attribute  {String}  submission   Sets or gets the data instruction on how to record the data from the data source from this model.
 */
/**
 * @attribute  {String}  session      Sets or gets the data instruction on how to store the session data from this model.
 */
/**
 * @attribute  {Boolean} autoinit     Sets or gets whether to initialize the model immediately. If set to false you are expected to call init() when needed. This is useful when the system has to log in first.
 */
/**
 * @attribute  {Boolean} enablereset  Sets or gets whether to save the original state of the data. This enables the use of the reset() call.
 */
/**
 * @attribute  {String}  remote       Sets or gets the id of the remote element to use for data synchronization between multiple clients.
 */
/**
 * @event beforeretrieve    Fires before a request is made to retrieve data.
 * @cancelable Prevents the data from being retrieved.
 */
/**
 * @event afterretrieve     Fires when the request to retrieve data returns both on success and failure.
 */
/**
 * @event receive           Fires when data is successfully retrieved
 * @param {Object} e The standard event object. It contains the following property:
 *  - `data` (([String])):  the retrieved data
 */
/**
 * @event beforeload        Fires before data is loaded into the model.
 * @cancelable
 */
/**
 * @event afterload         Fires after data is loaded into the model.
 */
/**
 * @event beforesubmit      Fires before data is submitted.
 * @cancelable Prevents the submit.
 * @param {Object} e The standard event object. It contains the following property:
 *   - `instruction` ([[String]]):  the data instruction used to store the data.
 */
/**
 * @event submiterror       Fires when submitting data has failed.
 */
/**
 * @event submitsuccess     Fires when submitting data was successfull.
 */
/**
 * @event aftersubmit       Fires after submitting data.
 */
/**
 * @event error             Fires when a communication error has occured while making a request for this element.
 * @cancelable Prevents the error from being thrown.
 * @bubbles
 * @param {Object} e The standard event object. It contains the following properties:
 *   - `error` ([[Error]]): the error object that is thrown when the event callback doesn't return false.
 *   - `state` ([[Number]]): the state of the call. Possible values include:
 *     - `apf.SUCCESS`:  the request was successfull
 *     - `apf.TIMEOUT`:  the request has timed out.
 *     - `apf.ERROR`:  an error has occurred while making the request.
 *     - `apf.OFFLINE`:  the request was made while the application was offline.
 *   - `userdata` (`Mixed`): data that the caller wanted to be available in the callback of the HTTP request.
 *   - `http` ([[XMLHttpRequest]]): The object that executed the actual HTTP request.
 *   - `url` ([[String]]): the URL that was requested.
 *   - `tpModule` ([[apf.http]]): the teleport module that is making the request.
 *   - `id` ([[Number]]): the id of the request.
 *   - `message` ([[String]]): the error message.
 *
 */
apf.model = function(struct, tagName) {
    this.$init(tagName || "model", apf.NODE_HIDDEN, struct);
    
    this.$amlNodes = {};
    this.$propBinds = {};
    
    this.$listeners = {};
    this.$proplisteners = {};
};

(function(){
    this.$parsePrio = "020";
    this.$isModel = true;
    this.$createModel = true;
    
    this.canHaveChildren = false;
    this.enablereset = false;

    this.$state = 0;//1 = loading

    //1 = force no bind rule, 2 = force bind rule
    this.$attrExcludePropBind = apf.extend({
        submission: 1,
        src: 1,
        session: 1
    }, this.$attrExcludePropBind);

    this.$booleanProperties["whitespace"] = true;
    this.$booleanProperties["create-model"] = true;
    this.$booleanProperties["autoinit"] = true;
    this.$booleanProperties.enablereset = true;
    this.$supportedProperties = ["submission", "src", "session", "autoinit", 
        "enablereset", "remote", "whitespace", "create-model"];
    
    this.$propHandlers["src"] = 
    this.$propHandlers["get"] = function(value, prop) {
        if (this.$amlLoaded)
            this.$loadFrom(value);
    };
    
    this.$propHandlers["create-model"] = function(value, prop) {
        this.$createModel = value;
    };

    
    //Connect to a remote databinding
    this.$propHandlers["remote"] = function(value, prop) {
        if (value) {
            if (this.src && this.src.indexOf("rdb://") === 0) {
                var _self = this;
                apf.queue.add("rdb_load_" + this.$uniqueId, function(){
                    _self.unshare();
                    _self.share();
                });
            }
        }
        else
            this.unshare();
    };

    this.share = function(xpath) {
        this.rdb = typeof this.remote == "string"
            ? 
            
            apf.nameserver.get("remote", this.remote)
            
            : this.remote;

        

        this.rdb.createSession(this.src, this, xpath);
    };

    this.unshare = function(xpath) {
        if (!this.rdb) return;
        this.rdb.endSession(this.src);
        this.rdb = null;
    };
    

    /**
     * Registers an AML element to this model in order for the AML element to
     * receive data loaded in this model.
     *
     * @param  {apf.AmlElement}  amlNode  The AML element to be registered.
     * @param  {String}      [xpath]  The XPath query which is executed on the
     *                                data of the model to select the node to be
     *                                loaded in the `amlNode`.
     * @return  {apf.model}  This model
     * @private
     */
    this.register = function(amlNode, xpath) {
        if (!amlNode || !amlNode.load) //hasFeature(apf.__DATABINDING__))
            return this;

        var isReloading = amlNode.$model == this;

        //Remove previous model
        if (amlNode.$model && !isReloading)
            amlNode.$model.unregister(amlNode);

        //Register the AML node
        var item = this.$amlNodes[amlNode.$uniqueId] = {
            amlNode: amlNode, 
            xpath: xpath
        };
        amlNode.$model = this;

        if (typeof amlNode.noloading == "undefined"
          && amlNode.$setInheritedAttribute 
          && !amlNode.$setInheritedAttribute("noloading"))
            amlNode.noloading = false;

        //amlNode.$model = this;
        if (this.$state == 1) {
            if (amlNode.clear && !amlNode.noloading)
                amlNode.clear("loading");//@todo apf3.0
        }
        else if (this.data) {
            this.$loadInAmlNode(item);
            //this.$loadInAmlProp(amlNode);
        }
        else { //@experimental
            if (amlNode.hasFeature(apf.__CACHE__)) // amlNode.clear
                amlNode.clear("empty");
        }

        var p, node, list = amlNode.$propsUsingMainModel, id = amlNode.$uniqueId;
        for (var prop in list) {
            this.$unbindXmlProperty(amlNode, prop);
            p = this.$bindXmlProperty(amlNode, prop, 
                    list[prop].xpath, list[prop].optimize);
            
            if (this.data) {
                //if (node = p.root || p.listen ? this.data.selectSingleNode(p.root || p.listen) : this.data) {
                if (node = p.listen ? this.data.selectSingleNode(p.listen) : this.data) {
                    amlNode.$execProperty(prop, node);
                }
                else
                    this.$waitForXml(amlNode, prop);
            }
        }
        
        return this;
    };

    this.$register = function(amlNode, xpath) {
        //@todo apf3.0 update this.$propBinds;
        
        this.$amlNodes[amlNode.$uniqueId].xpath = xpath;
    };

    /*
     * Removes an AML element from the group of registered AML elements.
     * The AML element will not receive any updates from this model, however
     * the data loaded in the AML element is not unloaded.
     *
     * @param  {apf.AmlElement}  amlNode  The AML element to be unregistered.
     * @private
     */
    this.unregister = function(amlNode) {
        delete this.$amlNodes[amlNode.$uniqueId];
        
        var list = amlNode.$propsUsingMainModel;
        for (var prop in list)
            this.$unbindXmlProperty(amlNode, prop);
            
        amlNode.dispatchEvent("unloadmodel");
    };

    /*
     * @private
     */
    this.getXpathByAmlNode = function(amlNode) {
        var n = this.$amlNodes[amlNode.$uniqueId];
        if (!n)
            return false;

        return n.xpath;
    };
    
    /*
     * @private
     */
    this.$loadInAmlNode = function(item) {
        var xmlNode;
        var xpath = item.xpath;
        var amlNode = item.amlNode;
        
        if (this.data && xpath) {
            xmlNode = this.data.selectSingleNode(xpath);
        }
        else
            xmlNode = this.data || null;
        
        if (xmlNode) {
            delete this.$listeners[amlNode.$uniqueId];
            if (amlNode.xmlRoot != xmlNode)
                amlNode.load(xmlNode);
        }
        else 
            this.$waitForXml(amlNode);
    };
    
    this.$loadInAmlProp = function(id, xmlNode) {
        var prop, node, p = this.$propBinds[id], amlNode = apf.all[id];
        if (!amlNode) {
             delete this.$propBinds[id];
             return;
        }
        

        for (prop in p) {
            if (xmlNode && (node = p[prop].listen 
              ? xmlNode.selectSingleNode(p[prop].listen) 
              : xmlNode)) {
                apf.xmldb.addNodeListener(xmlNode, amlNode, 
                  "p|" + id + "|" + prop + "|" + this.$uniqueId);
                
                delete this.$proplisteners[id + prop];
                amlNode.$execProperty(prop, node);
            }
            else
                this.$waitForXml(amlNode, prop);
        }            
    };
    
    /*
        We don't want to connect to the root, that would create a rush
        of unnecessary update messages, so we'll find the element that's
        closest to the node that is going to feed us the value
        
        mdlBlah: :bli/persons
        mdlBlah: :bli/persons/person
        
        $attrBindings
        //split / join, pop, indexOf
        
        <a:textbox value="[persons/person/@blah]" width="[persons/blah/@width]" height="[@height]" model="[mdlBlah::bli]"/>
    */
    this.$bindXmlProperty = function(amlNode, prop, xpath, optimize, listenRoot) {
        var q ,p, id = amlNode.$uniqueId;
        if (!this.$propBinds[id]) 
            this.$propBinds[id] = {};

        /*
            Store
            0 - Original xpath
            1 - Store point of change listener
            2 - Xpath to determine data node passed into load
        */
        p = this.$propBinds[id][prop] = {
            bind: xpath
        };

        //@todo apf3.0
        //Optimize root point, doesnt work right now because it doesnt change the original rule
        if (optimize && false) {
            //Find xpath for bind on this model of the amlNode
            if ((q = this.$amlNodes[id]) && q.xpath)
                xpath = (p.root = q.xpath) + "/" + xpath;
            
            var l = xpath.split("/"), z = l.pop();
            if (z.indexOf("@") == 0 
              || z.indexOf("text()") > -1 
              || z.indexOf("node()") > -1) {
                p.listen = l.join("/");
            }
            else p.listen = xpath;
        }
        else {
            if ((q = this.$amlNodes[id]) && q.xpath)
                p.listen = q.xpath;
        }
        
        if (listenRoot)
            p.listen = ".";

        if (this.data) {
            var xmlNode = 
              
              (p.listen ? this.data.selectSingleNode(p.listen) : this.data);

            if (xmlNode) {
                apf.xmldb.addNodeListener(xmlNode, amlNode, 
                  "p|" + amlNode.$uniqueId + "|" + prop + "|" + this.$uniqueId);
                
                return p;
            }
        }
        
        this.$waitForXml(amlNode, prop);
        
        return p;
    };
    
    this.$unbindXmlProperty = function(amlNode, prop) {
        var id = amlNode.$uniqueId;

        //@todo apf3.0
        var p = this.$propBinds[id] && this.$propBinds[id][prop];
        if (!p) return;
        
        if (this.data) {
            var xmlNode = p.listen ? this.data.selectSingleNode(p.listen) : this.data;
            if (xmlNode) {
                apf.xmldb.removeNodeListener(xmlNode, amlNode, 
                  "p|" + id + "|" + prop + "|" + this.$uniqueId);
            }
        }
        
        delete this.$proplisteners[id + prop];
        delete this.$propBinds[id][prop];
        return p;
    };

    /**
     * Gets a copy of current state of the XML of this model.
     *
     * @return  {XMLNode}  The context of this model, or `false` if there's no data
     * 
     */
    this.getXml = function(){
        return this.data
            ? apf.xmldb.cleanNode(this.data.cloneNode(true))
            : false;
    };

    /**
     * Sets a value of an XMLNode based on an XPath statement executed on the data of this model.
     *
     * @param  {String}  xpath  The xpath used to select a XMLNode.
     * @param  {String}  value  The value to set.
     * @return  {XMLNode}  The changed XMLNode
     */
    this.setQueryValue = function(xpath, value) {
        if (!this.data)
            return false;
        
        var node = apf.createNodeFromXpath(this.data, xpath);
        if (!node)
            return null;

        apf.setNodeValue(node, value, true);
        //apf.xmldb.setTextNode(node, value);
        return node;
    };
    
    /**
     * Sets a value of a set of XML nodes based on an XPath statement executed on the data of this model.
     *
     * @param  {String}  xpath  The xpath used to select a the nodeset.
     * @param  {String}  value  The value to set.
     * @return  {NodeList}  The changed XMLNodeSet
     */
    this.setQueryValues = function(xpath, value) {
        if (!this.data)
            return [];
        
        var nodes = this.data.selectNodes(xpath);
        for (var i = 0, l = nodes.length; i < l; i++)
            apf.setNodeValue(node, value, true);

        return nodes;
    };

    /**
     * Gets the value of an XMLNode based on a XPath statement executed on the data of this model.
     *
     * @param  {String}  xpath  The XPath used to select a XMLNode.
     * @return  {String}  The value of the XMLNode
     */
    this.queryValue = function(xpath) {
        if (!this.data)
            return false;
        
        return apf.queryValue(this.data, xpath);
    };
    
    /**
     * Gets the values of an XMLNode based on a XPath statement executed on the data of this model.
     *
     * @param  {String}  xpath  The xpath used to select a XMLNode.
     * @return  {[String]}  The values of the XMLNode
     */ 
    this.queryValues = function(xpath) {
        if (!this.data)
            return [];
        
        return apf.queryValue(this.data, xpath);
    };
    
    /**
     * Executes an XPath statement on the data of this model
     *
     * @param  {String}   xpath    The XPath used to select the XMLNode(s).
     * @return  {Mixed} The result of the selection, either an [[XMLNode]] or a [[NodeList]]
     */
    this.queryNode = function(xpath) {
        if (!this.data)
            return null;
        
        return this.data.selectSingleNode(xpath)
    };

    /**
     * Executes XPath statements on the data of this model
     *
     * @param  {String}   xpath    The XPath used to select the XMLNode(s).
     * @return  {Mixed} The result of the selection, either an [[XMLNode]] or a [[NodeList]]
     */
    this.queryNodes = function(xpath) {
        if (!this.data)
            return [];
        
        return this.data.selectNodes(xpath);
    };

    /**
     * Appends a copy of the `xmlNode` or model to this model as a child
     * of its root node
     * @param {XMLNode} xmlNode The XML node to append
     * @param {String} [xpath] The path to a node to append to
     * @returns {XMLNode} The appended node
     */
    this.appendXml = function(xmlNode, xpath) {
        var insertNode = xpath
          ? apf.createNodeFromXpath(this.data, xpath)
          : this.data;
        if (!insertNode)
            return null;
        
        if (typeof xmlNode == "string")
            xmlNode = apf.getXml(xmlNode);
        else if (xmlNode.nodeFunc)
            xmlNode = xmlNode.getXml();
        
        if (!xmlNode) return;

        xmlNode = apf.xmldb.appendChild(insertNode, xmlNode);
        
        this.dispatchEvent("update", {xmlNode: xmlNode});
        return xmlNode;
    };

    /**
     * Removes an XML node from this model.
     */
    this.removeXml = function(xmlNode) {
        if (!this.data) return;

        var xmlNodes;
        if (typeof xmlNode === "string") {
            xmlNodes = this.data.selectNodes(xmlNode);
        }
        else if (!xmlNode.length) {
            xmlNodes = [xmlNode];
        }
        
        if (xmlNodes.length) {
            apf.xmldb.removeNodeList(xmlNodes);
        }
    };

    /**
     * Clears the loaded data from this model.
     */
    this.clear = function(){
        this.load(null);
        doc = null; //Fix for safari refcount issue;
    };

    /**
     * Resets data in this model to the last saved point.
     *
     */
    this.reset = function(){
        var doc = this.data.ownerDocument;
        //doc.removeChild(this.data);
        //var node = doc.appendChild(apf.isWebkit ? doc.importNode(this.$copy, true) : this.$copy);
        this.data.parentNode.replaceChild(this.$copy, this.data);
        this.load(this.$copy);
    };

    /**
     * Sets a new saved point based on the current state of the data in this
     * model. The `reset()` method returns the model to this point.
     */
    this.savePoint = function(){
        this.$copy = apf.xmldb.getCleanCopy(this.data);
    };

    /**
     * @private
     */
    this.reloadAmlNode = function(uniqueId) {
        if (!this.data)
            return;

        var item = this.$amlNodes[uniqueId];
        var xmlNode = item.xpath 
            ? this.data.selectSingleNode(item.xpath) 
            : this.data;
        item.amlNode.load(xmlNode);
    };

    //@todo refactor this to use .blah instead of getAttribute
    //@todo move this to propHandlers
    /*
     * @private
     */
    this.addEventListener("DOMNodeInsertedIntoDocument", function(e) {
        var x = this.$aml;
        if (this.parentNode && this.parentNode.hasFeature(apf.__DATABINDING__)) {
            if (!this.name)
                this.setProperty("id", "model" + this.parentNode.$uniqueId);
            //this.parentNode.$aml.setAttribute("model", this.name); //@todo don't think this is necesary anymore...
            this.register(this.parentNode);
        }

        //Load literal model
        if (!this.src) {
            var strXml, xmlNode = x;
            if (xmlNode && xmlNode.childNodes.length) {
                if (apf.getNode(xmlNode, [0])) {
                    if ((strXml = xmlNode.xml || xmlNode.serialize()).match(/^[\s\S]*?>([\s\S]*)<[\s\S]*?$/)) {
                        strXml = RegExp.$1; //@todo apf3.0 test this with json
                        if (!apf.supportNamespaces)
                            strXml = strXml.replace(/xmlns=\"[^"]*\"/g, "");
                    }
                    
                    if (this.whitespace === false)
                        strXml = strXml.replace(/>[\s\n\r]*</g, "><");
                    
                    return this.load(apf.getXmlDom(strXml).documentElement);
                }
                // we also support JSON data loading in a model CDATA section
                else if (apf.isJson(xmlNode.childNodes[0].nodeValue)) {
                    return this.load(apf.getXmlDom(xmlNode.childNodes[0].nodeValue).documentElement);
                }
            }
            
            //Default data for XForms models without an instance but with a submission node
            if (this.submission)
                this.load("<data />");
        }

        //Load data into model if allowed
        if (!apf.isFalse(this.autoinit))
            this.init();

        //@todo actions apf3.0

        return this;
    });

    //callback here is private
    /**
     * Loads the initial data into this model.
     * @see apf.model.init
     */
    this.init = function(callback) {
        if (this.session) {
            this.$loadFrom(this.session, {isSession: true});
        }
        else {
            

            if (this.src)
                this.$loadFrom(this.src, {callback: callback});
        }
    };

    /* *********** LOADING ****************/

    /*
     * Loads data into this model using a data instruction.
     * @param {String}     instruction  The data instrution how to retrieve the data.
     * @param {Object}     options
     *   Properties:
     *   {XMLElement} xmlNode   the {@link term.datanode data node} that provides context to the data instruction.
     *   {Function}   callback  the code executed when the data request returns.
     *   {Mixed}      []        Custom properties available in the data instruction.
     */
    this.$loadFrom = function(instruction, options) {
        
        if (instruction.indexOf("rdb://") === 0) {
            this.src = instruction; //@todo
            return this.$propHandlers["remote"].call(this, this.remote);
        }
        
        var data = instruction.split(":");

        if (!options)
            options = {};

        if (!options.isSession) {
            this.src = instruction;
            this.$srcOptions = [instruction, options];
        }

        //Loading data in non-literal model
        this.dispatchEvent("beforeretrieve");
        
        //Set all components on loading...
        var uniqueId, item;
        for (uniqueId in this.$amlNodes) {
            if (!(item = this.$amlNodes[uniqueId]) || !item.amlNode)
                continue;

            //@todo apf3.0
            if (!item.amlNode.noloading)
                item.amlNode.clear("loading");
        }

        this.$state = 1;
        if (!this.$callCount)
            this.$callCount = 1;
        else
            this.$callCount++;

        var _self = this,
            callCount = this.$callCount,
            callback = options.callback;
        options.callback = function(data, state, extra) {
            if (callCount != _self.$callCount)
                return; //another call has invalidated this one
            
            _self.dispatchEvent("afterretrieve");

            

            if (state != apf.SUCCESS) {
                var oError;

                oError = new Error(apf.formatErrorString(1032,
                    _self, "Loading xml data", "Could not load data\n"
                  + "Instruction: " + instruction + "\n"
                  + "Url: " + extra.url + "\n"
                  + "Info: " + extra.message + "\n\n" + data));

                if (callback && callback.apply(this, arguments) === true)
                    return true;

                if (extra.tpModule && extra.tpModule.retryTimeout(extra, state, _self, oError) === true)
                    return true;

                _self.$state = 0;

                throw oError;
            }

            if (options && options.isSession && !data) {
                if (this.src)
                    return _self.$loadFrom(this.src);
            }
            else {
                if (options && options.cancel)
                    return;

                _self.load(data);
                _self.dispatchEvent("receive", {
                    data: data
                });

                if (callback)
                    callback.apply(this, arguments);
            }
        };

        return apf.getData(instruction, options);
    };
    
    /**
     * Loads the data from the datasource specified for [[apf.model.init]].
     */
    this.reload = function(){
        if (!this.data)
            return;
        
        if (this.$srcOptions)
            this.$loadFrom.apply(this, this.$srcOptions);
        else if (this.src)
            this.$loadFrom(this.src);
    };

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
    this.load = function(xmlNode, options) {
        if (typeof xmlNode == "string") {
            if (xmlNode.charAt(0) == "<") { //xml
                if (xmlNode.substr(0, 5).toUpperCase() == "<!DOC")
                    xmlNode = xmlNode.substr(xmlNode.indexOf(">")+1);
                if (!apf.supportNamespaces)
                    xmlNode = xmlNode.replace(/xmlns\=\"[^"]*\"/g, "");
                xmlNode = apf.getXmlDom(xmlNode, null, true).documentElement; //@todo apf3.0 whitespace issue
            }
            
            else
                return this.$loadFrom(xmlNode, options);
        }

        if (this.ownerDocument && this.ownerDocument.$domParser.$isPaused(this)) {
            //if (!this.$queueLoading) {
                var _self = this;
                this.data = xmlNode; //@todo expirement //this.$copy = 
                apf.xmldb.getXmlDocId(xmlNode, this); //@todo experiment
                
                this.$queueLoading = true;
                apf.queue.add("modelload" + this.$uniqueId, function(){
                    if (_self.ownerDocument && _self.ownerDocument.$domParser.$isPaused(_self))
                        apf.queue.add("modelload" + _self.$uniqueId, arguments.callee);
                    else {
                        _self.load(xmlNode, options);
                        _self.$queueLoading = false;
                    }
                });
            //}
            return;
        }
        else if (this.$queueLoading)
            apf.queue.remove("modelload" + this.$uniqueId);
        
        this.$state = 0;

        if (this.dispatchEvent("beforeload", {xmlNode: xmlNode}) === false)
            return false;

        var doc = xmlNode ? xmlNode.ownerDocument : null; //Fix for safari refcount issue;

        if (xmlNode) {
            if (!apf.supportNamespaces) {
                /* && (xmlNode.prefix || xmlNode.scopeName)) {
                doc.setProperty("SelectionNamespaces", "xmlns:"
                     + (xmlNode.prefix || xmlNode.scopeName) + "='"
                     + xmlNode.namespaceURI + "'");*/
                var xmlns = [], attr = xmlNode.attributes;
                for (var i = 0, l = attr.length; i < l; i++) {
                    if (attr[i].nodeName.substr(0, 5) == "xmlns") {
                        xmlns.push(attr[i].xml);
                    }
                }
                if (xmlns.length)
                    doc.setProperty("SelectionNamespaces", xmlns.join(" "));
            }
            
            apf.xmldb.addNodeListener(xmlNode, this); //@todo this one can be added for this.$listeners and when there are none removed
            apf.xmldb.nodeConnect(
                apf.xmldb.getXmlDocId(xmlNode, this), xmlNode, null, this);

            if ((!options || !options.nocopy) && this.enablereset)
                this.$copy = apf.xmldb.getCleanCopy(xmlNode);
        }

        this.data = xmlNode;
        
        this.dispatchEvent("afterload", {xmlNode: xmlNode});
        this.dispatchEvent("update", {xmlNode: xmlNode});
        
        for (var id in this.$amlNodes)
            this.$loadInAmlNode(this.$amlNodes[id]);

        for (id in this.$propBinds)
            this.$loadInAmlProp(id, xmlNode);

        return this;
    };
    
    //Listening nodes should be removed in unregister
    this.$waitForXml = function(amlNode, prop) {
        if (prop)
            this.$proplisteners[amlNode.$uniqueId + prop] = {
                id: amlNode.$uniqueId, 
                amlNode: amlNode, 
                prop: prop
            };
        else 
            this.$listeners[amlNode.$uniqueId] = amlNode;
        
        //When data is not available at model load but element had already data
        //loaded, it is cleared here.
        if (amlNode.xmlRoot)
            amlNode.clear();
    };
    
    this.$xmlUpdate = function(action, xmlNode, listenNode, UndoObj) {
        //@todo optimize by only doing this for add, sync etc actions
        
        if (action == "replacenode" && xmlNode == this.data.ownerDocument.documentElement) {
            var _self = this;
            $setTimeout(function(){
                _self.load(xmlNode);
            });
            return;
        }
        
        
        if (this.rdb && !this.$at && UndoObj)
            this.$at = UndoObj.at;
        

        
        
        var p, b;
        for (var id in this.$listeners) {
            if (xmlNode = this.data.selectSingleNode(this.$amlNodes[id].xpath || ".")) {
                this.$listeners[id].load(xmlNode);
                delete this.$listeners[id];
            }
        }

        for (id in this.$proplisteners) {
            p = this.$proplisteners[id];
            b = this.$propBinds[p.id][p.prop];
            if (xmlNode = b.listen ? this.data.selectSingleNode(b.listen) : this.data) {
                delete this.$proplisteners[id];
                
                apf.xmldb.addNodeListener(xmlNode, p.amlNode, 
                  "p|" + p.id + "|" + p.prop + "|" + this.$uniqueId);
                
                p.amlNode.$execProperty(p.prop, b.root 
                  ? this.data.selectSingleNode(b.root) 
                  : this.data);
            }
        }
        
        this.dispatchEvent("update", {xmlNode: xmlNode, action: action, undoObj: UndoObj});
    };

    // *** INSERT *** //

    /*
     * Inserts data into the data of this model using a data instruction.
     * @param {String}     instruction  The data instrution indicating how to retrieve the data.
     * @param {Object}     options      Additional options to pass. This can contain the following properties:
     *   
     *   - `insertPoint` ([[XMLElement]]): the parent element for the inserted data.
     *   - `clearContents` ([[Boolean]]): whether the contents of the insertPoint should be cleared before inserting the new children.
     *   - `copyAttributes` ([[Boolean]]): whether the attributes of the merged element are copied.
     *   - `callback` ([[Function]]): the code executed when the data request returns.
     *   - `[]` (`Mixed`): custom properties available in the data instruction.
     */
    this.$insertFrom = function(instruction, options) {
        if (!instruction) return false;

        this.dispatchEvent("beforeretrieve");

        

        var callback = options.callback, _self = this;
        options.callback = function(data, state, extra) {
            _self.dispatchEvent("afterretrieve");

            if (!extra)
                extra = {};

            if (state != apf.SUCCESS) {
                var oError;

                

                if (extra.tpModule.retryTimeout(extra, state, 
                  options.amlNode || _self, oError) === true)
                    return true;

                if (callback 
                  && callback.call(this, extra.data, state, extra) === false)
                    return;

                throw oError;
            }

            //Checking for xpath
            if (typeof options.insertPoint == "string")
                options.insertPoint = _self.data.selectSingleNode(options.insertPoint);

            if (typeof options.clearContents == "undefined" && extra.userdata) 
                options.clearContents = apf.isTrue(extra.userdata[1]); //@todo is this still used?

            if (options.whitespace == undefined)
                options.whitespace = _self.whitespace;

            //Call insert function
            (options.amlNode || _self).insert(data, options);

            if (callback)
                callback.call(this, extra.data, state, extra);
        };

        apf.getData(instruction, options);
    };

    /**
     * Inserts data in this model as a child of the currently loaded data.
     *
     * @param  {XMLElement} XMLRoot         The {@link term.datanode data node} to insert into this model.
     * @param {Object}     options Additional options to pass. This can contain the following properties:
     *   
     *   - `insertPoint` ([[XMLElement]]): the parent element for the inserted data.
     *   - `clearContents` ([[Boolean]]): specifies whether the contents of the `insertPoint` should be cleared before inserting the new children.
     *   - `copyAttributes` ([[Boolean]]): specifies whether the attributes of the merged element are copied.
     *   - `callback` ([[Function]]): the code executed when the data request returns.
     *   - `[]` (`Mixed`): Custom properties available in the data instruction.
     */
    this.insert = function(xmlNode, options) {
        if (typeof xmlNode == "string") {
            if (xmlNode.charAt(0) == "<") {
                if (xmlNode.substr(0, 5).toUpperCase() == "<!DOC")
                    xmlNode = xmlNode.substr(xmlNode.indexOf(">")+1);
                if (!apf.supportNamespaces)
                    xmlNode = xmlNode.replace(/xmlns\=\"[^"]*\"/g, "");
                
                if (this.whitespace === false)
                    xmlNode = xmlNode.replace(/>[\s\n\r]*</g, "><");
                
                xmlNode = apf.getXmlDom(xmlNode).documentElement;
            }
            
            else
                return this.$insertFrom(xmlNode, options);
        }

        if (!options.insertPoint)
            options.insertPoint = this.data;

        

        //if(this.dispatchEvent("beforeinsert", parentXMLNode) === false) return false;

        //Integrate XMLTree with parentNode
        if (typeof options.copyAttributes == "undefined")
            options.copyAttributes = true;
        
        var newNode = apf.mergeXml(xmlNode, options.insertPoint, options);

        //Call __XMLUpdate on all this.$listeners
        apf.xmldb.applyChanges("insert", options.insertPoint);//parentXMLNode);

        //this.dispatchEvent("afterinsert");

        return xmlNode;
    };


    this.$destroy = function(){
        if (this.session && this.data)
            apf.saveData(this.session, {xmlNode: this.getXml()});
    };
}).call(apf.model.prototype = new apf.AmlElement());

apf.aml.setElement("model", apf.model);






apf.__DATABINDING__ = 1 << 1;



/**
 * This is a baseclass that adds data binding features to this element. 
 * Databinding takes care of automatically going from data to representation and establishing a
 * permanent link between the two. In this way data that is changed will
 * change the representation as well. Furthermore, actions that are executed on
 * the representation will change the underlying data.
 * 
 * #### Example
 *
 * ```xml
 *  <a:list>
 *      <a:model>
 *          <data>
 *              <item icon="ajax_org.gif">Item 1</item>
 *              <item icon="ajax_org.gif">Item 2</item>
 *          </data>
 *      </a:model>
 *      <a:bindings>
 *          <a:icon match="[@icon]" />
 *          <a:caption match="[text()]" />
 *          <a:each match="[item]" />
 *      </a:bindings>
 *  </a:list>
 * ```
 *
 * @class apf.DataBinding
 * @inherits apf.Presentation
 * @baseclass
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.4
 * @default_private
 */
/**
 * @event error             Fires when a communication error has occured while
 *                          making a request for this element.
 * @cancelable Prevents the error from being thrown.
 * @bubbles
 * @param {Object} e The standard event object. It contains the following properties:
 *                   - error ([[Error]]): the error object that is thrown when the event callback doesn't return false.
 *                   - state ([[Number]]): the state of the call
 *                                                - `apf.SUCCESS`:  The request was successfull
 *                                                - `apf.TIMEOUT`:  The request has timed out.
 *                                                - `apf.ERROR  `:  An error has occurred while making the request.
 *                                                - `apf.OFFLINE`:  The request was made while the application was offline.
 *                   - userdata (`Mixed`): Data that the caller wanted to be available in the callback of the http request.
 *                   - http ([[XMLHttpRequest]]): The object that executed the actual http request.
 *                   - url ([[String]]): The url that was requested.
 *                   - tpModule ([[apf.http]]): The teleport module that is making the request.
 *                   - id ([[Number]]): The ID of the request.
 *                   - message ([[String]]): The error message.
 */
/** 
 * @event beforeretrieve    Fires before a request is made to retrieve data.
 * @cancelable Prevents the data from being retrieved.
 */
/**
 * @event afterretrieve     Fires when the request to retrieve data returns both
 *                          on success and failure.
 */
/**
 * @event receive           Fires when data is successfully retrieved
 * @param {Object} e The standard event object. It contains the following properties:
 *                   - data ([[String]]): the retrieved data
 *
 */
apf.DataBinding = function(){
    this.$init(true);
    
    this.$loadqueue = 
    this.$dbTimer = null;
    this.$regbase = this.$regbase | apf.__DATABINDING__;
    this.$mainBind = "value";
    
    this.$bindings = 
    this.$cbindings = 
    this.$attrBindings = false;

    //1 = force no bind rule, 2 = force bind rule
    this.$attrExcludePropBind = apf.extend({
        model: 1,
        each: 1
        //eachvalue : 1 //disabled because of line 1743 valueRule = in multiselect.js
    }, this.$attrExcludePropBind);

    // *** Public Methods *** //

    /**
     * Sets a value of an XMLNode based on an xpath statement executed on the data of this model.
     *
     * @param  {String}  xpath  The xpath used to select a XMLNode
     * @param  {String}  value  The value to set
     * @return  {XMLNode}  The changed XMLNode
     */
    this.setQueryValue = function(xpath, value, type) {
        var node = apf.createNodeFromXpath(this[type || 'xmlRoot'], xpath);
        if (!node)
            return null;

        apf.setNodeValue(node, value, true);
        //apf.xmldb.setTextNode(node, value);
        return node;
    };

    /**
     * Queries the bound data for a string value
     *
     * @param {String} xpath  The XPath statement which queries on the data this element is bound on.
     * @param {String} type   The node that is used as the context node for the query. It can be one of the following possible values:
     *                         - `"selected"`:    The selected data anode of this element.
     *                         - `"xmlRoot"`:   The root data node that this element is bound on.
     *                         - `"indicator"`:   The data node that is highlighted for keyboard navigation.
     * @return {String}       The value of the selected XML Node
     * 
     */
    this.queryValue = function(xpath, type) {
     /*   @todo
     *  lstRev.query('revision/text()', 'selected');
     *  lstRev.query('revision/text()', 'xmlRoot');
     *  lstRev.query('revision/text()', 'indicator');
     */
        return apf.queryValue(this[type || 'xmlRoot'], xpath );
    };
    /**
     * Queries the bound data for an array of string values
     *
     * @param {String} xpath The XPath statement which queries on the data this element is bound on.
     * @param {String} type   The node that is used as the context node for the query. It can be one of the following possible values:
     *                         - `"selected"`:    The selected data anode of this element.
     *                         - `"xmlRoot"`:   The root data node that this element is bound on.
     *                         - `"indicator"`:   The data node that is highlighted for keyboard navigation.
     * @return {String}       The value of the selected XML Node
     */
    this.queryValues = function(xpath, type) {
        return apf.queryValues(this[type || 'xmlRoot'], xpath );
    };
    
    /**
     * Executes an XPath statement on the data of this model
     *
     * @param {String} xpath The XPath statement which queries on the data this element is bound on.
     * @param {String} type   The node that is used as the context node for the query. It can be one of the following possible values:
     *                         - `"selected"`:    The selected data anode of this element.
     *                         - `"xmlRoot"`:   The root data node that this element is bound on.
     *                         - `"indicator"`:   The data node that is highlighted for keyboard navigation.
     * @return  {Mixed}  An [[XMLNode]] or [[NodeList]] with the result of the selection
     */
    this.queryNode = function(xpath, type) {
        var n = this[type||'xmlRoot'];
        return n ? n.selectSingleNode(xpath) : null;
    };

    /**
     * Executes an XPath statement on the data of this model
     *
     * @param  {String}   xpath    The XPath used to select the XMLNode(s)
     * @param {String} type   The node that is used as the context node for the query. It can be one of the following possible values:
     *                         - `"selected"`:    The selected data anode of this element.
     *                         - `"xmlRoot"`:   The root data node that this element is bound on.
     *                         - `"indicator"`:   The data node that is highlighted for keyboard navigation.
     * @return  {Mixed}  An [[XMLNode]] or [[NodeList]] with the result of the selection
     */
    this.queryNodes = function(xpath, type) {
        var n = this[type||'xmlRoot'];
        return n ? n.selectNodes(xpath) : [];
    };
    
    this.$checkLoadQueue = function(){
        // Load from queued load request
        if (this.$loadqueue) {
            if (!this.caching)
                this.xmlRoot = null;
            var q = this.load(this.$loadqueue[0], {cacheId: this.$loadqueue[1]});
            if (!q || q.dataType != apf.ARRAY || q != this.$loadqueue)
                this.$loadqueue = null;
        }
        else return false;
    };
    
    //setProp
    this.$execProperty = function(prop, xmlNode, undoObj) {
        var attr = this.$attrBindings[prop];
        
        //@todo this is a hacky solution for replaceNode support - Have to rethink this.
        if (this.nodeType == 7) {
            if (xmlNode != this.xmlRoot)
                this.xmlRoot = xmlNode;
        }
        
        
        
        

        
        try {
        
            if (attr.cvalue.asyncs) { //if async
                var _self = this;
                return attr.cvalue.call(this, xmlNode, function(value) {
                    _self.setProperty(prop, value, true);
                    
                    
                
                }); 
            }
            else {
                var value = attr.cvalue.call(this, xmlNode);
            }
        
        }
        catch (e) {
            apf.console.warn("[400] Could not execute binding for property "
                + prop + "\n\n" + e.message);
            return;
        }
        
        
        this.setProperty(prop, undoObj && undoObj.extra.range || value, true); //@todo apf3.0 range
        
        
    };
    
    //@todo apf3.0 contentEditable support
    this.$applyBindRule = function(name, xmlNode, defaultValue, callback, oHtml) {
        var handler = this.$attrBindings[name] 
          && this.$attrBindings[name].cvalue || this.$cbindings[name];

        return handler ? handler.call(this, xmlNode, callback) : defaultValue || "";
    };

    
    
    this.$hasBindRule = function(name) {
        return this.$attrBindings[name] || this.$bindings 
          && this.$bindings[name];
    };
    
    this.$getBindRule = function(name, xmlNode) {
        return this.$attrBindings[name] || this.$bindings 
          && this.$bindings.getRule(name, xmlNode);
    };
    
    var ruleIsMatch = {"drag":1,"drop":1,"dragcopy":1}
    this.$getDataNode = function(name, xmlNode, createNode, ruleList, multiple) {
        var node, rule = this.$attrBindings[name];
        if (rule) { //@todo apf3.0 find out why drag and drop rules are already compiled here
            if (rule.cvalue.type != 3) //@todo warn here?
                return false;
            
            var func = rule.cvalue2 || rule.compile("value", {
                xpathmode: multiple ? 4 : 3,
                parsecode: 1,
                injectself: ruleIsMatch[name]
            });
            if (func && (node = func(xmlNode, createNode))) {
                if (ruleList)
                    ruleList.push(rule);

                return node;
            }
            
            return false;
        }
        
        return this.$bindings 
           && this.$bindings.getDataNode(name, xmlNode, createNode, ruleList, multiple);
    };
    
    
    /**
     * Sets the model of the specified element. 
     * The model acts as a datasource for this element.
     *
     * @param  {apf.model}  The model this element is going to connect to.
     * 
     */
    this.setModel = function(model) {
        this.setAttribute("model", model, false, true);
    };
    
    
    /**
     * Gets the model which this element is connected to.
     * The model acts as a datasource for this element.
     *
     * @param {Boolean} doRecur Specifies whether the model should be searched recursively up the data tree.
     * @returns  {apf.model}  The model this element is connected to.
     * @see apf.smartbinding
     */
    this.getModel = function(doRecur) {
        if (doRecur && !this.$model)
            return this.dataParent ? this.dataParent.parent.getModel(true) : null;

        return this.$model;
    };
    
    /**
     * Reloads the data in this element.
     * @method 
     */
    this.reload = this.reload || function(){
        this.load(this.xmlRoot, {cacheId: this.cacheId, force: true});
    };

    /**
     * @event beforeload  Fires before loading data in this element.
     * @cancelable Prevents the data from being loaded.
     * @param {XMLElement} xmlNode The node that is loaded as the root {@link term.datanode data node}.
     *   
     */
    /** 
     * @event afterload   Fires after loading data in this element.
     * @param {XMLElement} xmlNode The node that is loaded as the root {@link term.datanode data node}.
     */
    /**
     * Loads data into this element using binding rules to transform the
     * data into a presentation.
     * 
     * #### Example
     * 
     * ```xml 
     *  <a:list id="lstExample">
     *      <a:bindings>
     *          <a:caption match="[text()]" />
     *          <a:icon match="[@icon]" />
     *          <a:each match="[image]" />
     *      </a:bindings>
     *  </a:list>
     *  
     *  <a:script><!--
     *      apf.onload = function() {
     *      lstExample.load('<images>\
     *          <image icon="icoTest.gif">image 1</image>\
     *          <image icon="icoTest.gif">image 2</image>\
     *          <image icon="icoTest.gif">image 3</image>\
     *          </images>');
     *      }
     *  --></a:script>
     * ```
     *
     * @param {XMLElement | String}  [xmlNode] The content to load into this element. It can be one of the following values:
     *                                                - {XMLElement}: An XML element that's loaded into this element
     *                                                - {String}: Either an XML string, or, an instruction to load the data from a remote source
     *                                                - `null`: Clears this element from its data
     * @param {Object} [options] Set of additional options to pass. Properties include:
     *                           - [xmlNode] ([[XMLElement]]):   The {@link term.datanode data node} that provides
     *                                                       context to the data instruction.
     *                           - [callback] ([[Function]]): The code executed when the data request returns
     *                           - [properties] (`Mixed`): Custom properties available in the data instruction
     *                           - [cacheId] ([[String]]): The xml element to which the binding rules are applied
     *                           - [force] ([[Boolean]]): Specifies whether cache is checked before loading the data
     *                           - [noClearMsg] ([[Boolean]]): Specifies whether a message is set when clear is called
     */
    this.load = function(xmlNode, options) {
        if (options) {
            var cacheId = options.cacheId,
                forceNoCache = options.force,
                noClearMsg = options.noClearMsg;
        }
        if (cacheId && cacheId == this.cacheId && !forceNoCache)
            return;

        
        if (apf.popup.isShowing(this.$uniqueId))
            apf.popup.forceHide(); //This should be put in a more general position
        

        // Convert first argument to an xmlNode we can use;
        if (xmlNode) {
            if (typeof xmlNode == "string") {
                if (xmlNode.charAt(0) == "<")
                    xmlNode = apf.getXmlDom(xmlNode).documentElement;
                else {
                    return apf.model.prototype.$loadFrom.call(this, xmlNode, options);
                }
            }
            else if (xmlNode.nodeType == 9) {
                xmlNode = xmlNode.documentElement;
            }
            else if (xmlNode.nodeType == 3 || xmlNode.nodeType == 4) {
                xmlNode = xmlNode.parentNode;
            }
            else if (xmlNode.nodeType == 2) {
                xmlNode = xmlNode.ownerElement 
                    || xmlNode.parentNode 
                    || xmlNode.selectSingleNode("..");
            }
        }

        // If control hasn't loaded databinding yet, queue the call
        if (this.$preventDataLoad || !this.$canLoadData 
          && ((!this.$bindings && (!this.$canLoadDataAttr || !this.each)) || !this.$amlLoaded) 
          && (!this.hasFeature(apf.__MULTISELECT__) || !this.each) 
          || this.$canLoadData && !this.$canLoadData()) {
            
            if (!this.caching || !this.hasFeature(apf.__CACHE__)) {
                
                //@todo this is wrong. It is never updated when there are only
                //Property binds and then it just leaks xml nodes
                this.xmlRoot = xmlNode;
                
                
                this.setProperty("root", this.xmlRoot);
                
            }
            
            
            
            return this.$loadqueue = [xmlNode, cacheId];
        }
        this.$loadqueue = null;

        // If no xmlNode is given we clear the control, disable it and return
        if (this.dataParent && this.dataParent.xpath)
            this.dataParent.parent.signalXmlUpdate[this.$uniqueId] = !xmlNode;

        if (!xmlNode && (!cacheId || !this.$isCached || !this.$isCached(cacheId))) {
            

            this.clear(noClearMsg);

            
            if (apf.config.autoDisable && this.$createModel === false)
                this.setProperty("disabled", true);

            //@todo apf3.0 remove , true in clear above
            //this.setProperty("selected", null);
            
            return;
        }
        
        // If reloading current document, and caching is disabled, exit
        if (!this.caching && !forceNoCache && xmlNode 
          && !this.$loadqueue && xmlNode == this.xmlRoot)
            return;

        var disabled = this.disabled;
        this.disabled = false;

        //Run onload event
        if (this.dispatchEvent("beforeload", {xmlNode : xmlNode}) === false)
            return false;

        

        this.clear(true, true);

        this.cacheId = cacheId;

        if (this.dispatchEvent("$load", {
          forceNoCache: forceNoCache, 
          xmlNode: xmlNode
        }) === false) {
            //delete this.cacheId;
            return;
        }
        
        //Set usefull vars
        this.documentId = apf.xmldb.getXmlDocId(xmlNode);
        this.xmlRoot = xmlNode;
        
        
        this.setProperty("root", this.xmlRoot);
        

        

        // Draw Content
        this.$load(xmlNode);
        
        

        // Check if subtree should be loaded
        this.$loadSubData(xmlNode);

        if (this.$createModel === false) {
            this.disabled = true;
            this.setProperty("disabled", false);
        }
        else
            this.disabled = disabled;

        // Run onafteronload event
        this.dispatchEvent('afterload', {xmlNode : xmlNode});
    };
    
    // @todo Doc
    /*
     * @binding load Determines how new data is loaded data is loaded into this
     * element. Usually this is only the root node containing no children.
     * 
     * #### Example
     * 
     * This example shows a load rule in a text element. It gets its data from
     * a list. When a selection is made on the list the data is loaded into the
     * text element.
     * 
     * ```xml
     *  <a:list id="lstExample" width="200" height="200">
     *      <a:bindings>
     *          <a:caption match="[text()]" />
     *          <a:value match="[text()]" />
     *          <a:each match="[message]" />
     *      </a:bindings>
     *      <a:model>
     *          <messages>
     *              <message id="1">message 1</message>
     *              <message id="2">message 2</message>
     *          </messages>
     *      </a:model>
     *  </a:list>
     * 
     *  <a:text model="{lstExample.selected}" width="200" height="150">
     *      <a:bindings>
     *          <a:load get="http://localhost/getMessage.php?id=[@id]" />
     *          <a:contents match="[message/text()]" />
     *      </a:bindings>
     *  </a:text>
     * ```
     *
     */
     /**
      * @attribute {String} get Sets or gets the {@link term.datainstruction data instruction}
      *                     that is used to load data into the XML root of this component.
      */
    this.$loadSubData = function(xmlRootNode) {
        if (this.$hasLoadStatus(xmlRootNode) && !this.$hasLoadStatus(xmlRootNode, "potential")) 
            return;

        //var loadNode = this.$applyBindRule("load", xmlRootNode);
        var rule = this.$getBindRule("load", xmlRootNode);
        if (rule && (!rule[1] || rule[1](xmlRootNode))) {
            
            
            this.$setLoadStatus(xmlRootNode, "loading");

            if (this.$setClearMessage)
                this.$setClearMessage(this["loading-message"], "loading");

            //||apf.xmldb.findModel(xmlRootNode)
            var mdl = this.getModel(true);

            
            var amlNode = this;
            if (mdl.$insertFrom(rule.getAttribute("get"), {
              xmlNode: xmlRootNode,  //@todo apf3.0
              insertPoint: xmlRootNode, //this.xmlRoot,
              amlNode: this,
              callback: function(){
                    
                    amlNode.setProperty(amlNode.hasFeature(apf.__MULTISELECT__) 
                        ? "selected" 
                        : "root", xmlRootNode);
                    
                }
              }) === false
            ) {
                this.clear(true);
                
                if (apf.config.autoDisable)
                    this.setProperty("disabled", true);

                //amlNode.setProperty("selected", null); //@todo is this not already done in clear?
                
            }
        }
    };
    
    //@todo this function is called way too much for a single load of a tree
    //@todo should clear listener
    /*
     * Unloads data from this element and resets state displaying an empty message.
     * The empty message is set on the {@link apf.GuiElement.msg}.
     *
     * @param {Boolean} [nomsg]   Specifies whether to display the empty message.
     * @param {Boolean} [doEvent] Specifies whether to send select events.
     * @see baseclass.databinding.method.load
     * @private
     */
    this.clear = function(nomsg, doEvent, fakeClear) {
        if (!this.$container)
            return;//@todo apf3.0

        if (this.clearSelection)
            this.clearSelection(true);//!doEvent);//@todo move this to the $clear event in multiselect.js

        var lastHeight = this.$container.offsetHeight;

        if (this.dispatchEvent("$clear") !== false)
            this.$container.innerHTML = ""; //@todo apf3.0

        if (typeof nomsg == "string") {
            var msgType = nomsg;
            nomsg = false;
            
            //@todo apf3.0 please use attr. inheritance
            if (!this[msgType + "-message"]) {
                this.$setInheritedAttribute(msgType + "-message");
            }
        }
        this.$lastClearType = msgType || null;

        if (!nomsg && this.$setClearMessage) {
            this.$setClearMessage(msgType 
              ? this[msgType + "-message"] 
              : this["empty-message"], msgType || "empty", lastHeight);

            //this.setProperty("selected", null); //@todo apf3.0 get the children to show loading... as well (and for each selected, null
            //c[i].o.clear(msgType, doEvent);
        }
        else if (this.$removeClearMessage)
            this.$removeClearMessage();

        if (!fakeClear)
            this.documentId = this.xmlRoot = this.cacheId = null;

        
        if (!nomsg) {
            if (this.hasFeature(apf.__MULTISELECT__)) //@todo this is all wrong
                this.setProperty("length", 0);
            //else 
                //this.setProperty("value", ""); //@todo redo apf3.0
        }
        
    };
    
    this.clearMessage = function(msg) {
        this.customMsg = msg;
        this.clear("custom");
    };

    //@todo optimize this
    /**
     * @private
     */
    this.$setLoadStatus = function(xmlNode, state, remove) {
        var group = this.loadgroup || "default";
        var re = new RegExp("\\|(\\w+)\\:" + group + ":(\\d+)\\|");
        var loaded = xmlNode.getAttribute("a_loaded") || "";

        var m;        
        if (!remove && (m = loaded.match(re)) && m[1] != "potential" && m[2] != this.$uniqueId)
            return;
        
        //remove old status if any
        var ostatus = loaded.replace(re, "")
        if (!remove)
            ostatus += "|" + state + ":" + group + ":" + this.$uniqueId + "|";

        xmlNode.setAttribute("a_loaded", ostatus);
    };

    /**
     * @private
     */
    this.$removeLoadStatus = function(xmlNode) {
        this.$setLoadStatus(xmlNode, null, true);
    };

    /**
     * @private
     */
    this.$hasLoadStatus = function(xmlNode, state, unique) {
        if (!xmlNode)
            return false;
        var ostatus = xmlNode.getAttribute("a_loaded");
        if (!ostatus)
            return false;
    
        var group = this.loadgroup || "default";
        var re = new RegExp("\\|" + (state || "\\w+") + ":" + group + ":" + (unique ? this.$uniqueId : "\\d+") + "\\|");
        return ostatus.match(re) ? true : false;
    };

    /*
     * @event beforeinsert Fires before data is inserted.
     * @cancelable Prevents the data from being inserted.
     * @param {XMLElement} xmlParentNode The parent in which the new data is inserted
     */
     /**
      * @event afterinsert Fires after data is inserted.
     */

    /**
     * @private
     */
    this.insert = function(xmlNode, options) {
        if (typeof xmlNode == "string") {
            if (xmlNode.charAt(0) == "<") {
                
                if (options.whitespace === false)
                    xmlNode = xmlNode.replace(/>[\s\n\r]*</g, "><");
                
                xmlNode = apf.getXmlDom(xmlNode).documentElement;
            }
            else {
                if (!options.insertPoint)
                    options.insertPoint = this.xmlRoot;
                return apf.model.prototype.$insertFrom.call(this, xmlNode, options);
            }
        }
        
        var insertPoint = options.insertPoint || this.xmlRoot;

        if (this.dispatchEvent("beforeinsert", {
          xmlParentNode: insertPoint
        }) === false)
            return false;

        //Integrate XMLTree with parentNode
        if (typeof options.copyAttributes == "undefined")
            options.copyAttributes = true;
        
        if (this.filterUnique)
            options.filter = this.filterUnique;
        
        var newNode = apf.mergeXml(xmlNode, insertPoint, options);
        
        this.$isLoading = true; //Optimization for simpledata

        //Call __XMLUpdate on all listeners
        apf.xmldb.applyChanges("insert", insertPoint);
        
        this.$isLoading = false;

        //Select or propagate new data
        if (this.selectable && this.autoselect) {
            if (this.xmlNode == newNode)
                this.$selectDefault(this.xmlNode);
        }
        
        else if (this.xmlNode == newNode) {
            this.setProperty("root", this.xmlNode);
        }
        

        if (this.$hasLoadStatus(insertPoint, "loading"))
            this.$setLoadStatus(insertPoint, "loaded");

        this.dispatchEvent("afterinsert");

        //Check Connections
        //this one shouldn't be called because they are listeners anyway...(else they will load twice)
        //if(this.selected) this.setConnections(this.selected, "select");
    };
    
    /**
     * @attribute {Boolean} render-root Sets or gets whether the XML element loaded into this
     * element is rendered as well. The default is false.
     *
     * #### Example
     *
     * This example shows a tree which also renders the root element.
     * 
     * ```xml
     *  <a:tree render-root="true">
     *      <a:model>
     *          <root name="My Computer">
     *              <drive name="C">
     *                  <folder name="/Program Files" />
     *                  <folder name="/Desktop" />
     *              </drive>
     *          </root>
     *      </a:model>
     *      <a:bindings>
     *          <a:caption match="[@name]"></a:caption>
     *          <a:each match="[root|drive|folder]"></a:each>
     *      </a:bindings>
     *  </a:tree>
     * ```
     */
    this.$booleanProperties["render-root"] = true;
    this.$supportedProperties.push("empty-message", "loading-message",
        "offline-message", "render-root", "smartbinding",
        "bindings", "actions");

    /**
     * @attribute {Boolean} render-root Sets or gets whether the root node of the data loaded
     * into this element is rendered as well. 
     * @see apf.tree
     */
    this.$propHandlers["render-root"] = function(value) {
        this.renderRoot = value;
    };
    
    /**
     * @attribute {String} empty-message Sets or gets the message displayed by this element
     * when it contains no data. This property is inherited from parent nodes.
     * When none is found, it is looked for on the appsettings element. Otherwise
     * it defaults to the string "No items".
     */
    this.$propHandlers["empty-message"] = function(value) {
        this["empty-message"] = value;

        if (this.$updateClearMessage) 
            this.$updateClearMessage(this["empty-message"], "empty");
    };

    /**
     * @attribute {String} loading-message Sets or gets the message displayed by this
     * element when it's loading. This property is inherited from parent nodes.
     * When none is found, it is looked for on the appsettings element. Otherwise
     * it defaults to the string "Loading...".
     *
     * #### Example
     *
     * This example uses property bindings to update the loading message. The
     * position of the progressbar should be updated by the script taking care
     * of loading the data.
     *
     * ```xml
     *  <a:list loading-message="{'Loading ' + Math.round(progress1.value*100) + '%'}" />
     *  <a:progressbar id="progress1" />
     * ```
     *
     * #### Remarks
     *
     * Usually, a static loading message is displayed for only 100 milliseconds
     * or so, whilst loading the data from the server. For instance, this is done
     * when the load binding rule is used. In the code example below, a list
     * binds on the selection of a tree displaying folders. When the selection
     * changes, the list loads new data by extending the model. During the load
     * of this new data, the loading message is displayed.
     * 
     * ```xml
     *  <a:list model="[trFolders::element]">
     *      <a:bindings>
     *          ...
     *          <a:load get="{comm.getFiles([@path])}" />
     *      </bindings>
     *  </a:list>
     * ```
     */
    this.$propHandlers["loading-message"] = function(value) {
        this["loading-message"] = value;

        if (this.$updateClearMessage)
            this.$updateClearMessage(this["loading-message"], "loading");
    };

    /**
     * @attribute {String} offline-message Sets or gets the message displayed by this
     * element when it can't load data because the application is offline.
     * This property is inherited from parent nodes. When none is found it is
     * looked for on the appsettings element. Otherwise it defaults to the
     * string "You are currently offline...".
     */
    this.$propHandlers["offline-message"] = function(value) {
        this["offline-message"] = value;

        if (this.$updateClearMessage)
            this.$updateClearMessage(this["offline-message"], "offline");
    };

    /**
     * @attribute {String} smartbinding Sets or gets the name of the SmartBinding for this
     * element. 
     * 
     * A smartbinding is a collection of rules which define how data
     * is transformed into representation, how actions on the representation are
     * propagated to the data and it's original source, how drag&drop actions
     * change the data and where the data is loaded from. Each of these are
     * optionally defined in the smartbinding set and can exist independently
     * of the smartbinding object.
     * 
     * #### Example
     *
     * This example shows a fully specified smartbinding. Usually, only parts
     * are used. This example shows a tree with files and folders.
     * 
     * ```xml
     *  <a:tree smartbinding="sbExample" />
     * 
     *  <a:smartbinding id="sbExample">
     *      <a:bindings>
     *          <a:caption  match = "[@caption|@filename]"/>
     *          <a:icon     match = "[file]"
     *                      value = "icoFile.gif" />
     *          <a:icon     value = "icoFolder.gif" />
     *          <a:each     match = "[file|folder|drive]" />
     *          <a:drag     match = "[folder|file]" />
     *          <a:drop     match = "[folder]" 
     *                      target = "[root]"
     *                      action = "tree-append" />
     *          <a:drop     match = "[folder]" 
     *                      target = "[folder]"
     *                      action = "insert-before" />
     *          <a:drop     match = "[file]"   
     *                      target = "[folder|root]" 
     *                      action = "tree-append" />
     *          <a:drop     match = "[file]"   
     *                      target = "[file]"
     *                      action = "insert-before" />
     *      </a:bindings>
     *      <a:actions>
     *          <a:remove set = "remove.php?path=[@path]" />
     *          <a:rename set = "move.php?from=oldValue&amp;to=[@path]" />
     *      </a:actions>
     *      <a:model src="xml/filesystem.xml" />
     *  </a:smartbinding>
     * ```
     * 
     * #### Remarks
     *
     * The smartbinding parts can also be assigned to an element by adding them
     * directly as a child in aml.
     * 
     * ```xml
     *  <a:tree>
     *      <a:bindings>
     *          ...
     *      </bindings>
     *      <a:model />
     *  </a:tree>
     * </code>
     *
     * ### See Also
     *
     * There are several ways to be less verbose in assigning certain rules. For more information, see:
     *
     * * [[apf.bindings]]
     * * [[apf.actions]]
     * * [[apf.DragDrop]]
     * 
     */
    this.$propHandlers["smartbinding"] = 
    
    /**
     * @attribute {String} actions Sets or gets the id of the actions element which
     * provides the action rules for this element. Action rules are used to
     * send changes on the bound data to a server.
     *
     * #### Example
     *
     * ```xml
     *  <a:tree 
     *    id = "tree" 
     *    height = "200" 
     *    width = "250" 
     *    actions = "actExample"
     *    model = "xml/filesystem.xml"
     *    actiontracker = "atExample"
     *    startcollapsed = "false" 
     *    onerror = "alert('Sorry this action is not permitted');return false">
     *      <a:each match="[folder|drive]">
     *          <a:caption match="[@caption|@filename]" />
     *          <a:icon value="Famfolder.gif" />
     *      </a:each>
     *  </a:tree>
     *  
     *  <a:actions id="actExample">
     *      <a:rename match = "[file]"   
     *               set = "rename_folder.php?id=[@fid]" />
     *      <a:rename match = "[folder]" 
     *               set = "rename_file.php?id=[@fid]" />
     *  </a:actions>
     *  
     *  <a:button 
     *    caption = "Rename"
     *    right = "10" 
     *    top = "10"
     *    onclick = "tree.startRename()" />
     *  <a:button onclick="tree.getActionTracker().undo();">Undo</a:button>
     * ```
     */
    this.$propHandlers["actions"] = 

    /**
     * @attribute {String} bindings Sets or gets the id of the bindings element which
     * provides the binding rules for this element.
     * 
     * #### Example
     *
     * This example shows a set of binding rules that transform data into the
     * representation of a list. In this case it displays the names of
     * several email accounts, with after each account name the number of unread
     * mails in that account. It uses JSLT to transform the caption.
     * 
     * ```xml
     *  <a:model id="mdlExample">
     *      <data>
     *          <account icon="application.png">Account 1
     *              <mail read="false" />
     *              <mail read="false" />
     *              <mail read="true" />
     *          </account>
     *          <account icon="application.png">Account 2</account>
     *      </data>
     *  </a:model>
     *  <a:list bindings="bndExample" model="mdlExample" />
     * 
     *   <a:bindings id="bndExample">
     *      <a:caption>[text()] (#[mail[@read != 'true']])</a:caption>
     *      <a:icon match="[@icon]" />
     *      <a:each match="[account]" sort="[text()]" />
     *  </a:bindings>
     * ```
     * 
     * #### Remarks
     *
     * Bindings can also be assigned directly by putting the bindings tag as a
     * child of this element.
     *
     * If the rule only contains a select attribute, it can be written in a
     * short way by adding an attribute with the name of the rule to the
     * element itself:
     * 
     * ```xml
     *  <a:list 
     *    caption = "[text()] (#[mail[@read != 'true']])"
     *    icon = "[@icon]"
     *    each = "[account]"
     *    sort = "[text()]" />
     * ```
     */
    this.$propHandlers["bindings"] = function(value, prop) {
        var local = "$" + prop + "Element";
        if (this[local])
            this[local].unregister(this);
        
        if (!value)
            return;
        
        

        apf.nameserver.get(prop, value).register(this);
        
        
        if (prop != "actions" && 
          this.$checkLoadQueue() === false && this.$amlLoaded)
            1+1; //@todo add reload queue.
            //this.reload();
    };

    
    var eachBinds = {"caption":1, "icon":1, "select":1, "css":1, "sort":1,
                     "drop":2, "drag":2, "dragcopy":2, "eachvalue":1}; //Similar to apf.Class
    
    this.$addAttrBind = function(prop, fParsed, expression) {
        //Detect if it uses an external model
        if (fParsed.models) {
            
            if (this.hasFeature(apf.__MULTISELECT__)) {
                
            }
            
        }

        //Set listener for all models
        var i, xpath, modelId, model,
            paths = fParsed.xpaths,
            list = {};
        //@todo when there is no model in xpath modelId == null...
        for (i = 0; i < paths.length; i+=2) {
            if (!list[(modelId = paths[i])])
                list[modelId] = 1;
            else list[modelId]++
        }
        
        if (!this.$propsUsingMainModel)
            this.$propsUsingMainModel = {};

        var rule = (this.$attrBindings || (this.$attrBindings = {}))[prop] = {
            cvalue: fParsed,
            value: expression,
            compile: apf.BindingRule.prototype.$compile,
            models: []
        };

        delete this.$propsUsingMainModel[prop];
        for (xpath, i = 0; i < paths.length; i+=2) {
            modelId = paths[i];
            if (list[modelId] == -1)
                continue;

            xpath = paths[i + 1];

            if (modelId == "#" || xpath == "#") {
                var m = (rule.cvalue3 || (rule.cvalue3 = apf.lm.compile(rule.value, {
                    xpathmode: 5
                }))).call(this, this.xmlRoot);
                
                //@todo apf3 this needs to be fixed in live markup
                if (typeof m != "string") {
                    model = m.model && m.model.$isModel && m.model;
                    if (model)
                        xpath = m.xpath;
                    else if (m.model) {
                        model = typeof m.model == "string" ? apf.xmldb.findModel(m.model) : m.model;
                        xpath = apf.xmlToXpath(m.model, model.data) + (m.xpath ? "/" + m.xpath : ""); //@todo make this better
                    }
                    else {
                        //wait until model becomes available
                        this.addEventListener("prop." + prop, function(e) {
                            var m = (rule.cvalue3 || (rule.cvalue3 = apf.lm.compile(rule.value, {
                                xpathmode: 5
                            }))).call(this, this.xmlRoot);
                            
                            if (m.model) {
                                this.removeEventListener("prop." + prop, arguments.callee);
                                var _self = this;
                                $setTimeout(function(){
                                    _self.$clearDynamicProperty(prop);
                                    _self.$setDynamicProperty(prop, expression);
                                }, 10);
                            }
                        });
                        continue;
                    }
                }
                else model = null;
            }
            else model = null;

            if (!model) {
                if (modelId) {
                    
                    //@todo apf3.0 how is this cleaned up???
                    //Add change listener to the data of the model
                    model = apf.nameserver.get("model", modelId) //is model creation useful here?
                        || apf.setReference(modelId, apf.nameserver.register("model", modelId, new apf.model()));
                    
                }
                else {
                    if (!this.$model && !this.$initingModel)
                        initModel.call(this);
    
                    model = this.$model;

                    if (!this.hasFeature(apf.__MULTISELECT__) 
                      && eachBinds[prop] != 2 || !eachBinds[prop]) //@experimental - should not set this because model will load these attributes
                        this.$propsUsingMainModel[prop] = {
                            xpath: xpath,
                            optimize: list[modelId] == 1
                        };
                }
            }
            
            //@todo warn here if no model??
            if (model && (!this.hasFeature(apf.__MULTISELECT__) 
              && eachBinds[prop] != 2 || !eachBinds[prop])) {
                //Create the attribute binding
                //@todo: remove listenRoot = expression.indexOf("*[") > -1 -> because it doesnt make sense in certain context. recheck selection handling
                model.$bindXmlProperty(this, prop, xpath, list[modelId] == 1); 
                rule.models.push(model);
            }
            
            list[modelId] = -1;
        }
        
        rule.xpath = xpath;

        this.$canLoadDataAttr = eachBinds[prop] == 1; //@todo apf3.0 remove
        this.$checkLoadQueue();
    }
    
    this.$removeAttrBind = function(prop) {
        //@todo apf3.0
        //$model.$unbindXmlProperty
        var rule = this.$attrBindings[prop]
        if (!rule)
            return;
        
        delete this.$attrBindings[prop];
        delete this.$propsUsingMainModel[prop]
        
        var models = rule.models;
        if (models.length)
            for (var i = 0; i < models.length; i++) {
                models[i].$unbindXmlProperty(this, prop);
            }
        else if (this.$model)
            this.$model.$unbindXmlProperty(this, prop);
    };
    
    this.$initingModel;
    function initModel(){
        this.$initingModel = true;
        this.$setInheritedAttribute("model");
    }
    
    this.addEventListener("DOMNodeInsertedIntoDocument", function(e) {
        //Set empty message if there is no data
        if (!this.model && this.$setClearMessage && !this.value)
            this.$setClearMessage(this["empty-message"], "empty");
        
        this.$amlLoaded = true; //@todo this can probably be removed
        this.$checkLoadQueue();
    });
    
    

    /**
     * @attribute {String} model Sets or gets the name of the model to load data from, or a
     * datainstruction to load data.
     *
     * #### Example
     *
     * ```xml
     *  <a:model id="mdlExample" src="filesystem.xml" />
     *   <a:tree 
     *     height = "200" 
     *     width = "250" 
     *     model = "mdlExample">
     *       <a:each match="[folder|drive]">
     *           <a:caption match="[@caption]" />
     *           <a:icon value="Famfolder.gif" />
     *       </a:each>
     *   </a:tree>
     * ```
     * 
     * #### Example
     *
     * Here's an example loading from an XML source:
     *
     * ```xml
     *  <a:tree 
     *    height = "200" 
     *    width = "250" 
     *    model = "filesystem.xml">
     *      <a:each match="[folder|drive]">
     *          <a:caption match="[@caption]" />
     *          <a:icon value="Famfolder.gif" />
     *      </a:each>
     *  </a:tree>
     * ```
     * 
     * #### Example
     *
     * ```xml
     *  <a:tree 
     *     id = "tree"
     *     height = "200" 
     *     width = "250" 
     *     model = "filesystem.xml">
     *       <a:each match="[folder|drive]">
     *           <a:caption match="[@caption]" />
     *           <a:icon value="Famfolder.gif" />
     *       </a:each>
     *   </a:tree>
     *   <a:text 
     *     model = "{tree.selected}" 
     *     value = "[@caption]" 
     *     width = "250" 
     *     height = "100" />
     * ```
     * 
     * #### Example
     *
     * This example shows a dropdown from which the user can select a country.
     * The list of countries is loaded from a model. Usually this would be loaded
     * from a separate url, but for clarity it's inlined. When the user selects
     * a country in the dropdown the value of the item is stored in the second
     * model (mdlForm) at the position specified by the ref attribute. In this
     * case this is the country element.
     * 
     * ```xml
     *  <a:label>Name</a:label>
     *  <a:textbox value="[name]" model="mdlForm" />
     * 
     *  <a:label>Country</a:label>
     *  <a:dropdown
     *    value = "[mdlForm::country]"
     *    each = "[mdlCountries::country]"
     *    caption = "[text()]">
     *  </a:dropdown>
     * 
     *  <a:model id="mdlCountries">
     *      <countries>
     *          <country value="USA">USA</country>
     *          <country value="GB">Great Britain</country>
     *          <country value="NL">The Netherlands</country>
     *      </countries>
     *  </a:model>
     * 
     *  <a:model id="mdlForm">
     *      <data>
     *          <name />
     *          <country />
     *      </data>
     *  </a:model>
     * ```
     *
     * #### Remarks
     *
     * This attribute is inherited from a parent when not set. You can use this
     * to tell sets of elements to use the same model.
     * 
     * ```xml
     *  <a:bar model="mdlForm">
     *      <a:label>Name</a:label>
     *      <a:textbox value="[name]" />
     * 
     *      <a:label>Happiness</a:label>
     *      <a:slider value="[happiness]" min="0" max="10" />
     *  </a:bar>
     * 
     *  <a:model id="mdlForm">
     *      <data />
     *  </a:model>
     * ```
     *
     * When no model is specified the default model is chosen. The default
     * model is the first model that is found without a name, or if all models
     * have a name, the first model found.
     * 
     * @see apf.DataBinding.model
     */
    this.$propHandlers["model"] = function(value) {
        //Unset model
        if (!value && !this.$modelParsed) {
            if (this.$model) {
                this.clear();
                this.$model.unregister(this);
                this.$model = null;
                this.lastModelId = "";
            }
            else if (this.dataParent)
                this.dataParent.parent = null; //Should be autodisconnected by property binding

            return;
        }
        this.$initingModel = true;

        var fParsed;
        //Special case for property binding
        if ((fParsed = this.$modelParsed) && fParsed.type != 2) {
            var found, pb = fParsed.props;
            
            if (this.dataParent)
                this.dataParent = null; //Should be autodisconnected by property binding

            //Try to figure out who is the dataParent
            for (var prop in pb) {
                

                this.dataParent = {
                    parent: self[prop.split(".")[0]],
                    xpath: null,
                    model: this.$modelParsed.instruction
                };
        
                found = true;
                break; // We currently only support one data parent
            }
            
            if (found) {
                //@todo this statement doesnt make sense
                /*//Maybe a compound model is found
                if (!this.dataParent && (pb = fParsed.xpaths && fParsed.xpaths[0])) {
                    this.dataParent = {
                        parent: self[pb.split(".")[0]],
                        xpath: fParsed.xpaths[1],
                        model: this.$modelParsed.instruction
                    };
                }*/
                
                if (this.dataParent && !this.dataParent.signalXmlUpdate)
                    this.dataParent.signalXmlUpdate = {};
            }
            
            this.$modelParsed = null;
        }

        //Analyze the data
        var model;
        if (typeof value == "object") {
            if (value.dataType == apf.ARRAY) { //Optimization used for templating
                
                model = apf.nameserver.get("model", value[0]);
                model.register(this, value[1]);
                return;
                
            }
            else if (value.$isModel) { // A model node is passed
                //Convert model object to value;
                model = value;
                value = this.model = model.name;
                if (!value)
                    model.setProperty("id", value = this.model = "model" + model.$uniqueId);
                
                //@todo why not set directly here?
            }
            else { //if (this.dataParent) { //Data came through data parent
                if (this.dataParent)
                    this.model = this.dataParent.model; //reset this property

                model = apf.xmldb.findModel(value);
                if (!model) //@todo very strange, this should never happen, but it does
                    return;
                var xpath = apf.xmlToXpath(value, null, true) || ".";
                
                
                
                model.register(this, xpath);
                return;
            }
            /*else {
                //@todo Error ??
            }*/
        }
        else if (value.indexOf("[::") > -1) { //@experimental
            var model, pNode = this;
            do {
                pNode = pNode.parentNode
                model = pNode.getAttribute("model");
            }
            while (pNode.parentNode && pNode.parentNode.nodeType == 1 && (!model || model == value));

            if (model && typeof model == "object")
                model = model.id;

            this.$inheritProperties.model = 3;
            if (model) {
                value = value.replace(/\[\:\:/g, "[" + model + "::");
            }
            else {
                apf.console.warn("No found model on any of the parents for this element while trying to overload model: " + value);
                return;
            }
        }

        //Optimize xmlroot position and set model async (unset the old one)
        //@todo apf3.0 this could be optimized by using apf.queue and only when not all info is there...
        clearTimeout(this.$dbTimer);
        if (!this.$amlLoaded && this.nodeType == 1) {
            var _self = this;
            this.$dbTimer = $setTimeout(function(){
                if (!_self.$amlDestroyed)
                    apf.setModel(value, _self);
            });
        }
        else
            apf.setModel(value, this);
    };

    
    /**
     * @attribute {String} viewport Sets or gets the way this element renders its data.
     * 
     * The possible values include:
     *   - `"virtual"`:  this element only renders data that it needs to display.
     *   - `"normal`"`:  this element renders all data at startup.
     * @experimental
     */
    this.$propHandlers["viewport"] = function(value) {
        if (value != "virtual")
            return;

        this.implement(apf.VirtualViewport);
    };
    
};

    apf.DataBinding.prototype = new apf[apf.Presentation ? "Presentation" : "AmlElement"]();


apf.config.$inheritProperties["model"] = 1;
apf.config.$inheritProperties["empty-message"] = 1;
apf.config.$inheritProperties["loading-message"] = 1;
apf.config.$inheritProperties["offline-message"] = 1;
apf.config.$inheritProperties["noloading"] = 1;

apf.Init.run("databinding");









/**
 * All elements inheriting from this {@link term.baseclass baseclass} can bind to data
 * which contains multiple nodes.
 *
 *
 *
 * @class apf.MultiselectBinding
 * @inherits apf.DataBinding
 * @baseclass
 * @default_private
 * @allowchild  item, choices
 */

/*
 * @define  choices     Container for item nodes which receive presentation.
 * This element is part of the XForms specification. It is not necesary for
 * the Ajax.org Markup Language.
 * 
 * #### Example
 *
 * ```xml
 *  <a:list>
 *      <a:choices>
 *          <a:item>red</a:item>
 *          <a:item>blue</a:item>
 *          <a:item>green</a:item>
 *      </a:choices>
 *  </a:list>
 * ```
 * @allowchild  item
 */
apf.MultiselectBinding = function(){
    if (!this.setQueryValue)
        this.implement(apf.DataBinding);

    this.$regbase = this.$regbase|apf.__MULTISELECT__; //We're pretending to have multiselect even though we might not.

    this.$init(function(){
        this.$selectTimer = {};
    });
};

(function(){
    this.length = 0;

    //1 = force no bind rule, 2 = force bind rule
    this.$attrExcludePropBind = apf.extend({
        caption: 2,
        icon: 2,
        eachvalue: 2,
        select: 2,
        css: 2,
        sort: 2,
        drag: 2,
        drop: 2,
        dragcopy: 2,
        selected: 3,
        //caret     : 2,
        each: 1,
        "selection"             : 3, //only databound when has an xpath
        "selection-unique"      : 3, //only databound when has an xpath
        "selection-constructor" : 3 //only databound when has an xpath
    }, this.$attrExcludePropBind);

     
    /**
     * Change the sorting order of this element.
     *
     * @param {Object}  options  The new sort options. These are applied incrementally.
     *                           Any property that is not set is maintained unless the clear
     *                           parameter is set to `true`. The following properties are available:
     *                  - order ([[String]])
     *                  - [xpath] ([[String]])
     *                  - [type] ([[String]])
     *                  - [method] ([[String]])
     *                  - [getNodes] ([[Function]]): A function that retrieves a list of nodes.
     *                  - [dateFormat] ([[String]])
     *                  - [getValue] ([[Function]]): A function that determines the string content based
     *                                            on an XML node as it's first argument.
     * @param {Boolean} clear    Removes the current sort options.
     * @param {Boolean} noReload Specifies whether to reload the data of this component.
     */
    this.resort = function(options, clear, noReload) {
        if (!this.$sort)
            this.$sort = new apf.Sort();

        this.$sort.set(options, clear);

        if (this.clearAllCache)
            this.clearAllCache();

        if (noReload)
            return;

        
        /*if(this.hasFeature(apf.__VIRTUALVIEWPORT__)){
            this.$clearVirtualDataset(this.xmlRoot);
            this.reload();

            return;
        }*/
        

        var _self = this;
        (function sortNodes(xmlNode, htmlParent) {
            if (!xmlNode)
                return;
            var sNodes = _self.$sort.apply(
                apf.getArrayFromNodelist(xmlNode.selectNodes(_self.each)));

            for (var i = 0; i < sNodes.length; i++) {
                if (_self.$isTreeArch || _self.$withContainer) {
                    var htmlNode = apf.xmldb.findHtmlNode(sNodes[i], _self);

                    

                    var container = _self.$findContainer(htmlNode);

                    htmlParent.appendChild(htmlNode);
                    if (!apf.isChildOf(htmlNode, container, true))
                        htmlParent.appendChild(container);

                    sortNodes(sNodes[i], container);
                }
                else
                    htmlParent.appendChild(apf.xmldb.findHtmlNode(sNodes[i], _self));
            }
        })(this.xmlRoot, this.$container);

        return options;
    };

    /**
     * Change sorting from ascending to descending, and vice versa!
     */
    this.toggleSortOrder = function(){
        return this.resort({"ascending" : !this.$sort.get().ascending}).ascending;
    };

    /**
     * Retrieves the current sort options.
     *
     * @returns {Object}  The current sort options. The following properties are available:
     *                     - order ([[String]])
     *                     - xpath ([[String]])
     *                     - type ([[String]])
     *                     - method ([[String]])
     *                     - getNodes ([[Function]]): A function that retrieves a list of nodes.
     *                     - dateFormat ([[String]])
     *                     - getValue ([[Function]]): A function that determines the string content based on
     *                                               an XML node as it's first argument.
     * 
     */
    this.getSortSettings = function(){
        return this.$sort.get();
    };
    

    /*
     * Optimizes load time when the xml format is very simple.
     */
    // @todo Doc
    this.$propHandlers["simpledata"] = function(value) {
        if (value) {
            this.getTraverseNodes = function(xmlNode) {
                
                if (this.$sort && !this.$isLoading) {
                    var nodes = apf.getArrayFromNodelist((xmlNode || this.xmlRoot).childNodes);
                    return this.$sort.apply(nodes);
                }
                

                return (xmlNode || this.xmlRoot).childNodes;
            };

            this.getFirstTraverseNode = function(xmlNode) {
                return this.getTraverseNodes(xmlNode)[0];//(xmlNode || this.xmlRoot).childNodes[0];
            };

            this.getLastTraverseNode = function(xmlNode) {
                var nodes = this.getTraverseNodes(xmlNode);//(xmlNode || this.xmlRoot).childNodes;
                return nodes[nodes.length - 1];
            };

            this.getTraverseParent = function(xmlNode) {
                if (!xmlNode.parentNode || xmlNode == this.xmlRoot)
                    return false;

                return xmlNode.parentNode;
            };
        }
        else {
            delete this.getTraverseNodes;
            delete this.getFirstTraverseNode;
            delete this.getLastTraverseNode;
            delete this.getTraverseParent;
        }
    };

    /**
     * Retrieves a node list containing the {@link term.datanode data nodes} which
     * are rendered by this element.
     *
     * @param {XMLElement} [xmlNode] The parent element on which each query is applied.
     * @return {NodeList} The node list containing the data nodes
     */
    this.getTraverseNodes = function(xmlNode) {
        

        
        if (this.$sort) {
            var nodes = apf.getArrayFromNodelist((xmlNode || this.xmlRoot).selectNodes(this.each));
            return this.$sort.apply(nodes);
        }
        

        return (xmlNode || this.xmlRoot).selectNodes(this.each);
    };

    /**
     * Retrieves the first {@link term.datanode data node} which gets representation
     * in this element. 
     *
     * @param {XMLElement} [xmlNode] The parent element on which the each query is executed.
     * @return {apf.AmlNode} The first represented {@link term.datanode data node}
     */
    this.getFirstTraverseNode = function(xmlNode) {
        
        if (this.$sort) {
            var nodes = (xmlNode || this.xmlRoot).selectNodes(this.each);
            return this.$sort.apply(nodes)[0];
        }
        

        return (xmlNode || this.xmlRoot).selectSingleNode(this.each);
    };

    /**
     * Retrieves the last {@link term.datanode data node} which gets representation
     * in this element. 
     *
     * @param {XMLElement} [xmlNode] the parent element on which the each query is executed.
     * @return {XMLElement} The last represented {@link term.datanode data node}
     * 
     */
    this.getLastTraverseNode = function(xmlNode) {
        var nodes = this.getTraverseNodes(xmlNode || this.xmlRoot);
        return nodes[nodes.length-1];
    };

    /**
     * Determines whether a {@link term.datanode data node} is an each node. 
     *
     * @param {XMLElement} [xmlNode] The parent element on which the each query is executed.
     * @return  {Boolean}  Identifies whether the XML element is a each node.
     * 
     */
    this.isTraverseNode = function(xmlNode) {
        /*
            Added optimization, only when an object has a tree architecture is it
            important to go up to the each parent of the xmlNode, else the node
            should always be based on the xmlroot of this component
        */
        //this.$isTreeArch
        var nodes = this.getTraverseNodes(
          this.getTraverseParent(xmlNode) || this.xmlRoot);
        for (var i = 0; i < nodes.length; i++)
            if (nodes[i] == xmlNode)
                return true;
        return false;
    };

    /**
     * Retrieves the next `each` node to be selected from a given `each` node. 
     *
     * The method can do this in either direction and also return the Nth node for this algorithm.
     *
     * @param {XMLElement}  xmlNode  The starting point for determining the next selection.
     * @param {Boolean}     [up=false]     The direction of the selection.
     * @param {Number}     [count=1]  The distance in number of nodes.
     * @return  {XMLElement} The {@link term.datanode data node} to be selected next.
     */
    this.getNextTraverseSelected = function(xmlNode, up, count) {
        if (!xmlNode)
            xmlNode = this.selected;
        if (!count)
            count = 1;

        var i = 0;
        var nodes = this.getTraverseNodes(this.getTraverseParent(xmlNode) || this.xmlRoot);
        while (nodes[i] && nodes[i] != xmlNode)
            i++;

        var node = (up == null)
            ? nodes[i + count] || nodes[i - count]
            : (up ? nodes[i + count] : nodes[i - count]);

        //arguments[2]
        return node || count && (i < count || (i + 1) > Math.floor(nodes.length / count) * count)
            ? node
            : (up ? nodes[nodes.length-1] : nodes[0]);
    };

    /**
     * Retrieves the next `each` node. 
     * 
     * The method can do this in either direction and also return the Nth next node.
     *
     * @param {XMLElement}  xmlNode  The starting point for determining the next selection.
     * @param {Boolean}     [up=false]     The direction of the selection.
     * @param {Number}     [count=1]  The distance in number of nodes.
     * @return  {XMLElement} The {@link term.datanode data node} to be selected next.
     */
    this.getNextTraverse = function(xmlNode, up, count) {
        if (!count)
            count = 1;
        if (!xmlNode)
            xmlNode = this.selected;

        var i = 0;
        var nodes = this.getTraverseNodes(this.getTraverseParent(xmlNode) || this.xmlRoot);
        while (nodes[i] && nodes[i] != xmlNode)
            i++;

        var ind = i + (up ? -1 * count : count);
        return nodes[ind < 0 ? 0 : ind];
    };

    /**
     * Retrieves the parent each node. 
     *
     * In some cases the each rules has a complex form like 'children/item'. In
     * those cases, the generated tree has a different structure from that of the XML
     * data. For these situations, the `xmlNode.parentNode` property won't return
     * the each parent; instead, this method will give you the right parent.
     *
     * @param {XMLElement} xmlNode The node for which the parent element will be determined.
     * @return  {XMLElement} The parent node or `null` if none was found.
     */
    this.getTraverseParent = function(xmlNode) {
        if (!xmlNode.parentNode || xmlNode == this.xmlRoot)
            return false;

        //@todo this can be removed when we have a new xpath implementation
        if (xmlNode.$regbase)
            return xmlNode.parentNode;

        var x, id = xmlNode.getAttribute(apf.xmldb.xmlIdTag);
        if (!id) {
            //return false;
            xmlNode.setAttribute(apf.xmldb.xmlIdTag, "temp");
            id = "temp";
        }

        /*
        do {
            xmlNode = xmlNode.parentNode;
            if (xmlNode == this.xmlRoot)
                return false;
            if (this.isTraverseNode(xmlNode))
                return xmlNode;
        } while (xmlNode.parentNode);
        */

        //This is not 100% correct, but good enough for now

        x = xmlNode.selectSingleNode("ancestor::node()[(("
            + this.each + ")/@" + apf.xmldb.xmlIdTag + ")='"
            + id + "']");

        if (id == "temp")
            xmlNode.removeAttribute(apf.xmldb.xmlIdTag);
        return x;
    };

    if (!this.$findHtmlNode) { //overwritten by apf.Cache
        /**
         * Finds HTML presentation node in cache by ID.
         *
         * @param  {String} id  The id of the HTMLElement which is looked up.
         * @return {HTMLElement} The HTMLElement found. When no element is found, `null` is returned.
         * @private
         */
        this.$findHtmlNode = function(id) {
            return this.$pHtmlDoc.getElementById(id);
        };
    }

    this.$setClearMessage = function(msg, className, lastHeight) {
        if (this.more && this.$addMoreItem) this.$addMoreItem();
        if (!this.$empty) {
            if (!this.$hasLayoutNode("empty"))
                return;

            this.$getNewContext("empty");

            var xmlEmpty = this.$getLayoutNode("empty");
            if (!xmlEmpty) return;

            this.$empty = apf.insertHtmlNode(xmlEmpty, this.$container);
        }
        else {
            this.$container.appendChild(this.$empty);
        }

        var empty = this.$getLayoutNode("empty", "caption", this.$empty);

        if (empty)
            apf.setNodeValue(empty, msg || "");

        this.$empty.setAttribute("id", "empty" + this.$uniqueId);
        apf.setStyleClass(this.$empty, className, ["loading", "empty", "offline"]);

        //@todo apf3.0 cleanup?
        var extH = apf.getStyle(this.$ext, "height");
        this.$empty.style.height = (lastHeight && (!extH || extH == "auto") && className != "empty")
            ? (Math.max(10, (lastHeight
               - apf.getHeightDiff(this.$empty)
               - apf.getHeightDiff(this.$ext))) + "px")
            : "";
    };

    this.$updateClearMessage = function(msg, className) {
        if (!this.$empty || this.$empty.parentNode != this.$container
          || this.$empty.className.indexOf(className) == -1)
            return;

        var empty = this.$getLayoutNode("empty", "caption", this.$empty);
        if (empty)
            apf.setNodeValue(empty, msg || "");
    }

    this.$removeClearMessage = function(){
        if (!this.$empty)
            this.$empty = document.getElementById("empty" + this.$uniqueId);
        if (this.$empty && this.$empty.parentNode)
            this.$empty.parentNode.removeChild(this.$empty);
    };

    /*
     * Set listeners, calls HTML creation methods and
     * initializes select and focus states of object.
     */
    this.$load = function(XMLRoot) {
        //Add listener to XMLRoot Node
        apf.xmldb.addNodeListener(XMLRoot, this);

        this.$isLoading = true;

        var length = this.getTraverseNodes(XMLRoot).length;
        if (!this.renderRoot && !length)
            return this.clear(null, null, true); //@todo apf3.0 this should clear and set a listener


        //Traverse through XMLTree
        var nodes = this.$addNodes(XMLRoot, null, null, this.renderRoot, null, 0, "load");

        //Build HTML
        this.$fill(nodes);

        this.$isLoading = false;

        //Select First Child
        if (this.selectable) {
            
            //@todo apf3.0 optimize to not set selection when .selection or .selected is set on initial load
            if (this["default"])
                this.select(this["default"]);
            else if (this.autoselect) {
                if (!this.selected) {
                    if (this.renderRoot)
                        this.select(XMLRoot, null, null, null, true);
                    else if (nodes.length)
                        this.$selectDefault(XMLRoot);
                    //else @todo apf3.0 this one doesnt seem needed
                        //this.clearSelection();
                }
            }
            else {
                this.clearSelection(true);
                var xmlNode = this.renderRoot
                    ? this.xmlRoot
                    : this.getFirstTraverseNode(); //should this be moved to the clearSelection function?
                if (xmlNode)
                    this.setCaret(xmlNode);
                
                if (this.selected)
                    this.setProperty("selected", null);
                if (this.choosen)
                    this.setProperty("choosen", null);
                
            }
        }

        if (this.focussable)
            apf.document.activeElement == this ? this.$focus() : this.$blur();

        
        if (length != this.length)
            this.setProperty("length", length);
        
    };

    var actionFeature = {
        "insert"      : 127,//11111110
        "replacenode" : 127,//11111110
        "attribute"   : 255,//11111111
        "add"         : 251,//11110111
        "remove"      : 110, //01011110
        "redo-remove" : 79, //10011110
        "synchronize" : 127,//11111110
        "move-away"   : 297,//11010111
        "move"        : 141  //10011111
    };

    /**
     * @event xmlupdate Fires when XML of this element is updated.
     * @param {Object} e The standard event object. The following properties are available:
     *                      - action ([[String]]): The action that was executed on the XML. The following values are possible:
     *                            - `text`   :     A text node is set
     *                            - `attribute` :  An attribute is set
     *                            - `update`:      An XML node is updated
     *                            - `insert`  :    xml nodes are inserted
     *                            - `add`   :      An XML node is added
     *                            - `remove` :     An XML node is removed (parent still set)
     *                            - `redo`-remove`: An XML node is removed (parent not set)
     *                            - `synchronize`:  An unknown update
     *                            - `move-away` :  An XML node is moved (parent not set)
     *                            - `move`        An XML node is moved (parent still set)
     *                      - xmlNode ([[XMLElement]]): The node that is subject to the update
     *                      - result (`Mixed`): The result
     *                      - UndoObj ([[apf.UndoData]]): The undo information
     */
    /*
     * Loops through parents of a changed node to find the first
     * connected node. Based on the action, it will change, remove,
     * or update the representation of the data.
     */
    this.$xmlUpdate = function(action, xmlNode, listenNode, UndoObj, lastParent) {
        if (!this.xmlRoot)
            return; //@todo think about purging cache when xmlroot is removed

        var result, length, pNode, htmlNode,
            startNode = xmlNode;
        if (!listenNode)
            listenNode = this.xmlRoot;

        if (action == "redo-remove") {
            var loc = [xmlNode.parentNode, xmlNode.nextSibling];
            lastParent.appendChild(xmlNode); //ahum, i'm not proud of this one
            var eachNode = this.isTraverseNode(xmlNode);
            if (loc[0])
                loc[0].insertBefore(xmlNode, loc[1]);
            else
                lastParent.removeChild(xmlNode);

            if (!eachNode)
                xmlNode = lastParent;
        }

        //Get First ParentNode connected
        do {
            if (action == "add" && this.isTraverseNode(xmlNode)
              && startNode == xmlNode)
                break; //@todo Might want to comment this out for adding nodes under a eachd node

            if (xmlNode.getAttribute(apf.xmldb.xmlIdTag)) {
                htmlNode = this.$findHtmlNode(
                    xmlNode.getAttribute(apf.xmldb.xmlIdTag)
                    + "|" + this.$uniqueId);

                if (xmlNode == listenNode && !this.renderRoot) {
                    if (xmlNode == this.xmlRoot && action != "insert" && action != "replacenode") {
                        //@todo apf3.0 - fix this for binding on properties
                        this.dispatchEvent("xmlupdate", {
                            action: action,
                            xmlNode: xmlNode,
                            UndoObj: UndoObj
                        });
                        return;
                    }
                    break;
                }

                if (htmlNode && actionFeature[action] & 2
                  && !this.isTraverseNode(xmlNode))
                    action = "remove"; //@todo why not break here?

                else if (!htmlNode && actionFeature[action] & 4
                  && this.isTraverseNode(xmlNode)){
                    action = "add";
                    break;
                }

                else if (htmlNode
                  && (startNode != xmlNode || xmlNode == this.xmlRoot)) {
                    if (actionFeature[action] & 1)
                        action = "update";
                    else if (action == "remove")
                        return;
                }

                if (htmlNode  || action == "move")
                    break;
            }
            else if (actionFeature[action] & 8 && this.isTraverseNode(xmlNode)){
                action = "add";
                break;
            }

            if (xmlNode == listenNode) {
                if (actionFeature[action] & 128) //The change is not for us.
                    return;

                break;
            }
            xmlNode = xmlNode.parentNode;
        }
        while (xmlNode && xmlNode.nodeType != 9);

        

        
        
        // @todo Think about not having this code here
        if (this.hasFeature(apf.__VIRTUALVIEWPORT__)) {
            if (!this.$isInViewport(xmlNode)) //xmlNode is a eachd node
                return;
        }
        

        //if(xmlNode == listenNode && !action.match(/add|synchronize|insert/))
        //    return; //deleting nodes in parentData of object

        var foundNode = xmlNode;
        if (xmlNode && xmlNode.nodeType == 9)
            xmlNode = startNode;

        if (action == "replacenode") {
            //var tmpNode;
            //Case for replacing the xmlroot or its direct parent
            if (UndoObj ? UndoObj.args[1] == this.xmlRoot : !this.xmlRoot.parentNode)
                return this.load(UndoObj ? UndoObj.xmlNode : listenNode, {force: true});

            //Case for replacing a node between the xmlroot and the traverse nodes
            var nodes = this.getTraverseNodes();
            for (var i = 0, l = nodes.length; i < l; i++) {
                if (apf.isChildOf(startNode, nodes[i]))
                    return this.load(this.xmlRoot, {force: true}); //This can be more optimized by using addNodes
            }
            //if ((tmpNode = this.getFirstTraverseNode()) && apf.isChildOf(startNode, tmpNode))
        }

        //Action Tracker Support - && xmlNode correct here??? - UndoObj.xmlNode works but fishy....
        if (UndoObj && xmlNode && !UndoObj.xmlNode)
            UndoObj.xmlNode = xmlNode;

        //Check Move -- if value node isn't the node that was moved then only perform a normal update
        if (action == "move" && foundNode == startNode) {
            //if(!htmlNode) alert(xmlNode.getAttribute("id")+"|"+this.$uniqueId);
            var isInThis = apf.isChildOf(this.xmlRoot, xmlNode.parentNode, true); //@todo this.getTraverseParent(xmlNode)
            var wasInThis = apf.isChildOf(this.xmlRoot, UndoObj.extra.parent, true);

            //Move if both previous and current position is within this object
            if (isInThis && wasInThis)
                this.$moveNode(xmlNode, htmlNode, UndoObj.extra.oldParent);
            else if (isInThis) //Add if only current position is within this object
                action = "add";
            else if (wasInThis) //Remove if only previous position is within this object
                action = "remove";
        }
        else if (action == "move-away") {
            var goesToThis = apf.isChildOf(this.xmlRoot, UndoObj.extra.parent, true);
            if (!goesToThis)
                action = "remove";
        }

        //Remove loading message
        if (this.$removeClearMessage && this.$setClearMessage) {
            if (this.getFirstTraverseNode())
                this.$removeClearMessage();
            else
                this.$setClearMessage(this["empty-message"], "empty")
        }

        //Check Insert
        if (action == "insert" && (this.$isTreeArch || xmlNode == this.xmlRoot)) {
            if (!xmlNode)
                return;

            if (this.$hasLoadStatus(xmlNode) && this.$removeLoading)
                this.$removeLoading(xmlNode);

            if (this.$container.firstChild && !apf.xmldb.getNode(this.$container.firstChild)) {
                //Appearantly the content was cleared
                this.$container.innerHTML = "";

                if (!this.renderRoot) {
                    length = this.getTraverseNodes().length;
                    if (!length)
                        this.clear();
                }
            }

            result = this.$addNodes(xmlNode, null, true, false, null, null, "insert");//this.$isTreeArch??

            this.$fillParentHtml = (this.$getParentNode
                ? this.$getParentNode(htmlNode)
                : htmlNode);
            this.$fillParent = xmlNode;
            this.$fill(result);

            

            if (this.selectable && (length === 0 || !this.xmlRoot.selectSingleNode(this.each)))
                return;
        }
        else if (action == "add") {// || !htmlNode (Check Add)
            var parentHTMLNode;
            pNode = this.getTraverseParent(xmlNode) || this.xmlRoot;

            if (pNode == this.xmlRoot)
                parentHTMLNode = this.$container;

            if (!parentHTMLNode && this.$isTreeArch) {
                parentHTMLNode = this.$findHtmlNode(
                    pNode.getAttribute(apf.xmldb.xmlIdTag) + "|" + this.$uniqueId);
            }

            //This should be moved into a function (used in setCache as well)
            
            if (!parentHTMLNode && this.getCacheItem)
                parentHTMLNode = this.getCacheItem(pNode.getAttribute(apf.xmldb.xmlIdTag)
                    || (pNode.getAttribute(apf.xmldb.xmlDocTag)
                         ? "doc" + pNode.getAttribute(apf.xmldb.xmlDocTag)
                         : false));
            

            //Only update if node is in current representation or in cache
            if (parentHTMLNode || this.$isTreeArch
              && pNode == this.xmlRoot) { //apf.isChildOf(this.xmlRoot, xmlNode)
                parentHTMLNode = (this.$findContainer && parentHTMLNode && parentHTMLNode.nodeType == 1
                    ? this.$findContainer(parentHTMLNode)
                    : parentHTMLNode) || this.$container;

                result = this.$addNodes(xmlNode, parentHTMLNode, true, true,
                    apf.xmldb.getHtmlNode(this.getNextTraverse(xmlNode), this));

                if (parentHTMLNode)
                    this.$fill(result);
            }
        }
        else if (action == "remove") { //Check Remove
            //&& (!xmlNode || foundNode == xmlNode && xmlNode.parentNode
            //if (!xmlNode || startNode != xmlNode) //@todo unsure if I can remove above commented out statement
                //return;
            //I've commented above code out, because it disabled removing a
            //subnode of a node that through an each rule makes the traverse
            //node no longer a traverse node.

            //Remove HTML Node
            if (htmlNode)
                this.$deInitNode(xmlNode, htmlNode);
            else if (startNode == this.xmlRoot) {
                return this.load(null, {
                    noClearMsg: !this.dataParent || !this.dataParent.autoselect
                });
            }
        }
        else if (htmlNode) {
            
            if (this.$sort)
                this.$moveNode(xmlNode, htmlNode);
            

            this.$updateNode(xmlNode, htmlNode);

            //Transaction 'niceties'
            if (action == "replacenode" && this.hasFeature(apf.__MULTISELECT__)
              && this.selected && xmlNode.getAttribute(apf.xmldb.xmlIdTag)
              == this.selected.getAttribute(apf.xmldb.xmlIdTag)) {
                this.selected = xmlNode;
            }

            //if(action == "synchronize" && this.autoselect) this.reselect();
        }
        else if (action == "redo-remove") { //Check Remove of the data (some ancestor) that this component is bound on
            var testNode = this.xmlRoot;
            while (testNode && testNode.nodeType != 9)
                testNode = testNode.parentNode;

            if (!testNode) {
                //Set Component in listening state until data becomes available again.
                var model = this.getModel(true);

                

                return model.$waitForXml(this);
            }
        }

        

        //For tree based nodes, update all the nodes up
        pNode = xmlNode ? xmlNode.parentNode : lastParent;
        if (this.$isTreeArch && !this.$preventRecursiveUpdate
          && pNode && pNode.nodeType == 1) {
            do {
                htmlNode = this.$findHtmlNode(pNode.getAttribute(
                    apf.xmldb.xmlIdTag) + "|" + this.$uniqueId);

                if (htmlNode)
                    this.$updateNode(pNode, htmlNode);
            }
            while ((pNode = this.getTraverseParent(pNode)) && pNode.nodeType == 1);
        }

        //Make sure the selection doesn't become corrupted
        if (actionFeature[action] & 32 && this.selectable
          && startNode == xmlNode
          && (action != "insert" || xmlNode == this.xmlRoot)) {

            clearTimeout(this.$selectTimer.timer);
            // Determine next selection
            if (action == "remove" && apf.isChildOf(xmlNode, this.selected, true)
              || xmlNode == this.$selectTimer.nextNode) {
                this.$selectTimer.nextNode = this.getDefaultNext(xmlNode, this.$isTreeArch);
                if (this.$selectTimer.nextNode == this.xmlRoot && !this.renderRoot)
                    this.$selectTimer.nextNode = null;
            }

            //@todo Fix this by putting it after xmlUpdate when its using a timer
            var _self = this;
            this.$selectTimer.timer = $setTimeout(function(){
                _self.$checkSelection(_self.$selectTimer.nextNode);
                _self.$selectTimer.nextNode = null;
            });
        }

        
        //Set dynamic properties that relate to the changed content
        if (actionFeature[action] & 64) {
            if (!length)
                length = this.xmlRoot.selectNodes(this.each).length;
            if (action == "remove")
                length--;
            if (length != this.length)
                this.setProperty("length", length);
        }
        

        //Let's signal components that are waiting for xml to appear (@todo what about clearing the signalXmlUpdate)
        if (this.signalXmlUpdate && actionFeature[action] & 16) {
            var uniqueId;
            for (uniqueId in this.signalXmlUpdate) {
                if (parseInt(uniqueId, 10) != uniqueId) continue; //safari_old stuff

                var o = apf.lookup(uniqueId);
                if (!this.selected) continue;

                xmlNode = this.selected.selectSingleNode(o.dataParent.xpath);
                if (!xmlNode) continue;

                o.load(xmlNode);
            }
        }

        this.dispatchEvent("xmlupdate", {
            action: action,
            xmlNode: startNode,
            traverseNode: xmlNode,
            result: result,
            UndoObj: UndoObj
        });
    };

    /*
     * Loop through NodeList of selected Traverse Nodes
     * and check if it has representation. If it doesn't
     * representation is created via $add().
     */
    this.$addNodes = function(xmlNode, parent, checkChildren, isChild, insertBefore, depth, action) {
        

        var htmlNode, lastNode, loopNode;
        isChild = (isChild && (this.renderRoot && xmlNode == this.xmlRoot
            || this.isTraverseNode(xmlNode)));
        var nodes = isChild ? [xmlNode] : this.getTraverseNodes(xmlNode);
        /*var loadChildren = nodes.length && this.$bindings["insert"]
            ? this.$applyBindRule("insert", xmlNode)
            : false; << UNUSED */

        
        var cId, cItem;
        if (this.$isTreeArch && this.caching
          && (!this.$bindings || !this.$bindings.each || !this.$bindings.each.filter)
          && (cItem = this.cache[(cId = xmlNode.getAttribute(apf.xmldb.xmlIdTag))])) {
            if (this.$subTreeCacheContext || this.$needsDepth) {
                //@todo
                //We destroy the current items, because currently we
                //don't support multiple treecachecontexts
                //and because datagrid needs to redraw depth
                this.clearCacheItem(cId);
            }
            else {
                this.$subTreeCacheContext = {
                    oHtml: cItem,
                    container: parent,
                    parentNode: null,
                    beforeNode: null
                };

                var htmlNode;
                while (cItem.childNodes.length)
                    (parent || this.$container).appendChild(htmlNode = cItem.childNodes[0]);

                return nodes;
            }
        }
        

        if (this.$isTreeArch && depth === null && action == "insert") {
            depth = 0, loopNode = xmlNode;
            while (loopNode && loopNode != this.xmlRoot) {
                depth++;
                loopNode = this.getTraverseParent(loopNode);
            }
        }

        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].nodeType != 1) {
                
                continue;
            }

            if (checkChildren) {
                htmlNode = this.$findHtmlNode(nodes[i]
                    .getAttribute(apf.xmldb.xmlIdTag) + "|" + this.$uniqueId);
            }

            if (!htmlNode) {
                //Retrieve DataBind ID
                var Lid = apf.xmldb.nodeConnect(this.documentId, nodes[i], null, this);

                //Add Children
                var beforeNode = isChild
                        ? insertBefore
                        : (lastNode ? lastNode.nextSibling : null),//(parent || this.$container).firstChild);
                    parentNode = this.$add(nodes[i], Lid, isChild ? xmlNode.parentNode : xmlNode,
                        beforeNode ? parent || this.$container : parent, beforeNode,
                        (!beforeNode && i == nodes.length - 1), depth, nodes[i + 1], action);//Should use getTraverParent

                //Exit if component tells us its done with rendering
                if (parentNode === false) {
                    //Tag all needed xmlNodes for future reference
                    // @todo apf3.0 code below looks harmful... hence commented out (Mike)
                    /*for (var j = i; j < nodes.length; j++)
                        apf.xmldb.nodeConnect(this.documentId, nodes[j],
                            null, this);*/
                    break;
                }

                //Parse Children Recursively -> optimize: don't check children that can't exist
                //if(this.$isTreeArch) this.$addNodes(nodes[i], parentNode, checkChildren);
            }

            if (checkChildren)
                lastNode = htmlNode;// ? htmlNode.parentNode.parentNode : null;
        }

        return nodes;
    };

    this.$handleBindingRule = function(value, prop) {
        if (!value)
            this[prop] = null;

        //@todo apf3.0 fix parsing
        if (prop == "each") {
            value = value.charAt(0) == "[" && value.charAt(value.length - 1) == "]"
                ? value.replace(/^\[|\]$/g, "")
                : value;

            if (value.match(/^\w+::/)) {
                var model = value.split("::"); //@todo this is all very bad
                if (!apf.xPathAxis[model[0]]) {
                    this.setProperty("model", model[0]);
                    this.each = model[1];
                }
                else
                    this.each = value;
            }
            else
                this.each = value;

            if (this.each == this.$lastEach)
                return;

            this.$lastEach = value;

            if (!this.$model && !this.$initingModel) {
                this.$initingModel = true;
                this.$setInheritedAttribute("model");

                return; //@experimental
            }

            if (this.$checkLoadQueue() !== false) //@experimental
                return;
        }

        //@todo apf3.0 find a better heuristic (portal demo)
        if (this.xmlRoot && !this.$bindRuleTimer && this.$amlLoaded) {
            var _self = this;
            apf.queue.add("reload" + this.$uniqueId, function(){
                
                _self.reload();
            });
        }
    };

    this.$select = function(o) {
        
        if (this.renaming)
            this.stopRename(null, true);
        

        if (!o || !o.style)
            return;
        return this.$setStyleClass(o, "selected");
    };

    this.$deselect = function(o) {
        
        if (this.renaming) {
            this.stopRename(null, true);

            if (this.ctrlselect)
                return false;
        }
        

        if (!o)
            return;
        return this.$setStyleClass(o, "", ["selected", "indicate"]);
    };

    this.$indicate = function(o) {
        
        if (this.renaming)
            this.stopRename(null, true);
        

        if (!o)
            return;
        return this.$setStyleClass(o, "indicate");
    };

    this.$deindicate = function(o) {
        
        if (this.renaming)
            this.stopRename(null, true);
        

        if (!o)
            return;
        return this.$setStyleClass(o, "", ["indicate"]);
    };

    
    /**
     * @attribute {String} each Sets or gets the XPath statement that determines which
     * {@link term.datanode data nodes} are rendered by this element (also known
     * as {@link term.eachnode each nodes}. 
     * 
     *
     * #### Example
     *
     * ```xml
     *  <a:label>Country</a:label>
     *  <a:dropdown
     *      model = "mdlCountries"
     *      each = "[country]"
     *      eachvalue = "[@value]"
     *      caption = "[text()]">
     *  </a:dropdown>
     *
     *  <a:model id="mdlCountries">
     *      <countries>
     *          <country value="USA">USA</country>
     *          <country value="GB">Great Brittain</country>
     *          <country value="NL">The Netherlands</country>
     *          ...
     *      </countries>
     *  </a:model>
     * ```
     *
     * 
     */
    this.$propHandlers["each"] =

    /**
     * @attribute {String} caption Sets or gets the text displayed on the item.
     *
     * #### Example
     *
     * ```xml
     *  <a:list caption="[text()]" each="[item]" />
     * ```
     */
    this.$propHandlers["caption"] = 

    /**
     * @attribute {String} eachvalue Sets or gets the {@link term.expression}
     * that determines the value for each data nodes in the dataset of the element.
     *
     * #### Example
     *
     * ```xml
     *  <a:list value="[@value]" each="[item]" />
     * ```
     * 
     */
    this.$propHandlers["eachvalue"] = 

    /**
     * @attribute {String} icon Sets or gets the XPath statement that determines from
     * which XML node the icon URL is retrieved.
     *
     * #### Example
     *
     * ```xml
     *  <a:list icon="[@icon]" each="[item]" />
     * ```
     */
    this.$propHandlers["icon"] = 

    /**
     * @attribute {String} tooltip Sets or gets the XPath statement that determines from
     * which XML node the tooltip text is retrieved.
     *
     * #### Example
     *
     * ```xml
     *  <a:list tooltip="[text()]" each="[item]" />
     * ```
     */
    this.$propHandlers["tooltip"] = this.$handleBindingRule;

    
    /**
     * @attribute {String} sort Sets or gets the XPath statement that selects the sortable value.
     *
     * #### Example
     *
     * ```xml
     *  <a:list sort="[@name]" each="[person]" />
     * ```
     * 
     */
    this.$propHandlers["sort"] = function(value) {
        if (value) {
            this.$sort = new apf.Sort()
            this.$sort.set({
                getValue: apf.lm.compile(value)
            });
        }
        else {
            this.$sort = null;
        }
    }
    

    /**
     * @attribute {String} match Sets or gets the XPath statement that determines whether
     * this node is selectable.
     *
     * #### Example
     *
     * ```xml
     *  <a:list match="{[@disabled] != 1}" each="[item]" />
     * ```
     * 
     */
    //this.$propHandlers["select"] = 
    
}).call(apf.MultiselectBinding.prototype = new apf.DataBinding());








/**
 * The baseclass for all standard data binding rules.
 *
 * @class apf.StandardBinding
 * @private
 * @baseclass
 * @inherits apf.DataBinding
 */
apf.StandardBinding = function(){
    this.$init(true);
    
    
    if (apf.Validation)
        this.implement(apf.Validation);
    
    
    if (!this.setQueryValue)
        this.implement(apf.DataBinding);

    if (!this.defaultValue) //@todo please use this in a sentence
        this.defaultValue = "";

    /**
     * Load XML into this element
     * @private
     */
    this.$load = function(xmlNode) {
        //Add listener to XMLRoot Node
        apf.xmldb.addNodeListener(xmlNode, this);
        //Set Properties

        
        var b, lrule, rule, bRules, bRule, value;
        if (b = this.$bindings) {
            for (rule in b) {
                lrule = rule.toLowerCase();
                if (this.$supportedProperties.indexOf(lrule) > -1) {
                    bRule = (bRules = b[lrule]).length == 1 
                      ? bRules[0] 
                      : this.$getBindRule(lrule, xmlNode);

                    value = bRule.value || bRule.match;

                    
                    //Remove any bounds if relevant
                    this.$clearDynamicProperty(lrule);
            
                    if (value.indexOf("{") > -1 || value.indexOf("[") > -1)
                        this.$setDynamicProperty(lrule, value);
                    else 
                    
                    if (this.setProperty)
                        this.setProperty(lrule, value, true);
                }
            }
        }
        

        //Think should be set in the event by the Validation Class
        if (this.errBox && this.isValid && this.isValid())
            this.clearError();
    };

    /**
     * Set xml based properties of this element
     * @private
     */
    this.$xmlUpdate = function(action, xmlNode, listenNode, UndoObj) {
        //Clear this component if some ancestor has been detached
        if (action == "redo-remove") {
            var retreatToListenMode = false, model = this.getModel(true);
            if (model) {
                var xpath = model.getXpathByAmlNode(this);
                if (xpath) {
                    xmlNode = model.data.selectSingleNode(xpath);
                    if (xmlNode != this.xmlRoot)
                        retreatToListenMode = true;
                }
            }
            
            if (retreatToListenMode || this.xmlRoot == xmlNode) {
                

                //Set Component in listening state untill data becomes available again.
                return model.$waitForXml(this);
            }
        }

        //Action Tracker Support
        if (UndoObj && !UndoObj.xmlNode)
            UndoObj.xmlNode = this.xmlRoot;

        //Set Properties

        
        var b, lrule, rule, bRules, bRule, value;
        if (b = this.$bindings) {
            for (rule in b) {
                lrule = rule.toLowerCase();
                if (this.$supportedProperties.indexOf(lrule) > -1) {
                    bRule = (bRules = b[lrule]).length == 1 
                      ? bRules[0] 
                      : this.$getBindRule(lrule, xmlNode);

                    value = bRule.value || bRule.match;

                    
                    //Remove any bounds if relevant
                    this.$clearDynamicProperty(lrule);
            
                    if (value.indexOf("{") > -1 || value.indexOf("[") > -1)
                        this.$setDynamicProperty(lrule, value);
                    else 
                    
                    if (this.setProperty)
                        this.setProperty(lrule, value);
                }
            }
        }
        

        //@todo Think should be set in the event by the Validation Class
        if (this.errBox && this.isValid && this.isValid())
            this.clearError();
        
        this.dispatchEvent("xmlupdate", {
            action: action,
            xmlNode: xmlNode,
            UndoObj: UndoObj
        });
    };

    //@todo apf3.0 this is wrong
    /**
     * @event $clear Clears the data loaded into this element resetting it's value.
     */
    this.addEventListener("$clear", function(nomsg, do_event) {
        if (this.$propHandlers && this.$propHandlers["value"]) {
            this.value = -99999; //force resetting
            this.$propHandlers["value"].call(this, "");
        }
    });
};
apf.StandardBinding.prototype = new apf.DataBinding();

apf.Init.run("standardbinding");






apf.__MULTISELECT__ = 1 << 8;



/**
 * All elements inheriting from this {@link term.baseclass baseclass} have selection features. This includes handling
 * for multiselect and several keyboard based selection interaction. It also
 * takes care of {@link term.caret caret} handling when multiselect is enabled. Furthermore features 
 * for dealing with multinode component are included like adding and removing 
 * {@link term.datanode data nodes}.
 *
 * #### Example
 *
 * In this example the tree contains nodes that have a disabled flag set. These nodes cannot be selected.
 *
 * ```xml
 *  <a:list width="200">
 *      <a:bindings>
 *          <a:selectable match="[self::node()[not(@disabled) or @disabled != 'true']]" />
 *          <a:each match="[person]"></a:each>
 *          <a:caption match="[@name]"></a:caption>
 *      </a:bindings>
 *      <a:model>
 *          <data>
 *              <person disabled="false" name="test 5"/>
 *              <person disabled="true" name="test 3"/>
 *              <person name="test 4"/>
 *              <person disabled="true" name="test 2"/>
 *              <person disabled="true" name="test 1"/>
 *          </data>
 *      </a:model>
 *  </a:list>
 * ```
 *
 * #### Example
 *
 * ```xml
 *  <a:dropdown onafterchange="alert(this.value)">
 *      <a:bindings>
 *          <a:caption match="[text()]" />
 *          <a:value match="[@value]" />
 *          <a:each match="[item]" />
 *      </a:bindings>
 *      <a:model>
 *          <items>
 *              <item value="#FF0000">red</item>
 *              <item value="#00FF00">green</item>
 *              <item value="#0000FF">blue</item>
 *          </items>
 *      </a:model>
 *  </a:dropdown>
 * ```
 *
 * @class apf.MultiSelect
 * @baseclass
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.5
 *
 * @inherits apf.MultiselectBinding
 *
 */
/**
 *
 * @binding select Determines whether the {@link term.eachnode each node} can be selected.
 *
 */
 /**
 *
 * * @binding value  Determines the way the value for the element is retrieved
 * from the selected node. The `apf.MultiSelect.value` property contains this value.
 *
 */
apf.MultiSelect = function(){
    this.$init(function(){
        this.$valueList = [];
        this.$selectedList = [];
    });
};

//@todo investigate if selectedList can be deprecated
(function() {
    this.$regbase = this.$regbase|apf.__MULTISELECT__;

    // *** Properties *** //

    // @todo Doc is that right? 
    /**
     * The last selected item of this element.
     * @type {XMLElement} 
     */
    this.sellength = 0;
    this.selected = null;
    this.$selected = null;
    
    /**
     * The XML element that has the {@link term.caret caret}.
     * @type {XMLElement} 
     */
    this.caret = null;
    this.$caret = null;
    
    /**
     * Specifies whether to use a {@link term.caret caret} in the interaction of this element.
     * @type {Boolean} 
     */
    this.useindicator = true;

    

    /**
     * Removes a {@link term.datanode data node} from the data of this element.
     *
     * #### Example
     *
     * A simple list showing products. This list is used in all the following examples.
     * 
     * ```xml
     *  <a:list id="myList">
     *      <a:bindings>
     *          <a:caption match="[@name]" />
     *          <a:value match="[@id]" />
     *          <a:icon>[@type].png</a:icon>
     *          <a:each match="[product]" />
     *      </a:bindings>
     *      <a:model>
     *          <products>
     *              <product name="Soundblaster" type="audio"    id="product10" length="12" />
     *              <product name="Teapot"       type="3d"       id="product13" />
     *              <product name="Coprocessor"  type="chips"    id="product15" />
     *              <product name="Keyboard"     type="input"    id="product17" />
     *              <product name="Diskdrive"    type="storage"  id="product20" />
     *          </products>
     *      </a:model>
     *  </a:list>
     * ```
     *
     * #### Example
     *
     * This example selects a product by its value and then removes the selection.
     * 
     * ```xml
     *  <a:script><!--
     *      apf.onload = function() {
     *          myList.setValue("product20");
     *          myList.remove();
     *      }
     *  --></a:script>
     * ```
     *
     * #### Example
     *
     * This example gets a product by its value and then removes it.
     * 
     * ```xml
     *  <a:script>
     *      var xmlNode = myList.findXmlNodeByValue("product20");
     *      myList.remove(xmlNode);
     *  </a:script>
     * ```
     *
     * #### Example
     *
     * This example retrieves all nodes from the list. All items with a length
     * greater than 10 are singled out and removed.
     * 
     * ```xml
     *  <a:script><![CDATA[
     *      apf.onload = function() {
     *          var list = myList.getTraverseNodes();
     * 
     *          var removeList = [];
     *          for (var i = 0; i < list.length; i++) {
     *              if (list[i].getAttribute("length") > 10)
     *                  removeList.push(list[i]);
     *          }
     *          myList.remove(removeList);
     *      }
     *   ]]></a:script>
     * ```
     * 
     * #### Remarks
     *
     * Another way to trigger this method is by using the action attribute on a
     * button.
     *
     * ```xml
     *  <a:button action="remove" target="myList">Remove item</a:button>
     * ```
     *
     * Using the action methodology, you can let the original data source
     * (usually the server) know that the user removed an item:
     * 
     * ```xml
     *     <a:list>
     *         <a:bindings />
     *         <a:remove set="remove_product.php?id=[@id]" />
     *     </a:list>
     * ```
     *
     * For undo, this action should be extended and the server should maintain a
     * copy of the deleted item.
     * 
     * ```xml
     *  <a:list actiontracker="atList">
     *      <a:bindings />
     *      <a:remove set = "remove_product.php?id=[@id]"
     *                undo = "undo_remove_product.php?id=[@id]" />
     *  </a:list>
     *  <a:button 
     *    action = "remove" 
     *    target = "myList">Remove item</a:button>
     *   <a:button 
     *     caption = "Undo"
     *     disabled = "{!atList.undolength}" 
     *     onclick = "atList.undo()" />
     * ```
     *
     * @action
     * @param  {NodeList | XMLElement} [nodeList]  The {@link term.datanode data node}(s) to be removed. If none are specified, the current selection is removed.
     *
     * @return  {Boolean}  Indicates if the removal succeeded
     */
    this.remove = function(nodeList) {
        //Use the current selection if no xmlNode is defined
        if (!nodeList)
            nodeList = this.$valueList;

        //If we're an xml node let's convert
        if (nodeList.nodeType)
            nodeList = [nodeList];

        //If there is no selection we'll exit, nothing to do
        if (!nodeList || !nodeList.length)
            return;

        

        var changes = [];
        for (var i = 0; i < nodeList.length; i++) {
            changes.push({
                action: "removeNode",
                args: [nodeList[i]]
            });
        }

        if (this.$actions["removegroup"])
            return this.$executeAction("multicall", changes, "removegroup", nodeList[0]);
        else {
            return this.$executeAction("multicall", changes, "remove", 
              nodeList[0], null, null, nodeList.length > 1 ? nodeList : null);
        }
    };
    
    /**
     * Adds a {@link term.datanode data node} to the data of this element.
     *
     * #### Example
     *
     * A simple list showing products. This list is used in all following examples.
     * 
     * ```xml
     *  <a:list id="myList">
     *      <a:bindings>
     *          <a:caption match="[@name]" />
     *          <a:value match="[@id]" />
     *          <a:icon>[@type].png</a:icon>
     *          <a:each match="[product]" />
     *      </a:bindings>
     *      <a:model>
     *          <products>
     *              <product name="Soundblaster" type="audio"    id="product10" />
     *              <product name="Teapot"       type="3d"       id="product13" />
     *              <product name="Coprocessor"  type="chips"    id="product15" />
     *              <product name="Keyboard"     type="input"    id="product17" />
     *              <product name="Diskdrive"    type="storage"  id="product20" />
     *          </products>
     *      </a:model>
     *  </a:list>
     * ```
     *
     * #### Example
     *
     * This example adds a product to this element selection.
     *
     * ```xml
     *  <a:script><![CDATA[
     *      apf.onload = function() {
     *          myList.add('<product name="USB drive" type="storage" />');
     *      }
     *  ]]></a:script>
     * ```
     *
     * #### Example
     *
     * This example copys the selected product, changes its name, and then
     * adds it. After selecting the new node, the user is offered a rename input
     * box.
     * 
     * ```xml
     *  <a:script><![CDATA[
     *      apf.onload = function() {
     *          var xmlNode = apf.xmldb.copy(myList.selected);
     *          xmlNode.setAttribute("name", "New product");
     *          myList.add(xmlNode);
     *          myList.select(xmlNode);
     *          myList.startRename();
     *      }
     *  ]]></a:script>
     * ```
     * 
     * #### Remarks
     * Another way to trigger this method is by using the action attribute on a
     * button.
     *
     * ```xml
     *  <a:list>
     *      <a:bindings />
     *      <a:model />
     *      <a:actions>
     *          <a:add>
     *              <product name="New item" />
     *          </a:add>
     *      </a:actions>
     *  </a:list>
     *  <a:button action="add" target="myList">Add new product</a:button>
     * ```
     *
     * Using the action methodology you can let the original data source (usually the server) know that the user added an item.
     * 
     * ```xml
     *  <a:add get="{comm.addProduct()}" />
     * ```
     *
     * For undo, this action should be extended as follows.
     * 
     * ```xml
     *  <a:list id="myList" actiontracker="atList">
     *      <a:bindings />
     *      <a:model />
     *      <a:actions>
     *          <a:add set = "add_product.php?xml=%[.]"
     *              undo = "remove_product.php?id=[@id]">
     *              <product name="New product" id="productId" />
     *          </a:add>
     *      </a:actions>
     *  </a:list>
     *  <a:button 
     *    action = "add" 
     *    target = "myList">Add new product</a:button>
     *  <a:button
     *     caption = "Undo"
     *     disabled = "{!atList.undolength}" 
     *     onclick = "atList.undo()" />
     * ```
     *
     * In some cases the server needs to create the new product before its
     * added. This is done as follows.
     * 
     * ```xml
     *  <a:add get="{comm.createNewProduct()}" />
     * ```
     * Alternatively the template for the addition can be provided as a child of
     * the action rule.
     * ```
     *  <a:add set="add_product.php?xml=%[.]">
     *      <product name="USB drive" type="storage" />
     *  </a:add>
     * ```
     *
     * @action
     * @param  {XMLElement} [xmlNode]    The {@link term.datanode data node} which is added. If none is specified the action will use the action rule to try to retrieve a new node to add
     * @param  {XMLElement} [pNode]      The parent node of the added {@link term.datanode data node}
     * @param  {XMLElement} [beforeNode] The position where the XML element should be inserted
     * @return  {XMLElement} The added {@link term.datanode data node} or false on failure
     */
    this.add = function(xmlNode, pNode, beforeNode, userCallback) {
        var rule;

        if (this.$actions) {
            if (xmlNode && xmlNode.nodeType)
                rule = this.$actions.getRule("add", xmlNode);
            else if (typeof xmlNode == "string") {
                if (xmlNode.trim().charAt(0) == "<") {
                    xmlNode = apf.getXml(xmlNode);
                    rule = this.$actions.getRule("add", xmlNode);
                }
                else {
                    var rules = this.$actions["add"];
                    for (var i = 0, l = rules.length; i < l; i++) {
                        if (rules[i].getAttribute("type") == xmlNode) {
                            xmlNode = null;
                            rule = rules[i];
                            break;
                        }
                    }
                }
            }

            if (!rule) 
                rule = (this.$actions["add"] || {})[0];
        }
        else
            rule = null;
            
        
        
        var refNode = this.$isTreeArch ? this.selected || this.xmlRoot : this.xmlRoot,
            amlNode = this,
        callback = function(addXmlNode, state, extra) {
            if (state != apf.SUCCESS) {
                var oError;

                oError = new Error(apf.formatErrorString(1032, amlNode,
                    "Loading xml data",
                    "Could not add data for control " + amlNode.name
                    + "[" + amlNode.tagName + "] \nUrl: " + extra.url
                    + "\nInfo: " + extra.message + "\n\n" + xmlNode));

                if (extra.tpModule.retryTimeout(extra, state, amlNode, oError) === true)
                    return true;

                throw oError;
            }

            /*if (apf.supportNamespaces && node.namespaceURI == apf.ns.xhtml) {
                node = apf.getXml(node.xml.replace(/xmlns\=\"[^"]*\"/g, ""));
                //@todo import here for webkit?
            }*/

            if (typeof addXmlNode != "object")
                addXmlNode = apf.getXmlDom(addXmlNode).documentElement;
            if (addXmlNode.getAttribute(apf.xmldb.xmlIdTag))
                addXmlNode.setAttribute(apf.xmldb.xmlIdTag, "");

            var actionNode = amlNode.$actions &&
              amlNode.$actions.getRule("add", amlNode.$isTreeArch
                ? amlNode.selected
                : amlNode.xmlRoot);
            if (!pNode) {
                if (actionNode && actionNode.parent) {
                    pNode = (actionNode.cparent 
                      || actionNode.compile("parent", {
                        xpathmode: 2, 
                        injectself: true
                      }))(amlNode.$isTreeArch
                          ? amlNode.selected || amlNode.xmlRoot
                          : amlNode.xmlRoot);
                }
                else {
                    pNode = amlNode.$isTreeArch
                      ? amlNode.selected || amlNode.xmlRoot
                      : amlNode.xmlRoot
                }
            }

            if (!pNode)
                pNode = amlNode.xmlRoot;

            //Safari issue not auto importing nodes:
            if (apf.isWebkit && pNode.ownerDocument != addXmlNode.ownerDocument)
                addXmlNode = pNode.ownerDocument.importNode(addXmlNode, true); 

            

            if (amlNode.$executeAction("appendChild",
              [pNode, addXmlNode, beforeNode], "add", addXmlNode) !== false
              && amlNode.autoselect)
                amlNode.select(addXmlNode);

            if (userCallback)
                userCallback.call(amlNode, addXmlNode);

            return addXmlNode;
        };

        if (xmlNode)
            return callback(xmlNode, apf.SUCCESS);
        else {
            if (rule.get)
                return apf.getData(rule.get, {xmlNode: refNode, callback: callback})
            else {
                
            }
        }

        return addXmlNode;
    };

    if (!this.setValue) {
        /**
         * Sets the value of this element. The value
         * corresponds to an item in the list of loaded {@link term.datanode data nodes}. This
         * element will receive the selection. If no {@link term.datanode data node} is found, the
         * selection is cleared.
         *
         * @param  {String}  value  The new value for this element.
         * @see apf.MultiSelect.getValue
         */
        this.setValue = function(value, disable_event) {
            // @todo apf3.0 what does noEvent do? in this scope it's useless and
            // doesn't improve codeflow with a global lookup and assignment
            noEvent = disable_event;
            this.setProperty("value", value, false, true);
            noEvent = false;
        };
    }

    /**
     * Retrieves an {@link term.datanode data node} that has a value that corresponds to the
     * string that is searched on.
     * @param {String} value The value to match.
     * @returns {XMLNode} The found node, or `false`
     */
    this.findXmlNodeByValue = function(value) {
        var nodes = this.getTraverseNodes(),
            bindSet = this.$attrBindings["eachvalue"]
                && "eachvalue" || this.$bindings["value"]
                && "value" || this.$hasBindRule("caption") && "caption";
        
        if (!bindSet)
            return false;
            
        for (var i = 0; i < nodes.length; i++) {
            if (this.$applyBindRule(bindSet, nodes[i]) == value)
                return nodes[i];
        }
    };

    if (!this.getValue) {
        /**
         * Retrieves the value of this element. This is the value of the
         * first selected {@link term.datanode data node}.
         * 
         */
        this.getValue = function(xmlNode, noError) {
            return this.value;
            /*
            if (!this.bindingRules && !this.caption) 
                return false;

            

            return this.$applyBindRule(this.$mainBind, xmlNode || this.selected, null, true)
                || this.$applyBindRule("caption", xmlNode || this.selected, null, true);
            */
        };
    }

    /**
     * Select the current selection...again.
     *
     */
    this.reselect = function(){ // @todo Add support for multiselect
        if (this.selected) this.select(this.selected, null, this.ctrlselect,
            null, true);//no support for multiselect currently.
    };

    /**
     * @event  beforeselect  Fires before a {@link apf.MultiSelect.select selection} is made
     * @param {Object} e The standard event object. It contains the following properties:
     *                     - `selected` ([[XMLElement]]): The {@link term.datanode data node} that will be selected
     *                     - `selection` ([[Array]]): An array of {@link term.datanode data nodes} that will be selected
     *                     - `htmlNode` ([[HTMLElement]]): The HTML element that visually represents the {@link term.datanode data node} 
     */
    /**
     * @event  afterselect  Fires after a {@link apf.MultiSelect.select selection} is made
     * @param {Object} e The standard event object. It contains the following properties:
     *                     - `selected` ([[XMLElement]]):    the {@link term.datanode data node} that was selected
     *                     - `selection` ([[Array]]():       an array of {@link term.datanode data node} that are selected
     *                     - `htmlNode` ([[HTMLElement]](): the HTML element that visually represents the {@link term.datanode data node}
     */
    /**
     * Selects a single, or set, of {@link term.eachnode each nodes}.
     * The selection can be visually represented in this element.
     *
     * @param {Mixed}   xmlNode      The identifier to determine the selection. It can be one of the following values:
     *                                 - ([[XMLElement]]):  The {@link term.datanode data node} to be used in the selection as a start/end point or to toggle the selection on the node.
     *                                 - ([[HTMLElement]]): The HTML element node used as visual representation of {@link term.datanode data node}. 
     *                                                 Used to determine the {@link term.datanode data node} for selection.
     *                                 - ([[String]]):      The value of the {@link term.datanode data node} to be selected.
     * @param {Boolean} [ctrlKey]    Indicates whether the [[keys: Ctrl]] key was pressed
     * @param {Boolean} [shiftKey]   Indicates whether the [[keys: Shift]]  key was pressed
     * @param {Boolean} [fakeselect] Indicates whether only visually a selection is made
     * @param {Boolean} [force]      Indicates whether reselect is forced
     * @param {Boolean} [noEvent]    Indicates whether to not call any event
     * @return  {Boolean}  Indicates whether the selection could be made
     *
     */
    this.select = function(xmlNode, ctrlKey, shiftKey, fakeselect, force, noEvent, userAction) {
        if (!this.selectable || this.disabled) 
            return;

        if (parseInt(fakeselect) == fakeselect) {
            //Don't select on context menu
            if (fakeselect == 2) {
                fakeselect = true;
                userAction = true;
            }
            else {
                fakeselect = false;
                userAction = true;
            }
        }

        if (this.$skipSelect) {
            this.$skipSelect = false;
            return;
        }

        if (this.ctrlselect && !shiftKey)
            ctrlKey = true;

        if (!this.multiselect)
            ctrlKey = shiftKey = false;
        
        // Selection buffering (for async compatibility)
        if (!this.xmlRoot) {
            if (!this.$buffered) {
                var f;
                this.addEventListener("afterload", f = function(){
                    this.select.apply(this, this.$buffered);
                    this.removeEventListener("afterload", f);
                    delete this.$buffered;
                });
            }

            this.$buffered = Array.prototype.slice.call(arguments);
            return;
        }

        var htmlNode;

        // *** Type Detection *** //
        if (!xmlNode) {
            

            return false;
        }

        if (typeof xmlNode != "object") {
            var str = xmlNode; xmlNode = null;
            if (typeof xmlNode == "string")
                xmlNode = apf.xmldb.getNodeById(str);

            //Select based on the value of the xml node
            if (!xmlNode) {
                xmlNode = this.findXmlNodeByValue(str);
                if (!xmlNode) {
                    this.clearSelection(noEvent);
                    return;
                }
            }
        }
        
        if (!(typeof (xmlNode.style || "") == "object")) {
            htmlNode = this.$findHtmlNode(xmlNode.getAttribute(
                    apf.xmldb.xmlIdTag) + "|" + this.$uniqueId);
        }
        else {
            var id = (htmlNode = xmlNode).getAttribute(apf.xmldb.htmlIdTag);
            while (!id && htmlNode.parentNode)
                id = (htmlNode = htmlNode.parentNode).getAttribute(
                    apf.xmldb.htmlIdTag);

            xmlNode = apf.xmldb.getNodeById(id);//, this.xmlRoot);
        }

        if (!shiftKey && !ctrlKey && !force && !this.reselectable 
          && this.$valueList.length <= 1 && this.$valueList.indexOf(xmlNode) > -1)
            return;

        if (this.dispatchEvent('beforeselect', {
            selected: xmlNode,
            htmlNode: htmlNode,
            ctrlKey: ctrlKey,
            shiftKey: shiftKey,
            force: force,
            captureOnly: noEvent
        }) === false)
              return false;

        // *** Selection *** //

        var lastIndicator = this.caret;
        this.caret = xmlNode;

        //Multiselect with SHIFT Key.
        if (shiftKey) {
            var range = this.$calcSelectRange(
              this.$valueList[0] || lastIndicator, xmlNode);

            if (this.$caret)
                this.$deindicate(this.$caret);

            this.selectList(range);

            this.$selected = 
            this.$caret = this.$indicate(htmlNode);
        }
        else if (ctrlKey) { //Multiselect with CTRL Key.
            //Node will be unselected
            if (this.$valueList.contains(xmlNode)) {
                if (this.selected == xmlNode) {
                    this.$deselect(this.$findHtmlNode(this.selected.getAttribute(
                        apf.xmldb.xmlIdTag) + "|" + this.$uniqueId));
                    
                    this.$deindicate(this.$caret);

                    if (this.$valueList.length && !fakeselect) {
                        //this.$selected = this.$selectedList[0];
                        this.selected = this.$valueList[0];
                    }
                }
                else
                    this.$deselect(htmlNode, xmlNode);

                if (!fakeselect) {
                    this.$selectedList.remove(htmlNode);
                    this.$valueList.remove(xmlNode);
                }

                if (htmlNode != this.$caret)
                    this.$deindicate(this.$caret);

                this.$selected = 
                this.$caret = this.$indicate(htmlNode);
            }
            // Node will be selected
            else {
                if (this.$caret)
                    this.$deindicate(this.$caret);
                this.$caret = this.$indicate(htmlNode, xmlNode);

                this.$selected = this.$select(htmlNode, xmlNode);
                this.selected = xmlNode;

                if (!fakeselect) {
                    this.$selectedList.push(htmlNode);
                    this.$valueList.push(xmlNode);
                }
            }
        }
        else if (fakeselect && htmlNode && this.$selectedList.contains(htmlNode)) {//Return if selected Node is htmlNode during a fake select
            return;
        }
        else { //Normal Selection
            //htmlNode && this.$selected == htmlNode && this.$valueList.length <= 1 && this.$selectedList.contains(htmlNode)
            if (this.$selected)
                this.$deselect(this.$selected);
            if (this.$caret)
                this.$deindicate(this.$caret);
            if (this.selected)
                this.clearSelection(true);

            this.$caret = this.$indicate(htmlNode, xmlNode);
            this.$selected = this.$select(htmlNode, xmlNode);
            this.selected = xmlNode;

            this.$selectedList.push(htmlNode);
            this.$valueList.push(xmlNode);
        }

        if (this.delayedselect && (typeof ctrlKey == "boolean")){
            var _self = this;
            $setTimeout(function(){
                if (_self.selected == xmlNode)
                    _self.dispatchEvent("afterselect", {
                        selection: _self.$valueList,
                        selected: xmlNode,
                        caret: _self.caret,
                        captureOnly: noEvent
                    });
            }, 10);
        }
        else {
            this.dispatchEvent("afterselect", {
                selection: this.$valueList,
                selected: xmlNode,
                caret: this.caret,
                captureOnly: noEvent
            });
        }

        return true;
    };

    /**
     * @event  beforechoose  Fires before a choice is made.
     * @param {Object} e The standard event object. It contains the following properties:
     *                   - `xmlNode` ([[XMLElement]]):   The {@link term.datanode data node} that was choosen
     *
     */
    /**
     * @event  afterchoose   Fires after a choice is made.
     * @param {Object} e The standard event object. It contains the following properties:
     *                   - `xmlNode` ([[XMLElement]]):   The {@link term.datanode data node} that was choosen
     */
    /**
     * Chooses a selected item. This is done by double clicking on the item or
     * pressing the Enter key.
     *
     * @param {Mixed}   xmlNode      The identifier to determine the selection. It can be one of the following values: 
     *                                - [[XMLElement]]:  The {@link term.datanode data node} to be choosen
     *                                - [[HTMLElement]]: The HTML element node used as visual representation of {@link term.datanode data node}
     *                                                 Used to determine the {@link term.datanode data node}
     *                                - [[String]] :     The value of the {@link term.datanode data node} to be choosen
     *
     */
    this.choose = function(xmlNode, userAction) {
        if (!this.selectable || userAction && this.disabled) return;

        if (this.dispatchEvent("beforechoose", {xmlNode : xmlNode}) === false)
            return false;

        if (xmlNode && !(typeof (xmlNode.style || "") == "object"))
            this.select(xmlNode);

        
        if (this.hasFeature(apf.__DATABINDING__)
          && this.dispatchEvent("afterchoose", {xmlNode : this.selected}) !== false)
            this.setProperty("chosen", this.selected);
        
    };

    /*
     * Removes the selection of one or more selected nodes.
     *
     * @param {Boolean} [noEvent]    Indicates whether or not to call any events
     */
    // @todo Doc
    this.clearSelection = function(noEvent, userAction) {
        if (!this.selectable || userAction && this.disabled || !this.$valueList.length)
            return;
        
        if (!noEvent) {
            if (this.dispatchEvent("beforeselect", {
                selection: [],
                selected: null,
                caret: this.caret
            }) === false)
                return false;
        }

        //Deselect html nodes
        var htmlNode;
        for (var i = this.$valueList.length - 1; i >= 0; i--) {
            if (this.$valueList[i]) {
                htmlNode = this.$findHtmlNode(this.$valueList[i].getAttribute(
                        apf.xmldb.xmlIdTag) + "|" + this.$uniqueId);
                this.$deselect(htmlNode);
            }
        }
        
        //Reset internal variables
        this.$selectedList.length = 0;
        this.$valueList.length = 0;
        this.$selected = 
        this.selected = null;

        //Redraw indicator
        if (this.caret) {
            htmlNode = this.$findHtmlNode(this.caret.getAttribute(
                    apf.xmldb.xmlIdTag) + "|" + this.$uniqueId);

            this.$caret = this.$indicate(htmlNode);
        }

        if (!noEvent) {
            this.dispatchEvent("afterselect", {
                selection: this.$valueList,
                selected: null,
                caret: this.caret
            });
        }
    };

    /*
     * Selects a set of items
     *
     * @param {Array} xmlNodeList the {@link term.datanode data nodes} that will be selected.
     */
    //@todo Doc I think there are missing events here?
    this.selectList = function(xmlNodeList, noEvent, selected, userAction) {
        if (!this.selectable || userAction && this.disabled) return;

        if (this.dispatchEvent("beforeselect", {
            selection: xmlNodeList,
            selected: selected || xmlNodeList[0],
            caret: this.caret,
            captureOnly: noEvent
          }) === false)
            return false;

        this.clearSelection(true);

        for (var sel, i = 0; i < xmlNodeList.length; i++) {
            //@todo fix select state in unserialize after removing
            if (!xmlNodeList[i] || xmlNodeList[i].nodeType != 1) continue;
            var htmlNode,
                xmlNode = xmlNodeList[i];

            //Type Detection
            if (typeof xmlNode != "object")
                xmlNode = apf.xmldb.getNodeById(xmlNode);
            if (!(typeof (xmlNode.style || "") == "object"))
                htmlNode = this.$pHtmlDoc.getElementById(xmlNode.getAttribute(
                    apf.xmldb.xmlIdTag) + "|" + this.$uniqueId);
            else {
                htmlNode = xmlNode;
                xmlNode = apf.xmldb.getNodeById(htmlNode.getAttribute(
                    apf.xmldb.htmlIdTag));
            }

            if (!xmlNode) {
                
                continue;
            }

            //Select Node
            if (htmlNode) {
                if (!sel && selected == htmlNode)
                    sel = htmlNode;

                this.$select(htmlNode, xmlNode);
                this.$selectedList.push(htmlNode);
            }
            this.$valueList.push(xmlNode);
        }

        this.$selected = sel || this.$selectedList[0];
        this.selected = selected || this.$valueList[0];

        this.dispatchEvent("afterselect", {
            selection: this.$valueList,
            selected: this.selected,
            caret: this.caret,
            captureOnly: noEvent
        });
    };

    /**
     * @event indicate Fires when an item becomes the indicator.
     */

    /**
     * Sets the {@link term.caret caret} on an item to indicate to the user that the keyboard
     * actions are done relevant to that item. Using the keyboard,
     * a user can change the position of the indicator using the [[keys: Ctrl]] and arrow
     * keys while not making a selection. When making a selection with the mouse
     * or keyboard, the indicator is always set to the selected node. Unlike a
     * selection there can be only one indicator item.
     *
     * @param {Mixed}   xmlNode      The identifier to determine the indicator. Its possible values include:
     *                                - {XMLElement}  The {@link term.datanode data node} to be set as indicator.
     *                                - {HTMLElement} The HTML element node used as visual representation of
     *                                                   {@link term.datanode data node}. Used to determine the {@link term.datanode data node}.
     *                                - {String}      The value of the {@link term.datanode data node} to be set as an indicator.
     */
    this.setCaret = function(xmlNode) {
        if (!xmlNode) {
            if (this.$caret)
                this.$deindicate(this.$caret);
            this.caret = 
            this.$caret = null;
            return;
        }

        // *** Type Detection *** //
        var htmlNode;
        if (typeof xmlNode != "object")
            xmlNode = apf.xmldb.getNodeById(xmlNode);
        if (!(typeof (xmlNode.style || "") == "object")) {
            htmlNode = this.$findHtmlNode(xmlNode.getAttribute(
                    apf.xmldb.xmlIdTag) + "|" + this.$uniqueId);
        }
        else {
            var id = (htmlNode = xmlNode).getAttribute(apf.xmldb.htmlIdTag);
            while (!id && htmlNode.parentNode && htmlNode.parentNode.nodeType == 1)
                id = (htmlNode = htmlNode.parentNode).getAttribute(
                    apf.xmldb.htmlIdTag);
            if (!id) alert(this.$int.outerHTML);

            xmlNode = apf.xmldb.getNodeById(id);
        }

        if (this.$caret) {
            //this.$deindicate(this.$findHtmlNode(this.caret.getAttribute(
                //apf.xmldb.xmlIdTag) + "|" + this.$uniqueId));
            this.$deindicate(this.$caret);
        }
        
        this.$caret = this.$indicate(htmlNode);
        this.setProperty("caret", this.caret = xmlNode);
    };

    /*
     * @private
     */
    this.$setTempSelected = function(xmlNode, ctrlKey, shiftKey, down) {
        clearTimeout(this.timer);

        if (this.$bindings.selectable) {
            while (xmlNode && !this.$getDataNode("selectable", xmlNode)) {
                xmlNode = this.getNextTraverseSelected(xmlNode, !down);
            }
            if (!xmlNode) return;
        }

        if (!this.multiselect)
            ctrlKey = shiftKey = false;

        if (ctrlKey || this.ctrlselect) {
            if (this.$tempsel) {
                this.select(this.$tempsel);
                this.$tempsel = null;
            }

            this.setCaret(xmlNode);
        }
        else if (shiftKey) {
            if (this.$tempsel) {
                this.$selectTemp();
                this.$deselect(this.$tempsel);
                this.$tempsel = null;
            }

            this.select(xmlNode, null, shiftKey);
        }
        else if (!this.bufferselect || this.$valueList.length > 1) {
            this.select(xmlNode);
        }
        else {
            var id = apf.xmldb.getID(xmlNode, this);

            this.$deselect(this.$tempsel || this.$selected);
            this.$deindicate(this.$tempsel || this.$caret);
            this.$tempsel = this.$indicate(document.getElementById(id));
            this.$select(this.$tempsel);

            var _self = this;
            this.timer = $setTimeout(function(){
                _self.$selectTemp();
            }, 400);
        }
    };

    /*
     * @private
     */
    this.$selectTemp = function(){
        if (!this.$tempsel)
            return;

        clearTimeout(this.timer);
        this.select(this.$tempsel);

        this.$tempsel = null;
        this.timer = null;
    };

    /**
     * Selects all the {@link term.eachnode each nodes} of this element
     * 
     */
    this.selectAll = function(userAction) {
        if (!this.multiselect || !this.selectable
          || userAction && this.disabled || !this.xmlRoot)
            return;

        var nodes = this.$isTreeArch
            ? this.xmlRoot.selectNodes(".//" 
              + this.each.split("|").join("|.//"))
            : this.xmlRoot.selectNodes(this.each);
        
        this.selectList(nodes);
    };

    /**
     * Retrieves an Array or a document fragment containing all the selected
     * {@link term.datanode data nodes} from this element.
     *
     * @param {Boolean} [xmldoc] Specifies whether the method should return a document fragment.
     * @return {Mixed} The selection of this element.
     */
    this.getSelection = function(xmldoc) {
        var i, r;
        if (xmldoc) {
            r = this.xmlRoot
                ? this.xmlRoot.ownerDocument.createDocumentFragment()
                : apf.getXmlDom().createDocumentFragment();
            for (i = 0; i < this.$valueList.length; i++)
                apf.xmldb.cleanNode(r.appendChild(
                    this.$valueList[i].cloneNode(true)));
        }
        else {
            for (r = [], i = 0; i < this.$valueList.length; i++)
                r.push(this.$valueList[i]);
        }

        return r;
    };
    
    this.$getSelection = function(htmlNodes) {
        return htmlNodes ? this.$selectedList : this.$valueList;
    };

    /**
     * Selects the next {@link term.datanode data node} to be selected.
     *
     * @param  {XMLElement}  xmlNode  The context {@link term.datanode data node}.
     * @param  {Boolean}     [isTree] If `true`, indicates that this node is a tree, and should select children
     */
    this.defaultSelectNext = function(xmlNode, isTree) {
        var next = this.getNextTraverseSelected(xmlNode);
        //if(!next && xmlNode == this.xmlRoot) return;

        //@todo Why not use this.$isTreeArch ??
        if (next || !isTree)
            this.select(next ? next : this.getTraverseParent(xmlNode));
        else
            this.clearSelection(true);
    };

    /**
     * Selects the next {@link term.datanode data node} when available.
     */
    this.selectNext = function(){
        var xmlNode = this.getNextTraverse();
        if (xmlNode)
            this.select(xmlNode);
    };

    /**
     * Selects the previous {@link term.datanode data node} when available.
     */
    this.selectPrevious = function(){
        var xmlNode = this.getNextTraverse(null, -1);
        if (xmlNode)
            this.select(xmlNode);
    };

    /*
     * @private
     */
    this.getDefaultNext = function(xmlNode, isTree){  //@todo why is isTree an argument
        var next = this.getNextTraverseSelected(xmlNode);
        //if(!next && xmlNode == this.xmlRoot) return;

        return (next && next != xmlNode)
            ? next
            : (isTree
                ? this.getTraverseParent(xmlNode)
                : null); //this.getFirstTraverseNode()
    };

    /**
     * Determines whether a node is selected.
     *
     * @param  {XMLElement} xmlNode  The {@link term.datanode data node} to be checked
     * @return  {Boolean} Identifies if the element is selected
     */
    this.isSelected = function(xmlNode) {
        if (!xmlNode) return false;

        for (var i = 0; i < this.$valueList.length; i++) {
            if (this.$valueList[i] == xmlNode)
                return this.$valueList.length;
        }

        return false;
    };

    /*
     * This function checks whether the current selection is still correct.
     * Selection can become invalid when updates to the underlying data
     * happen. For instance when a selected node is removed.
     */
    this.$checkSelection = function(nextNode) {
        if (this.$valueList.length > 1) {
            //Fix selection if needed
            for (var lst = [], i = 0, l = this.$valueList.length; i < l; i++) {
                if (apf.isChildOf(this.xmlRoot, this.$valueList[i]))
                    lst.push(this.$valueList[i]);
            }

            if (lst.length > 1) {
                this.selectList(lst);
                if (this.caret
                  && !apf.isChildOf(this.xmlRoot, this.caret)) {
                    this.setCaret(nextNode || this.selected);
                }
                return;
            }
            else if (lst.length) {
                //this.clearSelection(true); //@todo noEvents here??
                nextNode = lst[0];
            }
        }

        if (!nextNode) {
            if (this.selected
              && !apf.isChildOf(this.xmlRoot, this.selected)) {
                nextNode = this.getFirstTraverseNode();
            }
            else if (this.selected && this.caret
              && !apf.isChildOf(this.xmlRoot, this.caret)) {
                this.setCaret(this.selected);
            }
            else if (!this.selected) {
                nextNode = this.xmlRoot
                    ? this.getFirstTraverseNode()
                    : null;
            }
            else {
                return; //Nothing to do
            }
        }

        if (nextNode) {
            if (this.autoselect) {
                this.select(nextNode);
            }
            else {
                this.clearSelection();
                this.setCaret(nextNode);
            }
        }
        else
            this.clearSelection();

        //if(action == "synchronize" && this.autoselect) this.reselect();
    };

    /**
     * @attribute {Boolean} [multiselect]   Sets or gets whether the user may select multiple items. Default is `true, but `false` for dropdown. 
     */
    /**
     * @attribute {Boolean} [autoselect]    Sets or gets whether a selection is made after data is loaded. Default is `true`, but `false` for dropdown. When the string 'all' is set, all {@link term.datanode data nodes} are selected.
     */
    /**
     *  @attribute {Boolean} [selectable]    Sets or gets whether the {@link term.datanode data nodes} of this element can be selected. Default is `true`.
     */
    /**
     *  @attribute {Boolean} [ctrlselect]    Sets or gets whether a selection is made as if the user is holding the [[keys: Ctrl]] key. When set to `true` each mouse selection will add to the current selection. Selecting an already selected element will deselect it.
     */
    /**
     *  @attribute {Boolean} [allowdeselect] Sets or gets whether the user can remove the selection of this element. When set to `true` it is possible for this element to have no selected {@link term.datanode data node}.
     */
    /**
     *  @attribute {Boolean} [reselectable]  Sets or gets whether selected nodes can be selected again, and the selection events are called again. Default is `false`. When set to `false` a selected {@link term.datanode data node} cannot be selected again.
     */
    /**
     *  @attribute {String}  [default]      Sets or gets the value that this component has when no selection is made.
     */
    /**
     *  @attribute {String}  [eachvalue]     Sets or gets the {@link term.expression expression} that determines the value for each {@link term.datanode data nodes} in the dataset of the element.
     * 
     */
    this.selectable = true;
    if (typeof this.ctrlselect == "undefined")
        this.ctrlselect = false;
    if (typeof this.multiselect == "undefined")
        this.multiselect = true;
    if (typeof this.autoselect == "undefined")
        this.autoselect = true;
    if (typeof this.delayedselect == "undefined")
        this.delayedselect = true;
    if (typeof this.allowdeselect == "undefined")
        this.allowdeselect = true;
    this.reselectable = false;

    this.$booleanProperties["selectable"] = true;
    //this.$booleanProperties["ctrlselect"] = true;
    this.$booleanProperties["multiselect"] = true;
    this.$booleanProperties["autoselect"] = true;
    this.$booleanProperties["delayedselect"] = true;
    this.$booleanProperties["allowdeselect"] = true;
    this.$booleanProperties["reselectable"] = true;

    this.$supportedProperties.push("selectable", "ctrlselect", "multiselect",
        "autoselect", "delayedselect", "allowdeselect", "reselectable", 
        "selection", "selected", "default", "value", "caret");

    /**
     * @attribute {String} [value]  Sets or gets the value of the element that is selected.
     *
     */
    //@todo add check here
    this.$propHandlers["value"] = function(value) {
        if (this.$lastValue == value) {
            delete this.$lastValue;
            return;
        }

        if (!this.$attrBindings["eachvalue"] && !this.$amlLoaded
          && this.getAttribute("eachvalue")) {
            var _self = this;
            return apf.queue.add("value" + this.$uniqueId, function(){
                _self.$propHandlers["value"].call(_self, value);
            });
        }
        
        

        if (value || value === 0 || this["default"])
            this.select(String(value) || this["default"]);
        else
            this.clearSelection();
    }
    
    this.$propHandlers["default"] = function(value, prop) {
        if (!this.value || !this.$amlLoaded && !(this.getAttribute("value") 
          || this.getAttribute("selected") || this.getAttribute("selection"))) {
            this.$propHandlers["value"].call(this, "");
        }
    }
    
    /**
     * @attribute {String} [value]   Sets or gets the caret value of the element.
     */
    //@todo fill this in
    this.$propHandlers["caret"] = function(value, prop) {
        if (value)
            this.setCaret(value);
    }
    
    
    
    //@todo optimize this thing. Also implement virtual dataset support.
    /**
     * @attribute {String} [selection]  Sets or gets the {@link term.expression expression} that determines the selection for this element. A reference to an XML nodelist can be passed as well.
     *
     */
    this.$propHandlers["selection"] = 
    
    /**
     * @attribute {String} [selected]   Sets or gets the {@link term.expression expression} that determines the selected node for this element. A reference to an XML element can be passed as well.
     * 
     */
    this.$propHandlers["selected"] = function(value, prop) {
        if (!value) value = this[prop] = null;

        if (prop == "selected" && typeof value != "string") { // && value == this.selected
            if (value && value.nodeType != 1)
                value = value.nodeValue;
            else
            //this.selected = null; //I don't remember why this is here. It removes the selected property without setting it again. (dropdown test)
                return;
        }
        
        

        if (this.$isSelecting) {
            this.selection = this.$valueList;
            return false;
        }

        var nodes, bindSet, getValue, i, j, c, d;
        //Update the selection
        if (prop == "selection") {
            if (typeof value == "object" && value == this.$valueList) {
                var pNode;
                //We're using an external model. Need to update bound nodeset
                if ((c = this.$attrBindings[prop]) && c.cvalue.models) { //added check, @todo whats up with above assumption?
                    this.$isSelecting = true; //Prevent reentrance (optimization)
    
                    bindSet = this.$attrBindings["eachvalue"] 
                        && "eachvalue" || this.$bindings["value"]
                        && "value" || this.$hasBindRule("caption") && "caption";
                    
                    if (!bindSet)
                        throw new Error("Missing bind rule set: eachvalue, value or caption");//@todo apf3.0 make this into a proper error
                    
                    //@todo this may be optimized by keeping a copy of the selection
                    var selNodes = this.$getDataNode(prop, this.xmlRoot);
                    nodes = value;
                    getValue = (d = this.$attrBindings["selection-unique"]) && d.cvalue;
                    
                    if (selNodes.length) {
                        pNode = selNodes[0].parentNode;
                    }
                    else {
                        var model, path;
                        if (c.cvalue.xpaths[0] == "#" || c.cvalue.xpaths[1] == "#") {
                            var m = (c.cvalue3 || (c.cvalue3 = apf.lm.compile(c.value, {
                                xpathmode: 5
                            })))(this.xmlRoot);
                            
                            model = m.model && m.model.$isModel && m.model;
                            if (model)
                                path = m.xpath;
                            else if (m.model) {
                                model = apf.xmldb.findModel(m.model);
                                path = apf.xmlToXpath(m.model, model.data) + (m.xpath ? "/" + m.xpath : ""); //@todo make this better
                            }
                            else {
                                //No selection - nothing to do
                            }
                        }
                        else {
                            
                            model = apf.nameserver.get("model", c.cvalue.xpaths[0]);
                            
                            path = c.cvalue.xpaths[1];
                        }

                        if (!model || !model.data) {
                            this.$isSelecting = false;
                            return false;
                        }
                        
                        pNode = model.queryNode(path.replace(/\/[^\/]+$|^[^\/]*$/, "") || ".");

                        if (!pNode)
                            throw new Error("Missing parent node"); //@todo apf3.0 make this into a proper error
                    }
                    
                    //Nodes removed
                    remove_loop:
                    for (i = 0; i < selNodes.length; i++) {
                        //Value is either determined by special property or in the 
                        //same way as the value for the bound node.
                        value = getValue 
                          ? getValue(selNodes[i]) 
                          : this.$applyBindRule(bindSet, selNodes[i]);
    
                        //Compare the value with the traverse nodes
                        for (j = 0; j < nodes.length; j++) {
                            if (this.$applyBindRule(bindSet, nodes[j]) == value) //@todo this could be cached
                                continue remove_loop;
                        }
                        
                        //remove node
                        apf.xmldb.removeNode(selNodes[i]);
                    }
                    
                    //Nodes added
                    add_loop:
                    for (i = 0; i < nodes.length; i++) {
                        //Value is either determined by special property or in the 
                        //same way as the value for the bound node.
                        value = this.$applyBindRule(bindSet, nodes[i]);
    
                        //Compare the value with the traverse nodes
                        for (j = 0; j < selNodes.length; j++) {
                            if (getValue 
                              ? getValue(selNodes[j]) 
                              : this.$applyBindRule(bindSet, selNodes[j]) == value) //@todo this could be cached
                                continue add_loop;
                        }
                        
                        //add node
                        var node = this.$attrBindings["selection-constructor"] 
                          && this.$getDataNode("selection-constructor", nodes[i])
                          || apf.getCleanCopy(nodes[i]);
                        apf.xmldb.appendChild(pNode, node);
                    }
                    
                    //@todo above changes should be via the actiontracker
                    this.$isSelecting = false;
                }
                
                return;
            }
            this.selection = this.$valueList;
        }
        else {
            this.selected = null;
        }
        
        if (!this.xmlRoot) {
            if (!this.$buffered) {
                var f;
                this.addEventListener("afterload", f = function(){
                    this.removeEventListener("afterload", f);
                    this.$propHandlers["selected"].call(this, value, prop);
                    delete this.$buffered;
                });
                this.$buffered = true;
            }
            this[prop] = null;
            return false;
        }

        if (!value || typeof value != "object") {
            //this[prop] = null;

            if (this.$attrBindings[prop]) {
                //Execute the selection query
                nodes = this.$getDataNode(prop, this.xmlRoot);
                if (nodes && (nodes.length || nodes.nodeType == 1)) {
                    this.setProperty("selection", nodes);
                    return;
                }
                
                if (!nodes || nodes.length === 0)
                    return;
                
                //Current model, it's an init selection, we'll clear the bind
                /*if (typeof value == "string" 
                  && !this.$attrBindings[prop].cvalue.xpaths[0]) {
                    this.$removeAttrBind(prop);
                }*/
            }
            
            if (!value) {
                this.clearSelection();
            }
            else {
                this.select(value);
            }

            return false; //Disable signalling the listeners to this property
        }
        else if (typeof value.length == "number") {
            nodes = value;
            if (!nodes.length) {
                this.selected = null;
                if (this.$valueList.length) { //dont clear selection when no selection exists (at prop init)
                    this.clearSelection();
                    return false; //Disable signalling the listeners to this property
                }
                else return;
            }
            
            //For when nodes are traverse nodes of this element
            if (this.isTraverseNode(nodes[0]) 
              && apf.isChildOf(this.xmlRoot, nodes[0])) {
                if (!this.multiselect) {
                    this.select(nodes[0]);
                }
                else {
                    //this[prop] = null; //??
                    this.selectList(nodes);
                }
                return false; //Disable signalling the listeners to this property
            }
            
            //if external model defined, loop through items and find mate by value
            if (this.$attrBindings[prop]) { //Can assume an external model is in place
                bindSet = this.$attrBindings["eachvalue"] 
                    && "eachvalue" || this.$bindings["value"]
                    && "value" || this.$hasBindRule("caption") && "caption";
                
                if (!bindSet)
                    throw new Error("Missing bind rule set: eachvalue, value or caption");//@todo apf3.0 make this into a proper error
                
                var tNodes = !this.each 
                    ? this.getTraverseNodes()
                    : this.xmlRoot.selectNodes("//" + this.each.split("|").join("|//"));
                
                getValue = (c = this.$attrBindings["selection-unique"]) && c.cvalue;
                var selList = [];
                for (i = 0; i < nodes.length; i++) {
                    //Value is either determined by special property or in the 
                    //same way as the value for the bound node.
                    value = getValue 
                        ? getValue(nodes[i]) 
                        : this.$applyBindRule(bindSet, nodes[i]);

                    //Compare the value with the traverse nodes
                    for (j = 0; j < tNodes.length; j++) {
                        if (this.$applyBindRule(bindSet, tNodes[j]) == value) //@todo this could be cached
                            selList.push(tNodes[j]);
                    }
                }
                
                //this[prop] = null; //???
                this.selectList(selList, true); //@todo noEvent to distinguish between user actions and not user actions... need to rethink this
                return false;
            }
            
            throw new Error("Show me which case this is");
        }
        else if (this.$valueList.indexOf(value) == -1) {
            //this.selected = null;
            this.select(value);
        }
    };
    
    
    
    this.$propHandlers["allowdeselect"] = function(value) {
        if (value) {
            var _self = this;
            this.$container.onmousedown = function(e) {
                if (!e)
                    e = event;
                if (e.ctrlKey || e.shiftKey)
                    return;

                var srcElement = e.srcElement || e.target;
                if (_self.allowdeselect && (srcElement == this
                  || srcElement.getAttribute(apf.xmldb.htmlIdTag)))
                    _self.clearSelection(); //hacky
            }
        }
        else {
            this.$container.onmousedown = null;
        }
    };

    this.$propHandlers["ctrlselect"] = function(value) {
        if (value != "enter")
            this.ctrlselect = apf.isTrue(value);
    }

    function fAutoselect(){
        this.selectAll();
    }
    
    this.$propHandlers["autoselect"] = function(value) {
        if (value == "all" && this.multiselect)
            this.addEventListener("afterload", fAutoselect);
        else
            this.removeEventListener("afterload", fAutoselect);
    };

    this.$propHandlers["multiselect"] = function(value) {
        if (!value && this.$valueList.length > 1)
            this.select(this.selected);

        //if (value)
            //this.bufferselect = false; //@todo doesn't return to original value
    };

    // Select Bind class
    
    this.addEventListener("beforeselect", function(e) {
        if (this.$bindings.selectable && !this.$getDataNode("selectable", e.selected))
            return false;
    }, true);
    

    
    this.addEventListener("afterselect", function (e) {
        
        var combinedvalue = null;

        
        //@todo refactor below
        /*if (this.caret == this.selected || e.list && e.list.length > 1 && hasConnections) {
            //Multiselect databinding handling... [experimental]
            if (e.list && e.list.length > 1 && this.$getConnections().length) { //@todo this no work no more apf3.0
                var oEl = this.xmlRoot.ownerDocument.createElement(this.selected.tagName);
                var attr = {};

                //Fill basic nodes
                var nodes = e.list[0].attributes;
                for (var j = 0; j < nodes.length; j++)
                    attr[nodes[j].nodeName] = nodes[j].nodeValue;

                //Remove nodes
                for (var prop, i = 1; i < e.list.length; i++) {
                    for (prop in attr) {
                        if (typeof attr[prop] != "string") continue;

                        if (!e.list[i].getAttributeNode(prop))
                            attr[prop] = undefined;
                        else if (e.list[i].getAttribute(prop) != attr[prop])
                            attr[prop] = "";
                    }
                }

                //Set attributes
                for (prop in attr) {
                    if (typeof attr[prop] != "string") continue;
                    oEl.setAttribute(prop, attr[prop]);
                }

                //missing is childnodes... will implement later when needed...

                oEl.setAttribute(apf.xmldb.xmlIdTag, this.$uniqueId);
                apf.MultiSelectServer.register(oEl.getAttribute(apf.xmldb.xmlIdTag),
                    oEl, e.list, this);
                apf.xmldb.addNodeListener(oEl, apf.MultiSelectServer);

                combinedvalue = oEl;
            }
        }*/
        
        
        //Set caret property
        this.setProperty("caret", e.caret);

        //Set selection length
        if (this.sellength != e.selection.length)
            this.setProperty("sellength", e.selection.length);
        
        //Set selection property
        delete this.selection;
        this.setProperty("selection", e.selection);
        if (!e.selection.length) {
            //Set selected property
            this.setProperty("selected", e.selected);
            
            //Set value property
            if (this.value)
                this.setProperty("value", "");
        }
        else {
            //Set selected property
            this.$chained = true;
            if (!e.force && (!this.dataParent || !this.dataParent.parent 
              || !this.dataParent.parent.$chained)) {
                var _self = this;
                $setTimeout(function(){
                    
                    if (_self.selected == e.selected) {
                        delete _self.selected;
                        _self.setProperty("selected", combinedvalue || e.selected);
                    }
                    
                    delete _self.$chained;
                }, 10);
            }
            else {
                
                this.setProperty("selected", combinedvalue || e.selected);
                
                delete this.$chained;
            }
            
            //Set value property
            var valueRule = this.$attrBindings["eachvalue"] && "eachvalue" 
                || this.$bindings["value"] && "value" 
                || this.$hasBindRule("caption") && "caption";

            if (valueRule) {
                //@todo this will call the handler again - should be optimized

                this.$lastValue = this.$applyBindRule(valueRule, e.selected)
                //this.$attrBindings["value"] && 
                if (this.$lastValue != 
                  (valueRule != "value" && (this.xmlRoot
                  && this.$applyBindRule("value", this.xmlRoot, null, true)) 
                  || this.value)) {
                    if (valueRule == "eachvalue" || this.xmlRoot != this)
                        this.change(this.$lastValue);
                    else
                        this.setProperty("value", this.$lastValue);
                }
                /*else {
                    this.setProperty("value", this.$lastValue);
                }*/
                delete this.$lastValue;
            }
        }
        
        

        
    }, true);
    
    
    

}).call(apf.MultiSelect.prototype = new apf.MultiselectBinding());



//@todo refactor below
/*
 * @private
 */
/*
apf.MultiSelectServer = {
    objects: {},

    register: function(xmlId, xmlNode, selList, jNode) {
        if (!this.$uniqueId)
            this.$uniqueId = apf.all.push(this) - 1;

        this.objects[xmlId] = {
            xml: xmlNode,
            list: selList,
            jNode: jNode
        };
    },

    $xmlUpdate: function(action, xmlNode, listenNode, UndoObj) {
        if (action != "attribute") return;

        var data = this.objects[xmlNode.getAttribute(apf.xmldb.xmlIdTag)];
        if (!data) return;

        var nodes = xmlNode.attributes;

        for (var j = 0; j < data.list.length; j++) {
            //data[j].setAttribute(UndoObj.name, xmlNode.getAttribute(UndoObj.name));
            apf.xmldb.setAttribute(data.list[j], UndoObj.name,
                xmlNode.getAttribute(UndoObj.name));
        }

        //apf.xmldb.synchronize();
    }
};
*/








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
    
    this.$init(function(){
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
apf.DataAction = function(){
    this.$regbase = this.$regbase | apf.__DATAACTION__;

    // *** Public Methods *** //

    /**
     * Gets the ActionTracker this element communicates with.
     *
     * @return {apf.actiontracker}
     * @see apf.smartbinding
     */
    this.getActionTracker = function(ignoreMe) {
        if (!apf.AmlNode)
            return apf.window.$at;

        var pNode = this, tracker = ignoreMe ? null : this.$at;
        if (!tracker && this.dataParent && this.dataParent.parent)
            tracker = this.dataParent.parent.$at; //@todo apf3.0 change this to be recursive??

        while (!tracker) {
            if (!pNode.parentNode && !pNode.$parentNode) {
                var model;
                return (model = this.getModel && this.getModel(true)) && model.$at || apf.window.$at;
            }

            tracker = (pNode = pNode.parentNode || pNode.$parentNode).$at;
        }
        return tracker;
    };

    

    this.$actionsLog = {};
    this.$actions = false;

    /**
     * @event locksuccess   Fires when a lock request succeeds
     * @bubbles 
     * @param {Object} e The standard event object, with the following properties:
     *                   - state ([[Number]]): The return code of the lock request
     *
     */
    /**
     * @event lockfailed    Fires when a lock request failes
     * @bubbles 
     * @param {Object} e The standard event object, with the following properties:
     *                   - state ([[Number]]): The return code of the lock request
     *
     */
    /**
     * @event unlocksuccess Fires when an unlock request succeeds
     * @bubbles 
     * @param {Object} e The standard event object, with the following properties:
     *                   - state ([[Number]]): The return code of the unlock request
     *
     */
    /**
     * @event unlockfailed  Fires when an unlock request fails
     * @bubbles 
     * @param {Object} e The standard event object, with the following properties:
     *                   - state ([[Number]]): The return code of the unlock request
     *
     */
    /*
     *  Starts the specified action, does optional locking and can be offline aware
     *  - or for optimistic locking it will record the timestamp (a setting
     *    <a:appsettings locking="optimistic"/>)
     *  - During offline work, optimistic locks will be handled by taking the
     *    timestamp of going offline
     *  - This method is always optional! The server should not expect locking to exist.
     *
     */
    this.$startAction = function(name, xmlContext, fRollback) {
        if (this.disabled || this.liveedit && name != "edit")
            return false;

        var actionRule = this.$actions && this.$actions.getRule(name, xmlContext);
        if (!actionRule && apf.config.autoDisableActions && this.$actions) {
            

            return false;
        }

        var bHasOffline = typeof apf.offline != "undefined";
        

        if (this.dispatchEvent(name + "start", {
            xmlContext: xmlContext
        }) === false)
            return false;

        

        this.$actionsLog[name] = xmlContext;

        return true;
    };

    
    // @todo think about if this is only for rdb
    this.addEventListener("xmlupdate", function(e) {
        if (apf.xmldb.disableRDB != 2)
            return;

        for (var name in this.$actionsLog) {
            if (apf.isChildOf(this.$actionsLog[name], e.xmlNode, true)) {
                //this.$stopAction(name, true);
                this.$actionsLog[name].rollback.call(this, this.$actionsLog[name].xmlContext);
            }
        }
    });
    

    this.$stopAction = function(name, isCancelled, curLock) {
        delete this.$actionsLog[name];

        
    };

    /*
     * Executes an action using action rules set in the {@link apf.actions actions element}.
     *
     * @param {String}      atAction      The name of the action to be performed by the [[ActionTracker]]. Possible values include:
     *                                 - `"setTextNode"`:   Sets the first text node of an XML element. For more information, see {@link core.xmldb.method.setTextNode}
     *                                 - `"setAttribute"`:  Sets the attribute of an XML element. For more information, see {@link core.xmldb.method.setAttribute}
     *                                 - `"removeAttribute"`:   Removes an attribute from an XML element. For more information, see {@link core.xmldb.method.removeAttribute}
     *                                 - `"setAttributes"`:   Sets multiple attribute on an XML element. The arguments are in the form of `xmlNode, Array`
     *                                 - `"replaceNode"`:   Replaces an XML child with another one. For more information, see {@link core.xmldb.method.replaceNode}
     *                                 - `"addChildNode"`:   Adds a new XML node to a parent node. For more information, see {@link core.xmldb.method.addChildNode}
     *                                 - `"appendChild"`:   Appends an XML node to a parent node. For more information, see {@link core.xmldb.method.appendChild}
     *                                 - `"moveNode"` :  Moves an XML node from one parent to another. For more information, see {@link core.xmldb.method.moveNode}
     *                                 - `"removeNode"`:   Removes a node from it's parent. For more information, see {@link core.xmldb.method.removeNode}
     *                                 - `" removeNodeList"`:    Removes multiple nodes from their parent. For more information, see {@link core.xmldb.method.removeNodeList}
     *                                 - `"setValueByXpath"`:   Sets the nodeValue of an XML node which is selected
     *                                                           by an xpath statement. The arguments are in the form of `xmlNode, xpath, value`
     *                                 - `"multicall"`:          Calls multiple of the above actions. The argument`s are an array
     *                                                           of argument arrays for these actions each with a func`
     *                                                           property, which is the name of the action.
     * @param {Array}       args          the arguments to the function specified
     *                                    in <code>atAction</code>.
     * @param {String}      action        the name of the action rule defined in
     *                                    actions for this element.
     * @param {XMLElement}  xmlNode       the context for the action rules.
     * @param {Boolean}     [noevent]     whether or not to call events.
     * @param {XMLElement}  [contextNode] the context node for action processing
     *                                    (such as RPC calls). Usually the same
     *                                    as <code>xmlNode</code>
     * @return {Boolean} specifies success or failure
     * @see apf.smartbinding
     */
    this.$executeAction = function(atAction, args, action, xmlNode, noevent, contextNode, multiple) {
        

        

        //Get Rules from Array
        var rule = this.$actions && this.$actions.getRule(action, xmlNode);
        if (!rule && this.$actions && apf.config.autoDisableActions
          && "action|change".indexOf(action) == -1) {
            apf.console.warn("Could not execute action '" + action + "'. \
              No valid action rule was found and auto-disable-actions is enabled");

            return false;
        }

        

        var newMultiple;
        if (multiple) {
            newMultiple = [];
            for (var k = multiple.length - 1; k >= 0; k--) {
                newMultiple.unshift({
                    xmlActionNode: rule, // && rule[4],
                    amlNode: this,
                    selNode: multiple[k],
                    xmlNode: multiple[k]
                })
            }
        }

        //@todo apf3.0 Shouldn't the contextNode be made by the match
        var ev = new apf.AmlEvent("before" + action.toLowerCase(), {
            action: atAction,
            args: args,
            xmlActionNode: rule,
            amlNode: this,
            selNode: contextNode,
            multiple: newMultiple || false
            
        });

        //Call Event and cancel if it returns false
        if (!noevent) {
            //Allow the action and arguments to be changed by the event
            if (this.dispatchEvent(ev.name, null, ev) === false)
                return false;

            delete ev.currentTarget;
        }

        //Call ActionTracker and return ID of Action in Tracker
        var at = this.getActionTracker();
        if (!at)// This only happens at destruction of apf
            return UndoObj;

        var UndoObj = at.execute(ev);
        ev.xmlNode = UndoObj.xmlNode;
        ev.undoObj = UndoObj;

        //Call After Event
        if (!noevent) { //@todo noevent is not implemented for before.. ???
            ev.name = "after" + action.toLowerCase();
            ev.cancelBubble = false;
            delete ev.returnValue;
            delete ev.currentTarget;
            this.dispatchEvent(ev.name, null, ev);
        }

        return UndoObj;
    };

    /*
     * Executes an action based on the set name and the new value
     * @param {String}      atName   the name of the action rule defined in actions for this element.
     * @param {String}      setName  the name of the binding rule defined in bindings for this element.
     * @param {XMLElement}  xmlNode  the xml element to which the rules are applied
     * @param {String}      value    the new value of the node
     */
    this.$executeSingleValue = function(atName, setName, xmlNode, value, getArgList) {
        var xpath, args, rule = this.$getBindRule(setName, xmlNode);

        //recompile bindrule to create nodes
        if (!rule) {
            
                return false;
        }

        var compiled;
        ["valuematch", "match", "value"].each(function(type) {
            if (!rule[type] || compiled)
                return;

            compiled = rule["c" + type]; //cvaluematch || (rule.value ? rule.cvalue : rule.cmatch);
            if (!compiled)
                compiled = rule.compile(type);

            if (compiled.type != 3)
                compiled = null;
        });

        

        var atAction, model, node,
            sel = compiled.xpaths, //get first xpath
            shouldLoad = false;

        if (sel[0] == "#" || sel[1] == "#") {
            var m = (rule.cvalue3 || (rule.cvalue3 = apf.lm.compile(rule.value, {
                xpathmode: 5
            })))(xmlNode, apf.nameserver.lookup["all"]);

            model = m.model && m.model.$isModel && m.model;
            if (model) {
                node = model.queryNode(m.xpath);
                xmlNode = model.data;
            }
            else if (m.model) {
                model = apf.xmldb.findModel(m.model);
                node = m.model.selectSingleNode(m.xpath);
                xmlNode = m.model;
            }
            else {

            }

            sel[1] = m.xpath;
        }
        else {
            
            model = sel[0] && apf.nameserver.get("model", sel[0]) || this.$model,
            node = model
                ? model.queryNode(sel[1])
                : (xmlNode || this.xmlRoot).selectSingleNode(sel[1]);
            if (model && !xmlNode)
                xmlNode = model.data; //@experimental, after changing this, please run test/test_rename_edge.html
            
        }

        if (node) {
            if (apf.queryValue(node) == value) return; // Do nothing if value is unchanged

            atAction = (node.nodeType == 1 || node.nodeType == 3
                || node.nodeType == 4) ? "setTextNode" : "setAttribute";
            args = (node.nodeType == 1)
                ? [node, value]
                : (node.nodeType == 3 || node.nodeType == 4
                    ? [node.parentNode, value]
                    : [node.ownerElement || node.selectSingleNode(".."), node.nodeName, value]);
        }
        else {
            atAction = "setValueByXpath";
            xpath = sel[1];
            
            if (!this.$createModel || this.getModel() && !this.getModel().$createModel) {
                throw new Error("Model data does not exist, and I am not "
                    + "allowed to create the element for xpath '" 
                    + xpath + "' and element " + this.serialize(true));
            }

            if (!xmlNode) {
                //Assuming this component is connnected to a model
                if (!model)
                    model = this.getModel();
                if (model) {
                    if (!model.data)
                        model.load("<data />");

                    xpath = (model.getXpathByAmlNode(this) || ".")
                        + (xpath && xpath != "." ? "/" + xpath : "");
                    xmlNode = model.data;
                }
                else {
                    if (!this.dataParent)
                        return false;

                    xmlNode = this.dataParent.parent.selected || this.dataParent.parent.xmlRoot;
                    if (!xmlNode)
                        return false;

                    xpath = (this.dataParent.xpath || ".")
                        + (xpath && xpath != "." ? "/" + xpath : "");
                    shouldLoad = true;
                }
            }

            args = [xmlNode, value, xpath];
        }

        if (getArgList) {
            return {
                action: atAction,
                args: args
            };
        }

        //Use Action Tracker
        var result = this.$executeAction(atAction, args, atName, xmlNode);

        if (shouldLoad)
            this.load(xmlNode.selectSingleNode(xpath));

        return result;
    };

    /**
     * Changes the value of this element.
     * @action
     * @param  {String} [string] The new value of this element.
     * 
     */
    this.change = function(value, force){ // @todo apf3.0 maybe not for multiselect?? - why is clearError handling not in setProperty for value
        
        if (this.errBox && this.errBox.visible && this.isValid && this.isValid())
            this.clearError();
        
        //Not databound
        if (!this.xmlRoot && !this.$createModel || !(this.$mainBind == "value"
          && this.hasFeature(apf.__MULTISELECT__)
            ? this.$attrBindings["value"]
            : this.$hasBindRule(this.$mainBind))) {
        
            if (!force && value === this.value
              || this.dispatchEvent("beforechange", {value : value}) === false)
                return false;

            //@todo in theory one could support actions
            //@todo disabled below, because it gives unexpected behaviour when
            //form elements are used for layout and other UI alterations
            /*this.getActionTracker().execute({
                action: "setProperty",
                args: [this, "value", value, false, true],
                amlNode: this
            });*/
            this.setProperty("value", value);

            return this.dispatchEvent("afterchange", {value : value});
        
        }

        var valueRule = this.$attrBindings["eachvalue"] && "eachvalue"
            || this.$bindings["value"] && "value"
            || this.$hasBindRule("caption") && "caption";

        if (value === (valueRule != "value" && (this.xmlRoot
          && this.$applyBindRule("value", this.xmlRoot, null, true))
          || this.value))
            return false;

        this.$executeSingleValue("change", this.$mainBind, this.xmlRoot, value);
        
    };

    this.$booleanProperties["render-root"] = true;
    this.$supportedProperties.push("create-model", "actions");

    /**
     * @attribute {Boolean} create-model Sets or gets whether the model this element connects
     * to is extended when the data pointed to does not exist. Defaults to true.
     * 
     * #### Example
     *
     * In this example, a model is extended when the user enters information in
     * the form elements. Because no model is specified for the form elements,
     * the first available model is chosen. At the start, it doesn't have any
     * data; this changes when (for instance) the name is filled in. A root node
     * is created, and under that a 'name' element with a textnode containing
     * the entered text.
     * 
     * ```xml
     *  <a:bar>
     *      <a:label>Name</a:label>
     *      <a:textbox value="[name]" required="true" />
     *
     *      <a:label>Address</a:label>
     *      <a:textarea value="[address]" />
     *
     *      <a:label>Country</a:label>
     *      <a:dropdown
     *        value = "[mdlForm::country]"
     *        model = "countries.xml"
     *        each = "[country]"
     *        caption = "[@name]" />
     *      <a:button action="submit">Submit</a:button>
     *  </a:bar>
     * ```
     */
    this.$propHandlers["create-model"] = function(value) {
        this.$createModel = value;
    };

    this.addEventListener("DOMNodeInsertedIntoDocument", function(e) {
        if (typeof this["create-model"] == "undefined"
          && !this.$setInheritedAttribute("create-model")) {
            this.$createModel = true;
        }
    });
};

apf.config.$inheritProperties["create-model"] = 1;







apf.__CACHE__ = 1 << 2;



/**
 * All elements inheriting from this {@link term.baseclass baseclass} have caching features. It takes care of
 * storing, retrieving, and updating rendered data (in HTML form)
 * to overcome the waiting time while rendering the contents every time the
 * data is loaded.
 *
 * @class apf.Cache
 * @baseclass
 * @author      Ruben Daniels (ruben AT ajax DOT org)
 * @version     %I%, %G%
 * @since       0.4
 */
apf.Cache = function(){
    /* ********************************************************************
                                        PROPERTIES
    *********************************************************************/
    this.cache = {};
    this.$subTreeCacheContext = null;

    this.caching = true;
    this.$regbase = this.$regbase | apf.__CACHE__;

    /* ********************************************************************
                                        PUBLIC METHODS
    *********************************************************************/

    this.addEventListener("$load", function(e) {
        if (!this.caching || e.forceNoCache)
            return;

        // retrieve the cacheId
        if (!this.cacheId) {
            this.cacheId = this.$generateCacheId && this.$generateCacheId(e.xmlNode) 
                || e.xmlNode.getAttribute(apf.xmldb.xmlIdTag) 
                || apf.xmldb.nodeConnect(apf.xmldb.getXmlDocId(e.xmlNode), e.xmlNode);//e.xmlNode
        }

        // Retrieve cached version of document if available
        var fromCache = getCache.call(this, this.cacheId, e.xmlNode);
        if (fromCache) {
            if (fromCache == -1 || !this.getTraverseNodes)
                return (e.returnValue = false);

            var nodes = this.getTraverseNodes();

            //Information needs to be passed to the followers... even when cached...
            if (nodes.length) {
                if (this["default"])
                    this.select(this["default"]);
                else if (this.autoselect)
                    this.select(nodes[0], null, null, null, true);
            }
            else if (this.clearSelection)
                this.clearSelection(); //@todo apf3.0 was setProperty("selected", null

            if (!nodes.length) {
                // Remove message notifying user the control is without data
                this.$removeClearMessage();
                this.$setClearMessage(this["empty-message"], "empty");
            }
                
            
            //@todo move this to getCache??
            if (nodes.length != this.length)
                this.setProperty("length", nodes.length);
            

            return false;
        }
    });
    
    this.addEventListener("$clear", function(){
        if (!this.caching)
            return;

        /*
            Check if we borrowed an HTMLElement
            We should return it where it came from

            note: There is a potential that we can't find the exact location
            to put it back. We should then look at it's position in the xml.
            (but since I'm lazy it's not doing this right now)
            There might also be problems when removing the xmlroot
        */
        if (this.hasFeature(apf.__MULTISELECT__)
          && this.$subTreeCacheContext && this.$subTreeCacheContext.oHtml) {
            if (this.renderRoot) {
                this.$subTreeCacheContext.parentNode.insertBefore(
                    this.$subTreeCacheContext.oHtml, this.$subTreeCacheContext.beforeNode);
            }
            else {
                var container = this.$subTreeCacheContext.container || this.$container;
                while (container.childNodes.length)
                    this.$subTreeCacheContext.oHtml.appendChild(container.childNodes[0]);
            }

            this.documentId = this.xmlRoot = this.cacheId = this.$subTreeCacheContext = null;
        }
        else {
            /* If the current item was loaded whilst offline, we won't cache
             * anything
             */
            if (this.$loadedWhenOffline) {
                this.$loadedWhenOffline = false;
            }
            else {
                // Here we cache the current part
                var fragment = this.$getCurrentFragment();
                if (!fragment) return;//this.$setClearMessage(this["empty-message"]);

                fragment.documentId = this.documentId;
                fragment.xmlRoot = this.xmlRoot;
                
                if (this.cacheId || this.xmlRoot)
                    setCache.call(this, this.cacheId ||
                        this.xmlRoot.getAttribute(apf.xmldb.xmlIdTag) || "doc"
                        + this.xmlRoot.getAttribute(apf.xmldb.xmlDocTag), fragment);
            }
        }
    });

    /*
     * Checks the cache for a cached item by ID. If the ID is found, the
     * representation is loaded from cache and set active.
     *
     * @param  {String} id  The id of the cache element which is looked up.
     * @param  {Object} xmlNode
     * @return {Boolean} If `true`, the cache element was found and set active
     * @see    baseclass.databinding.method.load
     * @private
     */
    function getCache(id, xmlNode) {
        /*
            Let's check if the requested source is actually
            a sub tree of an already rendered part
        */
        
        if (xmlNode && this.hasFeature(apf.__MULTISELECT__) && this.$isTreeArch) {
            var cacheItem,
                htmlId = xmlNode.getAttribute(apf.xmldb.xmlIdTag) + "|" + this.$uniqueId,
                node = this.$pHtmlDoc.getElementById(htmlId);
            if (node) 
                cacheItem = id ? false : this.$container; //@todo what is the purpose of this statement?
            else {
                for (var prop in this.cache) {
                    if (this.cache[prop] && this.cache[prop].nodeType) {
                        node = this.cache[prop].getElementById(htmlId);
                        if (node) {
                            cacheItem = id ? prop : this.cache[prop]; //@todo what is the purpose of this statement?
                            break;
                        }
                    }
                }
            }
            
            if (cacheItem && !this.cache[id]) {
                /*
                    Ok so it is, let's borrow it for a while
                    We can't clone it, because the updates will
                    get ambiguous, so we have to put it back later
                */
                var oHtml = this.$findHtmlNode(
                    xmlNode.getAttribute(apf.xmldb.xmlIdTag) + "|" + this.$uniqueId);
                this.$subTreeCacheContext = {
                    oHtml: oHtml,
                    parentNode: oHtml.parentNode,
                    beforeNode: oHtml.nextSibling,
                    cacheItem: cacheItem
                };

                this.documentId = apf.xmldb.getXmlDocId(xmlNode);
                this.cacheId = id;
                this.xmlRoot = xmlNode;

                //Load html
                if (this.renderRoot)
                    this.$container.appendChild(oHtml);
                else {
                    while (oHtml.childNodes.length)
                        this.$container.appendChild(oHtml.childNodes[0]);
                }

                return true;
            }
        }
        

        //Checking Cache...
        if (!this.cache[id]) return false;

        //Get Fragment and clear Cache Item
        var fragment = this.cache[id];

        this.documentId = fragment.documentId;
        this.cacheId = id;
        this.xmlRoot = xmlNode;//fragment.xmlRoot;
        
        
        this.setProperty("root", this.xmlRoot);
        

        this.clearCacheItem(id);

        this.$setCurrentFragment(fragment);

        return true;
    };

    /*
     * Sets cache element and its ID.
     *
     * @param {String}           id        The id of the cache element to be stored.
     * @param {DocumentFragment} fragment  The data to be stored.
     * @private
     */
    function setCache(id, fragment) {
        if (!this.caching) return;

        this.cache[id] = fragment;
    };

    /*
     * Finds HTML presentation node in cache by ID.
     *
     * @param  {String} id  The id of the HTMLElement which is looked up.
     * @return {HTMLElement} The HTMLElement found. When no element is found, `null` is returned.
     */
    this.$findHtmlNode = function(id) {
        var node = this.$pHtmlDoc.getElementById(id);
        if (node) return node;

        for (var prop in this.cache) {
            if (this.cache[prop] && this.cache[prop].nodeType) {
                node = this.cache[prop].getElementById(id);
                if (node) return node;
            }
        }

        return null;
    };

    /**
     * Removes an item from the cache.
     *
     * @param {String}  id       The id of the HTMLElement which is looked up.
     * @param {Boolean} [remove] Specifies whether to destroy the Fragment.
     * @see baseclass.databinding.method.clear
     * @private
     */
    this.clearCacheItem = function(id, remove) {
        this.cache[id].documentId = 
        this.cache[id].cacheId = 
        this.cache[id].xmlRoot = null;

        if (remove)
            apf.destroyHtmlNode(this.cache[id]);

        this.cache[id] = null;
    };

    /*
     * Removes all items from the cache
     *
     * @see baseclass.databinding.method.clearCacheItem
     * @private
     */
    this.clearAllCache = function(){
        for (var prop in this.cache) {
            if (this.cache[prop])
                this.clearCacheItem(prop, true);
        }
    };

    /**
     * Gets the cache item by its id
     *
     * @param {String} id  The id of the HTMLElement which is looked up.
     * @see baseclass.databinding.method.clearCacheItem
     * @private
     */
    this.getCacheItem = function(id) {
        return this.cache[id];
    };

    /*
     * Checks whether a cache item exists by the specified id
     *
     * @param {String} id  the id of the cache item to check.
     * @see baseclass.databinding.method.clearCacheItem
     * @private
     */
    this.$isCached = function(id) {
        return this.cache[id] || this.cacheId == id ? true : false;
    };
    
    if (!this.$getCurrentFragment) {
        this.$getCurrentFragment = function(){
            var fragment = this.$container.ownerDocument.createDocumentFragment();
    
            while (this.$container.childNodes.length) {
                fragment.appendChild(this.$container.childNodes[0]);
            }
    
            return fragment;
        };
    
        this.$setCurrentFragment = function(fragment) {
            this.$container.appendChild(fragment);
    
            if (!apf.window.hasFocus(this) && this.blur)
                this.blur();
        };
    }
    
    /**
     * @attribute {Boolean} caching Sets or gets whether caching is enabled for this element.
     */
    this.$booleanProperties["caching"] = true;
    this.$supportedProperties.push("caching");

    this.addEventListener("DOMNodeRemovedFromDocument", function(e) {
        //Remove all cached Items
        this.clearAllCache();
    });
};

apf.GuiElement.propHandlers["caching"] = function(value) {
    if (!apf.isTrue(value)) return;
    
    if (!this.hasFeature(apf.__CACHE__))
        this.implement(apf.Cache);
};








apf.__RENAME__ = 0;







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
apf.BaseList = function(){
    this.$init(true);
    
    
    this.$dynCssClasses = [];
    
    
    this.listNodes = [];
};

(function() {
    
    this.implement(
        
        apf.Cache,
        
        
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
            //@todo undo actionRules setting
            this.removeEventListener("afterrename", $afterRenameMode);
            //@todo unimplement??
            this.$mode = 0;
        }
    };
    
    //@todo apf3.0 retest this completely
    function $afterRenameMode(){
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
        //Build Row
        this.$getNewContext("item");
        var oItem = this.$getLayoutNode("item"),
            elSelect = this.$getLayoutNode("item", "select"),
            elIcon = this.$getLayoutNode("item", "icon"),
            elImage = this.$getLayoutNode("item", "image"),
            //elCheckbox = this.$getLayoutNode("item", "checkbox"), // NOT USED
            elCaption = this.$getLayoutNode("item", "caption");

        oItem.setAttribute("id", Lid);

        elSelect.setAttribute("onmouseover",   "var o = apf.lookup(" + this.$uniqueId 
            + "); o.$setStyleClass(this, 'hover', null, true);");
        elSelect.setAttribute("onselectstart", "return false;");
        elSelect.setAttribute("style",         (elSelect.getAttribute("style") || "") 
            + ";user-select:none;-moz-user-select:none;-webkit-user-select:none;");

        if (this.hasFeature(apf.__RENAME__) || this.hasFeature(apf.__DRAGDROP__)) {
            elSelect.setAttribute("ondblclick", "var o = apf.lookup(" + this.$uniqueId + "); " +
                
                "o.stopRename();" +
                
                " o.choose()");
            elSelect.setAttribute("onmouseout", "var o = apf.lookup(" + this.$uniqueId + ");\
                  o.$setStyleClass(this, '', ['hover'], true);\
                this.hasPassedDown = false;");
            elSelect.setAttribute(this.itemSelectEvent || "onmousedown",
                'var o = apf.lookup(' + this.$uniqueId + ');\
                 var xmlNode = apf.xmldb.findXmlNode(this);\
                 var isSelected = o.isSelected(xmlNode);\
                 this.hasPassedDown = true;\
                 if (event.button == 2) \
                    o.stopRename();\
                 else if (!o.renaming && o.hasFocus() && isSelected == 1) \
                    this.dorename = true;\
                 if (event.button == 2 && isSelected)\
                    return;\
                 if (!o.hasFeature(apf.__DRAGDROP__) || !isSelected && !event.ctrlKey)\
                     o.select(this, event.ctrlKey, event.shiftKey, -1)');
            elSelect.setAttribute("onmouseup", 'if (!this.hasPassedDown) return;\
                var o = apf.lookup(' + this.$uniqueId + ');' +
                
                'if (o.hasFeature(apf.__RENAME__) && this.dorename)\
                    o.startDelayedRename(event, null, true);' +
                
                'this.dorename = false;\
                 var xmlNode = apf.xmldb.findXmlNode(this);\
                 var isSelected = o.isSelected(xmlNode);\
                 if (o.hasFeature(apf.__DRAGDROP__))\
                     o.select(this, event.ctrlKey, event.shiftKey, -1)');
        } //@todo add DRAGDROP ifdefs
        else {
            elSelect.setAttribute("onmouseout",    "apf.setStyleClass(this, '', ['hover']);");
            elSelect.setAttribute("ondblclick", 'var o = apf.lookup('
                + this.$uniqueId + '); o.choose(null, true)');
            elSelect.setAttribute(this.itemSelectEvent
                || "onmousedown", 'var o = apf.lookup(' + this.$uniqueId
                + '); o.select(this, event.ctrlKey, event.shiftKey, -1)');
        }
        
        
        
        
        if (this.$mode) {
            var elCheck = this.$getLayoutNode("item", "check");
            if (elCheck) {
                elCheck.setAttribute("onmousedown",
                    "var o = apf.lookup(" + this.$uniqueId + ");\
                    o.checkToggle(this, true);\o.$skipSelect = true;");

                if (apf.isTrue(this.$applyBindRule("checked", xmlNode))) {
                    this.$checkedList.push(xmlNode);
                    this.$setStyleClass(oItem, "checked");
                }
                else if (this.isChecked(xmlNode))
                    this.$setStyleClass(oItem, "checked");
            }
            else {
                
                return false;
            }
        }
        

        //Setup Nodes Identity (Look)
        if (elIcon) {
            if (elIcon.nodeType == 1) {
                elIcon.setAttribute("style", "background-image:url("
                    + apf.getAbsolutePath(this.iconPath, this.$applyBindRule("icon", xmlNode))
                    + ")");
            }
            else {
                elIcon.nodeValue = apf.getAbsolutePath(this.iconPath,
                    this.$applyBindRule("icon", xmlNode));
            }
        }
        else if (elImage) {
            if (elImage.nodeType == 1) {
                if ((elImage.tagName || "").toLowerCase() == "img") {
                    elImage.setAttribute("src", apf.getAbsolutePath(apf.hostPath, this.$applyBindRule("image", xmlNode)));
                }
                else {
                    elImage.setAttribute("style", "background-image:url("
                        + apf.getAbsolutePath(apf.hostPath, this.$applyBindRule("image", xmlNode))
                        + ")");
                }
            }
            else {
                if (apf.isSafariOld) { //@todo this should be changed... blrgh..
                    var p = elImage.ownerElement.parentNode,
                        img = p.appendChild(p.ownerDocument.createElement("img"));
                    img.setAttribute("src", 
                        apf.getAbsolutePath(apf.hostPath, this.$applyBindRule("image", xmlNode)));
                }
                else {
                    elImage.nodeValue = 
                        apf.getAbsolutePath(apf.hostPath, this.$applyBindRule("image", xmlNode));
                }
            }
        }

        if (elCaption) {
            
            {
                apf.setNodeValue(elCaption,
                    this.$applyBindRule("caption", xmlNode));
            }
        }
        oItem.setAttribute("title", this.$applyBindRule("tooltip", xmlNode) || "");

        
        var cssClass = this.$applyBindRule("css", xmlNode);
        if (cssClass) {
            this.$setStyleClass(oItem, cssClass);
            if (cssClass)
                this.$dynCssClasses.push(cssClass);
        }
        

        if (this.$addModifier && 
          this.$addModifier(xmlNode, oItem, htmlParentNode, beforeNode) === false)
            return;

        if (htmlParentNode)
            apf.insertHtmlNode(oItem, htmlParentNode, beforeNode);
        else
            this.listNodes.push(oItem);
    };
    
    this.addEventListener("$skinchange", function(e) {
        if (this.more)
            delete this.moreItem;
    });

    this.$fill = function(){
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
    
            var undoLastAction = function(){
                this.getActionTracker().undo(this.autoselect ? 2 : 1);
    
                this.removeEventListener("stoprename", undoLastAction);
                this.removeEventListener("beforerename", removeSetRenameEvent);
                this.removeEventListener("afterrename",  afterRename);
            }
            var afterRename = function(){
                //this.select(addedNode);
                this.removeEventListener("afterrename",  afterRename);
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
                        
                        this.addEventListener("stoprename",   undoLastAction);
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
    
            this.addEventListener("stoprename",   undoLastAction);
            this.addEventListener("beforerename", removeSetRenameEvent);
            this.addEventListener("afterrename",  afterRename);
    
            
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

(function(){
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
        this.oSlider.style.height = (this.sliderHeight - 1)     + "px";
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
    this.slideUp = function(){
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
    
    // *** Private methods and event handlers *** //

    //@todo apf3.0 why is this function called 6 times on init.
    this.$setLabel = function(value) {
        
        this.oLabel.innerHTML = value || this["initial-message"] || "";
        

        this.$setStyleClass(this.$ext, value ? "" : this.$baseCSSname + "Initial",
            !value ? [] : [this.$baseCSSname + "Initial"]);
    };

    this.addEventListener("afterselect", function(e) {
        if (!e) e = event;

        this.slideUp();
        if (!this.isOpen)
            this.$setStyleClass(this.$ext, "", [this.$baseCSSname + "Over"]);
        
        this.$setLabel(e.selection.length
          ? this.$applyBindRule("caption", this.selected)
          : "");
    });
    
    function setMaxCount() {
        if (this.isOpen == 2)
            this.slideDown();
    }

    this.addEventListener("afterload", setMaxCount);
    this.addEventListener("xmlupdate", function(){
        setMaxCount.call(this);
        this.$setLabel(this.$applyBindRule("caption", this.selected));
    });
    
    // Private functions
    this.$blur = function(){
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
    
    this.$removeClearMessage = function(){
        this.$setLabel("");
    };

    this.addEventListener("popuphide", this.slideUp);
    
    // *** Keyboard Support *** //
    
    
    this.addEventListener("keydown", function(e) {
        var key = e.keyCode;
        //var ctrlKey = e.ctrlKey; << unused
        //var shiftKey = e.shiftKey;
        
        if (!this.xmlRoot) return;
        
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
    
    
    // *** Init *** //
    
    this.$draw = function(){
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
    
    this.addEventListener("DOMNodeInsertedIntoDocument", function(){
        if (typeof this["initial-message"] == "undefined")
            this.$setInheritedAttribute("initial-message");
        
        if (!this.selected && this["initial-message"])
            this.$setLabel();
    });
    
    this.$destroy = function(){
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

(function(){
    this.morePos = "end";
    
    
    
    this.$getCaptionElement = function(){
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
        apf.setStyleRule(className, "height",  value + "px");
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
            this.$removeClearMessage = function(){};
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
    
    this.$draw = function(){
        this.appearance = this.getAttribute("appearance") || "compact";

        //Build Main Skin
        this.$ext = this.$getExternal();
        this.$container = this.$getLayoutNode("main", "container", this.$ext);
        
        if (apf.hasCssUpdateScrollbarBug && !this.mode)
            this.$fixScrollBug();
        
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
    
    this.$destroy = function(){
        if (this.$ext)
            this.$ext.onclick = null;
        apf.destroyHtmlNode(this.oDrag);
        this.oDrag = null;
    };
}).call(apf.list.prototype = new apf.BaseList());

apf.aml.setElement("list", apf.list);





};

});