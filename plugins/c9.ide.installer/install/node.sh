set -e

has() {
  type "$1" > /dev/null 2>&1
  return $?
}

if has "wget"; then
    DOWNLOAD="wget --no-check-certificate -nc"
elif has "curl"; then
    DOWNLOAD="curl -sSOL"
else
    echo "Error: you need curl or wget to proceed" >&2;
    exit 1
fi

C9_DIR="$HOME/.c9"
NPM="$C9_DIR/node/bin/npm"
cd "$C9_DIR"

download_virtualenv() {
  VIRTUALENV_VERSION="virtualenv-12.0.7"
  $DOWNLOAD "https://pypi.python.org/packages/source/v/virtualenv/$VIRTUALENV_VERSION.tar.gz"
  tar xzf $VIRTUALENV_VERSION.tar.gz
  rm $VIRTUALENV_VERSION.tar.gz
  mv $VIRTUALENV_VERSION virtualenv
}

check_python() {
  if which python2.7 &> /dev/null; then
    PYTHONVERSION="2.7"
    PYTHON="python2.7"
  else
    PYTHONVERSION=`python --version 2>&1`
    PYTHON=python
  fi
  
  if [[ $PYTHONVERSION != *2.7* ]]; then
    echo "Python version 2.7 is required to install pty.js. Please install python 2.7 and try again. You can find more information on how to install Python in the docs: https://docs.c9.io/ssh_workspaces.html"
    exit 100
  fi
}

configure_python() {
  check_python
  # when gyp is installed globally npm install pty.js won't work
  # to test this use `sudo apt-get install gyp`
  if [ `"$PYTHON" -c 'import gyp; print gyp.__file__' 2> /dev/null` ]; then
    echo "You have a global gyp installed. Setting up VirtualEnv without global pakages"
    rm -rf virtualenv
    rm -rf python
    installed=
    if has virtualenv; then
      # try global virtualenv first
      (virtualenv -p python2.7  "$C9_DIR/python") && installed=1
    fi
    
    if ! [ "$installed" ]; then
      download_virtualenv
      "$PYTHON" virtualenv/virtualenv.py -p python2.7 "$C9_DIR/python"
    fi
    if [[ -f "$C9_DIR/python/bin/python2" ]]; then
      PYTHON="$C9_DIR/python/bin/python2"
    else
      echo "Unable to setup virtualenv"
      exit 1
    fi
  fi
  "$NPM" config -g set python "$PYTHON"
  "$NPM" config -g set unsafe-perm true
}

# use local npm cache
"$NPM" config -g set cache  "$C9_DIR/tmp/.npm"


PYTHON=python
configure_python

