define(function(require, exports, module) {
    
    /**
     * Attempts to create a proxy object that will only allow you to access
     * known properties of an object.
     * 
     * @param name             The "name" of this object to use in error messages.
     * @param knownProperties  Optional: a list of known properties of the object.
     */
    exports.createKnownPropertyProxy = function(object, name, knownProperties) {
        /*global Proxy*/
        if (typeof Proxy === "undefined")
            return object;
            
        if (!knownProperties)
            knownProperties = Object.keys(object);
        
        return Proxy.create({
            get: function(proxy, property) {
                if (property === "inspect")
                    return object.inspect;
                if (!(property in object) && knownProperties.indexOf(property) === -1)
                    throw Error("Invalid property accessed: " + name + "." + property);
                if (property === "innerObject")
                    return object;
                return object[property];
            },
            set: function(proxy, property, value) {
                object[property] = value;
                return true;
            },
            getPropertyNames: function() {
                return Object.keys(object);
            }
        });
    };
    
});