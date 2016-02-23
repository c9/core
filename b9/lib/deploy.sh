b9_deploy_usage() {
    echo "Usage: $B9 deploy SERVICES TREEISH SERVER_PATTERN [ARG...]"
    echo
    echo "Deploy a Cloud9 version"
    echo
    echo "Options:"
    echo "  --strategy=[slow_start|parallel|serial] Deploy strategy to use (default: slow_start)"
    echo "  --regex                                 Interpret server patter as regular expression"
    echo "  --no-check                              skip the health check"
    exit 1
}

b9_deploy() {
    [ "$1" == "--help" ] && b9_deploy_usage
    
    local SERVICES=$1 && shift
    local TREEISH=$1 && shift
    local SERVER_PATTERN=$1 && shift
    
    local DRY_RUN=""
    local ASSET="gcs"
    local USE_REGEX=""
    local NO_CHECK=""
    local TYPE=newclient
    local STRATEGY=slow_start
    
    [ -z "$SERVICES" ] && b9_deploy_usage
    [ -z "$TREEISH" ] && b9_deploy_usage
    [ -z "$SERVER_PATTERN" ] && b9_deploy_usage
    
    local ARG
    for ARG in "$@"; do
        case $ARG in
            --strategy=*)
                STRATEGY="${ARG#*=}"
                shift
                ;;
            --docker)
                ASSET="docker"
                shift
                ;;
            --no-check)
                NO_CHECK="--no-check"
                shift
                ;;
            --regex)
                USE_REGEX="--regex"
                shift
                ;;
            --dry-run)
                DRY_RUN="1"
                shift
                ;;
            --help)
                b9_deploy_usage
                shift
                ;;
            *)
                b9_deploy_usage
                ;;
        esac
    done
    
    [ "$SERVICES" == "docker" ] && TYPE=docker
    
    local SERVER_LIST
    local VERSION
    
    local TMPFILE=$(mktemp --tmpdir=$TMPDIR)
    b9_package $TREEISH --type=$TYPE | tee $TMPFILE
    VERSION=$(cat $TMPFILE | tail -n1)
    rm $TMPFILE

    SERVER_LIST="$(_b9_deploy_server_list $SERVER_PATTERN $USE_REGEX)"
    local CMD="$B9 --settings=$MODE exec _b9_deploy_one_from_${ASSET} $NO_CHECK $VERSION $SERVICES"
    if [ "$DRY_RUN" == "1" ]; then
        CMD="echo $CMD"
    fi
    
    _b9_deploy_release_event "$SERVICES" $VERSION $SERVER_PATTERN
    _b9_deploy_strategy_${STRATEGY} "$SERVER_LIST" "$CMD"
}

_b9_deploy_strategy_slow_start() {
    local SERVER_LIST=$1
    local CMD=$2
    
    # first one
    $CMD $(echo "$SERVER_LIST" | head -n1)
    
    # then two
    echo "$SERVER_LIST" | tail -n +2  | head -n2 | parallel --halt 1 $CMD
    
    # then the rest
    echo "$SERVER_LIST" | tail -n +4 | parallel --halt 1 -j 15 $CMD
}

_b9_deploy_strategy_parallel() {
    local SERVER_LIST=$1
    local CMD=$2
    
    # first one
    $CMD $(echo "$SERVER_LIST" | head -n1)
    
    # then the rest
    echo "$SERVER_LIST" | tail -n +2 | parallel --halt 1 -j 30 $CMD
}

_b9_deploy_strategy_serial() {
    local SERVER_LIST=$1
    local CMD=$2
    
    echo "$SERVER_LIST" | xargs -n1 $CMD
}

_b9_deploy_server_list () {
    local SERVER_PATTERN=$1
    local USE_REGEX=$2
    $C9_DIR/scripts/gssh --no-cache $USE_REGEX --print-names "$SERVER_PATTERN" | shuf
}

_b9_deploy_one_from_gcs() {
    local NO_CHECK=$1
    if [ "$NO_CHECK" == "--no-check" ]; then
        shift
    else
        NO_CHECK=""
    fi
    
    local VERSION=$1
    local SERVICES=$2
    local SERVER=$3

    echo Deploying $VERSION \($SERVICES\) to $SERVER ... >&2

    _b9_deploy_upload_from_gcs $VERSION $SERVER
    _b9_deploy_update_services $VERSION $SERVICES $SERVER
    [ -z "$NO_CHECK" ] && _b9_deploy_check $SERVER $SERVICES

    echo Deployed $VERSION to $SERVER >&2
}

_b9_deploy_upload_from_gcs() {
    local VERSION=$1
    local SERVER=$2

    local TGZ
    TGZ=$(_b9_package_download_gcs $VERSION)
    
    local VERSIONS_DIR="/home/ubuntu/versions"
    local TARGET_FILE=${VERSIONS_DIR}/$(basename $TGZ)
    local TARGET_DIR=${VERSIONS_DIR}/$(basename $TGZ ".tar.xz")


    _b9_deploy_ssh $SERVER "rm -rf $TARGET_DIR $TARGET_FILE; mkdir -p /home/ubuntu/versions/history"
    _b9_deploy_scp $TGZ $SERVER:$TARGET_FILE
    _b9_deploy_ssh $SERVER "cd /home/ubuntu/versions && tar xf $TARGET_FILE && rm $TARGET_FILE"
}

_b9_deploy_update_services() {
    local VERSION=$1
    local SERVICES=$2
    local SERVER=$3

    local TOTAL_VERSIONS_TO_KEEP=7

    local VERSIONS_DIR="/home/ubuntu/versions"
    local TARGET_DIR=${VERSIONS_DIR}/$VERSION
    local BUILD_NAME=$(echo $VERSION | awk -F- '{printf "%s-%s-%s", $1, $2, $3}')
    
    _b9_deploy_ssh $SERVER "
        for SERVICE in $(echo $SERVICES | sed 's/,/ /g'); do
            mv /home/ubuntu/\$SERVICE /home/ubuntu/versions/history/\$SERVICE-$(date +%FT%T) &>/dev/null;
            ln -s $TARGET_DIR /home/ubuntu/\$SERVICE;
        done
        ~/supervisord_start_script.sh || ~/supervisord_start_script.sh -f || ~/supervisord_start_script.sh -f;
        cd /home/ubuntu/versions;
        USED_VERSIONS=\$(ls -l /home/ubuntu | grep -F -- '-> /home/ubuntu/versions' | awk -F'-> ' '{print \$2}' | awk -F/ '{print \$(NF)}');
        ls -t 2>/dev/null | grep $BUILD_NAME | grep -v -F \"\$USED_VERSIONS\" | tail -n +$TOTAL_VERSIONS_TO_KEEP | xargs sudo rm -rf;"
}

_b9_deploy_check() {
    local SERVER=$1
    local SERVICES=$2
    
    echo $SERVICES | sed 's/,/\n/g' | parallel --halt 1 -j 0 $B9 exec _b9_deploy_check_one $SERVER
}

_b9_deploy_check_one() {
    local SERVER=$1
    local SERVICE=$2
    
    local HOST
    local PORT
    local WAIT=default
    HOST=$(echo $SERVER | awk -F@ '{ print $2}')
    
    if [ "$SERVICE" == "oldclient" ]; then
        SERVICE="c9"
    elif [ "$SERVICE" == "docker" ]; then
        WAIT=long
        SERVICE="docker-daemon"
    elif [[ $SERVICE =~ ^vfs-[0-9]$ ]]; then
        PORT="--port=804$(echo $SERVICE | awk -F- '{print $2}')"
        SERVICE="vfs"
    else
        SERVICE=${SERVICE//-/_}
    fi
    
    if ! _b9_check_save_deploy --wait=$WAIT $PORT --server=$HOST --service=$SERVICE; then
      echo "One or more safe deploy checks failed :(" >&2
      exit 1
    fi
}

_b9_deploy_release_event() {
    local SERVICES=$1
    local VERSION=$2
    local SERVER_PATTERN=$3

    _b9_init_node_helper
    echo $SERVICES | sed 's/,/\n/g' | xargs -I '{}' -n1 $NODEJS $B9_DIR/lib/js/release_event.js '{}' $MODE $VERSION $SERVER_PATTERN
}

_b9_deploy_ssh() { 
    /usr/bin/ssh \
        -o LogLevel=ERROR \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -i $(find ~/.ssh/ -name "*" | grep -Pe "./(google_compute_engine|id_rsa_ansible|id_rsa)$" | head -1)\
        "$@"
}

_b9_deploy_scp() { 
    /usr/bin/scp \
        -o LogLevel=ERROR \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -i $(find ~/.ssh/ -name "*" | grep -Pe "./(google_compute_engine|id_rsa_ansible|id_rsa)$" | head -1) \
        "$@"
}
