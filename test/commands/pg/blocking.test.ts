import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgBlocking from '../../../src/commands/pg/blocking'
import {setupSimpleCommandMocks} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:blocking', function () {
  let sandbox: SinonSandbox
  let databaseStub: SinonStub
  let execStub: SinonStub
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
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  it('displays database blocking information', async function () {
    await runCommand(PgBlocking, ['--app', 'my-app'])

    // Test behavior: does the user see the expected information?
    expect(stdout.output).to.eq(heredoc`
      blocked_pid | blocking_statement | blocking_duration | blocking_pid | blocked_statement | blocked_duration
      -------------|-------------------|-------------------|--------------|-------------------|------------------
      1234 | SELECT * FROM users WHERE id = 1 | 00:00:05.123 | 5678 | UPDATE users SET name = 'John' | 00:00:02.456
    `)
    expect(stderr.output).to.eq('')
  })

  it('handles database connection failures gracefully', async function () {
    databaseStub.rejects(new Error('Database connection failed'))

    try {
      await runCommand(PgBlocking, ['--app', 'my-app'])
      expect.fail('Should have thrown an error when database connection fails')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Error)
    }
  })

  it('handles SQL execution failures gracefully', async function () {
    execStub.rejects(new Error('SQL execution failed'))

    try {
      await runCommand(PgBlocking, ['--app', 'my-app'])
      expect.fail('Should have thrown an error when SQL execution fails')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Error)
    }
  })
})
