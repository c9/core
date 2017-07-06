/**
 * So here there appears a line that starts with //# these are the tests
 * the ^ caret points up to the expression to infer the type of, the expected
 * type appears behind it.
 */

// Test closures
var fn;
(function() {
    var globalVar = 0;
    function testFun1() {
        return globalVar;
    }
    fn = testFun1;
})();

function ha() {
    return 8;
}

 ha();
//# ^ es5:Number

    fn,              fn();
//# ^ es5:Function      ^ es5:Number

// object instantiation
function Person(name, age) {
    this.name = name || "Unknown";
    this.age = age || 0;
}

Person.prototype.getName = function() {
    return this.name;
};

Person.prototype.setName = function(name) {
    this.haha = "Piet";
    this.name = name;
};

Person.prototype.getAge = function() {
    return this.age;
};

var zef = new Person("Zef", 28);
zef.name,     zef.age;
//# ^ es5:String   ^ es5:Number
zef.setName("Zef Hemel");
zef.getName(), zef.getAge(),             zef.getName();
//#         ^ es5:String  ^ es5:Number               ^ es5:String

zef.url = 'http://zef.me';

var obj = {
    name: "Zef",
    getName: function() {
        return this.name;
    }
};

obj.name;
//#  ^ es5:String

module.exports = {
    hello: function() {
    }
};

function manyArgs() {
    console.log(arguments);
    return 3;
}

manyArgs(1, 2, 3, 4, 5);
//# ^ es5:Function
manyArgs(1, 2);
//#           ^ es5:Number

function createPerson() {
    return new Person("A", 10);
}

createPerson().name
//#             ^ es5:String