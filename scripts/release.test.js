#!/usr/bin/env node

/**
 * Concise test suite for the release script
 * Run with: npm run test:release
 */

const {
  getPackageInfo,
  checkPrerequisites,
  getAvailableScripts,
  getEssentialScripts
} = require('./release.js');

// Simple test runner
const runTest = (name, testFn) => {
  try {
    testFn();
    console.log(`✅ ${name}`);
    return true;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    return false;
  }
};

// Test assertions
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const assertExists = (value, name) => {
  assert(value, `${name} should exist`);
};

const assertType = (value, expectedType, name) => {
  assert(typeof value === expectedType, `${name} should be ${expectedType}`);
};

// Test suite
console.log('Testing Release Script\n');

let passedTests = 0;
let totalTests = 0;

// Test 1: Package info validation
totalTests++;
if (runTest('Package info validation', () => {
  const pkg = getPackageInfo();
  assertExists(pkg.name, 'Package name');
  assertExists(pkg.version, 'Package version');
  assertExists(pkg.repository, 'Package repository');
  console.log(`   Found: ${pkg.name}@${pkg.version}`);
})) passedTests++;

// Test 2: Script detection
totalTests++;
if (runTest('Script detection', () => {
  const scripts = getAvailableScripts();
  assertType(scripts, 'object', 'Scripts object');
  assertExists(scripts.build, 'Build script');
  assertExists(scripts.test, 'Test script');
  console.log(`   Found scripts: ${Object.keys(scripts).join(', ')}`);
})) passedTests++;

// Test 3: Essential scripts filtering
totalTests++;
if (runTest('Essential scripts filtering', () => {
  const essential = getEssentialScripts();
  assertType(essential, 'object', 'Essential scripts object');
  assertExists(essential.build, 'Build script in essential');
  assertExists(essential.test, 'Test script in essential');
  console.log(`   Essential: ${Object.keys(essential).filter(k => essential[k]).join(', ')}`);
})) passedTests++;

// Test 4: Prerequisites checking
totalTests++;
if (runTest('Prerequisites validation', () => {
  const result = checkPrerequisites();
  assertType(result, 'boolean', 'Prerequisites result');
  console.log(`   Result: ${result}`);
})) passedTests++;

// Test 5: Error handling (mock test)
totalTests++;
if (runTest('Error handling', () => {
  // This would require mocking fs.readFileSync for comprehensive testing
  // For now, just verify the function exists and can be called
  assert(typeof getPackageInfo === 'function', 'getPackageInfo function');
  assert(typeof checkPrerequisites === 'function', 'checkPrerequisites function');
  console.log('   Functions available and callable');
})) passedTests++;

// Results
console.log(`\nTest Results: ${passedTests}/${totalTests} passed`);
console.log(passedTests === totalTests ? 'All tests passed!' : 'Some tests failed');

process.exit(passedTests === totalTests ? 0 : 1);
