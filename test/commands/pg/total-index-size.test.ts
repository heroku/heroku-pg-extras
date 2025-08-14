/* global describe, it, before, beforeEach, afterEach */
import {utils} from '@heroku/heroku-cli-util'
import {ux} from '@oclif/core'
import {expect} from 'chai'
import sinon from 'sinon'

// Import the compiled JavaScript version
const PgTotalIndexSize = require('../../../dist/commands/pg/total-index-size').default

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

describe('PgTotalIndexSize', function () {
  let sandbox: sinon.SinonSandbox
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let command: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockHeroku: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDbConnection: any

  // Performance optimization: Single command instance
  before(function () {
    command = new PgTotalIndexSize()
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
      expect(PgTotalIndexSize.description).to.equal('show the total size of all indexes in MB')
    })

    it('should have correct static args', function () {
      expect(PgTotalIndexSize.args).to.have.property('database')
      expect(PgTotalIndexSize.args.database.description).to.equal('database name')
    })

    it('should have correct static flags', function () {
      expect(PgTotalIndexSize.flags).to.have.property('app')
      expect(PgTotalIndexSize.flags).to.have.property('remote')
      expect(PgTotalIndexSize.flags.app.required).to.be.true
    })
  })

  describe('run()', function () {
    it('should execute total index size query successfully', async function () {
      const args = createTestArgs()
      const flags = createTestFlags()

      // Mock command.parse to return our test args and flags
      sandbox.stub(command, 'parse').resolves({args, flags})

      await command.run()

      expect(utils.pg.fetcher.database.calledOnce).to.be.true
      expect(utils.pg.psql.exec.calledOnce).to.be.true
      expect(ux.log.calledOnce).to.be.true

      // Verify the query contains the expected SQL
      const query = utils.pg.psql.exec.firstCall.args[1]
      expect(query).to.include('SELECT')
      expect(query).to.include('pg_size_pretty(sum(c.relpages::bigint*8192)::bigint) AS size')
      expect(query).to.include('FROM pg_class c')
      expect(query).to.include('LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)')
      expect(query).to.include('WHERE n.nspname NOT IN (\'pg_catalog\', \'information_schema\')')
      expect(query).to.include('AND n.nspname !~ \'^pg_toast\'')
      expect(query).to.include('AND c.relkind=\'i\'')
    })

    it('should handle database connection correctly', async function () {
      const args = createTestArgs({database: 'custom-db'})
      const flags = createTestFlags({app: 'custom-app'})

      // Mock command.parse to return our test args and flags
      sandbox.stub(command, 'parse').resolves({args, flags})

      await command.run()

      expect(utils.pg.fetcher.database.calledOnce).to.be.true
      expect(utils.pg.fetcher.database.firstCall.args[0]).to.equal(mockHeroku)
      expect(utils.pg.fetcher.database.firstCall.args[1]).to.equal('custom-app')
      expect(utils.pg.fetcher.database.firstCall.args[2]).to.equal('custom-db')
    })

    it('should output query results correctly', async function () {
      const args = createTestArgs()
      const flags = createTestFlags()
      const mockOutput = '1.2 GB'

      // Mock command.parse to return our test args and flags
      sandbox.stub(command, 'parse').resolves({args, flags})
      sandbox.stub(utils.pg.psql, 'exec').resolves(mockOutput)

      await command.run()

      expect(ux.log.calledOnce).to.be.true
      expect(ux.log.firstCall.args[0]).to.equal(mockOutput)
    })

    it('should exclude system schemas from results', async function () {
      const args = createTestArgs()
      const flags = createTestFlags()

      // Mock command.parse to return our test args and flags
      sandbox.stub(command, 'parse').resolves({args, flags})

      await command.run()

      // Verify the query excludes system schemas
      const query = utils.pg.psql.exec.firstCall.args[1]
      expect(query).to.include('n.nspname NOT IN (\'pg_catalog\', \'information_schema\')')
      expect(query).to.include('n.nspname !~ \'^pg_toast\'')
    })

    it('should only include indexes', async function () {
      const args = createTestArgs()
      const flags = createTestFlags()

      // Mock command.parse to return our test args and flags
      sandbox.stub(command, 'parse').resolves({args, flags})

      await command.run()

      // Verify the query only includes indexes (relkind='i')
      const query = utils.pg.psql.exec.firstCall.args[1]
      expect(query).to.include('c.relkind=\'i\'')
    })

    it('should calculate size using relpages and block size', async function () {
      const args = createTestArgs()
      const flags = createTestFlags()

      // Mock command.parse to return our test args and flags
      sandbox.stub(command, 'parse').resolves({args, flags})

      await command.run()

      // Verify the query calculates size using relpages * 8192 (8KB block size)
      const query = utils.pg.psql.exec.firstCall.args[1]
      expect(query).to.include('sum(c.relpages::bigint*8192)::bigint')
    })

    it('should format size output using pg_size_pretty', async function () {
      const args = createTestArgs()
      const flags = createTestFlags()

      // Mock command.parse to return our test args and flags
      sandbox.stub(command, 'parse').resolves({args, flags})

      await command.run()

      // Verify the query uses pg_size_pretty for human-readable output
      const query = utils.pg.psql.exec.firstCall.args[1]
      expect(query).to.include('pg_size_pretty(')
    })
  })
})
