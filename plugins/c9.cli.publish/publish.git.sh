VERSION="$1"
PACKAGE_PATH="$2"
CWD="${PWD}"

if [ ! -d .git ]; then
    echo "$CWD is not a git repository" 1>&2
    exit 1
fi

if [ ! -f "$PACKAGE_PATH" ]; then
    echo "Could not find package.json" 1>&2
    exit 1
fi

# Commit the package.json file
git add $PACKAGE_PATH
git commit -m "Publish version $VERSION"

# Create a new Git tag for the version being published.
git tag $VERSION

# Pushe the tag and current branch up to origin.
git push origin --tags