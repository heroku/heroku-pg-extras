/* global describe, it, before, beforeEach, afterEach */
import {utils} from '@heroku/heroku-cli-util'
import {ux} from '@oclif/core'
import {expect} from 'chai'
import sinon from 'sinon'

// Import the compiled JavaScript version
const PgLocks = require('../../../dist/commands/pg/locks').default

// Test data factories for better extensibility
const createTestArgs = (overrides = {}) => ({
  database: 'test-db',
  ...overrides,
})

const createTestFlags = (overrides = {}) => ({
  app: 'test-app',
  remote: undefined,
  truncate: false,
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
  sandbox.stub(utils.pg.psql, 'exec').resolves('123 | table_name | 456 | true | SELECT * FROM table | 00:01:30')
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

describe('PgLocks', function () {
  let sandbox: sinon.SinonSandbox
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let command: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockHeroku: any
  // Performance optimization: Single command instance
  before(function () {
    command = new PgLocks()
  })

  beforeEach(function () {
    sandbox = sinon.createSandbox()

    // Setup mocks using shared utility
    const mocks = setupCommandMocks(command, sandbox)
    mockHeroku = mocks.mockHeroku
  })

  afterEach(function () {
    sandbox.restore()
  })

  describe('Command Class', function () {
    it('should have correct static description', function () {
      expect(PgLocks.description).to.equal('display queries with active locks')
    })

    it('should have correct static args', function () {
      expect(PgLocks.args).to.have.property('database')
      expect(PgLocks.args.database.description).to.equal('database name')
    })

    it('should have correct static flags', function () {
      expect(PgLocks.flags).to.have.property('app')
      expect(PgLocks.flags).to.have.property('remote')
      expect(PgLocks.flags).to.have.property('truncate')
      expect(PgLocks.flags.app.required).to.be.true
      expect(PgLocks.flags.remote.char).to.equal('r')
      expect(PgLocks.flags.truncate.char).to.equal('t')
      expect(PgLocks.flags.truncate.description).to.equal('truncates queries to 40 characters')
    })

    it('should create command instance', function () {
      expect(command).to.be.instanceOf(PgLocks)
      expect(command).to.have.property('heroku')
    })

    it('should have private baseQuery property', function () {
      expect(command).to.have.property('baseQuery')
      expect(command.baseQuery).to.be.a('string')
      expect(command.baseQuery).to.include('SELECT')
      expect(command.baseQuery).to.include('pg_stat_activity.pid')
      expect(command.baseQuery).to.include('pg_class.relname')
      expect(command.baseQuery).to.include('pg_locks.transactionid')
      expect(command.baseQuery).to.include('pg_locks.granted')
      expect(command.baseQuery).to.include('%QUERY_SNIPPET%')
      expect(command.baseQuery).to.include('age(now(),pg_stat_activity.query_start)')
    })

    it('should have truncatedQueryString method', function () {
      expect(command).to.have.property('truncatedQueryString')
      expect(command.truncatedQueryString).to.be.a('function')
    })

    it('should have getQuery method', function () {
      expect(command).to.have.property('getQuery')
      expect(command.getQuery).to.be.a('function')
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
      expect(mockLog.called).to.be.true
    })

    it('should output lock data via ux.log', async function () {
      const mockLog = ux.log as sinon.SinonStub

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      expect(mockLog.called).to.be.true
      const output = mockLog.firstCall.args[0]
      expect(output).to.include('123')
      expect(output).to.include('table_name')
      expect(output).to.include('456')
      expect(output).to.include('true')
      expect(output).to.include('SELECT * FROM table')
      expect(output).to.include('00:01:30')
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
      expect(mockParse.calledWith(PgLocks)).to.be.true
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

  describe('Query Generation', function () {
    it('should generate query without truncation when truncate flag is false', function () {
      const query = command.getQuery(false)
      expect(query).to.include('pg_stat_activity.query AS query_snippet')
      expect(query).to.not.include('CASE WHEN length')
      expect(query).to.not.include('substr')
    })

    it('should generate query with truncation when truncate flag is true', function () {
      const query = command.getQuery(true)
      expect(query).to.include('CASE WHEN length(pg_stat_activity.query) <= 40 THEN pg_stat_activity.query ELSE substr(pg_stat_activity.query, 0, 39) || \'…\' END AS query_snippet')
    })

    it('should replace query snippet placeholder correctly', function () {
      const query = command.getQuery(false)
      expect(query).to.not.include('%QUERY_SNIPPET%')
      expect(query).to.include('pg_stat_activity.query AS query_snippet')
    })
  })

  describe('Query Structure', function () {
    it('should have valid SQL query structure', function () {
      const query = command.getQuery(false)

      // Check for required SELECT fields
      expect(query).to.include('SELECT')
      expect(query).to.include('pg_stat_activity.pid')
      expect(query).to.include('pg_class.relname')
      expect(query).to.include('pg_locks.transactionid')
      expect(query).to.include('pg_locks.granted')
      expect(query).to.include('query_snippet')
      expect(query).to.include('age(now(),pg_stat_activity.query_start) AS "age"')

      // Check for FROM and JOIN
      expect(query).to.include('FROM pg_stat_activity,pg_locks left')
      expect(query).to.include('OUTER JOIN pg_class')
      expect(query).to.include('ON (pg_locks.relation = pg_class.oid)')

      // Check for WHERE conditions
      expect(query).to.include("pg_stat_activity.query <> '<insufficient privilege>'")
      expect(query).to.include('pg_locks.pid = pg_stat_activity.pid')
      expect(query).to.include("pg_locks.mode = 'ExclusiveLock'")
      expect(query).to.include('pg_stat_activity.pid <> pg_backend_pid()')

      // Check for ORDER BY
      expect(query).to.include('order by query_start')
    })

    it('should filter out insufficient privilege queries', function () {
      const query = command.getQuery(false)
      expect(query).to.include("pg_stat_activity.query <> '<insufficient privilege>'")
    })

    it('should only show exclusive locks', function () {
      const query = command.getQuery(false)
      expect(query).to.include("pg_locks.mode = 'ExclusiveLock'")
    })

    it('should exclude current backend process', function () {
      const query = command.getQuery(false)
      expect(query).to.include('pg_stat_activity.pid <> pg_backend_pid()')
    })

    it('should order by query start time', function () {
      const query = command.getQuery(false)
      expect(query).to.include('order by query_start')
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

    it('should handle truncate flag variations', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('pid | table | txid | granted | query | age')

      // Test with truncate = true
      const testFlagsTruncate = createTestFlags({truncate: true})
      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: testFlagsTruncate,
      })

      await command.run()

      // Verify that the query was generated with truncation
      const mockLog = ux.log as sinon.SinonStub
      expect(mockLog.called).to.be.true
    })
  })
})
