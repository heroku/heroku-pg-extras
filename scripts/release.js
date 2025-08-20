#!/usr/bin/env node

/**
 * Heroku CLI Plugin Release Script
 * Automated release process for Heroku CLI plugins
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CONFIG = {
  NP_VERSION: '7.7.0', // Required for Node 16 compatibility
  DEFAULT_BRANCH: 'main',
  NPM_SCOPE: '@heroku-cli'
};

// Get available scripts from package.json
const getAvailableScripts = () => {
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    return pkg.scripts || {};
  } catch {
    return {};
  }
};

// Get essential scripts for release process
const getEssentialScripts = () => {
  const scripts = getAvailableScripts();
  return {
    test: scripts.test,
    build: scripts.build,
    lint: scripts.lint,
    lintFix: scripts['lint:fix']
  };
};

// Utility functions
const run = (cmd, silent = false) => {
  try {
    const result = execSync(cmd, { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' });
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const ask = (prompt) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(prompt, answer => { rl.close(); resolve(answer.trim()); });
  });
};

const log = (msg, type = 'info') => {
  const colors = { info: '\x1b[36m', success: '\x1b[32m', warning: '\x1b[33m', error: '\x1b[31m', reset: '\x1b[0m' };
  console.log(`${colors[type]}${msg}${colors.reset}`);
};

// Core functions
const getPackageInfo = () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!pkg.name || !pkg.version || !pkg.repository) {
    throw new Error('Missing required package.json fields');
  }
  return pkg;
};

const checkPrerequisites = () => {
  if (!run('npm whoami', true).success) {
    log('❌ Not authenticated with npm. Run: npm login', 'error');
    return false;
  }
  
  const nodeVersion = process.version;
  log(`ℹ Node version: ${nodeVersion}`, 'info');
  if (nodeVersion.startsWith('v16')) {
    log('⚠ Using Node 16 - NP 7.7.0 required for compatibility', 'warning');
  }
  
  // Check if we can run basic npm commands
  if (!run('npm --version', true).success) {
    log('❌ npm not available', 'error');
    return false;
  }
  
  // Check if we're in a valid npm project
  if (!fs.existsSync('package.json')) {
    log('❌ Not in an npm project directory', 'error');
    return false;
  }
  
  return true;
};

const getCurrentBranch = () => run('git branch --show-current', true).output.trim();

const showCommonWarnings = () => {
  log('⚠ Important notes:', 'warning');
  log('  - Package file warnings are usually inaccurate - click "y" to proceed', 'info');
  log('  - Watch for npm 2FA prompt: "Publishing package using Yarn (waiting for input…) → ? Enter OTP:"', 'info');
};

// Run pre-release validation using package.json scripts
const runPreReleaseValidation = async () => {
  const scripts = getEssentialScripts();
  let allPassed = true;
  
  // Run linting first
  if (scripts.lint) {
    log('🔍 Running linting...', 'info');
    if (!run('npm run lint').success) {
      log('❌ Linting failed', 'error');
      if (scripts.lintFix) {
        const fixLint = await ask('Try to auto-fix linting issues? (y/N): ');
        if (fixLint.toLowerCase().startsWith('y')) {
          log('🔧 Auto-fixing linting issues...', 'info');
          if (!run('npm run lint:fix').success) {
            log('❌ Auto-fix failed', 'error');
            allPassed = false;
          } else {
            log('✅ Linting issues auto-fixed', 'success');
          }
        } else {
          allPassed = false;
        }
      } else {
        allPassed = false;
      }
    } else {
      log('✅ Linting passed', 'success');
    }
  }
  
  // Run tests
  if (scripts.test && allPassed) {
    log('🧪 Running tests...', 'info');
    if (!run('npm test').success) {
      log('❌ Tests failed - cannot proceed with release', 'error');
      allPassed = false;
    } else {
      log('✅ Tests passed', 'success');
    }
  }
  
  // Run build
  if (scripts.build && allPassed) {
    log('🔨 Building project...', 'info');
    if (!run('npm run build').success) {
      log('❌ Build failed - cannot proceed with release', 'error');
      allPassed = false;
    } else {
      log('✅ Build successful', 'success');
    }
  }
  
  return allPassed;
};

const standardRelease = async (pkg) => {
  log('\n🚀 Standard Release (Main Branch)', 'info');
  
  if (getCurrentBranch() !== CONFIG.DEFAULT_BRANCH) {
    log('❌ Must be on main branch for standard release', 'error');
    return false;
  }

  // Run comprehensive pre-release validation
  log('🔍 Running pre-release validation...', 'info');
  if (!(await runPreReleaseValidation())) {
    log('❌ Pre-release validation failed - cannot proceed', 'error');
    return false;
  }

  showCommonWarnings();
  log('  - Git push may fail due to branch protection (this is expected)', 'info');
  
  if (!(await ask('\nProceed? (y/N): ')).toLowerCase().startsWith('y')) return false;
  
  log('📋 Running preview...', 'info');
  run(`npx np@${CONFIG.NP_VERSION} --preview`);
  
  if (!(await ask('\nRun actual release? (y/N): ')).toLowerCase().startsWith('y')) return false;
  
  log('🚀 Executing release...', 'info');
  const result = run(`npx np@${CONFIG.NP_VERSION}`);
  
  if (!result.success) {
    log('⚠ Release completed but git push may have failed due to branch protection', 'warning');
    log('📝 Next: Create branch and PR with version bump commit', 'info');
  }
  
  return true;
};

const preRelease = async (pkg) => {
  log('\n🧪 Pre-release (Beta/Alpha)', 'info');
  
  const currentBranch = getCurrentBranch();
  if (currentBranch === CONFIG.DEFAULT_BRANCH) {
    log('⚠ Pre-release should be on feature branch, not main', 'warning');
    if (!(await ask('Continue anyway? (y/N): ')).toLowerCase().startsWith('y')) return false;
  }

  const tag = await ask('Enter pre-release tag (e.g., beta, alpha): ');
  const version = await ask('Enter version number (e.g., 0.0.1-beta.0): ');
  
  // Run comprehensive pre-release validation
  log('🔍 Running pre-release validation...', 'info');
  if (!(await runPreReleaseValidation())) {
    log('❌ Pre-release validation failed - cannot proceed', 'error');
    return false;
  }
  
  showCommonWarnings();
  log(`  - When prompted for version, select "Other (specify)" and enter: ${version}`, 'info');
  
  if (!(await ask('\nProceed? (y/N): ')).toLowerCase().startsWith('y')) return false;
  
  log('📋 Running preview...', 'info');
  run(`npx np@${CONFIG.NP_VERSION} --tag=${tag} --no-release-draft --any-branch --preview`);
  
  if (!(await ask('\nRun actual pre-release? (y/N): ')).toLowerCase().startsWith('y')) return false;
  
  log('🚀 Executing pre-release...', 'info');
  const result = run(`npx np@${CONFIG.NP_VERSION} --tag=${tag} --no-release-draft --any-branch`);
  
  if (result.success) {
    log('✅ Pre-release completed successfully', 'success');
    log('📝 Note: No need to push this branch to remote', 'info');
  }
  
  return result.success;
};

const previousVersionRelease = async (pkg) => {
  log('\n🔄 Previous Major Version Release', 'info');
  
  const targetVersion = await ask('Enter target version to update (e.g., v11.5.0): ');
  const newVersion = await ask('Enter new version to release (e.g., 11.6.0): ');
  const npmTag = await ask('Enter npm tag (e.g., previous, oclif-core-v2): ');
  
  log(`📋 Target: ${targetVersion}, New: ${newVersion}, Tag: ${npmTag}`, 'info');
  
  // Checkout and create branch
  if (!run(`git checkout ${targetVersion}`).success) {
    log('❌ Failed to checkout target version', 'error');
    return false;
  }
  
  const versionBranch = `version-${newVersion}`;
  if (!run(`git checkout -b ${versionBranch}`).success) {
    log('❌ Failed to create version branch', 'error');
    return false;
  }
  
  if (!run(`git push origin ${versionBranch}`).success) {
    log('❌ Failed to push version branch', 'error');
    return false;
  }
  
  log('✅ Branch created and pushed successfully', 'success');
  log('📝 Make your changes, commit them, and merge into the version branch', 'info');
  
     if (!(await ask('\nReady to proceed with release? (y/N): ')).toLowerCase().startsWith('y')) return false;
   
   run(`git pull origin ${versionBranch}`);
   run('npm install');
   
   // Run comprehensive pre-release validation
   log('🔍 Running pre-release validation...', 'info');
   if (!(await runPreReleaseValidation())) {
     log('❌ Pre-release validation failed - cannot proceed', 'error');
     return false;
   }
   else {
    log('✅ Pre-release validation passed', 'success');
   }
   
   showCommonWarnings();
  
  if (!(await ask('\nProceed with release? (y/N): ')).toLowerCase().startsWith('y')) return false;
  
  log('📋 Running preview...', 'info');
  run(`npx np@${CONFIG.NP_VERSION} --branch ${versionBranch} --tag ${npmTag} --preview`);
  
  if (!(await ask('\nRun actual release? (y/N): ')).toLowerCase().startsWith('y')) return false;
  
  log('🚀 Executing release...', 'info');
  const result = run(`npx np@${CONFIG.NP_VERSION} --branch ${versionBranch} --tag ${npmTag}`);
  
  if (result.success) {
    log('✅ Previous version release completed successfully', 'success');
    log('📝 GitHub release draft will open - remember to:', 'info');
    log('   1. Change target to branch: ${versionBranch}', 'info');
    log('   2. Uncheck "Set as the latest release"', 'info');
    log('   3. Click "Publish Release"', 'info');
  }
  
  return result.success;
};

const main = async () => {
  try {
    log('🚀 Heroku CLI Plugin Release Script', 'info');
    log('=====================================\n', 'info');
    
    const pkg = getPackageInfo();
    log(`📦 Package: ${pkg.name}`, 'info');
    log(`📋 Version: ${pkg.version}`, 'info');
    
    if (!checkPrerequisites()) process.exit(1);
    
    // Show essential scripts for release
    const essentialScripts = getEssentialScripts();
    const availableEssential = Object.entries(essentialScripts)
      .filter(([name, script]) => script)
      .map(([name, script]) => `${name}: ${script}`);
    
    if (availableEssential.length > 0) {
      log('\n📜 Essential scripts for release:', 'info');
      availableEssential.forEach(script => {
        log(`   ${script}`, 'info');
      });
    }
    
    log('\n📋 Available release types:', 'info');
    log('1. Standard release (main branch)', 'info');
    log('2. Pre-release (beta/alpha)', 'info');
    log('3. Patch/minor for previous major version', 'info');
    
    const choice = await ask('\nSelect release type (1-3): ');
    
    let success = false;
    switch (choice) {
      case '1': success = await standardRelease(pkg); break;
      case '2': success = await preRelease(pkg); break;
      case '3': success = await previousVersionRelease(pkg); break;
      default: log('❌ Invalid selection', 'error'); process.exit(1);
    }
    
    if (success) {
      log('\n🎉 Release process completed successfully!', 'success');
      log('📝 Next steps:', 'info');
      log('   - Check GitHub for the new release', 'info');
      log('   - Verify npm package was published correctly', 'info');
      log('   - Update documentation if needed', 'info');
    } else {
      log('\n❌ Release process exited', 'error');
      process.exit(1);
    }
    
  } catch (error) {
    log(`\n❌ Fatal error: ${error.message}`, 'error');
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

// Export only what's needed for testing
module.exports = {
  standardRelease,
  preRelease,
  previousVersionRelease,
  getPackageInfo,
  checkPrerequisites,
  getAvailableScripts,
  getEssentialScripts,
  runPreReleaseValidation
};
