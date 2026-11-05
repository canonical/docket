#!/bin/bash
set -euo pipefail

# Bumps the package version and regenerates CHANGELOG.md from Conventional
# Commits, without committing or tagging, so the caller can inspect the bump
# first. Docket is a single package, so Lerna runs in independent mode with
# the root package as its only package.
#
# INPUTS:
# $1: release_type (required) - "stable", or a pre-release identifier such as
#     alpha, beta, rc or experimental.
# OUTPUTS:
# $GITHUB_OUTPUT: VERSION, the version the bump produced.

if [ -z "${1:-}" ]; then
  echo "Error: release_type argument is required."
  exit 1
fi

release_type="$1"
old_version=$(jq -r '.version' package.json)
if [ -z "$old_version" ] || [ "$old_version" = "null" ]; then
  echo "Error: could not read the current version from package.json."
  exit 1
fi

if [ "$release_type" = "stable" ]; then
  version_args="--conventional-graduate"
else
  version_args="--preid $release_type --conventional-prerelease"
fi

# shellcheck disable=SC2086 # version_args is intentionally word-split.
bun run lerna version --conventional-commits $version_args \
  --no-git-tag-version --no-push --yes

new_version=$(jq -r '.version' package.json)
if [ -z "$new_version" ] || [ "$new_version" = "null" ]; then
  echo "Error: could not read the new version from package.json."
  exit 1
fi
if [ "$old_version" = "$new_version" ]; then
  echo "No version changes detected; nothing to release."
  exit 1
fi

tag="v$new_version"
if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  echo "Error: git tag $tag already exists locally; refusing to overwrite it."
  exit 1
fi
if [ -n "$(git ls-remote --tags origin "refs/tags/$tag")" ]; then
  echo "Error: git tag $tag already exists on origin; refusing to overwrite it."
  exit 1
fi

echo "VERSION=$new_version" >> "$GITHUB_OUTPUT"
