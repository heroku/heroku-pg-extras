/* global describe, it, before, beforeEach, afterEach */
import {utils} from '@heroku/heroku-cli-util'
import {ux} from '@oclif/core'
import {expect} from 'chai'
import sinon from 'sinon'

// Import the compiled JavaScript version
const PgOutliers = require('../../../dist/commands/pg/outliers').default

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

describe('PgOutliers', function () {
  let sandbox: sinon.SinonSandbox
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let command: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockHeroku: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDbConnection: any

  // Performance optimization: Single command instance
  before(function () {
    command = new PgOutliers()
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
      expect(PgOutliers.description).to.equal('show 10 queries that have longest execution time in aggregate')
    })

    it('should have correct static args', function () {
      expect(PgOutliers.args).to.have.property('database')
      expect(PgOutliers.args.database.description).to.equal('database name')
    })

    it('should have correct static flags', function () {
      expect(PgOutliers.flags).to.have.property('app')
      expect(PgOutliers.flags).to.have.property('remote')
      expect(PgOutliers.flags).to.have.property('reset')
      expect(PgOutliers.flags).to.have.property('truncate')
      expect(PgOutliers.flags).to.have.property('num')
      expect(PgOutliers.flags.app.required).to.be.true
    })
  })

  describe('run()', function () {
    it('should execute basic outliers query successfully', async function () {
      const args = createTestArgs()
      const flags = createTestFlags()

      // Mock the util functions
      const ensurePGStatStatementStub = sandbox.stub().resolves()
      const newTotalExecTimeFieldStub = sandbox.stub().resolves(true)
      const newBlkTimeFieldsStub = sandbox.stub().resolves(true)

      // Replace the util functions with stubs
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').callsFake(ensurePGStatStatementStub)
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').callsFake(newTotalExecTimeFieldStub)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').callsFake(newBlkTimeFieldsStub)

      await command.run()

      expect(ensurePGStatStatementStub.calledOnce).to.be.true
      expect(newTotalExecTimeFieldStub.calledOnce).to.be.true
      expect(newBlkTimeFieldsStub.calledOnce).to.be.true
      expect(utils.pg.psql.exec.calledOnce).to.be.true
      expect(ux.log.calledOnce).to.be.true
    })

    it('should handle reset flag correctly', async function () {
      const args = createTestArgs()
      const flags = createTestFlags({reset: true})

      // Mock the util functions
      const ensurePGStatStatementStub = sandbox.stub().resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').callsFake(ensurePGStatStatementStub)

      // Mock command.parse to return our test args and flags
      sandbox.stub(command, 'parse').resolves({args, flags})

      await command.run()

      expect(ensurePGStatStatementStub.calledOnce).to.be.true
      expect(utils.pg.psql.exec.calledOnce).to.be.true
      expect(utils.pg.psql.exec.firstCall.args[1]).to.equal('select pg_stat_statements_reset()')
      expect(ux.log.called).to.be.false
    })

    it('should handle truncate flag correctly', async function () {
      const args = createTestArgs()
      const flags = createTestFlags({truncate: true})

      // Mock the util functions
      const ensurePGStatStatementStub = sandbox.stub().resolves()
      const newTotalExecTimeFieldStub = sandbox.stub().resolves(true)
      const newBlkTimeFieldsStub = sandbox.stub().resolves(true)

      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').callsFake(ensurePGStatStatementStub)
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').callsFake(newTotalExecTimeFieldStub)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').callsFake(newBlkTimeFieldsStub)

      // Mock command.parse to return our test args and flags
      sandbox.stub(command, 'parse').resolves({args, flags})

      await command.run()

      expect(utils.pg.psql.exec.calledOnce).to.be.true
      // Verify the query contains the truncate logic
      const query = utils.pg.psql.exec.firstCall.args[1]
      expect(query).to.include('CASE WHEN length(query) <= 40 THEN query ELSE substr(query, 0, 39) ||')
    })

    it('should handle num flag correctly', async function () {
      const args = createTestArgs()
      const flags = createTestFlags({num: 5})

      // Mock the util functions
      const ensurePGStatStatementStub = sandbox.stub().resolves()
      const newTotalExecTimeFieldStub = sandbox.stub().resolves(true)
      const newBlkTimeFieldsStub = sandbox.stub().resolves(true)

      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').callsFake(ensurePGStatStatementStub)
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').callsFake(newTotalExecTimeFieldStub)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').callsFake(newBlkTimeFieldsStub)

      // Mock command.parse to return our test args and flags
      sandbox.stub(command, 'parse').resolves({args, flags})

      await command.run()

      expect(utils.pg.psql.exec.calledOnce).to.be.true
      // Verify the query contains the limit
      const query = utils.pg.psql.exec.firstCall.args[1]
      expect(query).to.include('LIMIT 5')
    })

    it('should throw error for invalid num value', async function () {
      const args = createTestArgs()
      const flags = createTestFlags({num: -1})

      // Mock the util functions
      const ensurePGStatStatementStub = sandbox.stub().resolves()
      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').callsFake(ensurePGStatStatementStub)

      // Mock command.parse to return our test args and flags
      sandbox.stub(command, 'parse').resolves({args, flags})

      await expectRejection(command.run(), 'Cannot parse num param value "-1" to a positive number')
    })

    it('should use old time fields for older PostgreSQL versions', async function () {
      const args = createTestArgs()
      const flags = createTestFlags()

      // Mock the util functions to return false (older version)
      const ensurePGStatStatementStub = sandbox.stub().resolves()
      const newTotalExecTimeFieldStub = sandbox.stub().resolves(false)
      const newBlkTimeFieldsStub = sandbox.stub().resolves(false)

      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').callsFake(ensurePGStatStatementStub)
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').callsFake(newTotalExecTimeFieldStub)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').callsFake(newBlkTimeFieldsStub)

      await command.run()

      expect(utils.pg.psql.exec.calledOnce).to.be.true
      // Verify the query uses old field names
      const query = utils.pg.psql.exec.firstCall.args[1]
      expect(query).to.include('total_time')
      expect(query).to.include('blk_read_time')
      expect(query).to.include('blk_write_time')
    })

    it('should use new time fields for newer PostgreSQL versions', async function () {
      const args = createTestArgs()
      const flags = createTestFlags()

      // Mock the util functions to return true (newer version)
      const ensurePGStatStatementStub = sandbox.stub().resolves()
      const newTotalExecTimeFieldStub = sandbox.stub().resolves(true)
      const newBlkTimeFieldsStub = sandbox.stub().resolves(true)

      sandbox.stub(require('../../../dist/lib/util'), 'ensurePGStatStatement').callsFake(ensurePGStatStatementStub)
      sandbox.stub(require('../../../dist/lib/util'), 'newTotalExecTimeField').callsFake(newTotalExecTimeFieldStub)
      sandbox.stub(require('../../../dist/lib/util'), 'newBlkTimeFields').callsFake(newBlkTimeFieldsStub)

      await command.run()

      expect(utils.pg.psql.exec.calledOnce).to.be.true
      // Verify the query uses new field names
      const query = utils.pg.psql.exec.firstCall.args[1]
      expect(query).to.include('total_exec_time')
      expect(query).to.include('shared_blk_read_time')
      expect(query).to.include('shared_blk_write_time')
    })
  })
})
