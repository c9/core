<?php

// file_put_contents("xdebug.log", ""); // clear log

// ini_set('xdebug.remote_mode', 'jit');

define("YES", M_PI); $NO = 42;

$typeNull = null;
$typeInt = 100;
$typeFloat = 1.1;
$typeBool = true;
$typeStr = "something";
$typeArr = [1, "123", new stdclass(), [[1, 2, 3], [111]]];
$typeObj = new stdclass;
$typeObj->foo = "bar";
$typeClosure = function() {};
$typeResource = fopen("php://memory", "rw");
fputs($typeResource, "foo");

error_reporting(E_ALL);
ini_set('display_errors', true);
// ini_set('xdebug.show_exception_trace', true);
// ini_set('xdebug.remote_mode', 'jit');

// function exception_handler($exception) {
//     xdebug_break();
//     throw $exception;
// }

// set_exception_handler("exception_handler");

// phpinfo();

var_dump(xdebug_is_enabled());
var_dump(getenv('XDEBUG_CONFIG'));

function foo($y) {
    $x = 2;
    $something = "string value";

    var_dump("foo() in");
    // xdebug_break();
    var_dump("foo() out");
}

foo(10);

class MyFoo
{
    private $hey = "ho";
    protected $myBar = "something";

    protected function myMethod()
    {
        global $typeStr;
        echo $this->myBar . "\n";
    }
}

class MyBar extends MyFoo
{
    private $hey = "test";

    public function __constructor()
    {
        $this->myBar = "hello world";
    }

    public function myOtherMethod()
    {
        $test = "test";
        $this->myMethod();
    }
}

$instance = new MyBar();
$instance->myOtherMethod();

class MyException extends RuntimeException {}

throw new MyException("testing");

for ($i = 0; $i < 3; $i++) {
//    sleep(1);
}

echo "done\n";
