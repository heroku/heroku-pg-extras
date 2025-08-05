import type {AddOnWithRelatedData, ExtendedAddonAttachment} from '@heroku/heroku-cli-util/dist/types/pg/data-api.js'
import type {ConnectionDetailsWithAttachment} from '@heroku/heroku-cli-util/dist/types/pg/tunnel.js'

import PsqlService from '@heroku/heroku-cli-util/dist/utils/pg/psql.js'
import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'

import {
  ensureEssentialTierPlan,
  ensurePGStatStatement,
  essentialNumPlan,
  newBlkTimeFields,
  newTotalExecTimeField,
} from '../../src/lib/util.js'

// Configure chai plugins
chai.use(chaiAsPromised)
chai.use(sinonChai)

describe('util', function () {
  const {expect} = chai

  // Shared mock database connection details
  const mockDb: ConnectionDetailsWithAttachment = {
    attachment: {
      addon: {
        id: 'test-addon-id',
        name: 'test-addon',
        plan: {
          id: 'test-plan-id',
          name: 'heroku-postgresql:standard-0',
        },
      },
      id: 'test-attachment-id',
      name: 'test-attachment',
    } as ExtendedAddonAttachment,
    database: 'testdb',
    host: 'localhost',
    password: 'testpass',
    pathname: '/testdb',
    port: '5432',
    url: 'postgres://testuser:testpass@localhost:5432/testdb',
    user: 'testuser',
  } as ConnectionDetailsWithAttachment

  describe('ensurePGStatStatement', function () {
    let psqlExecStub: sinon.SinonStub

    beforeEach(function () {
      // Create a stub for psql.exec
      psqlExecStub = sinon.stub(PsqlService.prototype, 'execQuery')
    })

    afterEach(function () {
      // Restore all stubs after each test
      sinon.restore()
    })

    it('should pass when pg_stat_statements extension is available', async function () {
      // Mock successful response indicating pg_stat_statements is available
      psqlExecStub.resolves('available\n--------\nt\n(1 row)')

      // Call the function - should not throw
      await expect(ensurePGStatStatement(mockDb)).to.not.be.rejected

      // Verify psql.exec was called with correct arguments
      expect(psqlExecStub).to.have.been.calledOnce
    })

    it('should throw error when pg_stat_statements extension is not available', async function () {
      // Mock response indicating pg_stat_statements is not available
      psqlExecStub.resolves('available\n--------\nf\n(1 row)')

      // Call the function - should throw an error
      await expect(ensurePGStatStatement(mockDb)).to.be.rejectedWith(
        'pg_stat_statements extension need to be installed in the public schema first.',
      )

      // Verify psql.exec was called with correct arguments
      expect(psqlExecStub).to.have.been.calledOnce
    })

    it('should throw error when psql.exec fails', async function () {
      // Mock psql.exec to throw an error
      const dbError = new Error('Database connection failed')
      psqlExecStub.rejects(dbError)

      // Call the function - should throw the database error
      await expect(ensurePGStatStatement(mockDb)).to.be.rejectedWith('Database connection failed')

      // Verify psql.exec was called
      expect(psqlExecStub).to.have.been.calledOnce
    })
  })

  describe('ensureEssentialTierPlan', function () {
    let mockAddOn: AddOnWithRelatedData

    beforeEach(function () {
      // Create a base mock AddOn object with required plan property
      mockAddOn = {
        id: 'test-addon-id',
        name: 'test-addon',
        plan: {
          id: 'test-plan-id',
          name: 'heroku-postgresql:standard-0',
        },
      } as AddOnWithRelatedData
    })

    it('should pass when plan name does not match Essential-tier patterns', function () {
      // Test various non-Essential tier plan names
      const nonEssentialPlans = [
        'heroku-postgresql:standard-0',
        'heroku-postgresql:premium-0',
        'heroku-postgresql:private-0',
        'heroku-postgresql:shield-0',
      ]

      for (const planName of nonEssentialPlans) {
        mockAddOn.plan!.name = planName
        expect(() => ensureEssentialTierPlan(mockAddOn)).to.not.throw()
      }
    })

    it('should throw error when plan name matches Essential-tier patterns', function () {
      const nonEssentialPlans = [
        'heroku-postgresql:dev',
        'heroku-postgresql:basic',
        'heroku-postgresql:essential-0',
        'heroku-postgresql:essential-1',
        'heroku-postgresql:essential-2',
      ]

      for (const planName of nonEssentialPlans) {
        mockAddOn.plan!.name = planName
        expect(() => ensureEssentialTierPlan(mockAddOn)).to.throw(
          'This operation is not supported by Essential-tier databases.',
        )
      }
    })
  })

  describe('essentialNumPlan', function () {
    let mockAddOn: AddOnWithRelatedData

    beforeEach(function () {
      // Create a base mock AddOn object with required plan property
      mockAddOn = {
        id: 'test-addon-id',
        name: 'test-addon',
        plan: {
          id: 'test-plan-id',
          name: 'heroku-postgresql:standard-0',
        },
      } as AddOnWithRelatedData
    })

    it('should return false when plan name does not match essential pattern', function () {
      const nonEssentialPlans = [
        'heroku-postgresql:standard-0',
        'heroku-postgresql:premium-0',
        'heroku-postgresql:private-0',
        'heroku-postgresql:shield-0',
        'heroku-postgresql:dev',
        'heroku-postgresql:basic',
      ]

      for (const planName of nonEssentialPlans) {
        mockAddOn.plan!.name = planName
        expect(essentialNumPlan(mockAddOn)).to.be.false
      }
    })

    it('should return true when plan name matches essential pattern', function () {
      const essentialPlans = [
        'heroku-postgresql:essential-0',
        'heroku-postgresql:essential-1',
        'heroku-postgresql:essential-2',
      ]

      for (const planName of essentialPlans) {
        mockAddOn.plan!.name = planName
        expect(essentialNumPlan(mockAddOn)).to.be.true
      }
    })
  })

  describe('newTotalExecTimeField', function () {
    let psqlExecStub: sinon.SinonStub

    beforeEach(function () {
      // Create a stub for psql.exec
      psqlExecStub = sinon.stub(PsqlService.prototype, 'execQuery')
    })

    afterEach(function () {
      // Restore all stubs after each test
      sinon.restore()
    })

    it('should return true when database version is >= 13.0', async function () {
      // Mock response indicating version >= 13.0 (with -t -q flags, output is just " t\n")
      psqlExecStub.resolves(' t\n')

      const result = await newTotalExecTimeField(mockDb)
      expect(result).to.be.true

      // Verify psql.exec was called with correct arguments
      expect(psqlExecStub).to.have.been.calledOnce
      expect(psqlExecStub.firstCall.args[0]).to.equal('SELECT current_setting(\'server_version_num\')::numeric >= 130000')
      expect(psqlExecStub.firstCall.args[1]).to.deep.equal(['-t', '-q'])
    })

    it('should return false when database version is < 13.0', async function () {
      // Mock response indicating version < 13.0 (with -t -q flags, output is just " f\n  ")
      psqlExecStub.resolves(' f\n')

      const result = await newTotalExecTimeField(mockDb)
      expect(result).to.be.false

      // Verify psql.exec was called with correct arguments
      expect(psqlExecStub).to.have.been.calledOnce
      expect(psqlExecStub.firstCall.args[0]).to.equal('SELECT current_setting(\'server_version_num\')::numeric >= 130000')
      expect(psqlExecStub.firstCall.args[1]).to.deep.equal(['-t', '-q'])
    })

    it('should throw error when output is not "t" or "f"', async function () {
      // Mock unexpected output
      psqlExecStub.resolves('error')

      await expect(newTotalExecTimeField(mockDb)).to.be.rejectedWith(
        'Unable to determine database version, expected "t" or "f", got: "error"',
      )

      expect(psqlExecStub).to.have.been.calledOnce
    })

    it('should throw error when psql.exec fails', async function () {
      // Mock psql.exec to throw an error
      const dbError = new Error('Database connection failed')
      psqlExecStub.rejects(dbError)

      await expect(newTotalExecTimeField(mockDb)).to.be.rejectedWith('Database connection failed')

      expect(psqlExecStub).to.have.been.calledOnce
    })
  })

  describe('newBlkTimeFields', function () {
    let psqlExecStub: sinon.SinonStub

    beforeEach(function () {
      // Create a stub for psql.exec
      psqlExecStub = sinon.stub(PsqlService.prototype, 'execQuery')
    })

    afterEach(function () {
      // Restore all stubs after each test
      sinon.restore()
    })

    it('should return true when database version is >= 17.0', async function () {
      // Mock response indicating version >= 17.0 (with -t -q flags, output is just " t\n")
      psqlExecStub.resolves(' t\n')

      const result = await newBlkTimeFields(mockDb)
      expect(result).to.be.true

      // Verify psql.exec was called with correct arguments
      expect(psqlExecStub).to.have.been.calledOnce
      expect(psqlExecStub.firstCall.args[0]).to.equal('SELECT current_setting(\'server_version_num\')::numeric >= 170000')
      expect(psqlExecStub.firstCall.args[1]).to.deep.equal(['-t', '-q'])
    })

    it('should return false when database version is < 17.0', async function () {
      // Mock response indicating version < 17.0 (with -t -q flags, output is just " f\n")
      psqlExecStub.resolves(' f\n')

      const result = await newBlkTimeFields(mockDb)
      expect(result).to.be.false

      // Verify psql.exec was called with correct arguments
      expect(psqlExecStub).to.have.been.calledOnce
      expect(psqlExecStub.firstCall.args[0]).to.equal('SELECT current_setting(\'server_version_num\')::numeric >= 170000')
      expect(psqlExecStub.firstCall.args[1]).to.deep.equal(['-t', '-q'])
    })

    it('should throw error when output is not "t" or "f"', async function () {
      // Mock unexpected output
      psqlExecStub.resolves('error')

      await expect(newBlkTimeFields(mockDb)).to.be.rejectedWith(
        'Unable to determine database version, expected "t" or "f", got: "error"',
      )

      expect(psqlExecStub).to.have.been.calledOnce
    })

    it('should throw error when psql.exec fails', async function () {
      // Mock psql.exec to throw an error
      const dbError = new Error('Database connection failed')
      psqlExecStub.rejects(dbError)

      await expect(newBlkTimeFields(mockDb)).to.be.rejectedWith('Database connection failed')

      expect(psqlExecStub).to.have.been.calledOnce
    })
  })
})
