# Heroku CLI Plugin Release Guide

Quick, automated releases using `npm run release`.

## Quick Start

```bash
npm run release
```

## Step-by-Step Instructions

### Standard Release
1. **Switch to main**: `git checkout main`
2. **Run script**: `npm run release`
3. **Select option 1** (Standard release)
4. **Confirm release** when prompted
5. **Handle git push failure** (expected) - create PR with version bump
6. **Complete GitHub release** in opened browser tab

### Pre-release (Beta/Alpha)
1. **Switch to feature branch**: `git checkout your-feature-branch`
2. **Run script**: `npm run release`
3. **Select option 2** (Pre-release)
4. **Enter tag** (e.g., `beta`, `alpha`)
5. **Enter version** (e.g., `1.4.0-beta.0`)
6. **Confirm pre-release** when prompted
7. **Select "Other (specify)"** when np asks for version

### Previous Major Version
1. **Checkout target**: `git checkout v11.5.0`
2. **Run script**: `npm run release`
3. **Select option 3** (Previous major version)
4. **Enter target version** (e.g., `v11.5.0`)
5. **Enter new version** (e.g., `11.6.0`)
6. **Enter npm tag** (e.g., `previous`, `oclif-core-v2`)
7. **Make changes** and commit them
8. **Confirm ready** when prompted
9. **Complete GitHub release** (change target branch, uncheck "latest")

## Prerequisites

- **npm login** - Authenticate with npm
- **Git access** - Repository permissions
- **Node 20+** - Script auto-uses NP 7.7.0 for compatibility

## Release Types

### 1. Standard Release (Main Branch)
- **Purpose**: Production releases, patches, minor versions
- **Versions**: 1.3.0 → 1.3.1 (patch), 1.3.0 → 1.4.0 (minor)
- **Branch**: Must be on `main`
- **Process**: lint → test → build → np release
- **Output**: GitHub release draft, npm publish

### 2. Pre-release (Beta/Alpha)
- **Purpose**: Feature testing, validation before production
- **Versions**: 1.4.0-beta.0, 1.4.0-alpha.1
- **Branch**: Feature branch (not main)
- **Process**: lint → test → build → np pre-release
- **Output**: npm publish with tag, no GitHub release

### 3. Previous Major Version
- **Purpose**: Maintaining older major versions (backward compatibility)
- **Versions**: 11.5.0 → 11.6.0 (while v12.x is latest)
- **Branch**: Creates `version-X.X.X` from target tag
- **Process**: lint → test → build → np release
- **Output**: npm publish with custom tag, GitHub release draft

## Key Features

- **Auto-validation**: Lint → Test → Build before any release
- **Smart scripts**: Automatically detects package.json scripts
- **Auto-fix**: Offers `npm run lint:fix` if linting fails
- **Quality gate**: All validation must pass before release

## Common Issues

| Issue | Solution |
|-------|----------|
| npm auth failed | `npm login` |
| wrong branch | Check `git branch` |
| tests fail | Fix issues, re-run |
| build fails | Fix build errors |
| 2FA prompt missed | Look for "Enter OTP:" |
| git push fails | Expected - create PR |
| package warnings | Click "y" (usually inaccurate) |

## Testing

```bash
# Test the release script
npm run test:release

# Run project tests
npm test
```

## Quick Reference Scenarios

### Hotfix Release (Patch)
```bash
git checkout main
npm run release
# Select 1, confirm release
# For: 1.3.0 → 1.3.1 (bug fixes)
```

### Feature Testing (Pre-release)
```bash
git checkout feature/new-command
npm run release
# Select 2, tag=beta, version=1.4.0-beta.0
# For: Testing new features before production
```

### Legacy Version Update
```bash
git checkout v11.5.0
npm run release
# Select 3, follow prompts
# For: Maintaining older major versions (11.5.0 → 11.6.0)
```

## Manual Commands

```bash
# Standard
npx np@7.7.0

# Pre-release  
npx np@7.7.0 --tag=beta --no-release-draft --any-branch

# Previous version
npx np@7.7.0 --branch version-X.X.X --tag previous
```

## Best Practices

1. **Always preview first** - Use `--preview` flag
2. **Clean working directory** - Commit or stash changes
3. **Run tests locally** - Ensure `npm test` passes
4. **Watch for 2FA** - NPM token prompts are easy to miss
5. **Expect git push failures** - Branch protection is normal
6. **Create PRs manually** - For version bump commits

## Support

- Check script output for errors
- Verify prerequisites are met
- Run `npm run test:release` to validate script
- Check repository permissions
