# Command Testing Checklist

## Project Context
- **Project Type**: CommonJS (CJS) project
- **Framework**: oclif 4 with oclif/core 2
- **Testing**: c8 for test coverage
- **Language**: TypeScript source, compiled to JavaScript for testing
- **Architecture**: CLI commands for PostgreSQL database analysis

## Current Status: Bloat COMMAND TESTS COMPLETED ✅

### ✅ Completed Tests
- [x] **util** - `test/lib/util.test.ts`
  - **Type**: Utility Function Testing (NOT command class testing)
  - All 5 utility functions tested with comprehensive coverage
  - Mock database operations with sinon
  - Error handling scenarios covered
  - TypeScript types properly defined
  - CJS import pattern established

- [x] **bloat** - `test/commands/pg/bloat.test.ts`
  - **Type**: Command Class Testing
  - Static properties validation (description, args, flags)
  - Instance creation and property testing
  - Command execution flow with mocked dependencies
  - Error handling scenarios (database failures, query errors)
  - SQL query structure validation
  - Integration testing with utility functions
  - Proper oclif command mocking patterns established

### ❌ Tests Still Needed
- [ ] **blocking** - `test/commands/pg/blocking.test.ts` (needs creation)
- [ ] **cache-hit** - `test/commands/pg/cache-hit.test.ts` (needs creation)
- [ ] **calls** - `test/commands/pg/calls.test.ts` (needs creation)
- [ ] **extensions** - `test/commands/pg/extensions.test.ts` (needs creation)

### 📋 Test Coverage Types Status
- [x] **Utility Function Testing** (all 5 functions covered)
- [x] **Command Class Testing** (bloat command completed - static properties, flags, args, instance creation)
- [x] **Command Instance Testing** (bloat command completed)
- [x] **Command Execution Testing** (bloat command completed - run method with mocked dependencies)
- [x] **Database Integration Testing** (bloat command completed - mocked PostgreSQL operations)
- [ ] **CLI Integration Testing** (using runCommand helper)
- [x] **Error Handling Testing** (utility functions + bloat command errors covered)

### 📁 File Structure
```
test/
├── commands/
│   └── pg/
│       ├── bloat.test.ts ✅ (COMPLETED - comprehensive command class tests)
│       ├── blocking.test.ts (needs creation)
│       ├── cache-hit.test.ts (needs creation)
│       ├── calls.test.ts (needs creation)
│       └── extensions.test.ts (needs creation)
├── lib/
│   ├── util.test.ts ✅ (COMPLETED - comprehensive tests)
│   └── util.test.js (legacy, can be removed)
└── TEST_CHECKLIST.md ✅
```

### 🎯 Priority Order for Implementation
1. **✅ COMPLETED: util tests** - `test/lib/util.test.ts`
   - All utility functions tested and working
   - Established testing patterns for future use

2. **✅ COMPLETED: bloat command tests** - `test/commands/pg/bloat.test.ts`
   - Full command class testing completed
   - Established oclif command testing patterns
   - Ready to use as template for other commands

3. **Next: Create tests for remaining PostgreSQL commands**:
   - [ ] **blocking** - display queries holding locks
   - [ ] **cache-hit** - show index and table hit rate
   - [ ] **calls** - show top 10 queries by execution frequency
   - [ ] **extensions** - list available and installed extensions

4. **Add CLI integration testing using runCommand helper**
5. **Ensure comprehensive error handling coverage**

### 📝 Test Template Structure (Based on util.test.ts)
Each test file should include:
- **Import Pattern**: `const util = require('../../dist/lib/util')` (CJS style)
- **Mock Setup**: Use sinon sandbox for clean test isolation
- **Type Safety**: Define proper interfaces for mock objects
- **Error Testing**: Try-catch blocks with proper error message validation
- **Async Testing**: Proper async/await with error handling
- **Mock Verification**: Verify mocks are called with correct parameters

### 📝 Command Class Testing Template (Based on bloat.test.ts)
Each command test should include:
- **Static Properties**: Test `description`, `args`, `flags` properties
- **Instance Creation**: Test `new CommandClass()` works
- **Command Execution**: Test the `run()` method with mocked dependencies
- **Flag Parsing**: Test command line argument handling
- **Integration**: Test how commands use utility functions
- **Error Handling**: Test command-level error scenarios
- **Property Validation**: Test private properties and query structures
- **Mocking Strategy**: Use sinon sandbox with proper cleanup

### 🔧 Setup Requirements
- **TypeScript Compilation**: `npm run build` to generate `dist/` files
- **Test Dependencies**: Mocha, Chai, Sinon already configured
- **Import Paths**: Tests import from `dist/` directory (compiled JS)
- **Mocking Strategy**: Mock `utils.pg.psql.exec` for database operations
- **Command Testing**: Import command classes from `dist/commands/pg/`
- **oclif Mocking**: Use `sandbox.stub(command, 'heroku').get()` for read-only properties

### 📚 Util Functions Context (for Command Tests)
The following utility functions are now tested and available for command testing:

1. **`ensurePGStatStatement(db)`** - Verifies pg_stat_statements extension is installed
2. **`ensureEssentialTierPlan(db)`** - Blocks operations on Essential-tier databases
3. **`essentialNumPlan(plan)`** - Identifies Essential-tier plans by name
4. **`newTotalExecTimeField(db)`** - Checks if PostgreSQL version supports total_exec_time (13+)
5. **`newBlkTimeFields(db)`** - Checks if PostgreSQL version supports block time fields (17+)

**Usage in Commands**: These functions are typically called early in command execution to:
- Validate database prerequisites
- Check plan restrictions
- Determine available PostgreSQL features for query generation

**Testing Pattern**: Commands should mock these utility functions or test their integration with the utility layer.
