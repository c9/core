_b9_init_mode() {
    local SUFFIX
    SUFFIX=$(hostname | sed 's/.*-//')
    local MODE

    case $SUFFIX in
        prod)
            MODE=deploy
            ;;
        dev)
            MODE=devel
            shift
            ;;
        test)
            MODE=test
            ;;
        onlinedev)
            MODE=$SUFFIX
            ;;
        *)
            MODE=devel
            ;;
    esac

    if [ ! "$MODE" ]; then
        MODE=devel
    fi
    echo $MODE
}

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
    for NODEJS in $(which node 2>/dev/null) $(which nodejs 2>/dev/null) /usr/local/bin/node /usr/bin/nodejs; do
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
    
    . ~/.nvm/nvm.sh &> /dev/null || :
    for NPM in $(which npm) /usr/local/bin/npm /usr/bin/npm; do
        [ -x $NPM ] && break
        NPM=""
    done
    
    if [ -z "$NPM" ]; then
        echo "Can't find npm executable" 1>&2
        exit 1
    fi
    
    echo $NODEJS $NPM
}

_B9_NODE_HELPER_INITIALIZED=0

_b9_init_node_helper() {
    [ "$_B9_NODE_HELPER_INITIALIZED" == "1" ] && return
    _B9_NODE_HELPER_INITIALIZED=1
    
    pushd $B9_DIR/lib/js &> /dev/null
    rm -rf node_modules
    $NPM install
    popd &> /dev/null
}
