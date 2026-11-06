#!/bin/bash
set -euo pipefail

# Commits the version and changelog Lerna wrote, tags it, and pushes both to
# main. INPUTS: $1, the tag to create.

if [ -z "${1:-}" ]; then
  echo "Error: tag argument is required."
  exit 1
fi

tag="$1"
git add .
git commit -m "chore: version bump to $tag"
git tag "$tag" -m "$tag"
git push origin HEAD:main
git push origin "$tag"
