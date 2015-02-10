require({
    baseUrl: "lib"
}, ["treehugger/tree", "treehugger/traverse", "treehugger/js/parse", "jquery",
    "treehugger/js/acorn", "treehugger/js/acorn_loose"
], function(tree, traverse, parsejs, jq, acorn, acorn_loose) {

window.acorn_loose = acorn_loose
  function log(message) {
    $("#output").val($("#output").val() + message + "\n");
  }

  function exec() {
    var js = $("#code").val();
    var analysisJs = $("#analysis").val();
    $("#output").val("");   
    
    var t = performance.now();
    var ast = parsejs.parse(js);
    t -= performance.now();
    $("#ast").val(t + "\n" + ast.toPrettyString());
    try {
      eval(analysisJs);
    } catch(e) {
      $("#output").val("JS Error");
      console.log(e.message)
    }
  }

  tree.Node.prototype.log = function() {
    $("#output").val(this.toPrettyString());
  }

    require.ready(function() {
        $("#code").keyup(exec);
        $("#runbutton").click(exec);
        exec();
    });
});
