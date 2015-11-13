Cloud9 3.0
============

The new VFS based Cloud9.

#### Installation ####

Installing newclient is super simple.

    git clone git@github.com:ajaxorg/newclient.git
    cd newclient
    npm install

Installing the node-webkit based newclient has more steps:

1. Download the OSX node-webkit [https://s3.amazonaws.com/node-webkit/v0.5.1/node-webkit-v0.5.1-osx-ia32.zip](here).
2. Install nw-gyp (via your favorite package manager)
3. Run scripts/install-nw-pty.sh

#### Starting the VFS server ####

    node server.js

The following options can be used:

    -t          Start in Testing Mode
    -d          Start in Debug Mode
    -k          Don't kill tmux at startup (only relevant when -t is set)
    -w [path]   Use [path] as workspace root dir. Defaults to root dir of project.
    -p [port]   Set the port to [port]. Defaults to 8181.
    -l [host]   Set the host to [host]. Defaults to 0.0.0.0.

#### Starting node webkit version ####

Assuming node-webkit is installed and the nw command is the alias for node-webkit.

    nw local

There's support for -w to specify the workspace directory and an arbitrary number of args specifying the files to open:

	nw local -w `pwd` server.js

You can also open via bin/c9

	bin/c9 open -w . server.js

#### Building the local version ####

Run the following command to build a .app file for OSX:

    cd build; ./node-webkit-osx.sh

This will create a cloud9.app in the build/output directory. You can also specify the following options

    dmg     This creates a cloud9.dmg in the build/output directory
    install This will create a cloud9.app in ~/Applications

To create an update package run
    
    cd build; ./local-update.sh

This will build a new .tar.gz and .zip file and point build/output/latest.tar.gz (and .zip) to those files.

#### Load full UI in the browser ####

[http://localhost:8181/static/index.html](http://localhost:8181/static/index.html)

The plugin configuration for development mode is in configs/client-default.js.

To start the full UI in development mode use the following url:

[http://localhost:8181/static/index.html?devel=1](http://localhost:8181/static/index.html?devel=1)

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

