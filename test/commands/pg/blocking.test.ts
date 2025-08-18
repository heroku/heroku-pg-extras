import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'

import PgBlocking from '../../../src/commands/pg/blocking'
import {setupSimpleCommandMocks} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:blocking', function () {
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

    // Override the exec stub to return specific blocking output
    const mockOutput = `
blocked_pid | blocking_statement | blocking_duration | blocking_pid | blocked_statement | blocked_duration
-------------|-------------------|-------------------|--------------|-------------------|------------------
1234 | SELECT * FROM users WHERE id = 1 | 00:00:05.123 | 5678 | UPDATE users SET name = 'John' | 00:00:02.456
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
    await runCommand(PgBlocking, ['--app', 'my-app'])

    expect(databaseStub.calledOnce).to.be.true
    expect(databaseStub.firstCall.args[1]).to.equal('my-app')
    expect(databaseStub.firstCall.args[2]).to.equal(undefined)
    expect(execStub.calledOnce).to.be.true
    expect(uxLogStub.calledOnce).to.be.true
    expect(uxLogStub.firstCall.args[0]).to.include('blocked_pid | blocking_statement')
    expect(uxLogStub.firstCall.args[0]).to.include('1234 | SELECT * FROM users WHERE id = 1')
  })

  it('returns an error when database fetcher fails', async function () {
    // Mock the database fetcher to throw an error
    databaseStub.rejects()

    try {
      await runCommand(PgBlocking, ['--app', 'my-app'])
      expect.fail('Should have thrown an error when database fetcher fails')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Error)
    }
  })

  it('returns an error when psql exec fails', async function () {
    // Mock the psql exec to throw an error
    execStub.rejects()

    try {
      await runCommand(PgBlocking, ['--app', 'my-app'])
      expect.fail('Should have thrown an error when psql exec fails')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Error)
    }
  })
})
