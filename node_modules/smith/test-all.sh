#!/bin/sh
cd tests
npm install
echo "\nChecking message deframer..." && \
node test-framer.js && \
echo "\nChecking message scrubber..." && \
node test-scrubber.js && \
echo "\nChecking Agent interface..." && \
node test-agent.js && \
echo "\nChecking for memory leaks..." && \
node test-memory-leaks.js && \
echo "\nTesting in browser..." && \
echo "DISABLED: phantomjs doesn't support binary-websockets yet"
# node test-browser.js
