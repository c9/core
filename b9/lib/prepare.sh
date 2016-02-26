readonly NPMCACHE=$TMP

b9_prepare_usage() {
    echo "Usage: $B9 prepare [OPTIONS]"
    echo
    echo "Prepare checkout for testing"
    echo
    echo "Options:"
    echo "    --help       show this help message"
    exit 1
}

b9_prepare() {
    for ARG in "$@"; do
        case $ARG in
            --help|-h)
                usage
                ;;
            *)
                usage
                ;;
        esac
    done
    
    pushd $C9_DIR &> /dev/null
    
    # npm
    rm -rf node_modules
    git checkout -- node_modules
    _b9_install_deps
    git checkout -- node_modules
    
    popd &> /dev/null
}

_b9_install_deps() {
    if [ -f plugins/c9.profile/npm-shrinkwrap.json ]; then
        _b9_setup_node_modules npm-shrinkwrap.json
    fi
    
    if [ -f plugins/c9.profile/npm-shrinkwrap.json ]; then
        _b9_setup_node_modules plugins/c9.profile/npm-shrinkwrap.json
    fi
}
    
_b9_setup_node_modules() {
    local PACKAGE_FILE=$1
    local PACKAGE_PATH=$(dirname $PACKAGE_FILE)
    local PACKAGE=$(cat $PACKAGE_FILE | jq 'del(.version)')
    local GIT_HASH=$(git log --pretty=oneline -1 -- $PACKAGE_PATH/node_modules | awk '{ print $1 }')
    local PACKAGE_MD5=$(echo "$PACKAGE -- $GIT_HASH" | md5sum | awk '{print $1}')
    local CACHE_FILE="npm-${PACKAGE_MD5}.tar.xz"
    
    if [ -e "$TMP/$CACHE_FILE" ] || gsutil cp gs://cloud9_ci_cache/$CACHE_FILE $TMP &> /dev/null; then
        rm -rf $PACKAGE_PATH/node_modules
        tar -xkf $TMP/$CACHE_FILE || (
            rm $CACHE_FILE &>/dev/null 
            _b9_compile_node_modules "$CACHE_FILE" "$PACKAGE_PATH"
        )
    else
        _b9_compile_node_modules "$CACHE_FILE" "$PACKAGE_PATH"
    fi
}

_b9_compile_node_modules() {
    local CACHE_FILE=$1
    local PACKAGE_PATH=$2
    local NPM_CMD
    local TMP_TAR
    
    if ! _b9_npm "$(pwd)/$PACKAGE_PATH" install; then
        rm -rf node_modules
        git checkout node_modules
        _b9_npm "$(pwd)/$PACKAGE_PATH" install
    fi

    TMP_TAR=$(mktemp -d b9-npm-XXXXXXXXXXXXX --tmpdir=$TMP)/$CACHE_FILE
    tar -cJf $TMP_TAR $PACKAGE_PATH/node_modules
    
    gsutil cp $TMP_TAR gs://cloud9_ci_cache
    mv $TMP_TAR $TMP/$CACHE_FILE
}
