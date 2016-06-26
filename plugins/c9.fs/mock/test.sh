echo "Hello World"
   red=$'\e[0;31m'
 green=$'\e[0;32m'
yellow=$'\e[0;33m'
  blue=$'\e[0;34m'
   end=$'\e[0m'
for ((i=0; i<3; i++)){
    echo -ne "$red ======== $green ======== $yellow ======== $blue ======== $end |||||"
}