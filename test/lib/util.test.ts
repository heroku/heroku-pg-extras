/* global describe, it, beforeEach, afterEach */
import {utils} from '@heroku/heroku-cli-util'
import {expect} from 'chai'
import sinon from 'sinon'

// Import the compiled JavaScript version
const util = require('../../dist/lib/util')

interface MockDb {
  plan: {
    name: string
  }
}

interface MockPlan {
  plan: {
    name: string
  }
}

describe('util', function () {
  let sandbox: sinon.SinonSandbox
  let mockDb: MockDb
  let mockPlan: MockPlan

  beforeEach(function () {
    sandbox = sinon.createSandbox()

    // Mock database object
    mockDb = {
      plan: {
        name: 'premium-0',
      },
    }

    // Mock plan object
    mockPlan = {
      plan: {
        name: 'heroku:premium-0',
      },
    }

    // Mock utils.pg.psql.exec
    sandbox.stub(utils.pg.psql, 'exec')
  })

  afterEach(function () {
    sandbox.restore()
  })

  describe('ensurePGStatStatement', function () {
    it('should pass when pg_stat_statements extension is available', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('t')

      try {
        await util.ensurePGStatStatement(mockDb)
        // If we get here, no error was thrown
        expect(mockExec.calledOnce).to.be.true
      } catch {
        expect.fail('Should not have thrown an error')
      }
    })

    it('should throw error when pg_stat_statements extension is not available', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('f')

      try {
        await util.ensurePGStatStatement(mockDb)
        expect.fail('Should have thrown an error')
      } catch (error: unknown) {
        const err = error as Error
        expect(err.message).to.include('pg_stat_statements extension need to be installed in the public schema first')
        expect(mockExec.calledOnce).to.be.true
      }
    })
  })

  describe('ensureEssentialTierPlan', function () {
    it('should pass for non-essential tier plans', async function () {
      mockDb.plan.name = 'premium-0'

      try {
        await util.ensureEssentialTierPlan(mockDb)
        // If we get here, no error was thrown
      } catch {
        expect.fail('Should not have thrown an error')
      }
    })

    it('should throw error for dev tier plans', async function () {
      mockDb.plan.name = 'dev'

      try {
        await util.ensureEssentialTierPlan(mockDb)
        expect.fail('Should have thrown an error')
      } catch (error: unknown) {
        const err = error as Error
        expect(err.message).to.include('This operation is not supported by Essential-tier databases')
      }
    })

    it('should throw error for basic tier plans', async function () {
      mockDb.plan.name = 'basic'

      try {
        await util.ensureEssentialTierPlan(mockDb)
        expect.fail('Should have thrown an error')
      } catch (error: unknown) {
        const err = error as Error
        expect(err.message).to.include('This operation is not supported by Essential-tier databases')
      }
    })

    it('should throw error for essential tier plans', async function () {
      mockDb.plan.name = 'essential-0'

      try {
        await util.ensureEssentialTierPlan(mockDb)
        expect.fail('Should have thrown an error')
      } catch (error: unknown) {
        const err = error as Error
        expect(err.message).to.include('This operation is not supported by Essential-tier databases')
      }
    })
  })

  describe('essentialNumPlan', function () {
    it('should return true for essential tier plans', function () {
      mockPlan.plan.name = 'heroku:essential-0'
      const result = util.essentialNumPlan(mockPlan)
      expect(result).to.be.true
    })

    it('should return false for non-essential tier plans', function () {
      mockPlan.plan.name = 'heroku:premium-0'
      const result = util.essentialNumPlan(mockPlan)
      expect(result).to.be.false
    })

    it('should handle plans without colon separator', function () {
      mockPlan.plan.name = 'premium-0'
      const result = util.essentialNumPlan(mockPlan)
      expect(result).to.be.false
    })
  })

  describe('newTotalExecTimeField', function () {
    it('should return true for PostgreSQL 13+', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('t')

      const result = await util.newTotalExecTimeField(mockDb)
      expect(result).to.be.true
      expect(mockExec.calledOnce).to.be.true
    })

    it('should return false for PostgreSQL < 13', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('f')

      const result = await util.newTotalExecTimeField(mockDb)
      expect(result).to.be.false
      expect(mockExec.calledOnce).to.be.true
    })

    it('should throw error for invalid version response', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('invalid')

      try {
        await util.newTotalExecTimeField(mockDb)
        expect.fail('Should have thrown an error')
      } catch (error: unknown) {
        const err = error as Error
        expect(err.message).to.include('Unable to determine database version, expected "t" or "f", got: "invalid"')
      }
    })

    it('should call psql with correct flags', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('t')

      await util.newTotalExecTimeField(mockDb)

      expect(mockExec.calledWith(
        mockDb,
        'SELECT current_setting(\'server_version_num\')::numeric >= 130000',
        ['-t', '-q'],
      )).to.be.true
    })
  })

  describe('newBlkTimeFields', function () {
    it('should return true for PostgreSQL 17+', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('t')

      const result = await util.newBlkTimeFields(mockDb)
      expect(result).to.be.true
      expect(mockExec.calledOnce).to.be.true
    })

    it('should return false for PostgreSQL < 17', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('f')

      const result = await util.newBlkTimeFields(mockDb)
      expect(result).to.be.false
      expect(mockExec.calledOnce).to.be.true
    })

    it('should throw error for invalid version response', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('invalid')

      try {
        await util.newBlkTimeFields(mockDb)
        expect.fail('Should have thrown an error')
      } catch (error: unknown) {
        const err = error as Error
        expect(err.message).to.include('Unable to determine database version, expected "t" or "f", got: "invalid"')
      }
    })

    it('should call psql with correct flags', async function () {
      const mockExec = utils.pg.psql.exec as sinon.SinonStub
      mockExec.resolves('t')

      await util.newBlkTimeFields(mockDb)

      expect(mockExec.calledWith(
        mockDb,
        'SELECT current_setting(\'server_version_num\')::numeric >= 170000',
        ['-t', '-q'],
      )).to.be.true
    })
  })
})
