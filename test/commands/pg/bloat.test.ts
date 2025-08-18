import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'

import PgBloat from '../../../src/commands/pg/bloat'
import {setupSimpleCommandMocks} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:bloat', function () {
  let sandbox: SinonSandbox
  let databaseStub: SinonStub
  let execStub: SinonStub
  let uxLogStub: SinonStub
  const {env} = process

  beforeEach(function () {
    process.env = {}
    sandbox = sinon.createSandbox()

    // Setup Heroku CLI utils mocks
    const mocks = setupSimpleCommandMocks(sandbox)
    databaseStub = mocks.database
    execStub = mocks.exec

    // Override the exec stub to return specific bloat output
    const mockOutput = `
type | schemaname | object_name | bloat | waste
------|------------|-------------|-------|-------
table | public | users | 2.5 | 1.2 MB
index | public | users_email_idx | 1.8 | 512 kB
`.trim()
    execStub.resolves(mockOutput)

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
    await runCommand(PgBloat, ['--app', 'my-app'])

    expect(databaseStub.calledOnce).to.be.true
    expect(databaseStub.firstCall.args[1]).to.equal('my-app')
    expect(databaseStub.firstCall.args[2]).to.equal(undefined)
    expect(execStub.calledOnce).to.be.true
    expect(uxLogStub.calledOnce).to.be.true
    expect(uxLogStub.firstCall.args[0]).to.include('type | schemaname | object_name | bloat | waste')
    expect(uxLogStub.firstCall.args[0]).to.include('table | public | users | 2.5 | 1.2 MB')
  })

  it('returns an error when database fetcher fails', async function () {
    // Mock the database fetcher to throw an error
    databaseStub.rejects()

    try {
      await runCommand(PgBloat, ['--app', 'my-app'])
      expect.fail('Should have thrown an error when database fetcher fails')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Error)
    }
  })

  it('returns an error when psql exec fails', async function () {
    // Mock the psql exec to throw an error
    execStub.rejects()

    try {
      await runCommand(PgBloat, ['--app', 'my-app'])
      expect.fail('Should have thrown an error when psql exec fails')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Error)
    }
  })
})

