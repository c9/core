_b9_package_sync_workdir_newclient() {
    local WORKDIR=$1
    local VERSION=$2
    local HASH
    
    HASH=$(echo $VERSION | awk -F- '{print $5}')
    
    rm -rf $WORKDIR
    mkdir -p $WORKDIR
    
    pushd $WORKDIR &> /dev/null
    rsync -qrtv --delete $B9_PACKAGE_GIT_CACHE/.git $WORKDIR/
    git reset --hard
    git checkout $HASH

    popd &> /dev/null
}