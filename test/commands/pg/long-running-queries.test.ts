/* global describe, it, before, beforeEach, afterEach */
import {utils} from '@heroku/heroku-cli-util'
import {ux} from '@oclif/core'
import {expect} from 'chai'
import sinon from 'sinon'

// Import the compiled JavaScript version
const PgLongRunningQueries = require('../../../dist/commands/pg/long-running-queries').default

// Test data factories for better extensibility
const createTestArgs = (overrides = {}) => ({
  database: 'test-db',
  ...overrides,
})

const createTestFlags = (overrides = {}) => ({
  app: 'test-app',
  remote: undefined,
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
  sandbox.stub(utils.pg.psql, 'exec').resolves('123 | 00:15:30 | SELECT * FROM large_table WHERE complex_condition')
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

describe('PgLongRunningQueries', function () {
  let sandbox: sinon.SinonSandbox
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let command: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockHeroku: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDbConnection: any

  // Performance optimization: Single command instance
  before(function () {
    command = new PgLongRunningQueries()
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
      expect(PgLongRunningQueries.description).to.equal('show all queries longer than five minutes by descending duration')
    })

    it('should have correct static args', function () {
      expect(PgLongRunningQueries.args).to.have.property('database')
      expect(PgLongRunningQueries.args.database.description).to.equal('database name')
    })

    it('should have correct static flags', function () {
      expect(PgLongRunningQueries.flags).to.have.property('app')
      expect(PgLongRunningQueries.flags).to.have.property('remote')
      expect(PgLongRunningQueries.flags.app.required).to.be.true
      expect(PgLongRunningQueries.flags.remote.char).to.equal('r')
    })

    it('should create command instance', function () {
      expect(command).to.be.instanceOf(PgLongRunningQueries)
      expect(command).to.have.property('heroku')
    })

    it('should have private query property', function () {
      expect(command).to.have.property('query')
      expect(command.query).to.be.a('string')
      expect(command.query).to.include('SELECT')
      expect(command.query).to.include('pid')
      expect(command.query).to.include('duration')
      expect(command.query).to.include('query AS query')
      expect(command.query).to.include('FROM\n  pg_stat_activity')
      expect(command.query).to.include('WHERE')
      expect(command.query).to.include('ORDER BY')
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

    it('should output long running query data via ux.log', async function () {
      const mockLog = ux.log as sinon.SinonStub

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      expect(mockLog.called).to.be.true
      const output = mockLog.firstCall.args[0]
      expect(output).to.include('123')
      expect(output).to.include('00:15:30')
      expect(output).to.include('SELECT * FROM large_table WHERE complex_condition')
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
      expect(mockParse.calledWith(PgLongRunningQueries)).to.be.true
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

      // Check for required SELECT fields
      expect(query).to.include('SELECT')
      expect(query).to.include('pid')
      expect(query).to.include('now() - pg_stat_activity.query_start AS duration')
      expect(query).to.include('query AS query')

      // Check for FROM
      expect(query).to.include('FROM\n  pg_stat_activity')

      // Check for WHERE conditions
      expect(query).to.include("pg_stat_activity.query <> ''::text")
      expect(query).to.include("state <> 'idle'")
      expect(query).to.include("now() - pg_stat_activity.query_start > interval '5 minutes'")

      // Check for ORDER BY
      expect(query).to.include('ORDER BY')
      expect(query).to.include('now() - pg_stat_activity.query_start DESC')
    })

    it('should filter out empty queries', function () {
      const {query} = command
      expect(query).to.include("pg_stat_activity.query <> ''::text")
    })

    it('should filter out idle queries', function () {
      const {query} = command
      expect(query).to.include("state <> 'idle'")
    })

    it('should filter queries longer than 5 minutes', function () {
      const {query} = command
      expect(query).to.include("now() - pg_stat_activity.query_start > interval '5 minutes'")
    })

    it('should order by duration descending', function () {
      const {query} = command
      expect(query).to.include('ORDER BY')
      expect(query).to.include('now() - pg_stat_activity.query_start DESC')
    })

    it('should calculate duration correctly', function () {
      const {query} = command
      expect(query).to.include('now() - pg_stat_activity.query_start AS duration')
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

    it('should handle single long running query', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('456 | 00:30:15 | UPDATE users SET last_login = NOW()')

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      const mockLog = ux.log as sinon.SinonStub
      expect(mockLog.calledWith('456 | 00:30:15 | UPDATE users SET last_login = NOW()')).to.be.true
    })

    it('should handle multiple long running queries', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('123 | 00:45:20 | SELECT * FROM orders\n789 | 00:20:10 | DELETE FROM temp_table')

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      const mockLog = ux.log as sinon.SinonStub
      expect(mockLog.called).to.be.true
      const output = mockLog.firstCall.args[0]
      expect(output).to.include('123 | 00:45:20 | SELECT * FROM orders')
      expect(output).to.include('789 | 00:20:10 | DELETE FROM temp_table')
    })
  })
})
