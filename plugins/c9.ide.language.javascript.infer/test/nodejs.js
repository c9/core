var Path = require("path");
var Connect = require("connect");
var Auth = require("connect-auth/lib/index");
var MemoryStore = require("connect/middleware/session/memory");
var RedisStore = require("./db/redis-session");
var MailerCls = require("./mailer/mailer");
var CP = require("./dispatcher/controlpanel");

var Server = function(sessionredis, infraredis, searchredis, billingmysql, config) {
    this.sessionredis = sessionredis;
    this.infraredis = infraredis;
    this.searchredis = searchredis;
    this.billingmysql = billingmysql;
    this.config = config;
    this.mailer = new MailerCls(config);
};

alert("Hehe");

exports.alert = alert;

(function() {
    this.setupRoutes = function(httpServer, sessionStore) {
        var config = this.config;
        var _self = this;
        
        exports.httpServer = httpServer;
        
        // FIRST we listen to url's that DO NOT need a session (floods the session
        // database!)
        httpServer.use(Connect.router(function(app) {
            app.get("/probe", function(req, res, next) {
                res.writeHead(200);
                res.end("OK");
            });
        }));
        
        Connect.router(function(a) {
            a.post("hahaha");
        });
        httpServer.use(Connect.cookieDecoder());
        httpServer.use(Connect.session({
            store: sessionStore,
            secret: "c9dashboard",
            key: "c9.ide.dashboard.sid"
        }));

        httpServer.use(Auth([
            Auth.Anonymous(),
            Auth.Http({
                useDigest: false,
                validatePassword: function(username, password, cbSuccess, cbFailure) {
                    return CP.authCheck(config.controlpanel, username, 
                        password, cbSuccess, cbFailure);
                }
            })
        ]));
        
        httpServer.use(Connect.bodyDecoder());
        
        httpServer.use(Connect.router(function(app) {
            exports.app = app;
            app.get(/^\/(?:index\.html?)?$/, function(req, res, next) {
                CP.index(_self, req, res, next);
            });
            
            var staticFiles = Connect.staticProvider(Path.normalize(__dirname + "/../../client/controlpanel"));
            app.get(/^\/(include|js|pages|style).*$/, staticFiles);
            
            app.get("/auth/signout", function(req, res, next) {
                CP.signout(_self, req, res, next);
            });
            
            app.get("/auth/signin", function(req, res, next) {
                CP.auth(_self, req, res, next);
            });
        
            //get all users
            app.get(/^\/users\/?([\d]+)?\/?([\d]+)?$/, function(req, res, next) {
                CP.getUsers(_self, req, res, next);
            });
            
            //get all orgs
            app.get(/^\/orgs\/?([\d]+)?\/?([\d]+)?$/, function(req, res, next) {
                CP.getOrgs(_self, req, res, next);
            });
            
            //get all org-members
            app.get(/^\/members\/?([\d]+)$/, function(req, res, next) {
                CP.getOrgMembers(_self, req, res, next);
            });
            
            //get all projects for user X
            app.get(/^\/projects\/([\w\d_-]+)\/?$/, function(req, res, next) {
                CP.getProjects(_self, req, res, next);
            });
            
            //get all projects for user X
            app.get(/^\/trans\/?([\d]+)?\/?([\d]+)?$/, function(req, res, next) {
                CP.getTransactions(_self, req, res, next);
            });
            
            //Management for user section
            app.post(/^\/moderate\/(user|org|project)\/([\w\d_-]+)\/?$/, function(req, res, next) {
                CP.moderate(_self, req, res, next);
            });
            
            //activate last 100 accounts
            app.get(/^\/multiactivation\/([\d]+)\/?$/, function(req, res, next) {
                CP.multiactivation(_self, req, res, next);
            });
            
            //send email
            app.post(/^\/sendemail\/([\w\d_-]+)\/?$/, function(req, res, next) {
                CP.sendEmail(_self, req, res, next);
            });
            
            app.get(/^\/search\/(user|org|project)\/(.*)$/, function(req, res, next) {
                CP.search(_self, req, res, next);
            });
            
            //statistics
            app.get(/^\/stats\/?$/, function(req, res, next) {
                CP.stats(_self, req, res, next);
            });
            
            //hotfixes!
            app.get(/^\/hotfixes\/?$/, function(req, res, next) {
                CP.hotfixes(_self, req, res, next);
            });
            
            //export to CSV functionality
            app.get(/^\/export\/([\w]+)\/?$/, function(req, res, next) {
                CP["export"](_self, req, res, next);
            });
            
            //premium user handling
            app.get(/^\/premium\/([\w]+)\/?$/, function(req, res, next) {
                CP["export"](_self, req, res, next);
            });
        }));
    };
    
    this.listen = function(port, host, callback) {
        var httpServer = this.httpServer = Connect.createServer();

        var store = (this.config.infra.session.type == "memory") 
            ? new MemoryStore({ reapInterval: -1 }) 
            : new RedisStore(this.sessionredis, this.config.infra.session, this.config.infra.sessionredis);

        this.setupRoutes(httpServer, store);
        httpServer.listen(port, host, callback);
    };

}).call(Server.prototype);

exports.Server = Server;
//#      ^ es5:Function

var s = new Server();
s.listen
//# ^ es5:Function