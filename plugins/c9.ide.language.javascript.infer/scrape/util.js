function arrayToObject(array) {
    var obj = {};
    for (var i = 0; i < array.length; i++) {
        obj[array[i]] = true;
    }
    return obj;
}

function stripHtml(html) {
    return html.replace(/<[^>]+>/g, "");
}

function addLinkTargets(html, target) {
    return html
        .replace(/target=\"[^"]*\"/g, "")
        .replace(/href=\"/g, "target=\"" + target + "\" $&");
}

function asyncForEach(array, fn, callback) {
    array = array.slice(0); // Just to be sure

    function processOne() {
        var item = array.pop();
        fn(item, function(result, err) {
            if (array.length > 0) 
                processOne();
            else
                callback(result, err);
        });
    }
    if (array.length > 0) {
        processOne();
    }
    else {
        callback();
    }
}

module.exports.arrayToObject = arrayToObject;
module.exports.stripHtml = stripHtml;
module.exports.addLinkTargets = addLinkTargets;
module.exports.asyncForEach = asyncForEach;