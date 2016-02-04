_b9_init_temp() {
    local TMPDIR
    local UNAME=$(id -n -u)

    for TMPDIR in /var/lib/docker/tmp /tmp; do
        TMPDIR=$TMPDIR/$UNAME
        mkdir -p $TMPDIR &> /dev/null && break
        TMPDIR=""
    done

    if [ -z "$TMPDIR" ]; then
        echo "Can't find temp dir" 1>&2
        exit 1
    fi
    
    rm $(mktemp --tmpdir=$TMPDIR)
    
    echo $TMPDIR
}

_b9_init_nodejs() {
    local NODEJS
    
    . ~/.nvm/nvm.sh &> /dev/null || :
    for NODEJS in $(which node) $(which nodejs) /usr/local/bin/node /usr/bin/nodejs; do
        [ -x $NODEJS ] && break
        NODEJS=""
    done
    
    if [ -z "$NODEJS" ]; then
        echo "Can't find node executable" 1>&2
        exit 1
    fi
    
    echo $NODEJS
}

_b9_init_npm() {
    local NPM
    
    for NPM in $(which npm) /usr/local/bin/npm /usr/bin/npm; do
        [ -x $NPM ] && break
        NPM=""
    done
    
    if [ -z "$NPM" ]; then
        echo "Can't find npm executable" 1>&2
        exit 1
    fi
    
    echo $NPM
}