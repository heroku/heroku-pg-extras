import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'

import PgCalls from '../../../src/commands/pg/calls'
import {setupSimpleCommandMocks} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:calls', function () {
  let sandbox: SinonSandbox
  let databaseStub: SinonStub
  let execStub: SinonStub
  let uxLogStub: SinonStub
  let utilStub: {
    ensurePGStatStatement: SinonStub
    newBlkTimeFields: SinonStub
    newTotalExecTimeField: SinonStub
  }
  const {env} = process

  beforeEach(function () {
    process.env = {}
    sandbox = sinon.createSandbox()

    // Setup Heroku CLI utils mocks
    const mocks = setupSimpleCommandMocks(sandbox)
    databaseStub = mocks.database
    execStub = mocks.exec

    // Override the exec stub to return specific calls output
    const mockOutput = `
total_exec_time | prop_exec_time | ncalls | sync_io_time | query
----------------|----------------|--------|--------------|-------
00:00:01.234 | 25.0% | 1,000 | 00:00:00.123 | SELECT * FROM users WHERE id = ?
00:00:00.987 | 20.0% | 800 | 00:00:00.098 | UPDATE users SET name = ? WHERE id = ?
`.trim()
    execStub.resolves(mockOutput)

    // Mock utility functions
    utilStub = {
      ensurePGStatStatement: sandbox.stub().resolves(),
      newBlkTimeFields: sandbox.stub().resolves(true),
      newTotalExecTimeField: sandbox.stub().resolves(true),
    }
    sandbox.stub(require('../../../src/lib/util'), 'ensurePGStatStatement').value(utilStub.ensurePGStatStatement)
    sandbox.stub(require('../../../src/lib/util'), 'newTotalExecTimeField').value(utilStub.newTotalExecTimeField)
    sandbox.stub(require('../../../src/lib/util'), 'newBlkTimeFields').value(utilStub.newBlkTimeFields)

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
    await runCommand(PgCalls, ['--app', 'my-app'])

    expect(databaseStub.calledOnce).to.be.true
    expect(databaseStub.firstCall.args[1]).to.equal('my-app')
    expect(databaseStub.firstCall.args[2]).to.equal(undefined)
    expect(utilStub.ensurePGStatStatement.calledOnce).to.be.true
    expect(execStub.calledOnce).to.be.true
    expect(uxLogStub.calledOnce).to.be.true
    expect(uxLogStub.firstCall.args[0]).to.include('total_exec_time | prop_exec_time')
    expect(uxLogStub.firstCall.args[0]).to.include('SELECT * FROM users WHERE id = ?')
  })

  it('returns an error when database fetcher fails', async function () {
    // Mock the database fetcher to throw an error
    databaseStub.rejects()

    try {
      await runCommand(PgCalls, ['--app', 'my-app'])
      expect.fail('Should have thrown an error when database fetcher fails')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Error)
    }
  })

  it('returns an error when psql exec fails', async function () {
    // Mock the psql exec to throw an error
    execStub.rejects()

    try {
      await runCommand(PgCalls, ['--app', 'my-app'])
      expect.fail('Should have thrown an error when psql exec fails')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Error)
    }
  })
})
