(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(require("tern/lib/infer"), require("tern/lib/tern"), require);
  if (typeof define == "function" && define.amd) // AMD
    return define(["tern/lib/infer", "tern/lib/tern"], mod);
  mod(tern, tern);
})(function(infer, tern, require) {
  "use strict";

  function resolvePath(base, path) {
    if (path[0] == "/") return path;
    var slash = base.lastIndexOf("/"), m;
    if (slash >= 0) path = base.slice(0, slash + 1) + path;
    while (m = /[^\/]*[^\/\.][^\/]*\/\.\.\//.exec(path))
      path = path.slice(0, m.index) + path.slice(m.index + m[0].length);
    return path.replace(/(^|[^\.])\.\//g, "$1");
  }

  function buildWrappingScope(parent, origin, node) {
    var scope = new infer.Scope(parent);
    scope.exports = parent.exports;
    return scope;
  }

  tern.registerPlugin("meteor", function(server, options) {
    server._node = {
      modules: Object.create(null),
      options: options || {},
      currentFile: null,
      server: server
    };

    server.on("beforeLoad", function(file) {
      // Just building a wrapping scope for a file
      this._node.currentFile = resolvePath(server.options.projectDir + "/", file.name.replace(/\\/g, "/"));
      file.scope = buildWrappingScope(file.scope, file.name, file.ast);
    });

    server.on("afterLoad", function(file) {
      // XXX do we even need this stuff?
      this._node.currentFile = null;
    });

    server.on("reset", function() {
      // XXX
    });

    return { defs: defs };
  });

  var defs = {
    "!name": "meteor",
    "Match": {
      "Any": "?",
      "String": "?",
      "Number": "?",
      "Boolean": "?",
      "undefined": "?",
      "null": "?",
      "Integer": "?",
      "ObjectIncluding": "?",
      "Object": "?",
      "Optional": "fn(pattern: string)",
      "OneOf": "fn()",
      "Where": "fn(condition: bool)",
      "test": {
        "!doc": "Anywhere\nReturns true if the value matches the pattern.",
        "!type": "fn(value, pattern: MatchPattern)"
      },
      "!doc": "The namespace for all Match types and methods."
    },
    "MeteorSubscribeHandle": {
      "stop": "fn()",
      "ready": "fn() -> bool"
    },
    "Accounts": {
      "ui": {
        "config": {
          "!doc": "Client\nConfigure the behavior of [`{{> loginButtons}}`](#accountsui).",
          "!type": "fn(options: Object)"
        },
        "!doc": "Accounts UI"
      },
      "emailTemplates": {
        "!doc": "Server\nOptions to customize emails sent from the Accounts system."
      },
      "config": {
        "!doc": "Anywhere\nSet global accounts options.",
        "!type": "fn(options: Object)"
      },
      "validateLoginAttempt": {
        "!doc": "Server\nValidate login attempts.",
        "!type": "fn(func: fn())"
      },
      "onLogin": {
        "!doc": "Server\nRegister a callback to be called after a login attempt succeeds.",
        "!type": "fn(func: fn())"
      },
      "onLoginFailure": {
        "!doc": "Server\nRegister a callback to be called after a login attempt fails.",
        "!type": "fn(func: fn())"
      },
      "onCreateUser": {
        "!doc": "Server\nCustomize new user creation.",
        "!type": "fn(func: fn())"
      },
      "validateNewUser": {
        "!doc": "Server\nSet restrictions on new user creation.",
        "!type": "fn(func: fn())"
      },
      "onResetPasswordLink": {
        "!doc": "Client\nRegister a function to call when a reset password link is clicked\nin an email sent by\n[`Accounts.sendResetPasswordEmail`](#accounts_sendresetpasswordemail).\nThis function should be called in top-level code, not inside\n`Meteor.startup()`.",
        "!type": "fn(callback: fn())"
      },
      "onEmailVerificationLink": {
        "!doc": "Client\nRegister a function to call when an email verification link is\nclicked in an email sent by\n[`Accounts.sendVerificationEmail`](#accounts_sendverificationemail).\nThis function should be called in top-level code, not inside\n`Meteor.startup()`.",
        "!type": "fn(callback: fn())"
      },
      "onEnrollmentLink": {
        "!doc": "Client\nRegister a function to call when an account enrollment link is\nclicked in an email sent by\n[`Accounts.sendEnrollmentEmail`](#accounts_sendenrollmentemail).\nThis function should be called in top-level code, not inside\n`Meteor.startup()`.",
        "!type": "fn(callback: fn())"
      },
      "createUser": {
        "!doc": "Anywhere\nCreate a new user.",
        "!type": "fn(options: Object, callback?: fn())"
      },
      "changePassword": {
        "!doc": "Client\nChange the current user's password. Must be logged in.",
        "!type": "fn(oldPassword: string, newPassword: string, callback?: fn())"
      },
      "forgotPassword": {
        "!doc": "Client\nRequest a forgot password email.",
        "!type": "fn(options: Object, callback?: fn())"
      },
      "resetPassword": {
        "!doc": "Client\nReset the password for a user using a token received in email. Logs the user in afterwards.",
        "!type": "fn(token: string, newPassword: string, callback?: fn())"
      },
      "verifyEmail": {
        "!doc": "Client\nMarks the user's email address as verified. Logs the user in afterwards.",
        "!type": "fn(token: string, callback?: fn())"
      },
      "setPassword": {
        "!doc": "Server\nForcibly change the password for a user.",
        "!type": "fn(userId: string, newPassword: string)"
      },
      "sendResetPasswordEmail": {
        "!doc": "Server\nSend an email with a link the user can use to reset their password.",
        "!type": "fn(userId: string, email?: string)"
      },
      "sendEnrollmentEmail": {
        "!doc": "Server\nSend an email with a link the user can use to set their initial password.",
        "!type": "fn(userId: string, email?: string)"
      },
      "sendVerificationEmail": {
        "!doc": "Server\nSend an email with a link the user can use verify their email address.",
        "!type": "fn(userId: string, email?: string)"
      },
      "!doc": "The namespace for all accounts-related methods."
    },
    "Blaze": {
      "TemplateInstance": {
        "prototype": {
          "data": {
            "!doc": "Client\nThe data context of this instance's latest invocation."
          },
          "view": {
            "!doc": "Client\nThe [View](#blaze_view) object for this invocation of the template.",
            "!type": "Blaze.View"
          },
          "firstNode": {
            "!doc": "Client\nThe first top-level DOM node in this template instance.",
            "!type": "DOMNode"
          },
          "lastNode": {
            "!doc": "Client\nThe last top-level DOM node in this template instance.",
            "!type": "DOMNode"
          },
          "$": {
            "!doc": "Client\nFind all elements matching `selector` in this template instance, and return them as a JQuery object.",
            "!type": "fn(selector: string) -> [DOMNode]"
          },
          "findAll": {
            "!doc": "Client\nFind all elements matching `selector` in this template instance.",
            "!type": "fn(selector: string) -> [DOMNode]"
          },
          "find": {
            "!doc": "Client\nFind one element matching `selector` in this template instance.",
            "!type": "fn(selector: string) -> DOMNode"
          },
          "autorun": {
            "!doc": "Client\nA version of [Tracker.autorun](#tracker_autorun) that is stopped when the template is destroyed.",
            "!type": "fn(runFunc: fn()) -> +Tracker.Computation"
          }
        },
        "!doc": "The class for template instances",
        "!type": "fn(view: Blaze.View)"
      },
      "currentView": {
        "!doc": "Client\nThe View corresponding to the current template helper, event handler, callback, or autorun.  If there isn't one, `null`.",
        "!type": "Blaze.View"
      },
      "With": {
        "!doc": "Client\nConstructs a View that renders content with a data context.",
        "!type": "fn(data: Object, contentFunc: fn())"
      },
      "If": {
        "!doc": "Client\nConstructs a View that renders content conditionally.",
        "!type": "fn(conditionFunc: fn(), contentFunc: fn(), elseFunc?: fn())"
      },
      "Unless": {
        "!doc": "Client\nAn inverted [`Blaze.If`](#blaze_if).",
        "!type": "fn(conditionFunc: fn(), contentFunc: fn(), elseFunc?: fn())"
      },
      "Each": {
        "!doc": "Client\nConstructs a View that renders `contentFunc` for each item in a sequence.",
        "!type": "fn(argFunc: fn(), contentFunc: fn(), elseFunc?: fn())"
      },
      "isTemplate": {
        "!doc": "Client\nReturns true if `value` is a template object like `Template.myTemplate`.",
        "!type": "fn(value)"
      },
      "render": {
        "!doc": "Client\nRenders a template or View to DOM nodes and inserts it into the DOM, returning a rendered [View](#blaze_view) which can be passed to [`Blaze.remove`](#blaze_remove).",
        "!type": "fn(templateOrView: Template, parentNode: DOMNode, nextNode?: DOMNode, parentView?: Blaze.View)"
      },
      "renderWithData": {
        "!doc": "Client\nRenders a template or View to DOM nodes with a data context.  Otherwise identical to `Blaze.render`.",
        "!type": "fn(templateOrView: Template, data: Object, parentNode: DOMNode, nextNode?: DOMNode, parentView?: Blaze.View)"
      },
      "remove": {
        "!doc": "Client\nRemoves a rendered View from the DOM, stopping all reactive updates and event listeners on it.",
        "!type": "fn(renderedView: Blaze.View)"
      },
      "toHTML": {
        "!doc": "Client\nRenders a template or View to a string of HTML.",
        "!type": "fn(templateOrView: Template)"
      },
      "toHTMLWithData": {
        "!doc": "Client\nRenders a template or View to HTML with a data context.  Otherwise identical to `Blaze.toHTML`.",
        "!type": "fn(templateOrView: Template, data: Object)"
      },
      "getData": {
        "!doc": "Client\nReturns the current data context, or the data context that was used when rendering a particular DOM element or View from a Meteor template.",
        "!type": "fn(elementOrView?: DOMElement)"
      },
      "getView": {
        "!doc": "Client\nGets either the current View, or the View enclosing the given DOM element.",
        "!type": "fn(element?: DOMElement)"
      },
      "Template": {
        "!doc": "Client\nConstructor for a Template, which is used to construct Views with particular name and content.",
        "!type": "fn(viewName?: string, renderFunction: fn())"
      },
      "View": {
        "!doc": "Client\nConstructor for a View, which represents a reactive region of DOM.",
        "!type": "fn(name?: string, renderFunction: fn())"
      },
      "!doc": "The namespace for all Blaze-related methods and classes."
    },
    "DDP": {
      "connect": {
        "!doc": "Anywhere\nConnect to the server of a different Meteor application to subscribe to its document sets and invoke its remote methods.",
        "!type": "fn(url: string)"
      },
      "!doc": "The namespace for DDP-related methods."
    },
    "EJSON": {
      "newBinary": {
        "!doc": "Anywhere\nAllocate a new buffer of binary data that EJSON can serialize."
      },
      "CustomType": {
        "prototype": {
          "typeName": {
            "!doc": "Anywhere\nReturn the tag used to identify this type.  This must match the tag used to register this type with [`EJSON.addType`](#ejson_add_type).",
            "!type": "fn()"
          },
          "toJSONValue": {
            "!doc": "Anywhere\nSerialize this instance into a JSON-compatible value.",
            "!type": "fn()"
          },
          "clone": {
            "!doc": "Anywhere\nReturn a value `r` such that `this.equals(r)` is true, and modifications to `r` do not affect `this` and vice versa.",
            "!type": "fn()"
          },
          "equals": {
            "!doc": "Anywhere\nReturn `true` if `other` has a value equal to `this`; `false` otherwise.",
            "!type": "fn(other: Object)"
          }
        },
        "!doc": "The interface that a class must satisfy to be able to become an\nEJSON custom type via EJSON.addType.",
        "!type": "fn()"
      },
      "addType": {
        "!doc": "Anywhere\nAdd a custom datatype to EJSON.",
        "!type": "fn(name: string, factory: fn())"
      },
      "toJSONValue": {
        "!doc": "Anywhere\nSerialize an EJSON-compatible value into its plain JSON representation.",
        "!type": "fn(val: EJSON)"
      },
      "fromJSONValue": {
        "!doc": "Anywhere\nDeserialize an EJSON value from its plain JSON representation.",
        "!type": "fn(val: JSONCompatible)"
      },
      "stringify": {
        "!doc": "Anywhere\nSerialize a value to a string.\n\nFor EJSON values, the serialization fully represents the value. For non-EJSON values, serializes the same way as `JSON.stringify`.",
        "!type": "fn(val: EJSON, options?: Object)"
      },
      "parse": {
        "!doc": "Anywhere\nParse a string into an EJSON value. Throws an error if the string is not valid EJSON.",
        "!type": "fn(str: string)"
      },
      "isBinary": {
        "!doc": "Anywhere\nReturns true if `x` is a buffer of binary data, as returned from [`EJSON.newBinary`](#ejson_new_binary).",
        "!type": "fn(x: Object)"
      },
      "equals": {
        "!doc": "Anywhere\nReturn true if `a` and `b` are equal to each other.  Return false otherwise.  Uses the `equals` method on `a` if present, otherwise performs a deep comparison.",
        "!type": "fn(a: EJSON, b: EJSON, options?: Object)"
      },
      "clone": {
        "!doc": "Anywhere\nReturn a deep copy of `val`.",
        "!type": "fn(val: EJSON)"
      },
      "!doc": "Namespace for EJSON functions"
    },
    "Meteor": {
      "users": {
        "!doc": "Anywhere\nA [Mongo.Collection](#collections) containing user documents.",
        "!type": "Mongo.Collection"
      },
      "isClient": {
        "!doc": "Anywhere\nBoolean variable.  True if running in client environment.",
        "!type": "boolean"
      },
      "isServer": {
        "!doc": "Anywhere\nBoolean variable.  True if running in server environment.",
        "!type": "boolean"
      },
      "settings": {
        "!doc": "Anywhere\n`Meteor.settings` contains deployment-specific configuration options. You can initialize settings by passing the `--settings` option (which takes the name of a file containing JSON data) to `meteor run` or `meteor deploy`. When running your server directly (e.g. from a bundle), you instead specify settings by putting the JSON directly into the `METEOR_SETTINGS` environment variable. If you don't provide any settings, `Meteor.settings` will be an empty object.  If the settings object contains a key named `public`, then `Meteor.settings.public` will be available on the client as well as the server.  All other properties of `Meteor.settings` are only defined on the server.",
        "!type": "Object"
      },
      "isCordova": {
        "!doc": "Anywhere\nBoolean variable.  True if running in a Cordova mobile environment.",
        "!type": "boolean"
      },
      "release": {
        "!doc": "Anywhere\n`Meteor.release` is a string containing the name of the [release](#meteorupdate) with which the project was built (for example, `\"1.2.3\"`). It is `undefined` if the project was built using a git checkout of Meteor.",
        "!type": "string"
      },
      "userId": {
        "!doc": "Anywhere but publish functions\nGet the current user id, or `null` if no user is logged in. A reactive data source.",
        "!type": "fn()"
      },
      "loggingIn": {
        "!doc": "Client\nTrue if a login method (such as `Meteor.loginWithPassword`, `Meteor.loginWithFacebook`, or `Accounts.createUser`) is currently in progress. A reactive data source.",
        "!type": "fn()"
      },
      "user": {
        "!doc": "Anywhere but publish functions\nGet the current user record, or `null` if no user is logged in. A reactive data source.",
        "!type": "fn()"
      },
      "logout": {
        "!doc": "Client\nLog the user out.",
        "!type": "fn(callback?: fn())"
      },
      "logoutOtherClients": {
        "!doc": "Client\nLog out other clients logged in as the current user, but does not log out the client that calls this function.",
        "!type": "fn(callback?: fn())"
      },
      "loginWith<ExternalService>": {
        "!doc": "Client\nLog the user in using an external service.",
        "!type": "fn(options?: Object, callback?: fn())"
      },
      "loginWithPassword": {
        "!doc": "Client\nLog the user in with a password.",
        "!type": "fn(user: Object, password: string, callback?: fn())"
      },
      "subscribe": {
        "!doc": "Client\nSubscribe to a record set.  Returns a handle that provides `stop()` and `ready()` methods.",
        "!type": "fn(name: string, arg1, arg2..., callbacks?: fn()) -> MeteorSubscribeHandle"
      },
      "call": {
        "!doc": "Anywhere\nInvokes a method passing any number of arguments.",
        "!type": "fn(name: string, arg1, arg2..., asyncCallback?: fn())"
      },
      "apply": {
        "!doc": "Anywhere\nInvoke a method passing an array of arguments.",
        "!type": "fn(name: string, args: [EJSONable], options?: Object, asyncCallback?: fn())"
      },
      "status": {
        "!doc": "Client\nGet the current connection status. A reactive data source.",
        "!type": "fn()"
      },
      "reconnect": {
        "!doc": "Client\nForce an immediate reconnection attempt if the client is not connected to the server.\n\n  This method does nothing if the client is already connected.",
        "!type": "fn()"
      },
      "disconnect": {
        "!doc": "Client\nDisconnect the client from the server.",
        "!type": "fn()"
      },
      "onConnection": {
        "!doc": "Server\nRegister a callback to be called when a new DDP connection is made to the server.",
        "!type": "fn(callback: fn())"
      },
      "publish": {
        "!doc": "Server\nPublish a record set.",
        "!type": "fn(name: string, func: fn())"
      },
      "methods": {
        "!doc": "Anywhere\nDefines functions that can be invoked over the network by clients.",
        "!type": "fn(methods: Object)"
      },
      "wrapAsync": {
        "!doc": "Anywhere\nWrap a function that takes a callback function as its final parameter. On the server, the wrapped function can be used either synchronously (without passing a callback) or asynchronously (when a callback is passed). On the client, a callback is always required; errors will be logged if there is no callback. If a callback is provided, the environment captured when the original function was called will be restored in the callback.",
        "!type": "fn(func: fn(), context?: Object)"
      },
      "startup": {
        "!doc": "Anywhere\nRun code when a client or a server starts.",
        "!type": "fn(func: fn())"
      },
      "setTimeout": {
        "!doc": "Anywhere\nCall a function in the future after waiting for a specified delay.",
        "!type": "fn(func: fn(), delay: number)"
      },
      "setInterval": {
        "!doc": "Anywhere\nCall a function repeatedly, with a time delay between calls.",
        "!type": "fn(func: fn(), delay: number)"
      },
      "clearInterval": {
        "!doc": "Anywhere\nCancel a repeating function call scheduled by `Meteor.setInterval`.",
        "!type": "fn(id: number)"
      },
      "clearTimeout": {
        "!doc": "Anywhere\nCancel a function call scheduled by `Meteor.setTimeout`.",
        "!type": "fn(id: number)"
      },
      "absoluteUrl": {
        "!doc": "Anywhere\nGenerate an absolute URL pointing to the application. The server reads from the `ROOT_URL` environment variable to determine where it is running. This is taken care of automatically for apps deployed with `meteor deploy`, but must be provided when using `meteor bundle`.",
        "!type": "fn(path?: string, options?: Object)"
      },
      "Error": {
        "!doc": "Anywhere\nThis class represents a symbolic error thrown by a method.",
        "!type": "fn(error: string, reason?: string, details?: string)"
      },
      "!doc": "The Meteor namespace"
    },
    "Mongo": {
      "Cursor": {
        "prototype": {
          "forEach": {
            "!doc": "Anywhere\nCall `callback` once for each matching document, sequentially and synchronously.",
            "!type": "fn(callback: fn(), thisArg)"
          },
          "map": {
            "!doc": "Anywhere\nMap callback over all matching documents.  Returns an Array.",
            "!type": "fn(callback: fn(), thisArg)"
          },
          "fetch": {
            "!doc": "Anywhere\nReturn all matching documents as an Array.",
            "!type": "fn() -> [Object]"
          },
          "count": {
            "!doc": "Anywhere\nReturns the number of documents that match a query.",
            "!type": "fn()"
          },
          "observe": {
            "!doc": "Anywhere\nWatch a query.  Receive callbacks as the result set changes.",
            "!type": "fn(callbacks: Object)"
          },
          "observeChanges": {
            "!doc": "Anywhere\nWatch a query.  Receive callbacks as the result set changes.  Only the differences between the old and new documents are passed to the callbacks.",
            "!type": "fn(callbacks: Object)"
          }
        },
        "!doc": "To create a cursor, use find. To access the documents in a cursor, use forEach, map, or fetch.",
        "!type": "fn()"
      },
      "Collection": {
        "prototype": {
          "insert": {
            "!doc": "Anywhere\nInsert a document in the collection.  Returns its unique _id.",
            "!type": "fn(doc: Object, callback?: fn())"
          },
          "update": {
            "!doc": "Anywhere\nModify one or more documents in the collection. Returns the number of affected documents.",
            "!type": "fn(selector: MongoSelector, modifier: MongoModifier, options?: Object, callback?: fn())"
          },
          "find": {
            "!doc": "Anywhere\nFind the documents in a collection that match the selector.",
            "!type": "fn(selector?: MongoSelector, options?: Object) -> Mongo.Cursor"
          },
          "findOne": {
            "!doc": "Anywhere\nFinds the first document that matches the selector, as ordered by sort and skip options.",
            "!type": "fn(selector?: MongoSelector, options?: Object) -> Object"
          },
          "remove": {
            "!doc": "Anywhere\nRemove documents from the collection",
            "!type": "fn(selector: MongoSelector, callback?: fn())"
          },
          "upsert": {
            "!doc": "Anywhere\nModify one or more documents in the collection, or insert one if no matching documents were found. Returns an object with keys `numberAffected` (the number of documents modified)  and `insertedId` (the unique _id of the document that was inserted, if any).",
            "!type": "fn(selector: MongoSelector, modifier: MongoModifier, options?: Object, callback?: fn())"
          },
          "allow": {
            "!doc": "Server\nAllow users to write directly to this collection from client code, subject to limitations you define.",
            "!type": "fn(options: Object)"
          },
          "deny": {
            "!doc": "Server\nOverride `allow` rules.",
            "!type": "fn(options: Object)"
          }
        },
        "!doc": "Anywhere\nConstructor for a Collection",
        "!type": "fn(name: string, options?: Object)"
      },
      "ObjectID": {
        "!doc": "Anywhere\nCreate a Mongo-style `ObjectID`.  If you don't specify a `hexString`, the `ObjectID` will generated randomly (not using MongoDB's ID construction rules).",
        "!type": "fn(hexString: string)"
      },
      "!doc": "Namespace for MongoDB-related items"
    },
    "Tracker": {
      "active": {
        "!doc": "Client\nTrue if there is a current computation, meaning that dependencies on reactive data sources will be tracked and potentially cause the current computation to be rerun.",
        "!type": "boolean"
      },
      "currentComputation": {
        "!doc": "Client\nThe current computation, or `null` if there isn't one.  The current computation is the [`Tracker.Computation`](#tracker_computation) object created by the innermost active call to `Tracker.autorun`, and it's the computation that gains dependencies when reactive data sources are accessed.",
        "!type": "Tracker.Computation"
      },
      "Computation": {
        "prototype": {
          "stopped": {
            "!doc": "Client\nTrue if this computation has been stopped."
          },
          "invalidated": {
            "!doc": "Client\nTrue if this computation has been invalidated (and not yet rerun), or if it has been stopped.",
            "!type": "boolean"
          },
          "firstRun": {
            "!doc": "Client\nTrue during the initial run of the computation at the time `Tracker.autorun` is called, and false on subsequent reruns and at other times.",
            "!type": "boolean"
          },
          "onInvalidate": {
            "!doc": "Client\nRegisters `callback` to run when this computation is next invalidated, or runs it immediately if the computation is already invalidated.  The callback is run exactly once and not upon future invalidations unless `onInvalidate` is called again after the computation becomes valid again.",
            "!type": "fn(callback: fn())"
          },
          "invalidate": {
            "!doc": "Client\nInvalidates this computation so that it will be rerun.",
            "!type": "fn()"
          },
          "stop": {
            "!doc": "Client\nPrevents this computation from rerunning.",
            "!type": "fn()"
          }
        },
        "!doc": "A Computation object represents code that is repeatedly rerun\nin response to\nreactive data changes. Computations don't have return values; they just\nperform actions, such as rerendering a template on the screen. Computations\nare created using Tracker.autorun. Use stop to prevent further rerunning of a\ncomputation.",
        "!type": "fn()"
      },
      "Dependency": {
        "prototype": {
          "depend": {
            "!doc": "Client\nDeclares that the current computation (or `fromComputation` if given) depends on `dependency`.  The computation will be invalidated the next time `dependency` changes.\n\nIf there is no current computation and `depend()` is called with no arguments, it does nothing and returns false.\n\nReturns true if the computation is a new dependent of `dependency` rather than an existing one.",
            "!type": "fn(fromComputation?: Tracker.Computation) -> boolean"
          },
          "changed": {
            "!doc": "Client\nInvalidate all dependent computations immediately and remove them as dependents.",
            "!type": "fn()"
          },
          "hasDependents": {
            "!doc": "Client\nTrue if this Dependency has one or more dependent Computations, which would be invalidated if this Dependency were to change.",
            "!type": "fn() -> boolean"
          }
        },
        "!doc": "A Dependency represents an atomic unit of reactive data that a\ncomputation might depend on. Reactive data sources such as Session or\nMinimongo internally create different Dependency objects for different\npieces of data, each of which may be depended on by multiple computations.\nWhen the data changes, the computations are invalidated.",
        "!type": "fn()"
      },
      "flush": {
        "!doc": "Client\nProcess all reactive updates immediately and ensure that all invalidated computations are rerun.",
        "!type": "fn()"
      },
      "autorun": {
        "!doc": "Client\nRun a function now and rerun it later whenever its dependencies change. Returns a Computation object that can be used to stop or observe the rerunning.",
        "!type": "fn(runFunc: fn()) -> +Tracker.Computation"
      },
      "nonreactive": {
        "!doc": "Client\nRun a function without tracking dependencies.",
        "!type": "fn(func: fn())"
      },
      "onInvalidate": {
        "!doc": "Client\nRegisters a new [`onInvalidate`](#computation_oninvalidate) callback on the current computation (which must exist), to be called immediately when the current computation is invalidated or stopped.",
        "!type": "fn(callback: fn())"
      },
      "afterFlush": {
        "!doc": "Client\nSchedules a function to be called during the next flush, or later in the current flush if one is in progress, after all invalidated computations have been rerun.  The function will be run once and not on subsequent flushes unless `afterFlush` is called again.",
        "!type": "fn(callback: fn())"
      },
      "!doc": "The namespace for Tracker-related methods."
    },
    "Assets": {
      "getText": {
        "!doc": "Server\nRetrieve the contents of the static server asset as a UTF8-encoded string.",
        "!type": "fn(assetPath: string, asyncCallback?: fn())"
      },
      "getBinary": {
        "!doc": "Server\nRetrieve the contents of the static server asset as an [EJSON Binary](#ejson_new_binary).",
        "!type": "fn(assetPath: string, asyncCallback?: fn())"
      },
      "!doc": "The namespace for Assets functions, lives in the bundler."
    },
    "App": {
      "info": {
        "!doc": "Set your mobile app's core configuration information.",
        "!type": "fn(options: Object)"
      },
      "setPreference": {
        "!doc": "Add a preference for your build as described in the\n[PhoneGap documentation](http://docs.phonegap.com/en/3.5.0/config_ref_index.md.html#The%20config.xml%20File_global_preferences).",
        "!type": "fn(name: string, value: string)"
      },
      "configurePlugin": {
        "!doc": "Set the build-time configuration for a Phonegap plugin.",
        "!type": "fn(pluginName: string, config: Object)"
      },
      "icons": {
        "!doc": "Set the icons for your mobile app.",
        "!type": "fn(icons: Object)"
      },
      "launchScreens": {
        "!doc": "Set the launch screen images for your mobile app.",
        "!type": "fn(launchScreens: Object)"
      },
      "!doc": "The App configuration object in mobile-config.js"
    },
    "Plugin": {
      "registerSourceHandler": {
        "!doc": "Build Plugin\nInside a build plugin source file specified in\n[Package.registerBuildPlugin](#Package-registerBuildPlugin),\nadd a handler to compile files with a certain file extension.",
        "!type": "fn(fileExtension: string, handler: fn())"
      },
      "!doc": "The namespace that is exposed inside build plugin files."
    },
    "Package": {
      "describe": {
        "!doc": "package.js\nProvide basic package information.",
        "!type": "fn(options: Object)"
      },
      "onUse": {
        "!doc": "package.js\nDefine package dependencies and expose package methods.",
        "!type": "fn(func: fn())"
      },
      "onTest": {
        "!doc": "package.js\nDefine dependencies and expose package methods for unit tests.",
        "!type": "fn(func: fn())"
      },
      "registerBuildPlugin": {
        "!doc": "package.js\nDefine a build plugin. A build plugin extends the build\nprocess for apps and packages that use this package. For example,\nthe `coffeescript` package uses a build plugin to compile CoffeeScript\nsource files into JavaScript.",
        "!type": "fn(options?: Object)"
      },
      "!doc": "package.js\nThe Package object in package.js"
    },
    "Npm": {
      "depends": {
        "!doc": "package.js\nSpecify which [NPM](https://www.npmjs.org/) packages\nyour Meteor package depends on.",
        "!type": "fn(dependencies: Object)"
      },
      "require": {
        "!doc": "Server\nRequire a package that was specified using\n`Npm.depends()`.",
        "!type": "fn(name: string)"
      },
      "!doc": "The Npm object in package.js and package source files."
    },
    "Cordova": {
      "depends": {
        "!doc": "package.js\nSpecify which [Cordova / PhoneGap](http://cordova.apache.org/)\nplugins your Meteor package depends on.\n\nPlugins are installed from\n[plugins.cordova.io](http://plugins.cordova.io/), so the plugins and\nversions specified must exist there. Alternatively, the version\ncan be replaced with a GitHub tarball URL as described in the\n[Cordova / PhoneGap](https://github.com/meteor/meteor/wiki/Meteor-Cordova-Phonegap-integration#meteor-packages-with-cordovaphonegap-dependencies)\npage of the Meteor wiki on GitHub.",
        "!type": "fn(dependencies: Object)"
      },
      "!doc": "The Cordova object in package.js."
    },
    "currentUser": {
      "!doc": "Calls [Meteor.user()](#meteor_user). Use `{{#if currentUser}}` to check whether the user is logged in."
    },
    "loggingIn": {
      "!doc": "Calls [Meteor.loggingIn()](#meteor_loggingin)."
    },
    "Template": {
      "prototype": {
        "created": {
          "!doc": "Client\nProvide a callback when an instance of a template is created."
        },
        "rendered": {
          "!doc": "Client\nProvide a callback when an instance of a template is rendered."
        },
        "destroyed": {
          "!doc": "Client\nProvide a callback when an instance of a template is destroyed."
        },
        "helpers": {
          "!doc": "Client\nSpecify template helpers available to this template.",
          "!type": "fn(helpers: Object)"
        },
        "events": {
          "!doc": "Client\nSpecify event handlers for this template.",
          "!type": "fn(eventMap: EventMap)"
        }
      },
      "!doc": "The class for defining templates",
      "!type": "fn()"
    },
    "MethodInvocation": {
      "prototype": {
        "isSimulation": {
          "!doc": "Anywhere\nAccess inside a method invocation.  Boolean value, true if this invocation is a stub.",
          "!type": "boolean"
        },
        "userId": {
          "!doc": "Anywhere\nThe id of the user that made this method call, or `null` if no user was logged in."
        },
        "connection": {
          "!doc": "Server\nAccess inside a method invocation. The [connection](#meteor_onconnection) that this method was received on. `null` if the method is not associated with a connection, eg. a server initiated method call."
        },
        "unblock": {
          "!doc": "Server\nCall inside a method invocation.  Allow subsequent method from this client to begin running in a new fiber.",
          "!type": "fn()"
        },
        "setUserId": {
          "!doc": "Server\nSet the logged in user.",
          "!type": "fn(userId: string)"
        }
      },
      "!doc": "The state for a single invocation of a method, referenced by this\ninside a method definition.",
      "!type": "fn(options: Object)"
    },
    "Subscription": {
      "prototype": {
        "connection": {
          "!doc": "Server\nAccess inside the publish function. The incoming [connection](#meteor_onconnection) for this subscription."
        },
        "userId": {
          "!doc": "Server\nAccess inside the publish function. The id of the logged-in user, or `null` if no user is logged in."
        },
        "error": {
          "!doc": "Server\nCall inside the publish function.  Stops this client's subscription, triggering a call on the client to the `onError` callback passed to [`Meteor.subscribe`](#meteor_subscribe), if any. If `error` is not a [`Meteor.Error`](#meteor_error), it will be [sanitized](#meteor_error).",
          "!type": "fn(error: Error)"
        },
        "stop": {
          "!doc": "Server\nCall inside the publish function.  Stops this client's subscription; the `onError` callback is *not* invoked on the client.",
          "!type": "fn()"
        },
        "onStop": {
          "!doc": "Server\nCall inside the publish function.  Registers a callback function to run when the subscription is stopped.",
          "!type": "fn(func: fn())"
        },
        "added": {
          "!doc": "Server\nCall inside the publish function.  Informs the subscriber that a document has been added to the record set.",
          "!type": "fn(collection: string, id: string, fields: Object)"
        },
        "changed": {
          "!doc": "Server\nCall inside the publish function.  Informs the subscriber that a document in the record set has been modified.",
          "!type": "fn(collection: string, id: string, fields: Object)"
        },
        "removed": {
          "!doc": "Server\nCall inside the publish function.  Informs the subscriber that a document has been removed from the record set.",
          "!type": "fn(collection: string, id: string)"
        },
        "ready": {
          "!doc": "Server\nCall inside the publish function.  Informs the subscriber that an initial, complete snapshot of the record set has been sent.  This will trigger a call on the client to the `onReady` callback passed to  [`Meteor.subscribe`](#meteor_subscribe), if any.",
          "!type": "fn()"
        }
      },
      "!doc": "The server's side of a subscription",
      "!type": "fn()"
    },
    "CompileStep": {
      "prototype": {
        "inputSize": {
          "!doc": "The total number of bytes in the input file.",
          "!type": "number"
        },
        "inputPath": {
          "!doc": "The filename and relative path of the input file.\nPlease don't use this filename to read the file from disk, instead\nuse [compileStep.read](CompileStep-read).",
          "!type": "string"
        },
        "fullInputPath": {
          "!doc": "The filename and absolute path of the input file.\nPlease don't use this filename to read the file from disk, instead\nuse [compileStep.read](CompileStep-read).",
          "!type": "string"
        },
        "pathForSourceMap": {
          "!doc": "If you are generating a sourcemap for the compiled file, use\nthis path for the original file in the sourcemap.",
          "!type": "string"
        },
        "packageName": {
          "!doc": "The name of the package in which the file being built exists.",
          "!type": "string"
        },
        "rootOutputPath": {
          "!doc": "On web targets, this will be the root URL prepended\nto the paths you pick for your output files. For example,\nit could be \"/packages/my-package\".",
          "!type": "string"
        },
        "arch": {
          "!doc": "The architecture for which we are building. Can be \"os\",\n\"web.browser\", or \"web.cordova\".",
          "!type": "string"
        },
        "fileOptions": {
          "!doc": "Any options passed to \"api.addFiles\".",
          "!type": "Object"
        },
        "declaredExports": {
          "!doc": "The list of exports that the current package has defined.\nCan be used to treat those symbols differently during compilation.",
          "!type": "Object"
        },
        "read": {
          "!doc": "Read from the input file. If `n` is specified, returns the\nnext `n` bytes of the file as a Buffer. XXX not sure if this actually\nreturns a String sometimes...",
          "!type": "fn(n?: number)"
        },
        "addHtml": {
          "!doc": "Works in web targets only. Add markup to the `head` or `body`\nsection of the document.",
          "!type": "fn(options: Object)"
        },
        "addStylesheet": {
          "!doc": "Web targets only. Add a stylesheet to the document.",
          "!type": "fn(options: Object, path: string, data: string, sourceMap: string)"
        },
        "addJavaScript": {
          "!doc": "Add JavaScript code. The code added will only see the\nnamespaces imported by this package as runtime dependencies using\n['api.use'](#PackageAPI-use). If the file being compiled was added\nwith the bare flag, the resulting JavaScript won't be wrapped in a\nclosure.",
          "!type": "fn(options: Object)"
        },
        "addAsset": {
          "!doc": "Add a file to serve as-is to the browser or to include on\nthe browser, depending on the target. On the web, it will be served\nat the exact path requested. For server targets, it can be retrieved\nusing `Assets.getText` or `Assets.getBinary`.",
          "!type": "fn(options: Object, path: string, data: Buffer)"
        },
        "error": {
          "!doc": "Display a build error.",
          "!type": "fn(options: Object, message: string, sourcePath?: string, line: number, func: string)"
        }
      },
      "!doc": "The object passed into Plugin.registerSourceHandler",
      "!type": "fn()"
    },
    "check": {
      "!doc": "Anywhere\nCheck that a value matches a [pattern](#matchpatterns).\nIf the value does not match the pattern, throw a `Match.Error`.\n\nParticularly useful to assert that arguments to a function have the right\ntypes and structure.",
      "!type": "fn(value, pattern: MatchPattern)"
    },
    "Email": {
      "send": {
        "!doc": "Server\nSend an email. Throws an `Error` on failure to contact mail server\nor if mail server returns an error. All fields should match\n[RFC5322](http://tools.ietf.org/html/rfc5322) specification.",
        "!type": "fn(options: Object)"
      }
    },
    "HTTP": {
      "call": {
        "!doc": "Anywhere\nPerform an outbound HTTP request.",
        "!type": "fn(method: string, url: string, options?: Object, asyncCallback?: fn())"
      },
      "get": {
        "!doc": "Anywhere\nSend an HTTP `GET` request. Equivalent to calling [`HTTP.call`](#http_call) with \"GET\" as the first argument.",
        "!type": "fn(url: string, callOptions?: Object, asyncCallback?: fn())"
      },
      "post": {
        "!doc": "Anywhere\nSend an HTTP `POST` request. Equivalent to calling [`HTTP.call`](#http_call) with \"POST\" as the first argument.",
        "!type": "fn(url: string, callOptions?: Object, asyncCallback?: fn())"
      },
      "put": {
        "!doc": "Anywhere\nSend an HTTP `PUT` request. Equivalent to calling [`HTTP.call`](#http_call) with \"PUT\" as the first argument.",
        "!type": "fn(url: string, callOptions?: Object, asyncCallback?: fn())"
      },
      "del": {
        "!doc": "Anywhere\nSend an HTTP `DELETE` request. Equivalent to calling [`HTTP.call`](#http_call) with \"DELETE\" as the first argument. (Named `del` to avoid conflic with the Javascript keyword `delete`)",
        "!type": "fn(url: string, callOptions?: Object, asyncCallback?: fn())"
      }
    },
    "ReactiveVar": {
      "prototype": {
        "get": {
          "!doc": "Client\nReturns the current value of the ReactiveVar, establishing a reactive dependency.",
          "!type": "fn()"
        },
        "set": {
          "!doc": "Client\nSets the current value of the ReactiveVar, invalidating the Computations that called `get` if `newValue` is different from the old value.",
          "!type": "fn(newValue)"
        }
      },
      "!doc": "Client\nConstructor for a ReactiveVar, which represents a single reactive variable.",
      "!type": "fn(initialValue, equalsFunc?: fn())"
    },
    "Session": {
      "set": {
        "!doc": "Client\nSet a variable in the session. Notify any listeners that the value has changed (eg: redraw templates, and rerun any [`Tracker.autorun`](#tracker_autorun) computations, that called [`Session.get`](#session_get) on this `key`.)",
        "!type": "fn(key: string, value: EJSONable)"
      },
      "setDefault": {
        "!doc": "Client\nSet a variable in the session if it hasn't been set before. Otherwise works exactly the same as [`Session.set`](#session_set).",
        "!type": "fn(key: string, value: EJSONable)"
      },
      "get": {
        "!doc": "Client\nGet the value of a session variable. If inside a [reactive computation](#reactivity), invalidate the computation the next time the value of the variable is changed by [`Session.set`](#session_set). This returns a clone of the session value, so if it's an object or an array, mutating the returned value has no effect on the value stored in the session.",
        "!type": "fn(key: string)"
      },
      "equals": {
        "!doc": "Client\nTest if a session variable is equal to a value. If inside a [reactive computation](#reactivity), invalidate the computation the next time the variable changes to or from the value.",
        "!type": "fn(key: string, value: string)"
      }
    },
    "PackageAPI": {
      "prototype": {
        "use": {
          "!doc": "package.js\nDepend on package `packagename`.",
          "!type": "fn(packageNames: string, architecture?: string, options?: Object)"
        },
        "imply": {
          "!doc": "package.js\nGive users of this package access to another package (by passing  in the string `packagename`) or a collection of packages (by passing in an  array of strings [`packagename1`, `packagename2`]",
          "!type": "fn(packageSpecs: string)"
        },
        "addFiles": {
          "!doc": "package.js\nSpecify the source code for your package.",
          "!type": "fn(filename: string, architecture?: string)"
        },
        "versionsFrom": {
          "!doc": "package.js\nUse versions of core packages from a release. Unless provided, all packages will default to the versions released along with `meteorRelease`. This will save you from having to figure out the exact versions of the core packages you want to use. For example, if the newest release of meteor is `METEOR@0.9.0` and it includes `jquery@1.0.0`, you can write `api.versionsFrom('METEOR@0.9.0')` in your package, and when you later write `api.use('jquery')`, it will be equivalent to `api.use('jquery@1.0.0')`. You may specify an array of multiple releases, in which case the default value for constraints will be the \"or\" of the versions from each release: `api.versionsFrom(['METEOR@0.9.0', 'METEOR@0.9.5'])` may cause `api.use('jquery')` to be interpreted as `api.use('jquery@1.0.0 || 2.0.0')`.",
          "!type": "fn(meteorRelease: string)"
        },
        "export": {
          "!doc": "package.js\nExport package-level variables in your package. The specified variables (declared without `var` in the source code) will be available to packages that use this package.",
          "!type": "fn(exportedObject: string, architecture?: string)"
        }
      },
      "!doc": "The API object passed into the Packages.onUse function.",
      "!type": "fn()"
    }
  };
});

