readonly B9_PACKAGE_GIT_CACHE=$C9_DIR

b9_package_usage() {
    echo "Usage: $B9 package TREEISH [ARG...]"
    echo
    echo "Package and upload a version of Cloud 9"
    echo
    echo "Options:"
    echo "  --settings=[all|beta|deploy|onlinedev]      (default: all)"
    echo "  --type=[newclient|docker]                   (default: newclient)"
    echo "  --no-cache"
    exit 1
}

b9_package() {
    [ "$1" == "--help" ] && b9_package_usage
    
    local TREEISH=$1
    local TYPE=newclient
    local SETTINGS=all
    local STORAGE=gcs
    local USE_CACHE=1
    
    [ -z "$TREEISH" ] && b9_package_usage
    shift
    
    local ARG
    for ARG in "$@"; do
        case $ARG in
            --settings=*)
                SETTINGS="${ARG#*=}"
                shift
                ;;
            --type=*)
                TYPE="${ARG#*=}"
                shift
                ;;
            --docker)
                STORAGE=docker
                shift
                ;;
            --no-cache)
                USE_CACHE=0
                shift
                ;;
            *)
                b9_package_usage
                ;;
        esac
    done
    
    local VERSION
    local WORKDIR
    
    [ "$TYPE" == "newclient" ] && SETTINGS=all
    if [ "$TYPE" == "docker" ] && [ "$SETTINGS" == "all" ]; then
        echo "You must define settings when packaging the docker daemon" 1>&2
        exit 1
    fi
   
    _b9_package_init_git_cache
   
    VERSION=$(_b9_get_version $TREEISH $TYPE $SETTINGS)
   
    if [ "$USE_CACHE" == "1" ] && _b9_package_is_cached $STORAGE $VERSION; then
        echo $VERSION
        return
    fi
    
    WORKDIR=$(_d9_package_init_work_dir $VERSION)
    _d9_package_sync_workdir $TYPE $WORKDIR $VERSION $SETTINGS
    _d9_package_npm_install $WORKDIR
    _d9_package_cleanup_workdir $WORKDIR
    _d9_package_upload_${STORAGE} $WORKDIR $VERSION
    
    echo $VERSION
}

_b9_package_init_git_cache() {
    pushd $B9_PACKAGE_GIT_CACHE &> /dev/null
    
    if [ ! -d .git ]; then
        git clone git@github.com:c9/newclient.git .
    fi
    
    git fetch origin

    popd &> /dev/null
}

_d9_package_init_work_dir() {
    local VERSION=$1
    local WORK_DIR=$TMP/${VERSION}
    mkdir -p $WORK_DIR
    
    echo $WORK_DIR
}

_b9_get_version() {
    local TREEISH=$1
    local TYPE=${2:-newclient}
    local SETTINGS=${3:-all}
    
    pushd $B9_PACKAGE_GIT_CACHE &> /dev/null
    echo c9-${TYPE}-${SETTINGS}-$(git show $TREEISH:package.json | jq -r .version)-$(git rev-parse --short=8 $TREEISH)
    popd &> /dev/null
}

_b9_package_is_cached() {
    local STORAGE=$1
    local VERSION=$2
    
    case $STORAGE in
        gcs)
            _b9_package_is_cached_gcs $VERSION
            ;;
        docker)
            _b9_package_is_cached_docker $VERSION
            ;;
        *)
            echo "Invalid storage type: $STORAGE"
            exit 1
            ;;
    esac
}

_d9_package_upload() {
    local STORAGE=$1
    local $WORKDIR=$2
    local $VERSION=$3

    case $STORAGE in
        gcs)
            _d9_package_upload_gcs $WORKDIR $VERSION
            ;;
        docker)
            _d9_package_upload_docker $WORKDIR $VERSION
            ;;
        *)
            exit 1
            ;;
    esac
}

_d9_package_sync_workdir() {
    local TYPE=$1
    local WORKDIR=$2
    local VERSION=$3
    local SETTINGS=$4
    
    case $TYPE in
        newclient)
            _d9_package_sync_workdir_newclient $WORKDIR $VERSION $SETTINGS
            ;;
        docker)
            _d9_package_sync_workdir_docker $WORKDIR $VERSION $SETTINGS
            ;;
        *)
            exit 1
            ;;
    esac
}

_d9_package_npm_install() {
    local WORKDIR=$1
    
    pushd $WORKDIR &> /dev/null
    _b9_install_deps
    popd &> /dev/null
}

_d9_package_cleanup_workdir() {
    local WORKDIR=$1
    local REVISION
    [ -z "$WORKDIR" ] && return 1
    
    pushd $WORKDIR &> /dev/null
    
    _d9_package_patch_package_json
    rm -rf .git build bin local

    popd &> /dev/null
}

_d9_package_patch_package_json() {
    [ ! -d .git ] && return 0
    
    REVISION=$(git rev-parse HEAD)
    mv package.json _package.json
    cat _package.json | jq ".revision=\"$REVISION\"" > package.json
    rm _package.json
}

_do_check_package() {
    b9_package origin/master --type=newclient --no-cache
    b9_package origin/master --type=newclient
    b9_package origin/master --type=docker --settings=deploy --no-cache
    b9_package origin/master --docker --no-cache
}