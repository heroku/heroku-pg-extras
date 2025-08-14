/* global describe, it, beforeEach, afterEach */
import {utils} from '@heroku/heroku-cli-util'
import {ux} from '@oclif/core'
import {expect} from 'chai'
import sinon from 'sinon'

// Import the compiled JavaScript version
const PgBloat = require('../../../dist/commands/pg/bloat').default

describe('PgBloat', function () {
  let sandbox: sinon.SinonSandbox
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let command: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockHeroku: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDbConnection: any

  beforeEach(function () {
    sandbox = sinon.createSandbox()

    // Mock heroku object
    mockHeroku = {
      // Add any heroku-specific properties needed
    }

    // Mock database connection
    mockDbConnection = {
      // Add any database connection properties needed
    }

    // Create command instance
    command = new PgBloat()

    // Mock the heroku getter instead of trying to assign to it
    sandbox.stub(command, 'heroku').get(() => mockHeroku)

    // Mock utils.pg.fetcher.database
    sandbox.stub(utils.pg.fetcher, 'database').resolves(mockDbConnection)

    // Mock utils.pg.psql.exec
    sandbox.stub(utils.pg.psql, 'exec').resolves('mock output')

    // Mock ux.log
    sandbox.stub(ux, 'log')
  })

  afterEach(function () {
    sandbox.restore()
  })

  describe('Command Class', function () {
    it('should have correct static description', function () {
      expect(PgBloat.description).to.equal('show table and index bloat in your database ordered by most wasteful')
    })

    it('should have correct static args', function () {
      expect(PgBloat.args).to.have.property('database')
      expect(PgBloat.args.database.description).to.equal('database name')
    })

    it('should have correct static flags', function () {
      expect(PgBloat.flags).to.have.property('app')
      expect(PgBloat.flags).to.have.property('remote')
      expect(PgBloat.flags.app.required).to.be.true
      expect(PgBloat.flags.remote.char).to.equal('r')
    })

    it('should create command instance', function () {
      expect(command).to.be.instanceOf(PgBloat)
      expect(command).to.have.property('heroku')
    })

    it('should have private query property', function () {
      expect(command).to.have.property('query')
      expect(command.query).to.be.a('string')
      expect(command.query).to.include('WITH constants AS')
      expect(command.query).to.include('bloat_info AS')
      expect(command.query).to.include('table_bloat AS')
      expect(command.query).to.include('index_bloat AS')
    })
  })

  describe('Command Execution', function () {
    it('should execute run method successfully', async function () {
      const mockFetcher = utils.pg.fetcher.database as sinon.SinonStub
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      const mockLog = ux.log as sinon.SinonStub

      // Mock command.parse to return args and flags
      sandbox.stub(command, 'parse').resolves({
        args: {database: 'test-db'},
        flags: {app: 'test-app'},
      })

      await command.run()

      expect(mockFetcher.calledOnce).to.be.true
      expect(mockFetcher.calledWith(mockHeroku, 'test-app', 'test-db')).to.be.true

      expect(mockExec.calledOnce).to.be.true
      expect(mockExec.calledWith(mockDbConnection, command.query)).to.be.true

      expect(mockLog.calledOnce).to.be.true
      expect(mockLog.calledWith('mock output')).to.be.true
    })

    it('should handle database fetching errors', async function () {
      const mockFetcher = utils.pg.fetcher.database as sinon.SinonStub
      mockFetcher.rejects(new Error('Database connection failed'))

      sandbox.stub(command, 'parse').resolves({
        args: {database: 'test-db'},
        flags: {app: 'test-app'},
      })

      try {
        await command.run()
        expect.fail('Should have thrown an error')
      } catch (error: unknown) {
        const err = error as Error
        expect(err.message).to.include('Database connection failed')
      }
    })

    it('should handle query execution errors', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.rejects(new Error('Query execution failed'))

      sandbox.stub(command, 'parse').resolves({
        args: {database: 'test-db'},
        flags: {app: 'test-app'},
      })

      try {
        await command.run()
        expect.fail('Should have thrown an error')
      } catch (error: unknown) {
        const err = error as Error
        expect(err.message).to.include('Query execution failed')
      }
    })

    it('should parse command arguments correctly', async function () {
      const mockParse = sandbox.stub(command, 'parse').resolves({
        args: {database: 'production-db'},
        flags: {app: 'my-app', remote: 'heroku'},
      })

      await command.run()

      expect(mockParse.calledOnce).to.be.true
      expect(mockParse.calledWith(PgBloat)).to.be.true
    })
  })

  describe('Query Structure', function () {
    it('should have valid SQL query structure', function () {
      const {query} = command

      // Check for required CTEs
      expect(query).to.include('WITH constants AS')
      expect(query).to.include('bloat_info AS')
      expect(query).to.include('table_bloat AS')
      expect(query).to.include('index_bloat AS')

      // Check for final SELECT
      expect(query).to.include('SELECT')
      expect(query).to.include('type, schemaname, object_name, bloat, pg_size_pretty(raw_waste) as waste')

      // Check for ORDER BY
      expect(query).to.include('ORDER BY raw_waste DESC, bloat DESC')
    })

    it('should handle table and index bloat analysis', function () {
      const {query} = command

      // Check for table bloat analysis
      expect(query).to.include("'table' as type")
      expect(query).to.include('tablename as object_name')

      // Check for index bloat analysis
      expect(query).to.include("'index' as type")
      expect(query).to.include('tablename || \'::\' || iname as object_name')

      // Check for bloat calculation
      expect(query).to.include('ROUND(CASE WHEN otta=0 THEN 0.0 ELSE')
      expect(query).to.include('ROUND(CASE WHEN iotta=0 OR ipages=0 THEN 0.0 ELSE')
    })
  })

  describe('Integration with Utility Functions', function () {
    it('should use database fetcher utility', async function () {
      const mockFetcher = utils.pg.fetcher.database as sinon.SinonStub

      sandbox.stub(command, 'parse').resolves({
        args: {database: 'test-db'},
        flags: {app: 'test-app'},
      })

      await command.run()

      expect(mockFetcher.calledOnce).to.be.true
      expect(mockFetcher.calledWith(mockHeroku, 'test-app', 'test-db')).to.be.true
    })

    it('should use psql exec utility', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub

      sandbox.stub(command, 'parse').resolves({
        args: {database: 'test-db'},
        flags: {app: 'test-app'},
      })

      await command.run()

      expect(mockExec.calledOnce).to.be.true
      expect(mockExec.calledWith(mockDbConnection, command.query)).to.be.true
    })

    it('should use ux.log for output', async function () {
      const mockLog = ux.log as sinon.SinonStub

      sandbox.stub(command, 'parse').resolves({
        args: {database: 'test-db'},
        flags: {app: 'test-app'},
      })

      await command.run()

      expect(mockLog.calledOnce).to.be.true
      expect(mockLog.calledWith('mock output')).to.be.true
    })
  })
})
