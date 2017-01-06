define(function(require, exports, module) {

var getRegistry = require('./values').getRegistry;

function addValue(registry, v) {
    if (registry[v.guid])
        return;

    registry[v.guid] = true;
    v.getPropertyNames().forEach(function(p) {
        v.get(p).forEach(function(v) {
            addValue(registry, v);
        });
    });
}

function jsonValueEquals(v1, v2) {
    if (v1.guid === v2.guid)
        return true;

    if (!v1.properties)
        v1.properties = {};
    if (!v2.properties)
        v2.properties = {};
    var properties1 = Object.keys(v1.properties);
    var properties2 = Object.keys(v2.properties);
    if (properties1.length !== properties2.length)
        return false;
    for (var i = 0; i < properties1.length; i++) {
        var p = properties1[i];
        if (!v2.properties[p])  // no value
            return false;
        var guids1 = v1.properties[p];
        var guids2 = v2.properties[p];
        if (guids1.length !== guids2.length)
            return false;
        for (var j = 0; j < guids1.length; j++) {
            if (guids1[j] !== guids2[j])
                return false;
        }
    }
    
    if (v1.fargs && !v2.fargs || !v1.fargs & v2.fargs)
        return false;
    if (v1.fargs) {
        if (v1.fargs.length !== v2.fargs.length)
            return false;
        for (var i = 0; i < v1.fargs.length; i++) {
            if (v1.fargs[i] !== v2.fargs[i])
                return false;
        }
    }

    if (v1.returnValues && !v2.returnValues || !v1.returnValues && v2.returnValues)
        return false;
    if (!v1.returnValues)
        return true;
    
    var rv1 = v1.returnValues;
    var rv2 = v2.returnValues;
    if (rv1.length !== rv2.length)
        return false;
    for (var i = 0; i < rv1.length; i++) {
        if (rv1[i] !== rv2[i])
            return false;
    }
    return true;
}

function removeArrayDuplicates(array) {
    var obj = {};
    for (var i = 0; i < array.length; i++) {
        obj[array[i]] = true;
    }
    return Object.keys(obj);
}

function compact(registryJSON) {
    console.log("Compacting...");
    var guids = Object.keys(registryJSON);
    var guidToGuid = {};
    var guidToIgnore = {};
    for (var i = 0; i < guids.length; i++) {
        var guid = guids[i];
        for (var j = i + 1; j < guids.length; j++) {
            var guid2 = guids[j];
            if (jsonValueEquals(registryJSON[guid], registryJSON[guid2])) { // Equivalent, setup relink
                guidToGuid[guid2] = guid;
            }
        }
        // Not notable object, redirect to /dev/null
        if (Object.keys(registryJSON[guid].properties).length === 0 && (!registryJSON[guid].returnValues || registryJSON[guid].returnValues.length === 0)) {
            guidToIgnore[guid] = true;
        }
    }
    // Go through it again, replacing pointers
    for (var i = 0; i < guids.length; i++) {
        var val = registryJSON[guids[i]];
        for (var p in val.properties) {
            var guids2 = val.properties[p];
            for (var j = 0; j < guids2.length; j++) {
                var guid = guids2[j];
                while (guidToGuid[guid]) {
                    guid = guidToGuid[guid];
                }
                guids2[j] = guid;
                if (guidToIgnore[guid]) {
                    guids2.splice(j, 1);
                    j--;
                }
            }
            val.properties[p] = removeArrayDuplicates(guids2);
        }
        if (val.returnValues) {
            var guids2 = val.returnValues;
            for (var j = 0; j < guids2.length; j++) {
                var guid = guids2[j];
                while (guidToGuid[guid]) {
                    guid = guidToGuid[guid];
                }
                guids2[j] = guid;
                if (guidToIgnore[guid]) {
                    guids2.splice(j, 1);
                    j--;
                }
            }
            val.returnValues = removeArrayDuplicates(guids2);
        }
    }

    for (var p in guidToGuid) {
        delete registryJSON[p];
    }
    for (var p in guidToIgnore) {
        delete registryJSON[p];
    }
    
    //console.log("GUID2GUID: ", guidToGuid);
    //console.log("GUID2IGNORE: ", guidToIgnore);
    
    // Return, whether we compacted anything
    return Object.keys(guidToGuid).length > 0;
}

function externalize(rootPrefix, exportValue) {
    var registry = getRegistry();
    var tcValues = {};
    if (exportValue) {
        addValue(tcValues, exportValue);
    }
    var exportJSON = {};
    var keys = Object.keys(registry);

    for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf(rootPrefix) === 0 && (!exportValue || tcValues[keys[i]])) {
            exportJSON[keys[i]] = registry[keys[i]].toJSON();
        }
    }
    while (compact(exportJSON)) {}
    return exportJSON;
}

exports.externalize = externalize;

});