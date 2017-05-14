set -e

TASK=$0

has() {
  type "$1" > /dev/null 2>&1
  return $?
}

if has "wget"; then
    DOWNLOAD="wget --no-check-certificate -nc -nv"
elif has "curl"; then
    DOWNLOAD="curl -sSOL"
else
    echo "Error: you need curl or wget to proceed" >&2;
    exit 20
fi

if ! has "brew"; then
    ruby -e "$($DOWNLOAD https://raw.githubusercontent.com/mxcl/homebrew/go/install)"
fi

brew install $TASK > /dev/null ||
    (brew remove $TASK &>/dev/null && brew install $TASK)