set -e

SOURCE=$0
TARGET=$1
URL=$2
DIR=$3

has() {
  type "$1" > /dev/null 2>&1
  return $?
}

if [ ! "$SOURCE" ] || [ ! "$URL" ] || [ ! "$TARGET" ]; then
    echo "Error: missing source and/or target" >&2;
    exit 10
fi

if [ "$DIR" ]; then
    set +e
    rm -Rf "$TARGET" 2>/dev/null
    set -e
fi

mkdir -p "$TARGET"
cd "$TARGET"

# Download file if needed
if [ "$URL" ]; then

    if has "wget"; then
        DOWNLOAD="wget --no-check-certificate -nc -nv"
    elif has "curl"; then
        DOWNLOAD="curl -sSOL"
    else
        echo "Error: you need curl or wget to proceed" >&2;
        exit 20
    fi

    echo "Downloading... $URL"
    $DOWNLOAD "$URL" 2> >(while read line; do echo -e "\e[01;30m$line\e[0m" >&2; done)
    
    SOURCE="$TARGET/$(basename $URL)"
fi

# Make sure package is in the target folder
if [ `dirname $SOURCE` != $TARGET ]; then
    cp -a "$SOURCE" "$TARGET"
    SOURCE="$TARGET/$(basename $SOURCE)"
fi

# Unpack source
echo "Unpacking... $SOURCE"
unzip -q -o "$SOURCE" 2> >(while read line; do echo -e "\e[01;30m$line\e[0m" >&2; done)

# Delete package
rm -Rf $SOURCE

# Move directory
if [ "$DIR" ]; then
    echo "Merging... $TARGET/$DIR in $TARGET"
    
    merge() {
        mv "$DIR" "/tmp/$DIR"
        mv "/tmp/$DIR/"* .
        set +e
        mv "/tmp/$DIR/."* . 2>/dev/null
        set -e
        rmdir "/tmp/$DIR"
    }
    
    merge 2> >(while read line; do echo -e "\e[01;30m$line\e[0m" >&2; done)
fi