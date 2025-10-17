# Version Management

This project uses automated semantic versioning based on commit messages.

## Automatic Version Bumping

When you push to the `main` branch, the CI/CD workflow automatically bumps the version based on your commit message:

### Version Bump Types

| Commit Message Pattern | Version Change | Example |
|------------------------|----------------|---------|
| Default (no pattern) | Patch | 0.3.0 → 0.3.1 |
| `[minor]` or `feat:` | Minor | 0.3.0 → 0.4.0 |
| `[major]` or `BREAKING CHANGE:` | Major | 0.3.0 → 1.0.0 |
| `[alpha]` | Alpha prerelease | 0.3.0 → 0.3.1-alpha.0 |
| `[beta]` | Beta prerelease | 0.3.0 → 0.3.1-beta.0 |
| `[rc]` | Release candidate | 0.3.0 → 0.3.1-rc.0 |

### Examples

```bash
# Patch version bump (default)
git commit -m "Fix transition key generation"
# Results in: 0.3.0 → 0.3.1

# Minor version bump
git commit -m "feat: Add new plugin system"
# Results in: 0.3.1 → 0.4.0

# Major version bump
git commit -m "BREAKING CHANGE: Redesign workflow schema"
# Results in: 0.4.0 → 1.0.0

# Alpha prerelease
git commit -m "[alpha] Experimental feature for testing"
# Results in: 1.0.0 → 1.0.1-alpha.0

# Beta prerelease
git commit -m "[beta] Feature ready for beta testing"
# Results in: 1.0.1-alpha.0 → 1.0.1-beta.0

# Release candidate
git commit -m "[rc] Final testing before release"
# Results in: 1.0.1-beta.0 → 1.0.1-rc.0
```

## Release Process

1. **Push to main**: Triggers the CI/CD workflow
2. **Version bump**: Automatically determines version based on commit message
3. **Commit version**: Bot commits the version change with `[skip ci]`
4. **Create release**: GitHub release is created with the new version
5. **VSIX package**: Extension is packaged and attached to the release

## Prerelease Versions

Prerelease versions are marked as such on GitHub and follow npm's prerelease versioning:

- **Alpha** (`-alpha.X`): Early development, may have bugs
- **Beta** (`-beta.X`): Feature complete but may have bugs
- **RC** (`-rc.X`): Release candidate, final testing phase

Each subsequent prerelease of the same type increments the prerelease number:
- 0.3.1-alpha.0 → 0.3.1-alpha.1 → 0.3.1-alpha.2

## Manual Version Control

If you need to set a specific version manually:

```bash
# Set specific version in extension
cd packages/extension
npm version 1.2.3 --no-git-tag-version

# Update root package.json to match
cd ../..
npm version 1.2.3 --no-git-tag-version --allow-same-version

# Commit with [skip ci] to avoid auto-bump
git add -A
git commit -m "chore: manually set version to 1.2.3 [skip ci]"
```

## Skip CI

To push changes without triggering the CI/CD workflow, include `[skip ci]` in your commit message:

```bash
git commit -m "docs: Update README [skip ci]"
```

This is automatically added to version bump commits to prevent infinite loops.