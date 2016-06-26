=== Listing plugins
When running in debug mode use the following env variables to work with the dev api:

NODE_TLS_REJECT_UNAUTHORIZED=0 C9_APIHOST=api.c9.dev

Also ensure you run api locally. 

=== Installing plugins
To install you need to specify a projectId on the command line. Go to 
https://api.c9.dev/user/projects and get an id of a project you own then add:

C9_PID=<id>

before c9 install

Curl command to test installing:

curl -XPOST -k -v -u timjrobinson:password https://api.c9.dev/projects/90/install/awesome/0.0.1

Example install command:

NODE_TLS_REJECT_UNAUTHORIZED=0 C9_APIHOST=api.c9.dev C9_PID=90 c9 install <name>

NODE_TLS_REJECT_UNAUTHORIZED=0 C9_APIHOST=api.cloud9beta.com c9 install <name>
