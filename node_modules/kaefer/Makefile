	
.PHONY: test

REPORTER = spec

test:
	@NODE_ENV=test ./node_modules/.bin/mocha \
	  --reporter $(REPORTER)

test-w:
	@NODE_ENV=test ./node_modules/.bin/mocha \
	  --reporter $(REPORTER) \
	  --growl \
	  --watch
    
test-integration:
	node test/integration/chaos_monkey.js
	node test/integration/smith_test.js

test-cov: lib-cov
	@INSTINCT_COV=1 $(MAKE) test REPORTER=html-cov > public/coverage.html

lib-cov:
	@node_modules/.bin/jscoverage lib lib-cov --coverage

.PHONY: test test-w test-integration