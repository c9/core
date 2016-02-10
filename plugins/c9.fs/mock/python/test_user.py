#!/usr/bin/env python3
from app.tests.tests import test_user
from doesntexist import badimport

print(test_user())

bad_call()

badimport.foo()