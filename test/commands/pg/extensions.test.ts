/* global describe, it, before, beforeEach, afterEach */
import {utils} from '@heroku/heroku-cli-util'
import {ux} from '@oclif/core'
import {expect} from 'chai'
import sinon from 'sinon'

// Import the compiled JavaScript version
const PgExtensions = require('../../../dist/commands/pg/extensions').default

// Test data factories for better extensibility
const createTestArgs = (overrides = {}) => ({
  database: 'test-db',
  ...overrides,
})

const createTestFlags = (overrides = {}) => ({
  app: 'test-app',
  ...overrides,
})

const createMockHeroku = () => ({
  config: {apiToken: 'test-token'},
  get: sinon.stub(),
  post: sinon.stub(),
})

const createMockDatabase = (overrides = {}) => ({
  attachment: {name: 'test-attachment'},
  plan: {name: 'premium-0'},
  // Add other database properties as needed
  ...overrides,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any)

// Shared test utilities
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const setupCommandMocks = (command: any, sandbox: sinon.SinonSandbox) => {
  const mockHeroku = createMockHeroku()
  const mockDb = createMockDatabase()

  sandbox.stub(command, 'heroku').get(() => mockHeroku)
  sandbox.stub(utils.pg.fetcher, 'database').resolves(mockDb)
  sandbox.stub(utils.pg.psql, 'exec').resolves('mock output')
  sandbox.stub(ux, 'log')

  return {mockDb, mockHeroku}
}

// Custom error testing utility (best practice alternative to chai-as-promised)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const expectRejection = async (promise: Promise<any>, expectedMessage: string) => {
  try {
    await promise
    expect.fail('Should have thrown an error')
  } catch (error: unknown) {
    const err = error as Error
    expect(err.message).to.include(expectedMessage)
  }
}

describe('PgExtensions', function () {
  let sandbox: sinon.SinonSandbox
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let command: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockHeroku: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDbConnection: any

  // Performance optimization: Single command instance
  before(function () {
    command = new PgExtensions()
  })

  beforeEach(function () {
    sandbox = sinon.createSandbox()

    // Setup mocks using shared utility
    const mocks = setupCommandMocks(command, sandbox)
    mockHeroku = mocks.mockHeroku
    mockDbConnection = mocks.mockDb
  })

  afterEach(function () {
    sandbox.restore()
  })

  describe('Command Class', function () {
    it('should have correct static description', function () {
      expect(PgExtensions.description).to.equal('list available and installed extensions')
    })

    it('should have correct static args', function () {
      expect(PgExtensions.args).to.have.property('database')
      expect(PgExtensions.args.database.description).to.equal('database name')
    })

    it('should have correct static flags', function () {
      expect(PgExtensions.flags).to.have.property('app')
      expect(PgExtensions.flags).to.have.property('remote')
      expect(PgExtensions.flags.app.required).to.be.true
      expect(PgExtensions.flags.remote.char).to.equal('r')
    })

    it('should create command instance', function () {
      expect(command).to.be.instanceOf(PgExtensions)
      expect(command).to.have.property('heroku')
    })
  })

  describe('Command Execution', function () {
    it('should execute run method successfully with non-essential plan', async function () {
      const mockFetcher = utils.pg.fetcher.database as sinon.SinonStub
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      const mockLog = ux.log as sinon.SinonStub

      // Mock utility function to return false (non-essential plan)
      sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').returns(false)

      // Use test data factories
      const testArgs = createTestArgs()
      const testFlags = createTestFlags()

      sandbox.stub(command, 'parse').resolves({
        args: testArgs,
        flags: testFlags,
      })

      await command.run()

      expect(mockFetcher.calledOnce).to.be.true
      expect(mockFetcher.calledWith(mockHeroku, testFlags.app, testArgs.database)).to.be.true

      expect(mockExec.calledOnce).to.be.true
      expect(mockLog.calledOnce).to.be.true
      expect(mockLog.calledWith('mock output')).to.be.true
    })

    it('should execute run method successfully with essential plan', async function () {
      const mockFetcher = utils.pg.fetcher.database as sinon.SinonStub
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      const mockLog = ux.log as sinon.SinonStub

      // Mock utility function to return true (essential plan)
      sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').returns(true)

      // Use test data factories
      const testArgs = createTestArgs()
      const testFlags = createTestFlags()

      sandbox.stub(command, 'parse').resolves({
        args: testArgs,
        flags: testFlags,
      })

      await command.run()

      expect(mockFetcher.calledOnce).to.be.true
      expect(mockFetcher.calledWith(mockHeroku, testFlags.app, testArgs.database)).to.be.true

      expect(mockExec.calledOnce).to.be.true
      expect(mockLog.calledOnce).to.be.true
      expect(mockLog.calledWith('mock output')).to.be.true
    })

    it('should handle database fetching errors', async function () {
      const mockFetcher = utils.pg.fetcher.database as sinon.SinonStub
      mockFetcher.rejects(new Error('Database connection failed'))

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      // Better error testing pattern
      await expectRejection(command.run(), 'Database connection failed')
      expect(mockFetcher.calledOnce).to.be.true
    })

    it('should handle query execution errors', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.rejects(new Error('Query execution failed'))

      // Mock utility function
      sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').returns(false)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      // Better error testing pattern
      await expectRejection(command.run(), 'Query execution failed')
      expect(mockExec.calledOnce).to.be.true
    })

    it('should parse command arguments correctly', async function () {
      const testArgs = createTestArgs({database: 'production-db'})
      const testFlags = createTestFlags({app: 'my-app', remote: 'heroku'})

      const mockParse = sandbox.stub(command, 'parse').resolves({
        args: testArgs,
        flags: testFlags,
      })

      // Mock utility function
      sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').returns(false)

      await command.run()

      expect(mockParse.calledOnce).to.be.true
      expect(mockParse.calledWith(PgExtensions)).to.be.true
    })

    it('should handle different database names', async function () {
      const testArgs = createTestArgs({database: 'staging-db'})
      const testFlags = createTestFlags({app: 'staging-app'})

      // Mock utility function
      sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').returns(false)

      sandbox.stub(command, 'parse').resolves({
        args: testArgs,
        flags: testFlags,
      })

      await command.run()

      const mockFetcher = utils.pg.fetcher.database as sinon.SinonStub
      expect(mockFetcher.calledWith(mockHeroku, testFlags.app, testArgs.database)).to.be.true
    })
  })

  describe('Utility Function Integration', function () {
    it('should call essentialNumPlan utility with correct parameters', async function () {
      const mockEssentialNumPlan = sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').returns(false)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      expect(mockEssentialNumPlan.calledOnce).to.be.true
      expect(mockEssentialNumPlan.calledWith(mockDbConnection.attachment.addon)).to.be.true
    })

    it('should handle utility function errors gracefully', async function () {
      sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').throws(new Error('Utility function failed'))

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await expectRejection(command.run(), 'Utility function failed')
    })
  })

  describe('Conditional Query Generation', function () {
    it('should generate RDS query for essential plans', async function () {
      // Mock utility function to return true (essential plan)
      sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').returns(true)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.callsFake((db, query) => {
        // Check for RDS-specific query structure
        expect(query).to.include('FROM pg_available_extensions')
        expect(query).to.include("WHERE name IN (SELECT unnest(string_to_array(current_setting('rds.allowed_extensions'), ',')))")
        return Promise.resolve('mock output')
      })

      await command.run()

      expect(mockExec.calledOnce).to.be.true
    })

    it('should generate standard query for non-essential plans', async function () {
      // Mock utility function to return false (non-essential plan)
      sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').returns(false)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.callsFake((db, query) => {
        // Check for standard query structure
        expect(query).to.include('FROM pg_available_extensions')
        expect(query).to.include("WHERE name IN (SELECT unnest(string_to_array(current_setting('extwlist.extensions'), ',')))")
        return Promise.resolve('mock output')
      })

      await command.run()

      expect(mockExec.calledOnce).to.be.true
    })

    it('should use correct database connection for utility function', async function () {
      // Create a mock database with specific attachment structure
      const mockDbWithAttachment = createMockDatabase({
        attachment: {
          addon: {plan: {name: 'heroku:essential-0'}},
          name: 'test-attachment',
        },
      })

      // Mock utility function to return true (essential plan)
      const mockEssentialNumPlan = sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').returns(true)

      // Update the mock to return our specific database (without conflicting with setupCommandMocks)
      const mockFetcher = utils.pg.fetcher.database as sinon.SinonStub
      mockFetcher.resolves(mockDbWithAttachment)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      expect(mockEssentialNumPlan.calledWith(mockDbWithAttachment.attachment.addon)).to.be.true
    })
  })

  describe('Query Structure and Logic', function () {
    it('should have consistent base query structure for both plan types', async function () {
      // Test essential plan query
      sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').returns(true)
      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.callsFake((db, query) => {
        // Both queries should have the same base structure
        expect(query).to.include('SELECT *')
        expect(query).to.include('FROM pg_available_extensions')
        expect(query).to.include('WHERE name IN (SELECT unnest(string_to_array(current_setting(')
        expect(query).to.include('), \',\')))')
        return Promise.resolve('mock output')
      })

      await command.run()

      expect(mockExec.calledOnce).to.be.true
    })

    it('should use correct setting names for different plan types', async function () {
      // Test essential plan (RDS)
      sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').returns(true)
      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.callsFake((db, query) => {
        expect(query).to.include("'rds.allowed_extensions'")
        return Promise.resolve('mock output')
      })

      await command.run()

      // Test non-essential plan (standard)
      sandbox.restore()
      sandbox = sinon.createSandbox()
      setupCommandMocks(command, sandbox)

      sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').returns(false)
      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      mockExec.callsFake((db, query) => {
        expect(query).to.include("'extwlist.extensions'")
        return Promise.resolve('mock output')
      })

      await command.run()
    })
  })

  describe('Integration with Utility Functions', function () {
    it('should use database fetcher utility', async function () {
      const mockFetcher = utils.pg.fetcher.database as sinon.SinonStub

      // Mock utility function
      sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').returns(false)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      expect(mockFetcher.calledOnce).to.be.true
      expect(mockFetcher.calledWith(mockHeroku, 'test-app', 'test-db')).to.be.true
    })

    it('should use psql exec utility', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub

      // Mock utility function
      sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').returns(false)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      expect(mockExec.calledOnce).to.be.true
    })

    it('should use ux.log for output', async function () {
      const mockLog = ux.log as sinon.SinonStub

      // Mock utility function
      sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').returns(false)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      expect(mockLog.calledOnce).to.be.true
      expect(mockLog.calledWith('mock output')).to.be.true
    })
  })

  describe('Edge Cases and Error Scenarios', function () {
    it('should handle missing database argument', async function () {
      const testArgs = createTestArgs({database: null})
      const testFlags = createTestFlags()

      // Mock utility function
      sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').returns(false)

      sandbox.stub(command, 'parse').resolves({
        args: testArgs,
        flags: testFlags,
      })

      // This should still work as the command handles missing database
      await command.run()

      const mockFetcher = utils.pg.fetcher.database as sinon.SinonStub
      expect(mockFetcher.calledWith(mockHeroku, testFlags.app, null)).to.be.true
    })

    it('should handle empty output from database', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('') // Empty output

      // Mock utility function
      sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').returns(false)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      const mockLog = ux.log as sinon.SinonStub
      expect(mockLog.calledWith('')).to.be.true
    })

    it('should handle extensions output with available extensions', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('pg_stat_statements | 1.8 | public | t\nuuid-ossp | 1.1 | public | t') // Sample extensions data

      // Mock utility function
      sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').returns(false)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      const mockLog = ux.log as sinon.SinonStub
      expect(mockLog.calledWith('pg_stat_statements | 1.8 | public | t\nuuid-ossp | 1.1 | public | t')).to.be.true
    })

    it('should handle different plan types correctly', async function () {
      // Test with essential plan
      sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').returns(true)
      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.callsFake((db, query) => {
        expect(query).to.include("'rds.allowed_extensions'")
        return Promise.resolve('essential plan output')
      })

      await command.run()

      // Reset and test with non-essential plan
      sandbox.restore()
      sandbox = sinon.createSandbox()
      setupCommandMocks(command, sandbox)

      sandbox.stub(require('../../../dist/lib/util'), 'essentialNumPlan').returns(false)
      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      mockExec.callsFake((db, query) => {
        expect(query).to.include("'extwlist.extensions'")
        return Promise.resolve('non-essential plan output')
      })

      await command.run()
    })
  })
})
