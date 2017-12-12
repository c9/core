#!/usr/bin/env node

var test  = require('tape')
  , errno = require('./')

test('sanity checks', function (t) {
  t.ok(errno.all, 'errno.all not found')
  t.ok(errno.errno, 'errno.errno not found')
  t.ok(errno.code, 'errno.code not found')

  t.equal(errno.all.length, 60, 'found ' + errno.all.length + ', expected 60')
  t.equal(errno.errno['-1'], errno.all[1], 'errno -1 not second element')

  t.equal(errno.code['UNKNOWN'], errno.all[1], 'code UNKNOWN not second element')

  t.equal(errno.errno[1], errno.all[3], 'errno 1 not fourth element')

  t.equal(errno.code['EOF'], errno.all[3], 'code EOF not fourth element')
  t.end()
})

test('custom errors', function (t) {
  var Cust = errno.create('FooNotBarError')
  var cust = new Cust('foo is not bar')

  t.equal(cust.name, 'FooNotBarError', 'correct custom name')
  t.equal(cust.type, 'FooNotBarError', 'correct custom type')
  t.equal(cust.message, 'foo is not bar', 'correct custom message')
  t.notOk(cust.cause, 'no cause')
  t.end()
})
