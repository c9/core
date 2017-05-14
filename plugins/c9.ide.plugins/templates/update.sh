#!/bin/bash 

for i in * ; do
    if [ -d "$i" ]; then 
        echo $i "-------------";
        tar -zcvf "$i".tar.gz -- "$i" ;
    fi
done