<?php

class Foo {
  
  const c = 'CONSTANT';
  
  public function __construct() {
	$self->x = 1;
	$self->y = 2;
  }
  
  public static function members() {
    return array('x', 'y');
  }
}

$foo = new Foo;
$foo

?>