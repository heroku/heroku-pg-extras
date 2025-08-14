/* global describe, it, before, beforeEach, afterEach */
import {utils} from '@heroku/heroku-cli-util'
import {ux} from '@oclif/core'
import {expect} from 'chai'
import sinon from 'sinon'

// Import the compiled JavaScript version
const PgCalls = require('../../../dist/commands/pg/calls').default

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

const createMockDatabase = () => ({
  attachment: {name: 'test-attachment'},
  plan: {name: 'premium-0'},
  // Add other database properties as needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any) // Use any to avoid complex type compatibility issues

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

describe('PgCalls', function () {
  let sandbox: sinon.SinonSandbox
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let command: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockHeroku: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDbConnection: any

  // Performance optimization: Single command instance
  before(function () {
    command = new PgCalls()
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
      expect(PgCalls.description).to.equal('show 10 queries that have highest frequency of execution')
    })

    it('should have correct static args', function () {
      expect(PgCalls.args).to.have.property('database')
      expect(PgCalls.args.database.description).to.equal('database name')
    })

    it('should have correct static flags', function () {
      expect(PgCalls.flags).to.have.property('app')
      expect(PgCalls.flags).to.have.property('remote')
      expect(PgCalls.flags).to.have.property('truncate')
      expect(PgCalls.flags.app.required).to.be.true
      expect(PgCalls.flags.remote.char).to.equal('r')
      expect(PgCalls.flags.truncate.char).to.equal('t')
      expect(PgCalls.flags.truncate.description).to.equal('truncate queries to 40 characters')
    })

    it('should create command instance', function () {
      expect(command).to.be.instanceOf(PgCalls)
      expect(command).to.have.property('heroku')
    })
  })

  describe('Command Execution', function () {
    it('should execute run method successfully with default flags', async function () {
      const mockFetcher = utils.pg.fetcher.database as sinon.SinonStub
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      const mockLog = ux.log as sinon.SinonStub

      // Mock utility functions
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(true)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(true)

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

      // Mock utility functions
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(true)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(true)

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
      const testFlags = createTestFlags({app: 'my-app', remote: 'heroku', truncate: true})

      const mockParse = sandbox.stub(command, 'parse').resolves({
        args: testArgs,
        flags: testFlags,
      })

      // Mock utility functions
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(true)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(true)

      await command.run()

      expect(mockParse.calledOnce).to.be.true
      expect(mockParse.calledWith(PgCalls)).to.be.true
    })

    it('should handle different database names', async function () {
      const testArgs = createTestArgs({database: 'staging-db'})
      const testFlags = createTestFlags({app: 'staging-app'})

      // Mock utility functions
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(true)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(true)

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
    it('should call ensurePGStatStatement utility', async function () {
      const mockEnsurePGStatStatement = sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(true)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(true)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      expect(mockEnsurePGStatStatement.calledOnce).to.be.true
      expect(mockEnsurePGStatStatement.calledWith(mockDbConnection)).to.be.true
    })

    it('should call newTotalExecTimeField utility', async function () {
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').resolves()
      const mockNewTotalExecTimeField = sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(true)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(true)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      expect(mockNewTotalExecTimeField.calledOnce).to.be.true
      expect(mockNewTotalExecTimeField.calledWith(mockDbConnection)).to.be.true
    })

    it('should call newBlkTimeFields utility', async function () {
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(true)
      const mockNewBlkTimeFields = sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(true)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      expect(mockNewBlkTimeFields.calledOnce).to.be.true
      expect(mockNewBlkTimeFields.calledWith(mockDbConnection)).to.be.true
    })

    it('should handle utility function errors gracefully', async function () {
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').rejects(new Error('Extension not available'))
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(true)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(true)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await expectRejection(command.run(), 'Extension not available')
    })
  })

  describe('Dynamic Query Generation', function () {
    it('should generate query with new total_exec_time field when supported', async function () {
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(true)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(true)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.callsFake((db, query) => {
        expect(query).to.include('total_exec_time')
        expect(query).to.include('shared_blk_read_time')
        expect(query).to.include('shared_blk_write_time')
        return Promise.resolve('mock output')
      })

      await command.run()

      expect(mockExec.calledOnce).to.be.true
    })

    it('should generate query with legacy total_time field when not supported', async function () {
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(false)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(false)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.callsFake((db, query) => {
        expect(query).to.include('total_time')
        expect(query).to.include('blk_read_time')
        expect(query).to.include('blk_write_time')
        return Promise.resolve('mock output')
      })

      await command.run()

      expect(mockExec.calledOnce).to.be.true
    })

    it('should handle truncate flag for query display', async function () {
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(true)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(true)

      const testFlags = createTestFlags({truncate: true})

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: testFlags,
      })

      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.callsFake((db, query) => {
        expect(query).to.include("CASE WHEN length(query) <= 40 THEN query ELSE substr(query, 0, 39) || '…' END")
        return Promise.resolve('mock output')
      })

      await command.run()

      expect(mockExec.calledOnce).to.be.true
    })

    it('should handle no truncate flag for full query display', async function () {
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(true)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(true)

      const testFlags = createTestFlags({truncate: false})

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: testFlags,
      })

      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.callsFake((db, query) => {
        expect(query).to.include('query AS query')
        return Promise.resolve('mock output')
      })

      await command.run()

      expect(mockExec.calledOnce).to.be.true
    })
  })

  describe('Query Structure and Logic', function () {
    it('should generate query with correct SELECT structure', async function () {
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(true)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(true)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.callsFake((db, query) => {
        // Check for required fields
        expect(query).to.include('total_exec_time')
        expect(query).to.include('prop_exec_time')
        expect(query).to.include('ncalls')
        expect(query).to.include('sync_io_time')
        expect(query).to.include('query')

        // Check for FROM clause
        expect(query).to.include('FROM pg_stat_statements')

        // Check for WHERE clause
        expect(query).to.include('WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user LIMIT 1)')

        // Check for ORDER BY and LIMIT
        expect(query).to.include('ORDER BY calls DESC')
        expect(query).to.include('LIMIT 10')

        return Promise.resolve('mock output')
      })

      await command.run()

      expect(mockExec.calledOnce).to.be.true
    })

    it('should calculate proportion of execution time correctly', async function () {
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(true)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(true)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.callsFake((db, query) => {
        expect(query).to.include('(total_exec_time/sum(total_exec_time) OVER()) * 100')
        expect(query).to.include("'FM90D0'")
        expect(query).to.include('%')
        return Promise.resolve('mock output')
      })

      await command.run()

      expect(mockExec.calledOnce).to.be.true
    })

    it('should format calls count with proper formatting', async function () {
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(true)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(true)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.callsFake((db, query) => {
        expect(query).to.include("to_char(calls, 'FM999G999G999G990') AS ncalls")
        return Promise.resolve('mock output')
      })

      await command.run()

      expect(mockExec.calledOnce).to.be.true
    })
  })

  describe('Integration with Utility Functions', function () {
    it('should use database fetcher utility', async function () {
      const mockFetcher = utils.pg.fetcher.database as sinon.SinonStub

      // Mock utility functions
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(true)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(true)

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

      // Mock utility functions
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(true)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(true)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      expect(mockExec.calledOnce).to.be.true
    })

    it('should use ux.log for output', async function () {
      const mockLog = ux.log as sinon.SinonStub

      // Mock utility functions
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(true)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(true)

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

      // Mock utility functions
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(true)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(true)

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

      // Mock utility functions
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(true)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(true)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      const mockLog = ux.log as sinon.SinonStub
      expect(mockLog.calledWith('')).to.be.true
    })

    it('should handle calls output with execution statistics', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('query1 | 100ms | 25% | 1000 | 50ms\nquery2 | 200ms | 50% | 500 | 100ms') // Sample calls data

      // Mock utility functions
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').resolves(true)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').resolves(true)

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      const mockLog = ux.log as sinon.SinonStub
      expect(mockLog.calledWith('query1 | 100ms | 25% | 1000 | 50ms\nquery2 | 200ms | 50% | 500 | 100ms')).to.be.true
    })
  })
})
