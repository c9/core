#!/bin/bash

# set -x

ROOT=$(cd $(dirname $BASH_SOURCE)/; pwd)
cd "$ROOT"
rm -rf ./git
mkdir -p git
cd git

END() {
    git add -u
    git add --all -f .
    echo "------------------ $1 --"
    git commit -a -m "$1"
}

echo ".*" > .gitignore
git init


echo -e "mock readme\n" > Readme.markdown
git add .gitignore -f
END "commit 0"


echo -e "more lines\n" >> Readme.markdown
echo -e "where\n does\n all\n  \n this go" > first.js
echo -e "second\n text\n for conflict" > second.js
echo -e "first\n file\n to delete" > to_del_in_a.css
echo -e "second\n text\n to delete" > to_del_in_b.css
END "commit 1"


git mv Readme.markdown Readme.md
mkdir -p "dir"
echo -e "for (var i in a) {\n    log(i, a[i])\n}" > dir/script.js
END "commit 3 (rename)"


echo "------------------" >> first.js
echo "------------------" >> second.js
echo -e "// comment" > dir/script.js
END "commit 4 (prepare for conflict)"


git branch split

echo -e "where\n will\n  \n this go" > first.js
echo -e "change" >> to_del_in_b.css
rm to_del_in_a.css
END "commit 5 (first branch)"
git branch branch1


git reset split --hard
echo -e "where\n can\n this go" > first.js
echo -e "change" >> to_del_in_a.css
rm to_del_in_b.css
END "commit 6 (second branch)"
git branch branch2

git checkout branch1
git merge branch2
if [ "$1" == "-c" ]; then exit 1; fi

echo -e "where\n this comes\n from?" > first.js
END "merge 1 (conflict resolved)"

git branch merge
git checkout master
git reset split^1^1 --hard

mkdir -p dir
echo -e "new\n file\n here?" > dir/new.text
END "commit 7 (new start)"

git merge merge

git --no-pager log --oneline --graph

