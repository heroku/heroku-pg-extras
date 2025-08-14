/* global describe, it, before, beforeEach, afterEach */
import {utils} from '@heroku/heroku-cli-util'
import {ux} from '@oclif/core'
import {expect} from 'chai'
import sinon from 'sinon'

// Import the compiled JavaScript version
const PgIndexUsage = require('../../../dist/commands/pg/index-usage').default

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
  attachment: {
    addon: {
      plan: {name: 'premium-0'},
    },
    name: 'test-attachment',
  },
  database: 'test-database',
  host: 'test-host',
  password: 'test-password',
  user: 'test-user',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any)

// Shared test utilities
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const setupCommandMocks = (command: any, sandbox: sinon.SinonSandbox) => {
  const mockHeroku = createMockHeroku()
  const mockDb = createMockDatabase()

  sandbox.stub(command, 'heroku').get(() => mockHeroku)
  sandbox.stub(utils.pg.fetcher, 'database').resolves(mockDb)
  sandbox.stub(utils.pg.psql, 'exec').resolves('table_name_1 | 95.2 | 1000\ntable_name_2 | 99.8 | 5000')
  sandbox.stub(ux, 'log')

  return {mockDb, mockHeroku}
}

// Custom error testing utility
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

describe('PgIndexUsage', function () {
  let sandbox: sinon.SinonSandbox
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let command: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockHeroku: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDbConnection: any

  // Performance optimization: Single command instance
  before(function () {
    command = new PgIndexUsage()
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
      expect(PgIndexUsage.description).to.equal('calculates your index hit rate (effective databases are at 99% and up)')
    })

    it('should have correct static args', function () {
      expect(PgIndexUsage.args).to.have.property('database')
      expect(PgIndexUsage.args.database.description).to.equal('database name')
    })

    it('should have correct static flags', function () {
      expect(PgIndexUsage.flags).to.have.property('app')
      expect(PgIndexUsage.flags).to.have.property('remote')
      expect(PgIndexUsage.flags.app.required).to.be.true
      expect(PgIndexUsage.flags.remote.char).to.equal('r')
    })

    it('should create command instance', function () {
      expect(command).to.be.instanceOf(PgIndexUsage)
      expect(command).to.have.property('heroku')
    })

    it('should have private query property', function () {
      expect(command).to.have.property('query')
      expect(command.query).to.be.a('string')
      expect(command.query).to.include('SELECT relname')
      expect(command.query).to.include('CASE idx_scan')
      expect(command.query).to.include('percent_of_times_index_used')
      expect(command.query).to.include('rows_in_table')
      expect(command.query).to.include('FROM\n   pg_stat_user_tables')
    })
  })

  describe('Command Execution', function () {
    it('should execute run method successfully', async function () {
      const mockFetcher = utils.pg.fetcher.database as sinon.SinonStub
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      const mockLog = ux.log as sinon.SinonStub

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
      expect(mockExec.calledWith(mockDbConnection, command.query)).to.be.true

      expect(mockLog.called).to.be.true
    })

    it('should output index usage data via ux.log', async function () {
      const mockLog = ux.log as sinon.SinonStub

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      expect(mockLog.called).to.be.true
      const output = mockLog.firstCall.args[0]
      expect(output).to.include('table_name_1')
      expect(output).to.include('table_name_2')
      expect(output).to.include('95.2')
      expect(output).to.include('99.8')
      expect(output).to.include('1000')
      expect(output).to.include('5000')
    })

    it('should handle database fetching errors', async function () {
      const mockFetcher = utils.pg.fetcher.database as sinon.SinonStub
      mockFetcher.rejects(new Error('Database connection failed'))

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await expectRejection(command.run(), 'Database connection failed')
      expect(mockFetcher.calledOnce).to.be.true
    })

    it('should handle query execution errors', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.rejects(new Error('Query execution failed'))

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

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

      await command.run()

      expect(mockParse.calledOnce).to.be.true
      expect(mockParse.calledWith(PgIndexUsage)).to.be.true
    })

    it('should handle different database names', async function () {
      const testArgs = createTestArgs({database: 'staging-db'})
      const testFlags = createTestFlags({app: 'staging-app'})

      sandbox.stub(command, 'parse').resolves({
        args: testArgs,
        flags: testFlags,
      })

      await command.run()

      const mockFetcher = utils.pg.fetcher.database as sinon.SinonStub
      expect(mockFetcher.calledWith(mockHeroku, testFlags.app, testArgs.database)).to.be.true
    })
  })

  describe('Query Structure', function () {
    it('should have valid SQL query structure', function () {
      const {query} = command

      // Check for required SELECT
      expect(query).to.include('SELECT relname')
      expect(query).to.include('percent_of_times_index_used')
      expect(query).to.include('rows_in_table')

      // Check for CASE statement
      expect(query).to.include('CASE idx_scan')
      expect(query).to.include("WHEN 0 THEN 'Insufficient data'")
      expect(query).to.include('ELSE (100 * idx_scan / (seq_scan + idx_scan))::text')

      // Check for FROM and ORDER BY
      expect(query).to.include('FROM\n   pg_stat_user_tables')
      expect(query).to.include('ORDER BY\n   n_live_tup DESC')
    })

    it('should calculate index hit rate correctly', function () {
      const {query} = command

      expect(query).to.include('(100 * idx_scan / (seq_scan + idx_scan))::text')
    })

    it('should handle insufficient data case', function () {
      const {query} = command

      expect(query).to.include("WHEN 0 THEN 'Insufficient data'")
    })

    it('should order by table size', function () {
      const {query} = command

      expect(query).to.include('ORDER BY\n   n_live_tup DESC')
    })
  })

  describe('Integration with Utility Functions', function () {
    it('should use database fetcher utility', async function () {
      const mockFetcher = utils.pg.fetcher.database as sinon.SinonStub

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

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      expect(mockExec.calledOnce).to.be.true
      expect(mockExec.calledWith(mockDbConnection, command.query)).to.be.true
    })

    it('should use ux.log for output', async function () {
      const mockLog = ux.log as sinon.SinonStub

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      expect(mockLog.called).to.be.true
    })
  })

  describe('Edge Cases and Error Scenarios', function () {
    it('should handle missing database argument', async function () {
      const testArgs = createTestArgs({database: undefined})
      const testFlags = createTestFlags()

      sandbox.stub(command, 'parse').resolves({
        args: testArgs,
        flags: testFlags,
      })

      // This should still work as the command handles undefined database
      await command.run()

      const mockFetcher = utils.pg.fetcher.database as sinon.SinonStub
      expect(mockFetcher.calledWith(mockHeroku, testFlags.app)).to.be.true
    })

    it('should handle empty output from database', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('') // Empty output

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      const mockLog = ux.log as sinon.SinonStub
      expect(mockLog.calledWith('')).to.be.true
    })

    it('should handle single table output', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('single_table | 98.5 | 2500')

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      const mockLog = ux.log as sinon.SinonStub
      expect(mockLog.calledWith('single_table | 98.5 | 2500')).to.be.true
    })

    it('should handle insufficient data output', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('new_table | Insufficient data | 100')

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      const mockLog = ux.log as sinon.SinonStub
      expect(mockLog.calledWith('new_table | Insufficient data | 100')).to.be.true
    })
  })
})
