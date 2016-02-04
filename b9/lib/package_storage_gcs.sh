_b9_package_is_cached_gcs() {
    local VERSION=$1
    gsutil ls gs://cloud9_ci_cache/$(basename $VERSION).tar.xz &> /dev/null
}

_d9_package_upload_gcs() {
    local WORKDIR=$1
    local VERSION=$2
    
    local TMP_TAR
    local CACHE_FILE
    
    CACHE_FILE=$(basename $WORKDIR)
    
    pushd $WORKDIR/.. &> /dev/null

    TMP_TAR=$(mktemp -d b9-package-XXXXXXXXXXXXX --tmpdir=$TMP)/$CACHE_FILE.tar.xz
    tar -cJf $TMP_TAR $CACHE_FILE
    gsutil cp $TMP_TAR gs://cloud9_ci_cache
    mv $TMP_TAR $TMP/$(basename $CACHE_FILE.tar.xz)
    
    popd &> /dev/null
}

_d9_package_download_gcs() {
    local VERSION=$1
    local CACHE_FILE=$TMP/${VERSION}.tar.xz
    
    if [ -f "$CACHE_FILE" ]; then
        echo $CACHE_FILE
        return
    fi
    
    gsutil cp gs://cloud9_ci_cache/$(basename $CACHE_FILE) $TMP
    echo $CACHE_FILE
}