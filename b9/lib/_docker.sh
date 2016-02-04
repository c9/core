_DO_NEWCLIENT_IMAGE=
_b9_get_newclient_image() {
    if [ ! -z "$_DO_NEWCLIENT_IMAGE" ]; then
        echo $_DO_NEWCLIENT_IMAGE
        return
    fi
    
    local RESULT=$(docker build -t newclient --rm $B9_DIR/containers/newclient)
    if [[ $(echo "$RESULT" | tail -n1) =~ Successfully\ built ]]; then
        _DO_NEWCLIENT_IMAGE=$(echo "$RESULT" | tail -n1 | awk '{print $3}')
        echo $_DO_NEWCLIENT_IMAGE
        return
    fi
    
    echo $RESULT
    return 1
}