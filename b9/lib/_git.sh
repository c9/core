_b9_git_get_hash() {
    pushd $C9_DIR &> /dev/null

    git rev-parse HEAD
    
    popd &> /dev/null
}

_b9_git_get_hash_short() {
    pushd $C9_DIR &> /dev/null

    git rev-parse --short=10 HEAD
    
    popd &> /dev/null
}