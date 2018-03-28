// PhantomJS doesn't support bind yet
Function.prototype.bind = Function.prototype.bind || function (thisp) {
  var fn = this;
  return function () {
    return fn.apply(thisp, arguments);
  };
};

var body = document.querySelector("tbody");
var expectations = {};
function expect(name) {
  expectations[name] = setTimeout(function () {
    post("expected '" + name + "'", "timeout", false);
  }, 1000);
}
function fulfill(name) {
  post("fulfilled '" + name + "'", name, true);
  clearTimeout(expectations[name]);
}

function fail(err) {
  post(err.message, err.stack, false);
}
function assert(name, value) {
  post(name, value, value);
}
function assertEqual(name, expected, actual) {
  post(name + " === " + expected, actual + " === " + expected, expected === actual);
}

function post(name, result, pass) {
  var tr = document.createElement('tr');
  tr.setAttribute("class", pass ? "passed" : "failed");
  var td = document.createElement('td');
  td.textContent = name;
  tr.appendChild(td);
  td = document.createElement('td');
  td.textContent = result;
  tr.appendChild(td);
  body.appendChild(tr);
  if (pass) console.log(name);
  else throw new Error(name + "\n" + result);
}


expect("smith loads");
require(["smith"], function (smith) {
  fulfill("smith loads");


  //////////////////////////////////////////////////////////////////////////

  var Agent = smith.Agent;
  var BrowserTransport = smith.BrowserTransport;

  assertEqual("typeof smith", "object", typeof smith);
  assertEqual("typeof smith.Agent", "function", typeof smith.Agent);
  assertEqual("typeof smith.BrowserTransport", "function", typeof smith.BrowserTransport);

  var agent = new Agent();

  assert("agent instanceof smith.Agent", agent instanceof smith.Agent);

  expect("socket opened");
  var ws = new WebSocket(window.location.origin.replace(/^http/, "ws") + "/");
  ws.onopen = function () {
    fulfill("socket opened");
    expect("agent connected");
    agent.connect(new BrowserTransport(ws, true), function (err, serverAgent) {
      if (err) return fail(err);
      fulfill("agent connected");
      assertEqual("typeof serverAgent", "object", typeof serverAgent);
      expect("called add");
      serverAgent.add(5, 7, function (err, result) {
        if (err) return fail(err);
        fulfill("called add");
        assertEqual("5 + 7", 12, result);
      });
    });
  };

  //////////////////////////////////////////////////////////////////////////


});
