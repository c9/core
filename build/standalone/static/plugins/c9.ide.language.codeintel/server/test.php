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

function getFooX() {
  $foo = new Foo;
  // return $foo->;
}

// Should return constant c and members functions. Position is row 22 col 6.
Foo::

/* End of line is row 33, column 7
 *
 * Should complete with built-in candidates:
 * - class_alias
 * - class_exists
 * - class_implements
 * - class_parents
 * - class_uses
 */
class_


/* End of line is row 45, column 5 
 *
 * Should complete with built-in candidates:
 * - DateInterval
 * - DatePeriod
 * - DateTime
 * - DateTimeImmutable
 * - DateTimeZone 
 */
Date