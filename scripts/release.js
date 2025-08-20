#!/usr/bin/env node

/**
 * Heroku CLI Plugin Release Script
 * 
 * This script automates the release process for Heroku CLI plugins,
 * handling different release scenarios and following npm best practices.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const CONFIG = {
  NP_VERSION: '7.7.0', // For Node 16 compatibility
  DEFAULT_BRANCH: 'main',
  GITHUB_REPO_PREFIX: 'heroku/',
  NPM_SCOPE: '@heroku-cli'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${step}: ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

// Utility functions
function runCommand(command, options = {}) {
  try {
    const result = execSync(command, { 
      encoding: 'utf8', 
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options 
    });
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getUserInput(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function getPackageInfo() {
  const packagePath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packagePath)) {
    throw new Error('package.json not found. Please run this script from the project root.');
  }

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  // Validate required fields
  const requiredFields = ['name', 'version', 'repository'];
  for (const field of requiredFields) {
    if (!packageJson[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Extract package name without scope
  const packageName = packageJson.name.replace(`${CONFIG.NPM_SCOPE}/`, '');
  
  return {
    fullName: packageJson.name,
    name: packageName,
    version: packageJson.version,
    repository: packageJson.repository.url,
    engines: packageJson.engines || {}
  };
}

function getCurrentBranch() {
  const result = runCommand('git branch --show-current', { silent: true });
  if (!result.success) {
    throw new Error('Failed to get current branch');
  }
  return result.output.trim();
}

function getCurrentGitStatus() {
  const status = runCommand('git status --porcelain', { silent: true });
  if (status.success && status.output.trim()) {
    logWarning('Working directory has uncommitted changes:');
    log(status.output, 'yellow');
    return false;
  }
  return true;
}

function checkNpmAuth() {
  logStep('1', 'Checking npm authentication');
  
  const result = runCommand('npm whoami', { silent: true });
  if (!result.success) {
    logError('Not authenticated with npm. Please run: npm login');
    return false;
  }
  
  const username = result.output.trim();
  logSuccess(`Authenticated as: ${username}`);
  return true;
}

function determineReleaseType() {
  logStep('2', 'Determining release type');
  
  console.log('\nAvailable release types:');
  console.log('1. Standard release (main branch)');
  console.log('2. Pre-release (beta/alpha)');
  console.log('3. Patch/minor for previous major version');
  
  return getUserInput('\nSelect release type (1-3): ');
}

async function standardRelease(packageInfo) {
  logStep('3', 'Performing standard release');
  
  const currentBranch = getCurrentBranch();
  if (currentBranch !== CONFIG.DEFAULT_BRANCH) {
    logError(`Must be on ${CONFIG.DEFAULT_BRANCH} branch for standard release`);
    logInfo(`Current branch: ${currentBranch}`);
    return false;
  }

  if (!getCurrentGitStatus()) {
    const proceed = await getUserInput('\nProceed with uncommitted changes? (y/N): ');
    if (proceed.toLowerCase() !== 'y') {
      return false;
    }
  }

  logInfo('Running np for standard release...');
  const npCommand = `npx np@${CONFIG.NP_VERSION}`;
  
  logInfo(`Command: ${npCommand}`);
  logInfo('Note: This will create a new commit and tag');
  
  const proceed = await getUserInput('\nProceed with release? (y/N): ');
  if (proceed.toLowerCase() !== 'y') {
    return false;
  }

  // First run preview
  logInfo('Running preview first...');
  runCommand(`${npCommand} --preview`);
  
  const runRelease = await getUserInput('\nRun actual release? (y/N): ');
  if (runRelease.toLowerCase() !== 'y') {
    return false;
  }

  logInfo('Executing release...');
  const result = runCommand(npCommand);
  
  if (!result.success) {
    logWarning('Release completed but git push may have failed due to branch protection');
    logInfo('Please create a branch and PR with the version bump commit');
    return true;
  }
  
  return true;
}

async function preRelease(packageInfo) {
  logStep('3', 'Performing pre-release');
  
  const currentBranch = getCurrentBranch();
  if (currentBranch === CONFIG.DEFAULT_BRANCH) {
    logWarning('Pre-release should be done on a feature branch, not main');
    const proceed = await getUserInput('Continue anyway? (y/N): ');
    if (proceed.toLowerCase() !== 'y') {
      return false;
    }
  }

  const tag = await getUserInput('Enter pre-release tag (e.g., beta, alpha): ');
  const version = await getUserInput('Enter version number (e.g., 0.0.1-beta.0): ');
  
  logInfo('Running np for pre-release...');
  const npCommand = `npx np@${CONFIG.NP_VERSION} --tag=${tag} --no-release-draft --any-branch`;
  
  logInfo(`Command: ${npCommand}`);
  logInfo(`Version: ${version}`);
  
  const proceed = await getUserInput('\nProceed with pre-release? (y/N): ');
  if (proceed.toLowerCase() !== 'y') {
    return false;
  }

  // First run preview
  logInfo('Running preview first...');
  runCommand(`${npCommand} --preview`);
  
  const runRelease = await getUserInput('\nRun actual pre-release? (y/N): ');
  if (runRelease.toLowerCase() !== 'y') {
    return false;
  }

  logInfo('Executing pre-release...');
  const result = runCommand(npCommand);
  
  if (result.success) {
    logSuccess('Pre-release completed successfully');
    logInfo('Note: No need to push this branch to remote for pre-releases');
  }
  
  return result.success;
}

async function previousVersionRelease(packageInfo) {
  logStep('3', 'Releasing patch/minor for previous major version');
  
  const targetVersion = await getUserInput('Enter the target version to update (e.g., v11.5.0): ');
  const newVersion = await getUserInput('Enter the new version to release (e.g., 11.6.0): ');
  const npmTag = await getUserInput('Enter npm tag (e.g., previous, oclif-core-v2): ');
  
  logInfo(`Target version: ${targetVersion}`);
  logInfo(`New version: ${newVersion}`);
  logInfo(`NPM tag: ${npmTag}`);
  
  // Checkout target version
  logInfo(`Checking out ${targetVersion}...`);
  const checkoutResult = runCommand(`git checkout ${targetVersion}`);
  if (!checkoutResult.success) {
    logError(`Failed to checkout ${targetVersion}`);
    return false;
  }
  
  // Create version branch
  const versionBranch = `version-${newVersion}`;
  logInfo(`Creating branch: ${versionBranch}`);
  const branchResult = runCommand(`git checkout -b ${versionBranch}`);
  if (!branchResult.success) {
    logError(`Failed to create branch ${versionBranch}`);
    return false;
  }
  
  // Push branch
  logInfo(`Pushing branch to remote...`);
  const pushResult = runCommand(`git push origin ${versionBranch}`);
  if (!pushResult.success) {
    logError(`Failed to push branch ${versionBranch}`);
    return false;
  }
  
  logInfo('Branch created and pushed successfully');
  logInfo('Please make your changes, commit them, and merge into the version branch');
  
  const ready = await getUserInput('\nReady to proceed with release? (y/N): ');
  if (ready.toLowerCase() !== 'y') {
    return false;
  }
  
  // Pull latest changes
  logInfo('Pulling latest changes...');
  runCommand(`git pull origin ${versionBranch}`);
  
  // Install dependencies and build
  logInfo('Installing dependencies...');
  runCommand('yarn');
  
  if (fs.existsSync('yarn.lock')) {
    logInfo('Building project...');
    runCommand('yarn build');
  }
  
  // Run np for previous version release
  const npCommand = `npx np@${CONFIG.NP_VERSION} --branch ${versionBranch} --tag ${npmTag}`;
  
  logInfo(`Command: ${npCommand}`);
  
  const proceed = await getUserInput('\nProceed with release? (y/N): ');
  if (proceed.toLowerCase() !== 'y') {
    return false;
  }

  // First run preview
  logInfo('Running preview first...');
  runCommand(`${npCommand} --preview`);
  
  const runRelease = await getUserInput('\nRun actual release? (y/N): ');
  if (runRelease.toLowerCase() !== 'y') {
    return false;
  }

  logInfo('Executing release...');
  const result = runCommand(npCommand);
  
  if (result.success) {
    logSuccess('Previous version release completed successfully');
    logInfo('Remember to update GitHub release target and uncheck "Set as latest"');
  }
  
  return result.success;
}

async function main() {
  try {
    log('🚀 Heroku CLI Plugin Release Script', 'bright');
    log('=====================================\n', 'bright');
    
    // Get package information
    const packageInfo = getPackageInfo();
    logInfo(`Package: ${packageInfo.fullName}`);
    logInfo(`Current version: ${packageInfo.version}`);
    logInfo(`Repository: ${packageInfo.repository}`);
    
    // Check npm authentication
    if (!checkNpmAuth()) {
      process.exit(1);
    }
    
    // Determine release type
    const releaseType = await determineReleaseType();
    
    let success = false;
    
    switch (releaseType) {
      case '1':
        success = await standardRelease(packageInfo);
        break;
      case '2':
        success = await preRelease(packageInfo);
        break;
      case '3':
        success = await previousVersionRelease(packageInfo);
        break;
      default:
        logError('Invalid selection');
        process.exit(1);
    }
    
    if (success) {
      logSuccess('\n🎉 Release process completed successfully!');
      logInfo('Next steps:');
      logInfo('- Check GitHub for the new release');
      logInfo('- Verify npm package was published correctly');
      logInfo('- Update documentation if needed');
    } else {
      logError('\n❌ Release process failed');
      process.exit(1);
    }
    
  } catch (error) {
    logError(`\nFatal error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  main,
  getPackageInfo,
  checkNpmAuth,
  standardRelease,
  preRelease,
  previousVersionRelease
};
