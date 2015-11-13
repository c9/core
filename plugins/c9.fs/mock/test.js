/**
 * Some more docs for Student
 */
var Student = (function () {
    /**
     * Some docs for Student
     */
    function Student(firstname, middleinitial, lastname) {
        this.firstname = firstname;
        this.middleinitial = middleinitial;
        this.lastname = lastname;
        this.fullname = firstname + " " + middleinitial + " " + lastname;
    }
    return Student;
})();

var options = {x: 1}
function d(a) {
    var options = {x: 2}
    function e(a) {
        var options = {x: 2}
        console.log(1)
    }
    e()
}
d()
/**
 * A greeter().
 */
function greeter(person) {
    return "Hello, " + person.firstname + " " + person.lastname;
}

var user = new Student("Jane", "M.", "User");
var user2 = new Student("Joe", "M.", "cons");

var i = 0;
console.log(greeter(user), Date.now(), i++);
setInterval(function(){
    console.log(greeter(user), Date.now(), i++);
}, 1000);
