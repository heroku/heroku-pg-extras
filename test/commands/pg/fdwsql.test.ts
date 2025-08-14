/* global describe, it, before, beforeEach, afterEach */
import {utils} from '@heroku/heroku-cli-util'
import {ux} from '@oclif/core'
import {expect} from 'chai'
import sinon from 'sinon'

// Import the compiled JavaScript version
const PgFdwsql = require('../../../dist/commands/pg/fdwsql').default

// Test data factories for better extensibility
const createTestArgs = (overrides = {}) => ({
  database: 'test-db',
  prefix: 'test',
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
  sandbox.stub(utils.pg.psql, 'exec').resolves('CREATE FOREIGN TABLE test_table1(col1 int, col2 text);\nCREATE FOREIGN TABLE test_table2(col3 varchar);')
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

describe('PgFdwsql', function () {
  let sandbox: sinon.SinonSandbox
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let command: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockHeroku: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDbConnection: any
  // Performance optimization: Single command instance
  before(function () {
    command = new PgFdwsql()
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
      expect(PgFdwsql.description).to.equal('generate fdw install sql for database')
    })

    it('should have correct static args', function () {
      expect(PgFdwsql.args).to.have.property('prefix')
      expect(PgFdwsql.args).to.have.property('database')
      expect(PgFdwsql.args.prefix.description).to.equal('prefix for foreign data wrapper')
      expect(PgFdwsql.args.prefix.required).to.be.true
      expect(PgFdwsql.args.database.description).to.equal('database name')
    })

    it('should have correct static flags', function () {
      expect(PgFdwsql.flags).to.have.property('app')
      expect(PgFdwsql.flags).to.have.property('remote')
      expect(PgFdwsql.flags.app.required).to.be.true
      expect(PgFdwsql.flags.remote.char).to.equal('r')
    })

    it('should create command instance', function () {
      expect(command).to.be.instanceOf(PgFdwsql)
      expect(command).to.have.property('heroku')
    })

    it('should have private query property', function () {
      expect(command).to.have.property('query')
      expect(command.query).to.be.a('function')
      const queryResult = command.query('test_prefix')
      expect(queryResult).to.include('CREATE FOREIGN TABLE')
      expect(queryResult).to.include('test_prefix_')
      expect(queryResult).to.include('SERVER test_prefix_db')
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
      expect(mockExec.calledWith(mockDbConnection, command.query(testArgs.prefix))).to.be.true

      expect(mockLog.called).to.be.true
    })

    it('should output correct SQL statements', async function () {
      const mockLog = ux.log as sinon.SinonStub

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      expect(mockLog.calledWith('CREATE EXTENSION IF NOT EXISTS postgres_fdw;')).to.be.true
      expect(mockLog.calledWith('DROP SERVER IF EXISTS test_db;')).to.be.true
      expect(mockLog.calledWith(`CREATE SERVER test_db
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (dbname 'test-database', host 'test-host');`)).to.be.true
      expect(mockLog.calledWith(`CREATE USER MAPPING FOR CURRENT_USER
  SERVER test_db
  OPTIONS (user 'test-user', password 'test-password');`)).to.be.true
    })

    it('should filter and output CREATE statements', async function () {
      const mockLog = ux.log as sinon.SinonStub

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      expect(mockLog.called).to.be.true
      // Check that the CREATE statements are output (should be one of the calls)
      const calls = mockLog.getCalls()
      const createStatementsCall = calls.find(call =>
        call.args[0] && call.args[0].includes('CREATE FOREIGN TABLE')
      )
      expect(createStatementsCall).to.exist
      expect(createStatementsCall!.args[0]).to.include('CREATE FOREIGN TABLE test_table1')
      expect(createStatementsCall!.args[0]).to.include('CREATE FOREIGN TABLE test_table2')
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
  })

  describe('Query Structure', function () {
    it('should generate correct SQL query with prefix', function () {
      const prefix = 'my_prefix'
      const query = command.query(prefix)

      expect(query).to.include(`'${prefix}_' || c.relname`)
      expect(query).to.include(`SERVER ${prefix}_db`)
      expect(query).to.include('CREATE FOREIGN TABLE')
      expect(query).to.include('pg_class')
      expect(query).to.include('pg_attribute')
      expect(query).to.include('pg_type')
      expect(query).to.include('pg_namespace')
    })

    it('should filter system schemas correctly', function () {
      const query = command.query('test')

      expect(query).to.include("n.nspname <> 'pg_catalog'")
      expect(query).to.include("n.nspname <> 'information_schema'")
      expect(query).to.include("n.nspname !~ '^pg_toast'")
    })

    it('should handle table and view types', function () {
      const query = command.query('test')

      expect(query).to.include("c.relkind in ('r', 'v')")
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
      expect(mockExec.calledWith(mockDbConnection, command.query('test'))).to.be.true
    })

    it('should use ux.log for SQL statements', async function () {
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

    it('should handle output without CREATE statements', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('SELECT * FROM table;\nINSERT INTO table VALUES (1);')

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      const mockLog = ux.log as sinon.SinonStub
      expect(mockLog.calledWith('')).to.be.true
    })
  })
})
