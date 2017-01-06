// Basic, single value assignment
var n = 10;
//#     ^ es5:Number
var s = "Hello";
//#     ^ es5:String
var b = true;
//#     ^ es5:Boolean
var a = [];
//#      ^ es5:Array
    n,           s,            b,             a;
//# ^ es5:Number ^ es5:String  ^ es5:Boolean  ^ es5:Array

// Multiple type value assignment
var v = 10;
v = false;
    v;
//# ^ es5:Number|es5:Boolean

// for-loop
for (var i = 0; i < whatever.length; i++) {
}
    i;
//# ^ es5:Number

// simple object literals and property assignments
var zef = {
    firstName: "Zef",
    address: {
        street: "ul. Wojciecha Boguslawsiekgo",
        city: "Poznan"
    }
};
zef.lastName = "Zef";
zef.age = 28;
zef.address.number = 16;
    zef,          zef.firstName, zef.lastName, zef.age;
//# ^ es5:Object       ^ es5:String    ^ es5:String ^ es5:Number
zef.address, zef.address.street, zef.address.number;
//#  ^ es5:Object          ^ es5:String       ^ es5:Number
// rewiring
var address = zef.address;
address.zipCode = 1234;
address, address.street, zef.address.zipCode;
//# ^ es5:Object   ^ es5:String       ^ es5:Number
address.street.indexOf
//#              ^ es5:String/prototype/indexOf