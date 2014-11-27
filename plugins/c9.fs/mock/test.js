var Student = (function () {
    function Student(firstname, middleinitial, lastname) {
        this.firstname = firstname;
        this.middleinitial = middleinitial;
        this.lastname = lastname;
        this.fullname = firstname + " " + middleinitial + " " + lastname;
    }
    return Student;
})();

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