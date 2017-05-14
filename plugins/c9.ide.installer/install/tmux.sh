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
cd "$C9_DIR"
PATH="$C9_DIR/node/bin/:$C9_DIR/node_modules/.bin:$PATH";

compile_tmux(){
  cd "$C9_DIR"
  echo "Compiling libevent..."
  tar xzf libevent-2.0.21-stable.tar.gz
  rm libevent-2.0.21-stable.tar.gz
  cd libevent-2.0.21-stable
  echo "Configuring Libevent"
  ./configure --prefix="$C9_DIR/local"
  echo "Compiling Libevent"
  make
  echo "Installing libevent"
  make install
 
  cd "$C9_DIR"
  echo "Compiling ncurses..."
  tar xzf ncurses-5.9.tar.gz
  rm ncurses-5.9.tar.gz
  cd ncurses-5.9
  echo "Configuring Ncurses"
  CPPFLAGS=-P ./configure --prefix="$C9_DIR/local" --without-tests --without-cxx
  echo "Compiling Ncurses"
  make
  echo "Installing Ncurses"
  make install
 
  cd "$C9_DIR"
  echo "Compiling tmux..."
  tar xzf tmux-1.9.tar.gz
  rm tmux-1.9.tar.gz
  cd tmux-1.9
  echo "Configuring Tmux"
  ./configure CFLAGS="-I$C9_DIR/local/include -I$C9_DIR/local/include/ncurses" CPPFLAGS="-I$C9_DIR/local/include -I$C9_DIR/local/include/ncurses" LDFLAGS="-static-libgcc -L$C9_DIR/local/lib" LIBEVENT_CFLAGS="-I$C9_DIR/local/include" LIBEVENT_LIBS="-static -L$C9_DIR/local/lib -levent" LIBS="-L$C9_DIR/local/lib/ncurses -lncurses" --prefix="$C9_DIR/local"
  echo "Compiling Tmux"
  make
  echo "Installing Tmux"
  make install
}

tmux_download(){
  echo "Downloading tmux source code"
  echo "N.B: This will take a while. To speed this up install tmux 1.9 manually on your machine and restart this process."
  
  echo "Downloading Libevent..."
  $DOWNLOAD https://raw.githubusercontent.com/c9/install/master/packages/tmux/libevent-2.0.21-stable.tar.gz
  echo "Downloading Ncurses..."
  $DOWNLOAD https://raw.githubusercontent.com/c9/install/master/packages/tmux/ncurses-5.9.tar.gz
  echo "Downloading Tmux..."
  $DOWNLOAD https://raw.githubusercontent.com/c9/install/master/packages/tmux/tmux-1.9.tar.gz
}

check_tmux_version(){
  if [ ! -x $1 ]; then
    return 1
  fi
  tmux_version=$($1 -V | sed -e's/^[a-z0-9.-]* //g')
  if [ ! "$tmux_version" ]; then
    return 1
  fi

  if [ "$(node -e "console.log(1.7<=$tmux_version)")" == "true"  ]; then
    return 0
  else
    return 1
  fi
}

mkdir -p "$C9_DIR/bin"

if check_tmux_version $C9_DIR/bin/tmux; then
  echo 'Existing tmux version is up-to-date'

# If we can support tmux 1.9 or detect upgrades, the following would work:
elif has "tmux" && check_tmux_version `which tmux`; then
  echo 'A good version of tmux was found, creating a symlink'
  ln -sf $(which tmux) "$C9_DIR"/bin/tmux

# If tmux is not present or at the wrong version, we will install it
else
  if [ $os = "darwin" ]; then
    if ! has "brew"; then
      ruby -e "$($DOWNLOAD https://raw.githubusercontent.com/mxcl/homebrew/go/install)"
    fi
    brew install tmux > /dev/null ||
      (brew remove tmux &>/dev/null && brew install tmux >/dev/null)
    ln -sf $(which tmux) "$C9_DIR"/bin/tmux
  # Linux
  else
    if ! has "make"; then
      echo "Could not find make. Please install make and try again."
      exit 100;
    fi
  
    tmux_download  
    compile_tmux
    ln -sf "$C9_DIR"/local/bin/tmux "$C9_DIR"/bin/tmux
  fi
fi

if ! check_tmux_version "$C9_DIR"/bin/tmux; then
  echo "Installed tmux does not appear to work:"
  exit 100
fi
