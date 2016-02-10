

_b9_npm() {
    local WORKDIR=$1
    shift

    # TODO run all build steps in a container
    if [ $(id -u) == "1000" ]; then
        docker run \
            --rm \
            -w /home/ubuntu/newclient \
            -v $WORKDIR:/home/ubuntu/newclient \
            --sig-proxy -a STDIN -a STDOUT -a STDERR \
            $(_b9_get_newclient_image) bash -c "
                echo \"$(_b9_npm_get_github_ssh)\" >> /home/ubuntu/.ssh/id_rsa_deploy
                chmod 600 /home/ubuntu/.ssh/id_rsa_deploy
                npm "$@"
            "
    else
        pushd $WORKDIR &> /dev/null
        $NPM "$@"
        popd &> /dev/null
    fi
}

_b9_npm_get_github_ssh() {
    local FILE
    for FILE in "$B9_GITHUB_SSH_FILE" ~/.ssh/id_rsa_c9robot ~/.ssh/id_rsa_deploy ~/.ssh/id_rsa; do
        if [ -e "$FILE" ]; then
            cat $FILE
            return
        fi
    done
    
    echo "Can't find SSH key for Github" 1>&2
    exit 1
}