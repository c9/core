set -ex

SOURCE="$1"
TARGET="$2"
URL="$3"
DIR="$4"


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
        DOWNLOAD="wget --no-check-certificate -nc"
    elif has "curl"; then
        DOWNLOAD="curl -sSOL"
    else
        echo "Error: you need curl or wget to proceed" >&2;
        exit 20
    fi

    echo "Downloading... $URL"
    printf "\e[01;30m"
    $DOWNLOAD "$URL"
    printf "\e[0m"
    
    SOURCE="$TARGET/$(basename $URL)"
fi

# Make sure package is in the target folder
if [ "$(dirname "$SOURCE")" != "$(dirname "$TARGET"/x)" ]; then
    cp -a "$SOURCE" "$TARGET"
    SOURCE="$TARGET/$(basename "$SOURCE")"
fi

# Unpack source
echo "Unpacking... $SOURCE"
printf "\e[01;30m"
tar -U -zxf "$SOURCE"
printf "\e[0m"

# Delete package
rm -Rf $SOURCE

# Move directory
if [ "$DIR" ]; then
    echo "Merging... $TARGET/$DIR in $TARGET"
    
    merge() {
        mkdir -p "c9_tmp"
        rm -rf "c9_tmp/$DIR"
        mv "$DIR" "c9_tmp/$DIR"
        mv "c9_tmp/$DIR/"* .
        set +e
        mv "c9_tmp/$DIR/."* . 2>/dev/null
        set -e
        rm -rf "c9_tmp"
    }

    printf "\e[01;30m"
    merge
    printf "\e[0m"
fi