_b9_package_sync_workdir_docker() {
    local WORKDIR=$1
    local VERSION=$2
    local SETTINGS=$3
    local SOURCE=$WORKDIR/source
    
    pushd $WORKDIR &> /dev/null
    
    _b9_package_docker_init_source $WORKDIR $SOURCE $VERSION $SETTINGS
    _b9_package_docker_init_workdir
    
    _b9_init_node_helper
    _b9_package_docker_node_modules $WORKDIR $SOURCE $SETTINGS
    _b9_package_docker_generate_settings $WORKDIR $SOURCE $SETTINGS
    _b9_package_docker_include_files $WORKDIR $SOURCE $SETTINGS
    _b9_package_docker_copy_plugins $WORKDIR $SOURCE $SETTINGS
    
    rm -rf $SOURCE
    
    popd &> /dev/null
}

_b9_package_docker_init_source() {
    local WORKDIR=$1
    local SOURCE=$2
    local VERSION=$3
    local SETTINGS=$4
    
    rm -rf $WORKDIR
    mkdir -p $SOURCE
    
    _b9_package_sync_workdir_newclient $SOURCE $VERSION $SETTINGS
    _b9_package_npm_install $SOURCE
}

_b9_package_docker_init_workdir() {
    mkdir -p plugins
    mkdir -p node_modules
    mkdir -p settings
    mkdir -p configs
}

_b9_package_docker_node_modules() {
    local WORKDIR=$1
    local SOURCE=$2
    local SETTINGS=$3
    local NODE_MODULES
    local MODULE
    
    NODE_PATH=$B9_DIR/lib/js/node_modules:$C9_DIR/node_modules:$NODE_PATH $NODEJS $B9_DIR/lib/js/filter_node_modules.js docker --targetFile=$WORKDIR/package.json --source=$SOURCE --settings=$SETTINGS
    
    NODE_MODULES=$(cat $WORKDIR/package.json | jq -r '.dependencies | keys | @sh')
    
    mkdir -p $WORKDIR/node_modules
    for MODULE in $NODE_MODULES; do
        MODULE=${MODULE:1:-1}
        if [ -d $SOURCE/node_modules/$MODULE ]; then
            cp -a $SOURCE/node_modules/$MODULE $WORKDIR/node_modules
        fi
    done
    
    pushd $WORKDIR &> /dev/null
    _b9_npm "$WORKDIR" install

    popd &> /dev/null
}

_b9_package_docker_generate_settings() {
    local WORKDIR=$1
    local SOURCE=$2
    local SETTINGS=$3

    $NODEJS $B9_DIR/lib/js/generate_settings.js docker --targetFile=$WORKDIR/settings/$SETTINGS.js --source=$SOURCE --settings=$SETTINGS
}

_b9_package_docker_include_files() {
    local WORKDIR=$1
    local SOURCE=$2
    local SETTINGS=$3

    local BUILD_CONFIG
    local FILE_MODULES_INCLUDE
    local PATTERN
    
    pushd $WORKDIR &> /dev/null
    
    BUILD_CONFIG=$($NODEJS -e "console.log(JSON.stringify(require('$SOURCE/configs/docker').buildConfig({mode: '$SETTINGS'})))")
    FILE_INCLUDE=$(echo $BUILD_CONFIG | jq -r '.fileInclude | @sh')
    
    for PATTERN in $FILE_INCLUDE; do
        PATTERN=${PATTERN:1:-1}
        mkdir -p $(dirname $PATTERN)
        cp -a -R $SOURCE/$PATTERN $(dirname $PATTERN)
    done
    
    for PATTERN in "server.js" "scripts/tail-log.sh" "configs/docker.js"; do
        mkdir -p $(dirname $PATTERN)
        cp -a -R $SOURCE/$PATTERN $(dirname $PATTERN) || :
    done
    
    popd &> /dev/null
}

_b9_package_docker_copy_plugins() {
    local WORKDIR=$1
    local SOURCE=$2
    local SETTINGS=$3
    
    local PLUGINS
    local PLUGIN

    PLUGINS=$($NODEJS $B9_DIR/lib/js/list_plugins.js docker --source=$SOURCE --settings=$SETTINGS)
    for PLUGIN in $PLUGINS; do
        cp -a $SOURCE/plugins/$PLUGIN $WORKDIR/plugins
    done
}
