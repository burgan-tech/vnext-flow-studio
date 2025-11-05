# Release Workflow & Changelog Management

## Development Phase

### For Every Change (Claude will do this):
1. Make the code changes
2. **ALWAYS** update `CHANGELOG.md` in the `[Unreleased]` section
3. Commit both together

Example:
```markdown
## [Unreleased]

### Added
- New feature X with Y capability

### Fixed
- Bug in component Z that caused issue W

### Changed
- Updated behavior of feature Q
```

## Release Process

### Automatic (happens on push to main):
1. CI/CD reads commit message to determine version bump
2. Version is bumped automatically
3. GitHub release is created with content from `[Unreleased]` section

### Post-Release Cleanup (manual or automated):

#### Option 1: Manual (after release is created)
```bash
# After v1.2.0 is released:
./scripts/update-changelog-version.sh 1.2.0
git add CHANGELOG.md
git commit -m "docs: move unreleased notes to v1.2.0 section [skip ci]"
git push
```

#### Option 2: Automated (add to CI/CD)
The CI/CD could automatically commit the changelog update after creating a release.

## Commit Message Conventions

| Commit Pattern | Version Change | Example |
|---|---|---|
| `fix:` or default | Patch (1.0.0 → 1.0.1) | `fix: correct edge case in parser` |
| `feat:` or `[minor]` | Minor (1.0.1 → 1.1.0) | `feat: add dark mode support` |
| `BREAKING CHANGE:` or `[major]` | Major (1.1.0 → 2.0.0) | `BREAKING CHANGE: new API` |
| `[alpha]` | Alpha pre-release | `feat: experimental feature [alpha]` |
| `[beta]` | Beta pre-release | `fix: stabilize feature [beta]` |
| `[rc]` | Release candidate | `chore: prepare for release [rc]` |

## Example Workflow

### 1. During Development
```bash
# Make changes
git add src/
# Update CHANGELOG.md [Unreleased] section
git add CHANGELOG.md
# Commit with appropriate prefix
git commit -m "feat: add new mapping feature"
git push
```

### 2. After Release (v1.2.0 was just created)
```bash
# Update changelog to move Unreleased → 1.2.0
./scripts/update-changelog-version.sh 1.2.0
git add CHANGELOG.md
git commit -m "docs: update changelog for v1.2.0 [skip ci]"
git push
```

### 3. Continue Development
The `[Unreleased]` section is now empty and ready for new changes.

## Current State

After our recent fixes, the `[Unreleased]` section contains:
- Start Transition Editing fixes
- Diagram File Persistence
- Performance optimizations
- JSON Schema Validation fix
- Sample Tasks removal

These will be included in the next release (likely v1.2.0).

## Important Notes

- **Always** update CHANGELOG.md with your changes
- Use `[skip ci]` when updating changelog after release to avoid triggering another build
- The `[Unreleased]` section should always exist at the top of CHANGELOG.md
- Released sections should have version number and date