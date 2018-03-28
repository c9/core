# Architect

Architect is a simple but powerful structure for Node.js applications. Using Architect,
you set up a simple configuration and tell Architect which plugins you want to load. Each
plugin registers itself with Architect, so other plugins can use its functions. Plugins can
be maintained as NPM packages so they can be dropped in to other Architect apps.

## Plugin Interface

```js
// auth.js

/* All plugins must export this public signature.
 * @options is the hash of options the user passes in when creating an instance
 * of the plugin.
 * @imports is a hash of all services this plugin consumes.
 * @register is the callback to be called when the plugin is done initializing.
 */
module.exports = function setup(options, imports, register) {

  // "database" was a service this plugin consumes
  var db = imports.database;

  register(null, {
    // "auth" is a service this plugin provides
    auth: {
      users: function (callback) {
        db.keys(callback);
      },
      authenticate: function (username, password, callback) {
        db.get(username, function (user) {
          if (!(user && user.password === password)) {
            return callback();
          }
          callback(user);
        });
      }
    }
  });
};
```

Each plugin is a node module complete with a package.json file.  It need not
actually be in npm, it can be a simple folder in the code tree.

```json
{
    "name": "auth",
    "version": "0.0.1",
    "main": "auth.js",
    "private": true,
    "plugin": {
        "consumes": ["database"],
        "provides": ["auth"]
    }
}
```

## Config Format

The `loadConfig` function below can read an architect config file.  This file can be either JSON or JS (or anything that node's require can read).

The sample calculator app has a config like this:

```js
module.exports = [
  { packagePath: "architect-http", port: 8080 },
  { packagePath: "architect-http-static", root: "www" },
  "./plugins/calculator",
  "./plugins/db",
  "./plugins/auth"
]
```

Notice that the config is a list of plugin config options.  If the only option in the config is `packagePath`, then a string can be used in place of the object.  If you want to pass other options to the plugin when it's being created, you can put arbitrary properties here.

The `plugin` section in each plugin's package.json is also merged in as a prototype to the main config.  This is where `provides` and `consumes` properties are usually set.

## Architect main API

The architect module exposes two functions as it's main API.

### createApp(config, [callback])

This function starts an architect config.  The return value is an `Architect` instance.  The optional callback will listen for both "error" and "ready" on the app object and report on which one happens first.

### loadConfig(configPath)

This is a sync function that loads a config file and parses all the plugins into a proper config object for use with `createApp`.  While this uses sync I/O all steps along the way are memoized and I/O only occurs on the first invocation.  It's safe to call this in an event loop provided a small set of configPaths are used.

## Class: Architect

Inherits from `EventEmitter`.

The `createApp` function returns an instance of `Architect`.

### Event: "service" (name, service)

When a new service is registered, this event is emitted on the app.  Name is the short name for the service, and service is the actual object with functions.

### Event: "plugin" (plugin)

When a plugin registers, this event is emitted.

### Event: "ready" (app)

When all plugins are done, the "ready" event is emitted.  The value is the Architect instance itself.

