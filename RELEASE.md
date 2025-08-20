# Release Guide for Heroku CLI Plugins

This guide covers the automated release process for Heroku CLI plugins using our release script.

## Quick Start

```bash
npm run release
```

The script will guide you through the entire release process interactively.

## Prerequisites

1. **npm Authentication**: Ensure you're logged into npm
   ```bash
   npm login
   ```

2. **Git Setup**: Ensure you have access to the repository and are on the correct branch

3. **Dependencies**: The script will automatically handle dependency installation and building

## Release Types

### 1. Standard Release (Main Branch)

**Use for**: Regular releases from the main branch

**Requirements**:
- Must be on `main` branch
- Working directory should be clean (or confirm uncommitted changes)

**Process**:
1. Script validates branch and git status
2. Runs `npx np@7.7.0` (preview first, then actual release)
3. Creates version bump commit and tag
4. Publishes to npm
5. Opens GitHub release draft

**Note**: Due to branch protection rules, git push may fail. Create a PR with the version bump commit.

### 2. Pre-release (Beta/Alpha)

**Use for**: Testing releases before full release

**Requirements**:
- Should be on a feature branch (not main)
- Specify pre-release tag (beta, alpha, etc.)
- Specify version number

**Process**:
1. Script validates branch
2. Prompts for tag and version
3. Runs `npx np@7.7.0 --tag=<tag> --no-release-draft --any-branch`
4. Publishes to npm with specified tag
5. No GitHub release draft (pre-release)

**Note**: No need to push this branch to remote.

### 3. Previous Major Version Release

**Use for**: Releasing patches/minor versions for older major versions

**Requirements**:
- Target version must exist as a git tag
- Specify new version number
- Specify npm tag (e.g., "previous", "oclif-core-v2")

**Process**:
1. Script checks out target version tag
2. Creates `version-<new-version>` branch
3. Pushes branch to remote
4. Prompts for changes to be made
5. Runs `npx np@7.7.0 --branch <branch> --tag <tag>`
6. Publishes to npm with specified tag

**Note**: Remember to update GitHub release target and uncheck "Set as latest".

## Configuration

The script automatically detects:
- Package name and scope
- Current version
- Repository information
- Node.js engine requirements

Default settings:
- NP version: 7.7.0 (for Node 16 compatibility)
- Default branch: main
- NPM scope: @heroku-cli

## Industry Standards

### Versioning
- Follows [Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH)
- Pre-releases use format: `X.Y.Z-tag.N` (e.g., `1.0.0-beta.0`)
- Previous major versions use custom npm tags

### Branch Strategy
- `main`: Production releases
- Feature branches: Pre-releases and development
- Version branches: Previous major version releases

### NPM Tags
- `latest`: Current production version (default)
- `beta`, `alpha`: Pre-release versions
- Custom tags: Previous major versions (e.g., `oclif-core-v2`)

## Troubleshooting

### Common Issues

1. **npm Authentication Failed**
   ```bash
   npm login
   npm whoami  # Verify authentication
   ```

2. **Git Branch Issues**
   - Ensure you're on the correct branch
   - Check git status for uncommitted changes
   - Verify remote access

3. **NP Command Failures**
   - Use `--preview` flag to see what will happen
   - Check Node.js version compatibility
   - Verify package.json configuration

4. **GitHub Release Issues**
   - Check branch protection rules
   - Verify repository permissions
   - Create PR manually if needed

### Manual Commands

If the script fails, you can run commands manually:

```bash
# Standard release
npx np@7.7.0

# Pre-release
npx np@7.7.0 --tag=beta --no-release-draft --any-branch

# Previous version release
npx np@7.7.0 --branch version-11.6.0 --tag previous
```

## Best Practices

1. **Always preview first**: Use `--preview` flag to see what will happen
2. **Clean working directory**: Commit or stash changes before release
3. **Verify npm authentication**: Ensure you're logged in before starting
4. **Check branch protection**: Be prepared to create PRs manually
5. **Test pre-releases**: Use beta/alpha tags for testing
6. **Document changes**: Update changelog and documentation
7. **Verify releases**: Check npm and GitHub after completion

## Support

For issues with the release script:
1. Check this guide for common solutions
2. Review the script output for error messages
3. Verify your environment meets prerequisites
4. Check repository permissions and access

## Script Features

- **Interactive prompts**: Guides you through each step
- **Validation**: Checks prerequisites and validates inputs
- **Color-coded output**: Easy to read console messages
- **Error handling**: Graceful failure with helpful messages
- **Automation**: Handles complex git and npm operations
- **Flexibility**: Supports all release scenarios
