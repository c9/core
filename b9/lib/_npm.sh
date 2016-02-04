_b9_npm() {
    local WORKDIR=$1
    shift
    docker run --rm -w /home/ubuntu/newclient -v $WORKDIR:/home/ubuntu/newclient -v $HOME/.ssh/id_rsa_deploy:/home/ubuntu/.ssh/id_rsa_deploy:ro --sig-proxy -a STDIN -a STDOUT -a STDERR $(_b9_get_newclient_image) npm "$@"
    # pushd $WORKDIR
    # npm "$@"
    # popd
}