require({
    baseUrl: "lib"
}, ["treehugger/tree", "treehugger/traverse", "treehugger/js/parse",
    "acorn/dist/acorn", "acorn/dist/acorn_loose", "acorn/dist/walk"
], function(tree, traverse, parsejs, acorn, acorn_loose) {
  var $ = document.querySelector.bind(document);
  window.acorn_loose = acorn_loose;

  if (localStorage.trehuggerJsVal)
    $("#code").value = localStorage.trehuggerJsVal;
  if (localStorage.trehuggerAnalysisVal)
    $("#analysis").value = localStorage.trehuggerAnalysisVal;
  window.onbeforeunload = function() {
    localStorage.trehuggerJsVal = $("#code").value;
    localStorage.trehuggerAnalysisVal = $("#analysis").value;
  };
  
  function log(message) {
    $("#output").value = $("#output").value + message + "\n";
  }

  function exec() {
    var js = $("#code").value;
    var analysisJs = $("#analysis").value;
    $("#output").value = "";
    
    try {
      var t = performance.now();
      var ast = parsejs.parse(js);
      t -= performance.now();
      $("#ast").value = t + "\n" + ast.toPrettyString();
      eval(analysisJs);
    } catch(e) {
      $("#output").value = "JS Error \n\t" + (e.stack || e.message);
      console.log(e)
    }
  }

  tree.Node.prototype.log = function() {
    $("#output").value = this.toPrettyString();
  }

    
  $("#code").addEventListener("input", exec);
  $("#runbutton").addEventListener("click", exec);
  exec();
    
});
