Cloud9 3.0
==========

The new VFS based Cloud9.

#### Documentation ####

Find the documentation at http://docs.c9.io:8080/.

The docs are protected by a username and password:

    username: c9v3
    password: r3v0l4t10naRy

#### Installation ####

Installing newclient is super simple.

    git clone git@github.com:ajaxorg/newclient.git
    cd newclient
    npm install
    
Installing dependencies is easy as well.

    curl https://raw.github.com/c9/install/master/install.sh | bash

Installing the node-webkit based newclient has more steps:

1. Run `scripts/setup-local-dev` to download our own fork of node-webkit and create `Cloud9-dev` app in `build` folder.
2. Set up an alias called 'c9nw' for newclient, e.g. using
   alias c9nw=\`pwd\`/build/Cloud9-dev.app/Contents/MacOS/node-webkit

#### Starting the standalone ####

For most development purposes it's recommended to use the lightweight
standalone version. It can be started as follows:

    node server.js

The following options can be used:

    --settings       Settings file to use
    --help           Show command line options.
    -t               Start in test mode
    -k               Kill tmux server in test mode
    -b               Start the bridge server - to receive commands from the cli  [default: false]
    -w               Workspace directory
    --port           Port
    --debug          Turn debugging on
    --listen         IP address of the server
    --workspacetype  The workspace type to use
    --readonly       Run in read only mode
    --packed         Whether to use the packed version.
    --auth           Basic Auth username:password
    --collab         Whether to enable collab.

#### Starting the hosted version ####

Starting the hosted version is a bit more involved.

1. Add to your /etc/hosts the line:

    ```
    127.0.0.1    c9.dev vfs.c9.dev ide.c9.dev api.c9.dev preview.c9.dev
    ```

2. You should have your **c9** folder next to your **newclient** folder (because the `legacy` role will expect so).

3. Start non-touched roles in a process and the in-dev roles in another process (to easily restart more often) - (note that a process can play multiple roles at once).

    `./server.js legacy redis proxy`
    `./server.js ide api vfs preview`
    
   Optionally, you can use the scripts/launch script to launch these processes for you. It will also make sure they are kept alive, and kills any rogue legacy processes as needed.

4. Set yourself as alpha user in your local redis db:

    `cd ../c9`
    `bin/cli.sh infraredis`
    `HMSET u/uid alpha true`

    (OR easier: change that [line](https://github.com/c9/newclient/blob/master/plugins/c9.ide.server/user_filter.js#L7) to `return true;`)

6. Login to the old c9 at [https://c9.dev](https://c9.dev)

7. Open your workspace with prefix: `ide.c9.dev` prefix instead of `c9.dev` (in oldclient): e.g. [https://ide.c9.dev/username/workspacename](https://ide.c9.dev/username/workspacename)

#### Starting node webkit version ####

Run `scripts/setup-local-dev` to install node-webkit and create Cloud9-dev app in build folder.

it will create build/cloud9-dev.app, which can run either with double click or `build/Cloud9-dev.app/Contents/MacOS/node-webkit`
(If node-webkit is installed and the nw command is the alias for node-webkit. `nw local` works too, but it have problems with native menus on mac)

    
The following flags are available:

    --wait          Wait with starting everything. Type start(); in the console to start.
    --devel         Loads packed files from the server, useful if something is deleted, and you need to rebuild.
    --unpacked      Run with unpacked files. This is handy for debugging.
    --no-worker     Run without the worker (runs all the worker process in the main thread).

You can also open via bin/c9 (though c9 needs to be packaged and installed for this to work properly)

	bin/c9 server.js

#### Building the local version ####

Run the following command to build a .app file for OSX:

    make local

This will create a "Cloud9.app" in the build/output directory. Furthermore there are these build steps

    make local-static       Build the static files for the local version
    make local-build        Build the packages for the local version
    make local-update       Build an update package for the local version
    make local-install      Install the local version in ~/Applications
    make local-installer    Build the OSX installer pkg and puts it in output/c9.pkg

#### Run the update service ####

To run the update service run:

    node node configs/update-service.js

This will provide the rest API that the local version connects to to requests updates.

#### Load full UI in the browser ####

[http://localhost:8181/ide.html](http://localhost:8181/ide.html)

The plugin configuration for development mode is in configs/client-default.js.

To start the full UI in development mode use the following url:

[http://localhost:8181/ide.html?devel=1](http://localhost:8181/ide.html?devel=1)

The plugin configuration for development mode is in configs/client-devel.js.

#### Running Tests ####

In the following example the server name is localhost. Change this to your server name or ip address.

Running all tests:

[http://localhost:8181/static/test.html](http://localhost:8181/static/test.html)

Running one specific test (in this case of the ace plugin):

[http://localhost:8181/static/test.html?plugins/c9.ace/ace_test.js](http://localhost:8181/static/test.html?plugins/c9.ace/ace_test.js)

Running multiple tests:

[http://localhost:8181/static/test.html?plugins/c9.ace/ace_test.js&plugins/c9.ace.gotoline/gotoline_test.js](http://localhost:8181/static/test.html?plugins/c9.ace/ace_test.js&plugins/c9.ace.gotoline/gotoline_test.js)

Keeping the UI after the test ran

[http://localhost:8181/static/test.html?plugins/c9.ace/ace_test.js&remain=1](http://localhost:8181/static/test.html?plugins/c9.ace/ace_test.js&remain=1)

note: you may need to install coffee-script for all tests to pass (sudo npm install -g coffee-script)

#### Committing back to SubTree repositories

Newclient uses git subtree as a way to manage the underlying repositories that are managed by us. 
To commit back to those repositories keep in mind that commits should not cross repository boundaries. 
Split up your commits per sub repo. The sub repos are all in the node_modules folder.

To pull from a repo use the following command:

    git fetch <name> master
    git subtree pull --prefix node_modules/<name> <name> master --squash


To push back to a repo use the following command:

    git subtree push --prefix=node_modules/<name> <name> <branch_name>

For instance:

    git subtree push --prefix=node_modules/ace ace fix/multi-cursor-weirdness

For more info see: [http://blogs.atlassian.com/2013/05/alternatives-to-git-submodule-git-subtree/](http://blogs.atlassian.com/2013/05/alternatives-to-git-submodule-git-subtree/)

#### Installing a new version of git using nix

Older versions of git don't have the subtree command. You can use nix to install the latest version of git:

    scripts/install-git-subtree.sh

#### Deploy to alpha.c9.io ####

Deploy to alpha.c9.io (every server, GCE and AWS) is done automatically by Jenkins CI server as soon
as there is a merge in master *and* every test passes.
To force a deploy:

1. ssh ubunutu@salt.c9.io
2. sudo salt 'newclient*-prod' state.highstate
3. wait to see the result in the output

To force the deploy of a specific commit, tag or branch you need to modify the file **/srv/salt/prodenv/newclientrepo.sls**
and change the rev parameter to the desired one:

    newclient_git:
      git.latest:
        - require:
          - file: '{{ pillar['home'] }}/.ssh/id_rsa_deploy'
          - file: '{{ pillar['home'] }}/.ssh/config'
        - target: {{ pillar['home'] }}/newclient
        - runas: {{ pillar['user'] }}
        - rev: master

To deploy the vfs:

    sudo salt 'vfs*-prod' state.highstate

