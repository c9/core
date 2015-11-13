#!/usr/bin/env phantomjs

var url = require('system').env.URL;
console.log('Loading ' + url + ' in headless browser...');

var page = require('webpage').create();

page.onConsoleMessage = function (msg) {
  console.log(msg);
};

page.onError = function (msg, trace) {
  console.log(msg);
  trace.forEach(function(item) {
    console.log('  ', item.file, ':', item.line);
  });
  phantom.exit(1);
};

page.onLoadFinished = function (status) {
  if (status !== "success") {
    console.log("page.open failed");
    phantom.exit(2);
  }
};

page.open(url);

