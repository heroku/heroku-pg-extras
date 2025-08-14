/* global describe, it, before, beforeEach, afterEach */
import {utils} from '@heroku/heroku-cli-util'
import {ux} from '@oclif/core'
import {expect} from 'chai'
import sinon from 'sinon'

// Import the compiled JavaScript version
const PgStatsReset = require('../../../dist/commands/pg/stats-reset').default

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
  put: sinon.stub(),
})

const createMockDatabase = () => ({
  name: 'test-database',
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
  sandbox.stub(utils.pg.fetcher, 'addon').resolves(mockDb)
  sandbox.stub(utils.pg, 'host').returns('test-host')
  sandbox.stub(ux, 'log')

  return {mockDb, mockHeroku}
}

describe('PgStatsReset', function () {
  let sandbox: sinon.SinonSandbox
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let command: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockHeroku: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDbConnection: any

  // Performance optimization: Single command instance
  before(function () {
    command = new PgStatsReset()
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
      expect(PgStatsReset.description).to.equal('calls the Postgres functions pg_stat_reset()')
    })

    it('should have correct static args', function () {
      expect(PgStatsReset.args).to.have.property('database')
      expect(PgStatsReset.args.database.description).to.equal('database name')
    })

    it('should have correct static flags', function () {
      expect(PgStatsReset.flags).to.have.property('app')
      expect(PgStatsReset.flags).to.have.property('remote')
      expect(PgStatsReset.flags.app.required).to.be.true
    })
  })

  describe('run()', function () {
    it('should execute stats reset successfully', async function () {
      const args = createTestArgs()
      const flags = createTestFlags()
      const mockResponse = {message: 'Statistics reset successfully'}

      // Mock the util function
      const ensureEssentialTierPlanStub = sandbox.stub().resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'ensureEssentialTierPlan').callsFake(ensureEssentialTierPlanStub)

      // Mock command.parse to return our test args and flags
      sandbox.stub(command, 'parse').resolves({args, flags})

      // Mock the heroku.put response
      mockHeroku.put.resolves(mockResponse)

      await command.run()

      expect(utils.pg.fetcher.addon.calledOnce).to.be.true
      expect(ensureEssentialTierPlanStub.calledOnce).to.be.true
      expect(utils.pg.host.calledOnce).to.be.true
      expect(mockHeroku.put.calledOnce).to.be.true
      expect(ux.log.calledOnce).to.be.true

      // Verify the API call parameters
      expect(mockHeroku.put.firstCall.args[0]).to.equal('/client/v11/databases/test-database/stats_reset')
      expect(mockHeroku.put.firstCall.args[1]).to.deep.equal({host: 'test-host'})
      expect(ux.log.firstCall.args[0]).to.equal('Statistics reset successfully')
    })

    it('should handle database connection correctly', async function () {
      const args = createTestArgs({database: 'custom-db'})
      const flags = createTestFlags({app: 'custom-app'})
      const mockResponse = {message: 'Custom database stats reset'}

      // Mock the util function
      const ensureEssentialTierPlanStub = sandbox.stub().resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'ensureEssentialTierPlan').callsFake(ensureEssentialTierPlanStub)

      // Mock command.parse to return our test args and flags
      sandbox.stub(command, 'parse').resolves({args, flags})

      // Mock the heroku.put response
      mockHeroku.put.resolves(mockResponse)

      await command.run()

      expect(utils.pg.fetcher.addon.calledOnce).to.be.true
      expect(utils.pg.fetcher.addon.firstCall.args[0]).to.equal(mockHeroku)
      expect(utils.pg.fetcher.addon.firstCall.args[1]).to.equal('custom-app')
      expect(utils.pg.fetcher.addon.firstCall.args[2]).to.equal('custom-db')
    })

    it('should call ensureEssentialTierPlan with database', async function () {
      const args = createTestArgs()
      const flags = createTestFlags()
      const mockResponse = {message: 'Stats reset'}

      // Mock the util function
      const ensureEssentialTierPlanStub = sandbox.stub().resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'ensureEssentialTierPlan').callsFake(ensureEssentialTierPlanStub)

      // Mock command.parse to return our test args and flags
      sandbox.stub(command, 'parse').resolves({args, flags})

      // Mock the heroku.put response
      mockHeroku.put.resolves(mockResponse)

      await command.run()

      expect(ensureEssentialTierPlanStub.calledOnce).to.be.true
      expect(ensureEssentialTierPlanStub.firstCall.args[0]).to.equal(mockDbConnection)
    })

    it('should use correct host from utils.pg.host', async function () {
      const args = createTestArgs()
      const flags = createTestFlags()
      const mockResponse = {message: 'Host-based reset'}

      // Mock the util function
      const ensureEssentialTierPlanStub = sandbox.stub().resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'ensureEssentialTierPlan').callsFake(ensureEssentialTierPlanStub)

      // Mock command.parse to return our test args and flags
      sandbox.stub(command, 'parse').resolves({args, flags})

      // Mock the heroku.put response
      mockHeroku.put.resolves(mockResponse)

      await command.run()

      expect(utils.pg.host.calledOnce).to.be.true
      expect(utils.pg.host.firstCall.args[0]).to.equal(mockDbConnection)
    })
  })
})
