/* global describe, it, before, beforeEach, afterEach */
import {utils} from '@heroku/heroku-cli-util'
import {ux} from '@oclif/core'
import {expect} from 'chai'
import sinon from 'sinon'

// Import the compiled JavaScript version
const PgMandelbrot = require('../../../dist/commands/pg/mandelbrot').default

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
  sandbox.stub(utils.pg.psql, 'exec').resolves('  .,,,-----++++%%%%@@@@####  \n  .,,,-----++++%%%%@@@@####  ')
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

describe('PgMandelbrot', function () {
  let sandbox: sinon.SinonSandbox
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let command: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockHeroku: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDbConnection: any

  // Performance optimization: Single command instance
  before(function () {
    command = new PgMandelbrot()
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
      expect(PgMandelbrot.description).to.equal('show the mandelbrot set')
    })

    it('should have correct static args', function () {
      expect(PgMandelbrot.args).to.have.property('database')
      expect(PgMandelbrot.args.database.description).to.equal('database name')
    })

    it('should have correct static flags', function () {
      expect(PgMandelbrot.flags).to.have.property('app')
      expect(PgMandelbrot.flags).to.have.property('remote')
      expect(PgMandelbrot.flags.app.required).to.be.true
      expect(PgMandelbrot.flags.remote.char).to.equal('r')
    })

    it('should create command instance', function () {
      expect(command).to.be.instanceOf(PgMandelbrot)
      expect(command).to.have.property('heroku')
    })

    it('should have private query property', function () {
      expect(command).to.have.property('query')
      expect(command.query).to.be.a('string')
      expect(command.query).to.include('WITH RECURSIVE')
      expect(command.query).to.include('Z(IX, IY, CX, CY, X, Y, I)')
      expect(command.query).to.include('SELECT')
      expect(command.query).to.include('FROM')
      expect(command.query).to.include('UNION ALL')
      expect(command.query).to.include('WHERE')
      expect(command.query).to.include('GROUP BY')
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

    it('should output mandelbrot set via ux.log', async function () {
      const mockLog = ux.log as sinon.SinonStub

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      expect(mockLog.called).to.be.true
      const output = mockLog.firstCall.args[0]
      expect(output).to.include('  .,,,-----++++%%%%@@@@####  ')
      expect(output).to.include('\n')
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
      expect(mockParse.calledWith(PgMandelbrot)).to.be.true
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

      // Check for recursive CTE
      expect(query).to.include('WITH RECURSIVE')
      expect(query).to.include('Z(IX, IY, CX, CY, X, Y, I) AS (')
      expect(query).to.include('SELECT IX, IY, X::float, Y::float, X::float, Y::float, 0')
      expect(query).to.include('UNION ALL')
      expect(query).to.include('FROM Z')
      expect(query).to.include('WHERE X * X + Y * Y < 16::float')
      expect(query).to.include('AND I < 100')

      // Check for main SELECT
      expect(query).to.include('SELECT array_to_string')
      expect(query).to.include('array_agg(SUBSTRING')
      expect(query).to.include("' .,,,-----++++%%%%@@@@#### '")
      expect(query).to.include('LEAST(GREATEST(I,1),27), 1)')

      // Check for FROM and GROUP BY
      expect(query).to.include('FROM (')
      expect(query).to.include('GROUP BY IY, IX')
      expect(query).to.include('ORDER BY IY, IX')
      expect(query).to.include('GROUP BY IY')
      expect(query).to.include('ORDER BY IY')
    })

    it('should have recursive CTE structure', function () {
      const {query} = command

      expect(query).to.include('WITH RECURSIVE Z(IX, IY, CX, CY, X, Y, I) AS (')
      expect(query).to.include('SELECT IX, IY, X::float, Y::float, X::float, Y::float, 0')
      expect(query).to.include('FROM (select -2.2 + 0.031 * i, i from generate_series(0,101) as i) as xgen(x,ix)')
      expect(query).to.include('(select -1.5 + 0.031 * i, i from generate_series(0,101) as i) as ygen(y,iy)')
    })

    it('should have recursive iteration logic', function () {
      const {query} = command

      expect(query).to.include('X * X - Y * Y + CX AS X')
      expect(query).to.include('Y * X * 2 + CY')
      expect(query).to.include('I + 1')
      expect(query).to.include('X * X + Y * Y < 16::float')
      expect(query).to.include('I < 100')
    })

    it('should have coordinate generation', function () {
      const {query} = command

      expect(query).to.include('-2.2 + 0.031 * i')
      expect(query).to.include('-1.5 + 0.031 * i')
      expect(query).to.include('generate_series(0,101)')
    })

    it('should have character mapping', function () {
      const {query} = command

      expect(query).to.include("' .,,,-----++++%%%%@@@@#### '")
      expect(query).to.include('LEAST(GREATEST(I,1),27), 1')
    })

    it('should have proper ordering', function () {
      const {query} = command

      expect(query).to.include('ORDER BY IY, IX')
      expect(query).to.include('ORDER BY IY')
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

    it('should handle single line output', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('  .,,,-----++++%%%%@@@@####  ')

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      const mockLog = ux.log as sinon.SinonStub
      expect(mockLog.calledWith('  .,,,-----++++%%%%@@@@####  ')).to.be.true
    })

    it('should handle multi-line output', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('  .,,,-----++++%%%%@@@@####  \n  .,,,-----++++%%%%@@@@####  \n  .,,,-----++++%%%%@@@@####  ')

      sandbox.stub(command, 'parse').resolves({
        args: createTestArgs(),
        flags: createTestFlags(),
      })

      await command.run()

      const mockLog = ux.log as sinon.SinonStub
      expect(mockLog.called).to.be.true
      const output = mockLog.firstCall.args[0]
      expect(output).to.include('  .,,,-----++++%%%%@@@@####  ')
      expect(output).to.include('\n')
    })
  })
})
