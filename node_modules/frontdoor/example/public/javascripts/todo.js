(function() {
    
    refresh();
    
    function refresh() {
        $.ajax("/api/todo").done(function(data) {
            var list = $("#list");
            list.empty();
            
            for (var i = 0; i < data.items.length; i++) {
                var item = data.items[i];
                var id = item.id;
                var listItem = $("<li>").text(item.description).addClass(item.done ? "done": "");
                listItem.append($("<button class='doneBtn'>").text("done").click(doneItem.bind(this, id)));
                listItem.append($("<button class='delBtn'>").text("x").click(deleteItem.bind(this, id)));
                list.append(listItem);
            }
        });
    }
    
    function doneItem(id) {
        $.ajax({
            url: "/api/todo/" + id,
            type: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({
                done: true    
            })
        }).done(refresh);
    }
    
    function deleteItem(id) {
        $.ajax({
            url: "/api/todo/" + id,
            type: "DELETE",
            dataType: "json"
        }).done(refresh);
    }
    
    $("#add").click(function() {
        $.ajax({
            url: "/api/todo",
            type: "PUT",
            dataType: "json",
            contentType: "application/json",
            data: JSON.stringify({
                description: $("#desc").val()
            })
        }).done(refresh);
    });
    
})(window);