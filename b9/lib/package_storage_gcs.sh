_b9_package_is_cached_gcs() {
    local VERSION=$1
    gsutil ls gs://cloud9_ci_cache/$(basename $VERSION).tar.xz &> /dev/null
}

_b9_package_upload_gcs() {
    local WORKDIR=$1
    local VERSION=$2
    
    local TMP_TAR
    local CACHE_FILE
    
    pushd $WORKDIR/.. &> /dev/null

    TMP_TAR=$(mktemp b9-package-XXXXXXXXXXXXX --tmpdir=$TMP --suffix=.tar.xz)
    tar --transform="s/^$(basename $WORKDIR)/$VERSION/" -cJf $TMP_TAR $(basename $WORKDIR)
    gsutil cp $TMP_TAR gs://cloud9_ci_cache/$VERSION.tar.xz
    mv $TMP_TAR $TMP/$VERSION.tar.xz
    
    popd &> /dev/null
}

_b9_package_download_gcs() {
    local VERSION=$1
    local CACHE_FILE=$TMP/${VERSION}.tar.xz
    
    if [ -f "$CACHE_FILE" ]; then
        echo $CACHE_FILE
        return
    fi
    
    gsutil cp gs://cloud9_ci_cache/$(basename $CACHE_FILE) $TMP
    echo $CACHE_FILE
}