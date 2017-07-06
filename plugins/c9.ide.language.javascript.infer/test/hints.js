(function() {
    !!someUnknownVar;
//# ^ es5:Boolean
    nuthin * nuthin;
//#         ^ es5:Number
    nuthin - nuthin;
//#         ^ es5:Number
    unknown1 *= nuthin;
//#   ^ es5:Number
    unknown2 += nuthin;
//#   ^ es5:Number
//#   ^ es5:String
    (+whatever),   (~whatever),   (-whatever);
//#  ^ es5:Number   ^ es5:Number   ^ es5:Number
    a === b,         a > b,         a < b;
//#     ^ es5:Boolean   ^ es5:Boolean  ^ es5:Boolean

    var Something = require('blabla').Something;
    Something.haha();
    Something.haha;
//#            ^ es5:Function

    var completer = module.exports = Object.create(baseLanguageHandler);
        
    completer.handlesLanguage = function(language) {
        return language === 'javascript';
    };
    
    completer.handlesLanguage;
//#             ^ es5:Function

var Variable = exports.module = function Variable(declaration) {
    this.declarations = [];
    if (declaration)
        this.declarations.push(declaration);
    this.uses = [];
    this.values = [];
    this.addUse;
//#       ^ es5:Function
}

Variable.prototype.addUse = function(node) {};

     probablyANumber < somethingElse;
//#    ^ es5:Number     ^ es5:Number

console.info2("Hello!");
console.info2
//#      ^ es5:Function
})();
