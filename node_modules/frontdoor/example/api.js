var frontdoor = require("../../frontdoor");
var errors = require("http-error");
 
module.exports = function() {
    var api = frontdoor("TODO app");
     
    var todo = new Todo();
    todo.add({description: "get a hair cut"}, function() {});
    todo.add({description: "buy milk"}, function() {});
    todo.update({id: 1, done: true}, function() {});
     
    api.section("todo").get("/", todo.list.bind(todo))
        .put("/", {
            params: {
                description: {
                    type: "string",
                    source: "body"
                }
            }
        }, todo.add.bind(todo))
        .post("/:id", {
            params: { 
                id: "int",
                done: {
                    type: "boolean",
                    source: "body",
                    optional: true
                },
                description: {
                    type: "string",
                    source: "body",
                    optional: true
                }
            }
        }, todo.update.bind(todo))
        .delete("/:id", {
            params: { id: "int" }
        }, todo.remove.bind(todo));
         
    api.get("/inspect.json", frontdoor.middleware.describeApi(api));
     
    return api;
};
 
function Todo() {
    this.items = {};
    this._id = 1;
}
Todo.prototype.list = function(params, callback) {
    var res = { items: [] };
    for (var id in this.items)
        res.items.push(this.items[id]);
    callback(null, res);
};
Todo.prototype.add = function(params, callback) {
    var id = this._id++;
    this.items[id] = {
        id: id,
        done: false,
        description: params.description
    };
    callback(null, { id: params.id });
};
Todo.prototype.update = function(params, callback) {
    var item = this.items[params.id];
    if (!item)
        return callback(new errors.NotFound("No such entry " + params.id));
         
    if ("done" in params)
        item.done = params.done;
         
    if ("description" in params)
        item.description = params.description;
 
    callback(null, { id: params.id });
};
Todo.prototype.remove = function(params, callback) {
    var item = this.items[params.id];
    if (!item)
        return callback(new errors.NotFound("No such entry " + params.id));
     
    delete this.items[params.id];
    callback(null, { id: params.id });
};