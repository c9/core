# `c9.ide.run.debug.xdebug`

[Cloud9](https://c9.io/) core plugin for [Xdebug](http://xdebug.org/) and other DBGP
debuggers.


to install xdebug for php use

```sh
sudo apt-get update
sudo apt-get install -y php5-dev
sudo pecl install xdebug
sudo mkdir -p /etc/php5/mods-available
echo "; Xdebug extension installed by Cloud9
zend_extension=xdebug.so
xdebug.remote_enable=1
" | sudo tee --append /etc/php5/mods-available/xdebug.ini
sudo php5enmod xdebug
```

## License

[The MIT License](http://opensource.org/licenses/MIT)

Copyright (c) 2015 Ajax.org B.V.
