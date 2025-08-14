/* global describe, it, before, beforeEach, afterEach */
import {utils} from '@heroku/heroku-cli-util'
import {ux} from '@oclif/core'
import {expect} from 'chai'
import sinon from 'sinon'

// Import the compiled JavaScript version
const PgIndexSize = require('../../../dist/commands/pg/index-size').default

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
  sandbox.stub(utils.pg.psql, 'exec').resolves('index_name_1 | 8192 bytes\nindex_name_2 | 4096 bytes')
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

describe('PgIndexSize', function () {
  let sandbox: sinon.SinonSandbox
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let command: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockHeroku: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDbConnection: any

  // Performance optimization: Single command instance
  before(function () {
    command = new PgIndexSize()
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
      expect(PgIndexSize.description).to.equal('show the size of indexes, descending by size')
    })

    it('should have correct static args', function () {
      expect(PgIndexSize.args).to.have.property('database')
      expect(PgIndexSize.args.database.description).to.equal('database name')
    })

    it('should have correct static flags', function () {
      expect(PgIndexSize.flags).to.have.property('app')
      expect(PgIndexSize.flags).to.have.property('remote')
      expect(PgIndexSize.flags.app.required).to.be.true
      expect(PgIndexSize.flags.remote.char).to.equal('r')
    })

    it('should create command instance', function () {
      expect(command).to.be.instanceOf(PgIndexSize)
      expect(command).to.have.property('heroku')
    })

    it('should have private query property', function () {
      expect(command).to.have.property('query')
      expect(command.query).to.be.a('string')
      expect(command.query).to.include('SELECT c.relname AS name')
      expect(command.query).to.include('pg_size_pretty(sum(c.relpages::bigint*8192)::bigint) AS size')
      expect(command.query).to.include('FROM pg_class c')
      expect(command.query).to.include('LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)')
    })
  })

  describe('Command Execution', function () {
    it('should execute run method successfully', async function () {
      const mockFetcher = utils.pg.fetcher.database as sinon.SinonStub
      const mockExec = utils.pg.psql.exec as sinon.SinonStub

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
    })

    it('should output index size data via ux.log', async function () {
      const mockLog = ux.log as sinon.SinonStub

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      expect(mockLog.called).to.be.true
      const output = mockLog.firstCall.args[0]
      expect(output).to.include('index_name_1')
      expect(output).to.include('index_name_2')
      expect(output).to.include('8192 bytes')
      expect(output).to.include('4096 bytes')
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
      expect(mockParse.calledWith(PgIndexSize)).to.be.true
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
      expect(query).to.include('SELECT c.relname AS name')
      expect(query).to.include('pg_size_pretty(sum(c.relpages::bigint*8192)::bigint) AS size')

      // Check for FROM and JOIN
      expect(query).to.include('FROM pg_class c')
      expect(query).to.include('LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)')

      // Check for WHERE conditions
      expect(query).to.include("n.nspname NOT IN ('pg_catalog', 'information_schema')")
      expect(query).to.include("n.nspname !~ '^pg_toast'")
      expect(query).to.include("c.relkind='i'")

      // Check for GROUP BY and ORDER BY
      expect(query).to.include('GROUP BY c.relname')
      expect(query).to.include('ORDER BY sum(c.relpages) DESC')
    })

    it('should filter system schemas correctly', function () {
      const {query} = command

      expect(query).to.include("n.nspname NOT IN ('pg_catalog', 'information_schema')")
      expect(query).to.include("n.nspname !~ '^pg_toast'")
    })

    it('should only include index objects', function () {
      const {query} = command

      expect(query).to.include("c.relkind='i'")
    })

    it('should calculate index size correctly', function () {
      const {query} = command

      expect(query).to.include('pg_size_pretty(sum(c.relpages::bigint*8192)::bigint) AS size')
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

    it('should handle single index output', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('single_index | 1024 bytes')

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      const mockLog = ux.log as sinon.SinonStub
      expect(mockLog.calledWith('single_index | 1024 bytes')).to.be.true
    })
  })
})
