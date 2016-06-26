set -e

# Remove any pre-existing directory
rm -Rf /tmp/c9.ide.example
rm -Rf ~/.c9/plugins/c9.ide.example

# Clone the test repo
git clone git@github.com:c9/c9.ide.example.git /tmp/c9.ide.example

# Delete all the tags from remote and local
cd /tmp/c9.ide.example
git ls-remote --tags origin | awk '/^(.*)(\s+)(.*)$/ {print ":" $2}' | xargs git push origin
git tag -l | awk '/^(.*)$/ {print $1}'  | xargs git tag -d

echo "Done."