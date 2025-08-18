import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'

import PgExtensions from '../../../src/commands/pg/extensions'
import {setupSimpleCommandMocks} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:extensions', function () {
  let sandbox: SinonSandbox
  let databaseStub: SinonStub
  let execStub: SinonStub
  let uxLogStub: SinonStub
  let utilStub: {
    essentialNumPlan: SinonStub
  }
  const {env} = process

  beforeEach(function () {
    process.env = {}
    sandbox = sinon.createSandbox()

    // Setup Heroku CLI utils mocks
    const mocks = setupSimpleCommandMocks(sandbox)
    databaseStub = mocks.database
    execStub = mocks.exec

    // Override the exec stub to return specific extensions output
    const mockOutput = `
name | default_version | installed_version | comment
-----|----------------|-------------------|---------
uuid-ossp | 1.1 | 1.1 | generate universally unique identifiers (UUIDs)
pg_stat_statements | 1.8 | 1.8 | track execution statistics of all SQL statements
`.trim()
    execStub.resolves(mockOutput)

    // Mock utility functions
    utilStub = {
      essentialNumPlan: sandbox.stub().returns(true),
    }
    sandbox.stub(require('../../../src/lib/util'), 'essentialNumPlan').value(utilStub.essentialNumPlan)

    // Mock ux.log
    uxLogStub = sandbox.stub()
    sandbox.stub(require('@oclif/core'), 'ux').value({
      log: uxLogStub,
    })
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  it('returns the SQL output via ux.log', async function () {
    await runCommand(PgExtensions, ['--app', 'my-app'])

    expect(databaseStub.calledOnce).to.be.true
    expect(databaseStub.firstCall.args[1]).to.equal('my-app')
    expect(databaseStub.firstCall.args[2]).to.equal(undefined)
    expect(utilStub.essentialNumPlan.calledOnce).to.be.true
    expect(execStub.calledOnce).to.be.true
    expect(uxLogStub.calledOnce).to.be.true
    expect(uxLogStub.firstCall.args[0]).to.include('name | default_version')
    expect(uxLogStub.firstCall.args[0]).to.include('uuid-ossp | 1.1')
  })

  it('returns an error when database fetcher fails', async function () {
    // Mock the database fetcher to throw an error
    databaseStub.rejects()

    try {
      await runCommand(PgExtensions, ['--app', 'my-app'])
      expect.fail('Should have thrown an error when database fetcher fails')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Error)
    }
  })

  it('returns an error when psql exec fails', async function () {
    // Mock the psql exec to throw an error
    execStub.rejects()

    try {
      await runCommand(PgExtensions, ['--app', 'my-app'])
      expect.fail('Should have thrown an error when psql exec fails')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Error)
    }
  })
})
