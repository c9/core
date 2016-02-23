readonly B9_DOCKER_REGISTRY=gcr.io/c9.io/cloud9gce
readonly B9_DOCKER_BUCKET=gs://artifacts.cloud9gce.c9.io.a.appspot.com

_b9_dockerize_update_base() {
    local TREEISH=origin/master
    
    local CID
    local VERSION
    
    # build package
    local TMPFILE=$(mktemp --tmpdir=$TMPDIR)
    b9_package $TREEISH --type=newclient | tee $TMPFILE
    VERSION=$(cat $TMPFILE | tail -n1)
    rm $TMPFILE
    
    # build base image
    docker build -t $B9_DOCKER_REGISTRY/c9:base $B9_DIR/containers/c9
    
    CID=$(docker run -d $B9_DOCKER_REGISTRY/c9:base sleep 1h)
    
    # copy package to base
    docker exec $CID bash -c "
        cd /home/ubuntu &&
        tar xf $TMP/$VERSION.tar.xz
        rm -rf $VERSION.tgz newclient
        mv $VERSION newclient"
    
    # commit image
    docker stop $CID
    docker commit $CID $B9_DOCKER_REGISTRY/c9:base
    
    # push
    gcloud docker push $B9_DOCKER_REGISTRY/c9:base
}

_b9_package_is_cached_docker() {
    local VERSION=$1
    local TAG
    
    TAG=$(echo $VERSION | awk -F- '{printf "%s-%s", $4, $5}')
    _b9_dockerize_has_tag c9 $TAG
}

_b9_package_upload_docker() {
    local WORKDIR=$1
    local VERSION=$2

    local CID
    local TAG
    
    gcloud docker pull $B9_DOCKER_REGISTRY/c9:base
    
    CID=$(docker run -d -v $WORKDIR:/home/ubuntu/$(basename $WORKDIR):ro $B9_DOCKER_REGISTRY/c9:base sleep 1h)
    
    # copy package
    docker exec $CID bash -c "
        cd /home/ubuntu &&
        rsync -qrt --delete --checksum /home/ubuntu/$(basename $WORKDIR)/* newclient"
    
    # commit image
    TAG=$(echo $VERSION | awk -F- '{printf "%s-%s", $4, $5}')
    docker stop $CID
    docker commit $CID $B9_DOCKER_REGISTRY/c9:$TAG
    
    # push
    gcloud docker push $B9_DOCKER_REGISTRY/c9:$TAG
}

_b9_dockerize_has_tag() {
    local REPO=$1
    local TAG=$2
    
    gsutil ls $B9_DOCKER_BUCKET/containers/repositories/library/${REPO}/tag_${TAG}
}
