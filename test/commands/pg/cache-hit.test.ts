import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'

import PgCacheHit from '../../../src/commands/pg/cache-hit'
import {setupSimpleCommandMocks} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:cache-hit', function () {
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

    // Override the exec stub to return specific cache hit output
    const mockOutput = `
name | ratio
-----|-------
index hit rate | 0.95
table hit rate | 0.87
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
    await runCommand(PgCacheHit, ['--app', 'my-app'])

    expect(databaseStub.calledOnce).to.be.true
    expect(databaseStub.firstCall.args[1]).to.equal('my-app')
    expect(databaseStub.firstCall.args[2]).to.equal(undefined)
    expect(execStub.calledOnce).to.be.true
    expect(uxLogStub.calledOnce).to.be.true
    expect(uxLogStub.firstCall.args[0]).to.include('name | ratio')
    expect(uxLogStub.firstCall.args[0]).to.include('index hit rate | 0.95')
  })

  it('returns an error when database fetcher fails', async function () {
    // Mock the database fetcher to throw an error
    databaseStub.rejects()

    try {
      await runCommand(PgCacheHit, ['--app', 'my-app'])
      expect.fail('Should have thrown an error when database fetcher fails')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Error)
    }
  })

  it('returns an error when psql exec fails', async function () {
    // Mock the psql exec to throw an error
    execStub.rejects()

    try {
      await runCommand(PgCacheHit, ['--app', 'my-app'])
      expect.fail('Should have thrown an error when psql exec fails')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Error)
    }
  })
})
