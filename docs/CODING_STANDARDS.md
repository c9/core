Cloud9 IDE Coding Style
=====================

Goals
=====

1. readability/clarity
2. easy to maintain/change code
3. reduce risk of introducing errors
4. minimize typing

Base
----

* [http://nodeguide.com/style.html]([http://nodeguide.com/style.html)
* [https://github.com/ajaxorg/apf/blob/master/CODING_STANDARDS](https://github.com/ajaxorg/apf/blob/master/CODING_STANDARDS)


Tabs vs Spaces
--------------

We use 4 spaces of indentation.

Line Termination
----------------

Always use UNIX style line termination with a single new line character `\n`.

File names
----------

To avoid problems with non case sensitive file systems (Windows) only alphanumeric characters, underscores, and the dash character ("-") are permitted. Spaces are strictly prohibited.

*Right:*

    elements/bar.js
    core/parsers/aml.js
    elements/teleport/rpc/jsonrpc.js

*Wrong:*

    elements/Bar.js
    rpc/Json Rpc.js

Semicolons
----------

There are [rebellious forces][isaac] that try to steal your semicolons from you. But make no mistake, our traditional culture is still [well and truly alive][hnsemicolons]. So follow the community, and use those semicolons!

[isaac]: community.html#isaac-schlueter
[hnsemicolons]: http://news.ycombinator.com/item?id=1547647

Trailing whitespace
-------------------

Just like you brush your teeth after every meal, you clean up any trailing whitespace in your JavaScript files before committing. Otherwise the rotten smell of careless neglect will eventually drive away contributors and/or co-workers.

Line length
-----------

The target line length is 80 characters. That is to say, developers should strive keep each line of their code under 80 characters where possible and practical. However, longer lines are acceptable in some circumstances. The maximum length of any line of code is 120 characters.

Quotes
------

When a string is literal (contains no variable substitutions), the quotation mark or "double quote" should always be used to demarcate the string:

```javascript
    var a = "Example String";
```

When a literal string itself contains quotation marks, it is permitted to demarcate the string with apostrophes or "single quotes". This is especially useful for blocks of HTML:

```javascript
    var a = '<div class="button">' +
        '<a href="#" title="Click me">Click me</a>' +
        '</div>';
```

## Braces

Your opening braces go on the same line as the statement.

*Right:*

```javascript
    if (true) {
        console.log("winning");
    }
```

*Wrong:*

```javascript
    if (true)
    {
        console.log("losing");
    }
```

Also, notice the use of whitespace before and after the condition statement.

Closing braces are always followed by a new line. This is relevant for `else`, `catch` and `finally`.

*Right*:

```javascript
    if (true) {
        console.log("winning");
    }
    else {
        console.log("losing");
    }
```

*Wrong*

```javascript
    if (true) {
        console.log("winning");
    } else {
        console.log("losing");
    }
```

If the block inside the curlys consists only of one statement the curlys may be omitted.

```javascript
    if (err)
        return callback(err);
```

However within one condition curlys must be used consistently.

*Right:*

```javascript
    if (true) {
        var msg = "winning" + name;
        console.log(msg);
    }
    else {
        console.log("Oh noo");
    }
```

*Wrong:*

```javascript
    if (true) {
        var msg = "winning" + name;
        console.log(msg);
    }
    else
        console.log("Oh noo");
```

Always use a new line after after `if`, `while`, `for`, `do` and `try`.

*Right:*

```javascript
    if (err)
        return callback(err);
```

*Wrong:*

```javascript
    if (err) return callbak(err);
```

Variable declarations
---------------------

Declare one variable per var statement, it makes it easier to re-order the lines. Ignore [Crockford][crockfordconvention] on this, and put those declarations wherever they make sense.

*Right:*

```javascript
    var keys = ["foo", "bar"];
    var values = [23, 42];

    var object = {};
    while (items.length) {
        var key = keys.pop();
        object[key] = values.pop();
    }
```

*Wrong:*

```javascript
    var keys = ["foo", "bar"],
        values = [23, 42],
        object = {},
        key;

    while (items.length) {
        key = keys.pop();
        object[key] = values.pop();
    }
```

[crockfordconvention]: http://javascript.crockford.com/code.html

Variable and property names
---------------------------

Variables and properties should use [lower camel case][camelcase] capitalization. They should also be descriptive. Single character variables, uncommon abbreviations and hungarian notation should generally be avoided.

*Right:*

```javascript
    var adminUser = db.query("SELECT * FROM users ...");
    var isAdmin = adminUser !== "";
```

*Wrong:*

```javascript
    var admin_user = d.query("SELECT * FROM users ...");
    bAdmin = adminUser !== "";
```

*Wrong:*

```javascript
    var ufm = d.query("SELECT * FROM users ...");
    bAdmin = ufm.getBrs();
```

[camelcase]: http://en.wikipedia.org/wiki/camelCase#Variations_and_synonyms

Class names
-----------

Class names should be capitalized using [upper camel case][camelcase].

*Right:*

```javascript
    function BankAccount() {
    }
```

*Wrong:*

```javascript
    function bank_Account() {
    }
```

Constants
---------

Constants should be declared as regular variables or static class properties, using all uppercase letters.

Node.js / V8 actually supports mozilla's [const][const] extension, but unfortunately that cannot be applied to class members, nor is it part of any ECMA standard.

*Right:*

```javascript
    var SECOND = 1 * 1000;

    function File() {
    }
    File.FULL_PERMISSIONS = 0777;
```

*Wrong:*

```javascript
    const SECOND = 1 * 1000;

    function File() {
    }
    File.fullPermissions = 0777;
```

[const]: https://developer.mozilla.org/en/JavaScript/Reference/Statements/const

Object / Array creation
-----------------------

Use trailing commas and put *short* declarations on a single line. Only quote keys when your interpreter complains:

*Right:*

```javascript
    var a = ["hello", "world"];
    var b = {
        good: "code",
        "is generally": "pretty"
    };
```

*Wrong:*

```javascript
    var a = [
        "hello", "world"
    ];
    var b = {"good": "code"
             is generally: "pretty"
            };
```

To initialize empty arrays or objects always use the literal form.

*Right:*

```javascript
    var users = [];
    var me = {};
```

*Wrong:*

```javascript
    var users = new Array();
    var me = new Object();
```

Equality operator
-----------------

Programming is not about remembering [stupid rules][comparisonoperators]. Use the triple equality operator as it will work just as expected.

*Right:*

```javascript
    var a = 0;
    if (a === "") {
        console.log("winning");
    }
```

*Wrong:*

```javascript
    var a = 0;
    if (a == "") {
        console.log("losing");
    }
```

[comparisonoperators]: https://developer.mozilla.org/en/JavaScript/Reference/Operators/Comparison_Operators

Extending prototypes
--------------------

Do not extend the prototypes of any objects, especially native ones. There is a special place in hell waiting for you if you don't obey this rule.

*Right:*

```javascript
    var a = [];
    if (!a.length) {
        console.log("winning");
    }
```

*Wrong:*

```javascript
    Array.prototype.empty = function() {
        return !this.length;
    }

    var a = [];
    if (a.empty()) {
        console.log("losing");
    }
```

Function length
---------------

Keep your functions short. A function that doesn't fit on a 13" Notebook screen is too long. Limit yourself to max. 30 lines. Less is better.

Return statements
-----------------

To avoid deep nesting of if-statements, always return a functions value as early
as possible.

*Right:*

```javascript
    function isPercentage(val) {
        if (val < 0)
            return false;

        if (val > 100)
            return false;

        return true;
    }
```

*Wrong:*

```javascript
    function isPercentage(val) {
        if (val >= 0) {
            if (val < 100) {
                return true;
            }
            else {
                return false;
            }
        }
        else {
            return false;
        }
    }
```

Or for this particular example it may also be fine to shorten things even further:

```javascript
    function isPercentage(val) {
        var isInRange = (val >= 0 && val <= 100);
        return isInRange;
    }
```

Named closures
--------------

Feel free to give your closures a name. It shows that you care about them, and will produce better stack traces:

```javascript
    req.on("end", function onEnd() {
        console.log("winning");
    });
```

Callbacks
---------

Since node is all about non-blocking I/O, functions generally return their results using callbacks. The convention used by the node core is to reserve the first parameter of any callback for an optional error object.

You should use the same approach for your own callbacks.

If a function takes a callback some limitations apply:

1. the callback must be the last argument and the argument name should be 'callback'
2. the callback must be called exactly once
3. the function must now throw an exception. Exceptions must be caught and passed to the callback as first argument
4. the function is not allowed to return a value


Object.freeze, Object.preventExtensions, Object.seal, with, eval
----------------------------------------------------------------

Crazy shit that you will probably never need. Stay away from it.

Getters and setters
-------------------

Limit the use of (ES5) setters, they tend to cause more problems for people who try to use your software than they can solve.

Feel free to use getters that are free from [side effects][sideeffect], like providing a length property for a collection class.

[sideeffect]: http://en.wikipedia.org/wiki/Side_effect_(computer_science)

EventEmitters
-------------

Node.js ships with a simple EventEmitter class that can be included from the 'events' module:

```javascript
    var EventEmitter = require("events").EventEmitter;
```

When creating complex classes, it is common to inherit from this EventEmitter class to emit events. This is basically a simple implementation of the [Observer pattern][].

[Observer pattern]: http://en.wikipedia.org/wiki/Observer_pattern

However, I strongly recommend that you never listen to the events of your own class from within it. It isn't natural for an object to observe itself. It often leads to undesirable exposure to implementation details, and makes your code more difficult to follow.

Class Definition
----------------

```javascript
    var Ide = module.exports = function() {};

    (function() {
        this.member = function() {};
    }).call(Ide.prototype);
```

Within a JavaScript file only one class definition is permitted.

Inheritance
-----------

```javascript
    var RunvmPlugin = module.exports = function(ide, workspace) {
        Plugin.call(this, ide, workspace);
        // ...
    }
    sys.inherits(RunvmPlugin, Plugin);

    (function() {
        this.member = function() {};
    }).call(RunvmPlugin.prototype);
```

Private function
----------------

Private functions attached to the constructor (static) of the prototype of a class must be prefixed with an underscore.

```javascript
    var Ide = module.exports = function() {};

    Ide._privateField = "private data";

    (function() {
        this._privateMethod = function() {};
    }).call(Ide.prototype);
```

How to break long lines
-----------------------

Treat parenthesis and square brackets like curly braces:

* they start in the same line as the function
* the body (argument list) is indented one level
* the closing parenthesis is outdented and on a separate line

*Right:*

```javascript
    foo(
        very, long argument,
        list, with lots, of,
        different, stuff
    );
```

*Wrong:*

```javascript
    foo(very, long argument, list, with lots, of,
        different, stuff);
```

The same applies for long array literals.

*Right:*

```javascript
    var a = [
        '<div class="button">',
        '  <a href="#" title="Click me">Click me</a>',
        '</div>'
    ].join("");
```

*Wrong:*

```javascript
    var a = ['<div class="button">',
             '  <a href="#" title="Click me">Click me</a>',
             '</div>'].join("");
```

When breaking up long expressions the operator should be on the new line and broken lines should be indented by one level.

*Right:*

```javascript
    var isAdmin = isLoggedIn
        && username === "admin"
        && password === "secret";
```

*Wrong:*

```javascript
    var isAdmin = isLoggedIn &&
                  username === "admin" &&
                  password === "secret";
```

The same is true for the ternary operator:

```javascript
    var a = (value > 20 && otherValue < 10 && boolFoo === false)
        ? this.foo();
        : this.bar();
```

For Loops
---------

If statements are incredibly flexible. The condition, test and increment part of an if statement can contain any code. However to make it easy for others to understand the code you should stay away from the crazy shit and limit yourself to the straighforard cases:

1. declare the loop and length variables inline.
2. Don't declare any other variables in the initializer

*Right:*

```javascript
    for (var i = 0, l = users.length; i < l; i++) {
        var user = users[i];
        //
    }
```

*Wrong:*

```javascript
    var i, l;
    for (i = 0, l = users.length; i < l; i++) {
        var user = users[i];
        //
    }

    for (var user, i = 0, l = users.length; i++ < l;) {
        var user = users[i];
        //
    }
```

Switch Statements
-----------------

Control statements written with the "switch" statement must have a single space before the opening parenthesis of the conditional statement and after the closing parenthesis.

All content within the "switch" statement must be indented using four spaces. Content under each "case" statement must be indented using an additional four spaces.

```javascript
    switch (numPeople) {
        case 1:
            break;

        case 2:
            break;

        default:
            break;
    }
```

The construct default should never be omitted from a switch statement.

NOTE: It is sometimes useful to write a case statement which falls through to the next case by not including a break or return within that case. To distinguish these cases from bugs, any case statement where break or return are omitted should contain a comment indicating that the break was intentionally omitted.

Vertical alignment
------------------

Vertically aligning asignments can improve readability but also makes it harder to maintain the code. The style should be avoided.

*Right*:

```javascript
    var foo = 12;
    var firstName = "Peter";
    var options = {
        name: firstName,
        age: {
            years: 12,
            months: 1
        }
    };
```

*Wrong*:

```javascript
    var foo       = 12;
    var firstName = "Peter";
    var options   = {
        name : firstName,
        age  :  {
            years  : 12,
            months : 2
        }
    };
```

_self = this
-----------

The alias to access `this` from within closures is `_self` or `that`. We do not use `self` to avoid confusion with `window.self` in client side code.

API Documentation
-----------------

All classes and public API should be documented using [JSDuck annotations](https://github.com/senchalabs/jsduck).

Commit messages
---------------

We try to adhere to https://github.com/blog/926-shiny-new-commit-styles and to a lesser extent http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html. 
Don't write `I fixed a bug` or `Fixed bug`, or even `Added a cool fix for bug`. Just write `Fix bug in wrop wraffles` or `Add feature flip floppers`, present tense.

Branch Naming
-------------

We follow the uni-repo approach so our source code is in one place. To work around some of the issues - for example looking at all PRs affecting a certain service - we prefix branches with the name of the service(s) the branch affects.

PR branch names, e.g. 

    “api-”, “ide-”, “multi-ide-vfs-sapi-”
    
Checking for branch naming consistency is part of the review process and the teams responsibility.

    Use “all-” in case of doubt. E.g., https://github.com/c9/newclient/pull/12962/files affects redis schema code.
    
Generally, releasing changes affecting several services is a smell so this can help you identify possible issues.

You can now look for all PRs which made it in like so (api in this case):

    git log --oneline --first-parent SHA..origin/master | grep -v bump | grep api-

Other Resources
===============

* [https://github.com/ajaxorg/apf/blob/master/CODING_STANDARDS](https://github.com/ajaxorg/apf/blob/master/CODING_STANDARDS)
* [http://google-styleguide.googlecode.com/svn/trunk/javascriptguide.xml](http://google-styleguide.googlecode.com/svn/trunk/javascriptguide.xml)
