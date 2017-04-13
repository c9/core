# c9.ide.language.codeintel

Provides code completion using the codeintel plugin ported from the Open Komodo Editor.

https://pypi.python.org/pypi/CodeIntel

## Installation

## Cloud9 hosted workspaces

On normal Cloud9 workspaces, all dependencies of this plugin are installed
and work out of the box.

## Linux

1. Install pip

   Most Linux distributions these days have pip already installed.
   If not, the following command should help you install it.
   Otherwise, there's always Google.
   
   ```
   sudo easy_install pip
   ```
   
2. Make sure pip is up-to-date
   
   ```
   sudo pip install -U pip
   ```

3. Install and setup virtualenv

   ```
   sudo pip install -U virtualenv
   virtualenv --python=python2 $HOME/.c9/python2
   source $HOME/.c9/python2/bin/activate
   ```

4. Install codeintel dependencies

   For Debian/Ubuntu-flavored distributions, type:
   
   ```
   sudo apt-get update
   sudo apt-get install python-dev
   ```

   For other flavors of Linux, see:

   http://stackoverflow.com/questions/8282231/ubuntu-i-have-python-but-gcc-cant-find-python-h

5. Download codeintel

   ```
   mkdir /tmp/codeintel
   pip download /tmp/codeintel codeintel==0.9.3
   ```

6. Install codeintel

   Before installation, we patch codeintel to work on Linux.

   ```
   cd /tmp/codeintel
   tar xf CodeIntel-0.9.3.tar.gz
   mv CodeIntel-0.9.3/SilverCity CodeIntel-0.9.3/silvercity
   tar czf CodeIntel-0.9.3.tar.gz CodeIntel-0.9.3
   pip install -U --no-index --find-links=/tmp/codeintel codeintel
   ```

7. Reload Cloud9.

## OSX

1. Run the following command to install virtualenv.

   ```
   sudo pip install virtualenv
   ```

2. Install and setup virtualenv

   ```
   sudo pip install -U virtualenv
   virtualenv --python=python2 $HOME/.c9/python2
   source $HOME/.c9/python2/bin/activate
   ```

3. Install CodeIntel 0.9.3

   ```
   pip install codeintel==0.9.3
   ```

4. Reload Cloud9.

## Windows

Unfortunately Windows is not supported at this time.
