#!/bin/bash

# Update CHANGELOG.md after a release
# Moves [Unreleased] content to a versioned section and creates new [Unreleased]

VERSION=$1
DATE=$(date +%Y-%m-%d)

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 1.2.0"
  exit 1
fi

# Create a backup
cp CHANGELOG.md CHANGELOG.md.bak

# Update the changelog
awk -v version="$VERSION" -v date="$DATE" '
  /^## \[Unreleased\]/ {
    # Print new Unreleased section
    print "## [Unreleased]"
    print ""
    print "### Added"
    print ""
    print "### Fixed"
    print ""
    print "### Changed"
    print ""
    # Print the version section with the old Unreleased content
    print "## [" version "] - " date
    in_unreleased = 1
    next
  }
  /^## \[/ && in_unreleased {
    in_unreleased = 0
  }
  !in_unreleased {
    print
  }
' CHANGELOG.md > CHANGELOG.md.tmp

mv CHANGELOG.md.tmp CHANGELOG.md

echo "✅ Updated CHANGELOG.md: [Unreleased] → [$VERSION] - $DATE"
echo "📝 Created new empty [Unreleased] section for future changes"