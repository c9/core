function getRandomChars(len) {
    var text = "";
    if (!len) len = 5;
    var possible = "abcdefghijklmnopqrstuvwxyz0123456789";
    
    for (var i=0; i < len; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    
    return text;
}

module.exports = getRandomChars;

