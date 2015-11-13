rm ~/.c9/installed 2> /dev/null
rm ~/.c9/version 2> /dev/null
rm -Rf ~/.c9/bin 2> /dev/null
rm -Rf ~/.c9/lib 2> /dev/null
rm -Rf ~/.c9/node_modules 2> /dev/null

if [ -d /Applications/Cloud9.app ]; then
    rm -Rf /Applications/Cloud9.app 2> /dev/null
fi