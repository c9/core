set -e

has() {
  type "$1" > /dev/null 2>&1
  return $?
}


check_deps() {
  local MISSING
  local OS
  local CMD

  if [[ `cat /etc/issue 2>/dev/null` =~ CentOS ]]; then
    OS="RHEL"
  elif [[ `cat /etc/redhat-release 2>/dev/null` =~ "Red Hat" ]]; then
    OS="RHEL"
  elif [[ `cat /etc/system-release 2>/dev/null` =~ "Amazon Linux" ]]; then
    OS="RHEL"
  elif [[ `cat /proc/version 2>/dev/null` =~ Ubuntu|Debian ]]; then
    OS="DEBIAN"
  fi
  
  check_missing() {
    MISSING=
    for DEP in "make" "gcc" "g++"; do
      if ! has $DEP; then 
        MISSING="$MISSING, $DEP"
      fi
    done
  }
  
  check_missing
  
  if [ "$MISSING" ]; then
    
    if [ "$OS" == "RHEL" ]; then
      CMD="sudo yum groupinstall -y development"
    elif [ "$OS" == "DEBIAN" ]; then
      sudo apt-get update || true
      CMD="sudo apt-get install -y build-essential"
    fi
    
    if [ "$CMD" ]; then
      echo "running '$CMD' to install missing dependencies: $MISSING"
      $CMD || true;
    fi
    
    check_missing
    
    if [ "$MISSING" ]; then
      echo "ERROR: failed to install '${MISSING/, /}'"
    fi
  fi
  
  # RHEL, CentOS, Amazon Linux
  if [ "$OS" == "RHEL" ]; then
    if ! yum list installed glibc-static >/dev/null 2>&1; then
      echo "Error: please install glibc-static to proceed"
      echo "To do so, log into your machine and type 'sudo yum install glibc-static'"
      MISSING=1
    fi
  fi
  
  if which python2.7 &> /dev/null; then
    PYTHONVERSION="2.7"
  else
    PYTHONVERSION=`python --version 2>&1`
  fi
  
  if [[ $PYTHONVERSION != *2.7* ]]; then
    echo "Python version 2.7 is required to install pty.js. Please install python 2.7 and try again. You can find more information on how to install Python in the docs: https://docs.c9.io/ssh_workspaces.html"
    MISSING=1
  fi
  
  if [ "$MISSING" ]; then exit 1; fi
}

check_deps
