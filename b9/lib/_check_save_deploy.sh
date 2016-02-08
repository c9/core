_b9_check_save_deploy_usage() {
    echo "Use: check-deploy.sh --service=SERVICE [--server=SERVER] [--wait=WAIT_SECONDS] [--port=PORT]"
    exit 1
}

_b9_check_save_deploy() {
    local SERVICE
    local PORT
    local WAIT=default
    local SERVER=${SERVER:-localhost}
    
    local P
    for P in "$@"; do
        case "$P" in
            --wait=*)
                WAIT=${P#*=}
                ;;
            --server=*)
                SERVER=${P#*=}
                ;;
            --service=*)
                SERVICE=${P#*=}
                PORT=$(_do_get_setting $SERVICE.port)
                ;;
            --port=*)
                PORT=${P#*=}
                ;;
            *)
                echo "Illegal argument: $P"
                _b9_check_save_deploy_usage
        esac
    done
    
    if [ "$WAIT" == "default" ]; then
        WAIT=45
    elif [ "$WAIT" == "long" ]; then
        WAIT=60
    fi
    if [ ! "$PORT" ]; then
        _b9_check_save_deploy_usage
    fi
    
    for I in {1..160}; do
        if curl http://$SERVER:$PORT/_health &>/dev/null; then
            break
        fi
        sleep 1
    done
    
    echo "Service $SERVICE running, testing if it stays up for $WAIT seconds..."
    
    if ! curl http://$SERVER:$PORT/_health?delay=$((WAIT * 1000)) &>/dev/null; then
        echo "Failed: service $SERVICE at $SERVER:$PORT failed to stay up for $WAIT seconds" >&2
        echo "Likely it exited with an error, shown in raygun, or the process was killed." >&2
        echo "" >&2
        
        echo "Recent errors in service log that might help debug this:" >&2
        if [ "$SERVICE" ] && [ "$(type -t ssh)" != "function" ]; then
            echo "Warning: ssh function not defined, trying gssh instead"
            gssh $SERVER ${SERVICE//_/-}/scripts/tail-log.sh $(_do_get_setting $SERVICE.logFile) >&2
        elif [ "$SERVICE" ]; then
            ssh $SERVER ${SERVICE//_/-}/scripts/tail-log.sh $(_do_get_setting $SERVICE.logFile) >&2
        fi
        echo >&2
        
        return 1
    fi
    
    echo "Confirmed successful deploy to $SERVER!"
}