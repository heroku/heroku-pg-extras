import {ux} from '@oclif/core'
import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'

import * as util from '../../src/lib/util'
import {setupSimpleCommandMocks} from '../helpers/mock-utils'

describe('util - boolean functions', function () {
  let sandbox: SinonSandbox
  let execStub: SinonStub
  let uxErrorStub: SinonStub
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPlan: any

  beforeEach(function () {
    sandbox = sinon.createSandbox()

    // Setup Heroku CLI utils mocks
    const mocks = setupSimpleCommandMocks(sandbox)
    execStub = mocks.exec

    // Mock ux.error
    uxErrorStub = sandbox.stub(ux, 'error')

    // Mock database connection
    mockDb = {
      attachment: {
        addon: {
          plan: {
            name: 'heroku-postgresql:premium-0',
          },
        },
      },
    }

    // Mock plan object
    mockPlan = {
      plan: {
        name: 'heroku-postgresql:essential-0',
      },
    }
  })

  afterEach(function () {
    sandbox.restore()
    // Reset the uxErrorStub to clear call history
    uxErrorStub.reset()
  })

  describe('ensurePGStatStatement', function () {
    it('succeeds when pg_stat_statements is available', async function () {
      execStub.resolves('t')

      await util.ensurePGStatStatement(mockDb)

      expect(execStub.calledOnce).to.be.true
      expect(execStub.firstCall.args[0]).to.equal(mockDb)
      expect(execStub.firstCall.args[1]).to.include('pg_stat_statements')
    })

    it('calls ux.error when psql exec fails', async function () {
      execStub.rejects()

      await util.ensurePGStatStatement(mockDb)

      expect(uxErrorStub.calledOnce).to.be.true
      expect(uxErrorStub.firstCall.args[1]).to.deep.equal({exit: 1})
    })

    it('calls ux.error when pg_stat_statements is not available', async function () {
      execStub.resolves('f')

      await util.ensurePGStatStatement(mockDb)

      expect(uxErrorStub.calledOnce).to.be.true
      expect(uxErrorStub.firstCall.args[1]).to.deep.equal({exit: 1})
    })
  })

  describe('ensureEssentialTierPlan', function () {
    it('succeeds for non-essential tier plans', async function () {
      mockDb.attachment.addon.plan.name = 'heroku-postgresql:premium-0'

      await util.ensureEssentialTierPlan(mockDb)
      // Should not throw an error
    })

    it('calls ux.error for dev tier plans', async function () {
      mockDb.attachment.addon.plan.name = 'heroku-postgresql:dev'

      await util.ensureEssentialTierPlan(mockDb)

      expect(uxErrorStub.calledOnce).to.be.true
      expect(uxErrorStub.firstCall.args[1]).to.deep.equal({exit: 1})
    })

    it('calls ux.error for basic tier plans', async function () {
      mockDb.attachment.addon.plan.name = 'heroku-postgresql:basic'

      await util.ensureEssentialTierPlan(mockDb)

      expect(uxErrorStub.calledOnce).to.be.true
      expect(uxErrorStub.firstCall.args[1]).to.deep.equal({exit: 1})
    })

    it('calls ux.error for essential tier plans', async function () {
      mockDb.attachment.addon.plan.name = 'heroku-postgresql:essential-0'

      await util.ensureEssentialTierPlan(mockDb)

      expect(uxErrorStub.calledOnce).to.be.true
      expect(uxErrorStub.firstCall.args[1]).to.deep.equal({exit: 1})
    })

    it('calls ux.error when plan name is missing', async function () {
      mockDb.attachment.addon.plan.name = undefined

      await util.ensureEssentialTierPlan(mockDb)

      expect(uxErrorStub.calledOnce).to.be.true
      expect(uxErrorStub.firstCall.args[1]).to.deep.equal({exit: 1})
    })

    it('calls ux.error when plan is missing', async function () {
      mockDb.attachment.addon.plan = undefined

      await util.ensureEssentialTierPlan(mockDb)

      expect(uxErrorStub.calledOnce).to.be.true
      expect(uxErrorStub.firstCall.args[1]).to.deep.equal({exit: 1})
    })
  })

  describe('essentialNumPlan', function () {
    it('returns true for essential tier plans', function () {
      const result = util.essentialNumPlan(mockPlan)
      expect(result).to.be.a('boolean')
      expect(result).to.be.true
    })

    it('returns false for non-essential tier plans', function () {
      mockPlan.plan.name = 'heroku-postgresql:premium-0'
      const result = util.essentialNumPlan(mockPlan)
      expect(result).to.be.a('boolean')
      expect(result).to.be.false
    })

    it('returns false when plan name is missing', function () {
      mockPlan.plan.name = undefined
      const result = util.essentialNumPlan(mockPlan)
      expect(result).to.be.a('boolean')
      expect(result).to.be.false
    })
  })

  describe('newTotalExecTimeField', function () {
    it('returns true for PostgreSQL 13+', async function () {
      // Note: PostgreSQL 13+ has 'total_exec_time' column, older versions use 'total_time'
      execStub.resolves('t')

      const result = await util.newTotalExecTimeField(mockDb)

      expect(result).to.be.a('boolean')
      expect(result).to.be.true
      expect(execStub.calledOnce).to.be.true
    })

    it('returns false for PostgreSQL < 13', async function () {
      // Note: PostgreSQL < 13 only has 'total_time' column, not 'total_exec_time'
      execStub.resolves('f')

      const result = await util.newTotalExecTimeField(mockDb)

      expect(result).to.be.a('boolean')
      expect(result).to.be.false
      expect(execStub.calledOnce).to.be.true
    })

    it('calls ux.error when psql exec fails', async function () {
      execStub.rejects()

      await util.newTotalExecTimeField(mockDb)

      expect(uxErrorStub.calledOnce).to.be.true
      expect(uxErrorStub.firstCall.args[1]).to.deep.equal({exit: 1})
    })

    it('calls ux.error for invalid version response', async function () {
      execStub.resolves('invalid')

      await util.newTotalExecTimeField(mockDb)

      expect(uxErrorStub.calledOnce).to.be.true
      expect(uxErrorStub.firstCall.args[1]).to.deep.equal({exit: 1})
    })
  })

  describe('newBlkTimeFields', function () {
    it('returns true for PostgreSQL 17+', async function () {
      // Note: PostgreSQL 17+ has 'shared_blk_read_time' and 'shared_blk_write_time' columns
      execStub.resolves('t')

      const result = await util.newBlkTimeFields(mockDb)

      expect(result).to.be.a('boolean')
      expect(result).to.be.true
      expect(execStub.calledOnce).to.be.true
    })

    it('returns false for PostgreSQL < 17', async function () {
      // Note: PostgreSQL < 17 only has 'blk_read_time' and 'blk_write_time' columns
      execStub.resolves('f')

      const result = await util.newBlkTimeFields(mockDb)
      expect(result).to.be.a('boolean')
      expect(result).to.be.false
      expect(execStub.calledOnce).to.be.true
    })

    it('calls ux.error when psql exec fails', async function () {
      execStub.rejects()

      await util.newBlkTimeFields(mockDb)

      expect(uxErrorStub.calledOnce).to.be.true
      expect(uxErrorStub.firstCall.args[1]).to.deep.equal({exit: 1})
    })

    it('calls ux.error for invalid version response', async function () {
      execStub.resolves('invalid')

      await util.newBlkTimeFields(mockDb)

      expect(uxErrorStub.calledOnce).to.be.true
      expect(uxErrorStub.firstCall.args[1]).to.deep.equal({exit: 1})
    })
  })
})
