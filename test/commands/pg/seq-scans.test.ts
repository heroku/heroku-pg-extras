/* global describe, it, before, beforeEach, afterEach */
import {utils} from '@heroku/heroku-cli-util'
import {ux} from '@oclif/core'
import {expect} from 'chai'
import sinon from 'sinon'

// Import the compiled JavaScript version
const PgSeqScans = require('../../../dist/commands/pg/seq-scans').default

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

describe('PgSeqScans', function () {
  let sandbox: sinon.SinonSandbox
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let command: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockHeroku: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDbConnection: any

  // Performance optimization: Single command instance
  before(function () {
    command = new PgSeqScans()
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
      expect(PgSeqScans.description).to.equal('show the count of sequential scans by table descending by order')
    })

    it('should have correct static args', function () {
      expect(PgSeqScans.args).to.have.property('database')
      expect(PgSeqScans.args.database.description).to.equal('database name')
    })

    it('should have correct static flags', function () {
      expect(PgSeqScans.flags).to.have.property('app')
      expect(PgSeqScans.flags).to.have.property('remote')
      expect(PgSeqScans.flags.app.required).to.be.true
    })
  })

  describe('run()', function () {
    it('should execute seq scans query successfully', async function () {
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
      expect(query).to.include('relname AS name')
      expect(query).to.include('seq_scan as count')
      expect(query).to.include('FROM pg_stat_user_tables')
      expect(query).to.include('ORDER BY seq_scan DESC')
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
      const mockOutput = 'table1\t1000\ntable2\t500\ntable3\t100'

      // Mock command.parse to return our test args and flags
      sandbox.stub(command, 'parse').resolves({args, flags})
      sandbox.stub(utils.pg.psql, 'exec').resolves(mockOutput)

      await command.run()

      expect(ux.log.calledOnce).to.be.true
      expect(ux.log.firstCall.args[0]).to.equal(mockOutput)
    })
  })
})
