Cloud9 3.0 SDK for Plugin Development
======================================

This is the core repository for the Cloud9 v3 SDK. The SDK allows you to run a version of Cloud9 that allows you to develop plugins and create a custom IDE based on Cloud9.
 
#### Project Status: *ALPHA*

During the alpha stage, expect many things to break, not work or simply fail.

#### Creating Plugins ####

The best and easiest way to create plugins is on c9.io. Please check out this tutorial for how to [get started writing plugins.](http://cloud9-sdk.readme.io/v0.1/docs/getting-started-with-cloud9-plugins)

We also have a tutorial for how to get started working on the core plugins. [Check out that tutorial here.](http://cloud9-sdk.readme.io/v0.1/docs/contributing-to-cloud9)

#### Documentation ####

We have several documentation resources for you:

<table>
    <tr><th>SDK documentation</th><td>http://cloud9-sdk.readme.io/v0.1/docs</td></tr>
    <tr><th>API documentation</th><td>http://docs.c9.io/api</td></tr>
    <tr><th>User documentation</th><td>http://docs.c9.io</td></tr>
</table>

Please join the mailinglist to get support or give support to the growing community of plugin developers:
https://groups.google.com/forum/#!forum/cloud9-sdk

#### Installation ####

Follow these steps to install the SDK:

    git clone git://github.com/c9/core.git c9sdk
    cd c9sdk
    scripts/install-sdk.sh
    
To update the SDK to the latest version run:

    git pull origin master
    scripts/install-sdk.sh
    
Please note that Cloud9 v3 is currently developed with Node.js 0.12 and 0.10. Newer versions of node should work too.

#### Starting Cloud9 ####

Start the Cloud9 as follows:

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
    --readonly       Run in read only mode
    --packed         Whether to use the packed version.
    --auth           Basic Auth username:password
    --collab         Whether to enable collab.
    --no-cache       Don't use the cached version of CSS

Now visit [http://localhost:8181/ide.html](http://localhost:8181/ide.html) to load Cloud9.

#### Running Tests ####

Run server side tests with:
    
    npm run test
    
Run client side tests with:

    npm run ctest
    
Then visit [http://localhost:8181/static/test](http://localhost:8181/static/test) in your browser.

#### Contributing ####

We actively encourage and support contributions. We accept pull requests to the core as well as to any of the open source plugins and libraries that we maintain under the c9 organization on GitHub.

Feel free to fork and improve/enhance the Cloud9 SDK and the open source plugins in any way you want. Then please open a pull request. For more information on our contributing guidelines, see our contributing guide: http://cloud9-sdk.readme.io/v0.1/docs/contributing-to-cloud9

To protect the interests of the Cloud9 contributors and users we require contributors to sign a Contributors License Agreement (CLA) before we pull the changes into the main repository. Our CLA is the simplest of agreements, requiring that the contributions you make to an ajax.org project are only those you're allowed to make. This helps us significantly reduce future legal risk for everyone involved. It is easy, helps everyone, takes ten minutes, and only needs to be completed once. There are two versions of the agreement:

1. [The Individual CLA](https://docs.google.com/a/c9.io/forms/d/1MfmfrxqD_PNlNsuK0lC2KSelRLxGLGfh_wEcG0ijVvo/viewform): use this version if you're working on the Cloud9 SDK or open source plugins in your spare time, or can clearly claim ownership of copyright in what you'll be submitting.
2. [The Corporate CLA](https://docs.google.com/a/c9.io/forms/d/1vFejn4111GdnCNuQ6BfnJDaxdsUEMD4KCo1ayovAfu0/viewform): have your corporate lawyer review and submit this if your company is going to be contributing to the Cloud9 SDK and/or open source plugins.

If you want to contribute to the Cloud9 SDK and/or open source plugins please go to the online form, fill it out and submit it.

Happy coding, Cloud9
