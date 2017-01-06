<?php

echo "php start\n";

error_reporting(E_ALL);
ini_set('display_errors', true);

define("YES", M_PI);
$NO = 42;

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

// test?

var_dump(xdebug_is_enabled());
var_dump(getenv('XDEBUG_CONFIG'));

xdebug_break();

echo "php end\n";