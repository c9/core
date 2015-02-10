#!/bin/bash -e
set -e
has() {
  type "$1" > /dev/null 2>&1
  return $?
}

# Redirect stdout ( > ) into a named pipe ( >() ) running "tee"
exec > >(tee /tmp/installlog.txt)

# Without this, only stdout would be captured - i.e. your
# log file would not contain any error messages.
exec 2>&1

NODE_VERSION=v0.10.28
APPSUPPORT_USER=$HOME/.c9
SCRIPT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
RUNTIME=$SCRIPT/..
INSTALL_DIR=/tmp/c9-`date '+%s'`
ORIGINAL_USER=`basename $HOME`
OSX_INSTALLER_PATH=$2

start() {
  if [ $# -lt 1 ]; then
    start base
    return
  fi

  # Try to figure out the os and arch for binary fetching
  local uname="$(uname -a)"
  local os=
  local arch="$(uname -m)"
  case "$uname" in
    Linux\ *) os=linux ;;
    Darwin\ *) os=darwin ;;
    SunOS\ *) os=sunos ;;
    FreeBSD\ *) os=freebsd ;;
  esac
  case "$uname" in
    *x86_64*) arch=x64 ;;
    *i*86*) arch=x86 ;;
    *armv6l*) arch=arm-pi ;;
  esac
  
  if [ $os != "linux" ] && [ $os != "darwin" ]; then
    echo "Unsupported Platform: $os $arch" 1>&2
    exit 1
  fi
  
  if [ $arch != "x64" ] && [ $arch != "x86" ]; then
    echo "Unsupported Architecture: $os $arch" 1>&2
    exit 1
  fi
  
  if [ $os == "darwin" ]; then
    APPSUPPORT_USER="$HOME/Library/Application Support/Cloud9"
    APPTARGET=$OSX_INSTALLER_PATH
    APPSUPPORT="/Library/Application Support/Cloud9"
    RUNTIME="${APPTARGET}/Contents/Resources/app.nw"
  fi
  
  case $1 in
    "help" )
      echo
      echo "Cloud9 Installer"
      echo
      echo "Usage:"
      echo "    install help                       Show this message"
      echo "    install install [name [name ...]]  Download and install a set of packages"
      echo "    install ls                         List available packages"
      echo
    ;;

    "ls" )
      echo "!node - Node.js"
      echo "!tmux_install - TMUX"
      echo "!nak - NAK"
      echo "!vfsextend - VFS extend"
      echo "!ptyjs - pty.js"
      echo "!c9cli - C9 CLI"
      echo "!sc - Sauce Connect"
      echo "coffee - Coffee Script"
      echo "less - Less"
      echo "sass - Sass"
      echo "typescript - TypeScript"
      echo "stylus - Stylus"
      # echo "go - Go"
      # echo "heroku - Heroku"
      # echo "rhc - RedHat OpenShift"
      # echo "gae - Google AppEngine"
    ;;
    
    "install" )
      shift

      # make sure dirs are around
      mkdir -p "$APPSUPPORT/bin"
      mkdir -p "$APPSUPPORT/node_modules"
      cd "$APPSUPPORT"
      
      cp -a "$SCRIPT" "$INSTALL_DIR"
    
      # install packages
      while [ $# -ne 0 ]
      do
        time eval ${1} $os $arch
        shift
      done
      
      # finalize
      #pushd $APPSUPPORT/node_modules/.bin
      #for FILE in $APPSUPPORT/node_modules/.bin/*; do
      #  if [ `uname` == Darwin ]; then
      #    sed -i "" -E s:'#!/usr/bin/env node':"#!$NODE":g $(readlink $FILE)
      #  else
      #    sed -i -E s:'#!/usr/bin/env node':"#!$NODE":g $(readlink $FILE)
      #  fi
      #done
      #popd
      
      VERSION=`cat $RUNTIME/version || echo 1`
      echo 1 > "$APPSUPPORT/installed"
      echo $VERSION > "$APPSUPPORT/version"
      
      # set chown/chmod of application dirs for update
      echo "Testing existence of APPTARGET (${APPTARGET})"
      if [ -d "$APPTARGET" ]; then
        echo "Updating permissions of APPTARGET (${APPTARGET})"
        chown -R root:admin "$APPTARGET" || chown -R root:staff "$APPTARGET"
        chmod -R 775 "$APPTARGET"
      fi
      
      echo "Testing existence of APPSUPPORT (${APPSUPPORT})"
      if [ -d "$APPSUPPORT" ]; then
        echo "Updating permissions of APPSUPPORT (${APPSUPPORT})"
        chown -R root:admin "$APPSUPPORT" || chown -R root:staff "$APPSUPPORT"
        chmod -R 775 "$APPSUPPORT"
      fi
      
      echo "Testing existence of APPSUPPORT_USER (${APPSUPPORT_USER})"
      if [ -n "$ORIGINAL_USER" ] && [ -d "$APPSUPPORT_USER" ]; then
        echo "Updating permissions of APPSUPPORT_USER (${APPSUPPORT_USER})"
        chown -R $ORIGINAL_USER "$APPSUPPORT_USER"
      fi
      
      rm -Rf $INSTALL_DIR
      
      echo :Done.
    ;;
    
    "base" )
      echo "Installing base packages. Use '`basename $0` help' for more options"
      start install node tmux_install nak ptyjs sc vfsextend c9cli
    ;;
    
    * )
      start base
    ;;
  esac
}

# NodeJS

node(){
  # clean up 
  rm -rf node 
  rm -rf node-$NODE_VERSION*
  
  echo :Installing Node $NODE_VERSION
  
  cd "$INSTALL_DIR"
  tar xvfz node-$NODE_VERSION-$1-$2.tar.gz
  rm -Rf "$APPSUPPORT/node"
  mv node-$NODE_VERSION-$1-$2 "$APPSUPPORT/node"
}

tmux_install(){
  echo :Installing TMUX
  mkdir -p "$APPSUPPORT/bin"

  if [ $os = "darwin" ]; then
    cd "$INSTALL_DIR"
    python rudix.py -i libevent-2.0.21-0.pkg
    python rudix.py -i tmux-1.9-0.pkg
    
    if ! type "/usr/local/bin/tmux"; then
      echo "Installation Failed"
      exit 100
    fi
    
    ln -sf "/usr/local/bin/tmux" "$APPSUPPORT/bin/tmux"
  # Linux
  else
    echo "Unsupported"
  fi
}

vfsextend(){
  echo :Installing VFS extend
  cd "$INSTALL_DIR"
  tar xvfz c9-vfs-extend.tar.gz
  rm -Rf "$APPSUPPORT/c9-vfs-extend"
  mv c9-vfs-extend "$APPSUPPORT"
}

sc(){
  echo :Installing Sauce Connect
  cd "$INSTALL_DIR"
  tar xvzf sc-4.0-latest.tar.gz
  rm -rf "$APPSUPPORT/sc"
  mv sc-4.0-latest "$APPSUPPORT/sc"
}

nak(){
  echo :Installing Nak
  cd "$INSTALL_DIR"
  tar -zxvf nak.tar.gz
  mkdir -p "$APPSUPPORT/node_modules/.bin"
  rm -Rf "$APPSUPPORT/node_modules/nak"
  mv nak "$APPSUPPORT/node_modules"
  ln -s "$APPSUPPORT/node_modules/nak/bin/nak" "$APPSUPPORT/node_modules/.bin/nak" &2> /dev/null
}

ptyjs(){
  echo :Installing pty.js
  cd "$INSTALL_DIR"
  tar -zxvf pty-$NODE_VERSION-$1-$2.tar.gz
  mkdir -p "$APPSUPPORT/node_modules"
  rm -Rf "$APPSUPPORT/node_modules/pty.js"
  mv pty.js "$APPSUPPORT/node_modules"
}

c9cli(){
  if [ -d "/usr/local/bin/" ]; then
    chmod +x "$RUNTIME/bin/c9"
    ln -s -f "$RUNTIME/bin/c9" /usr/local/bin/c9
  else
    echo "unable to add c9cli to the path"
  fi
}

start $@
