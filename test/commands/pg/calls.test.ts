import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgCalls from '../../../src/commands/pg/calls'
import {setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:calls', function () {
  let sandbox: SinonSandbox
  let databaseStub: SinonStub
  let execStub: SinonStub
  let utilStub: {
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
---------------|----------------|--------|--------------|-------
00:00:01.234  | 25.0%          | 1,000  | 00:00:00.100 | SELECT * FROM users WHERE id = 1
00:00:00.567  | 15.0%          | 500    | 00:00:00.050 | UPDATE users SET name = 'John' WHERE id = 2
`.trim()
    execStub.resolves(mockOutput)

    // Mock utility functions
    utilStub = {
      newBlkTimeFields: sandbox.stub().resolves(true),
      newTotalExecTimeField: sandbox.stub().resolves(true),
    }
    sandbox.stub(require('../../../src/lib/util'), 'newTotalExecTimeField').value(utilStub.newTotalExecTimeField)
    sandbox.stub(require('../../../src/lib/util'), 'newBlkTimeFields').value(utilStub.newBlkTimeFields)
    sandbox.stub(require('../../../src/lib/util'), 'ensurePGStatStatement').value(sandbox.stub().resolves())
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  it('displays database query performance information', async function () {
    await runCommand(PgCalls, ['--app', 'my-app'])

    // Test behavior: does the user see the expected information?
    expect(stdout.output).to.eq(heredoc`
      total_exec_time | prop_exec_time | ncalls | sync_io_time | query
      ---------------|----------------|--------|--------------|-------
      00:00:01.234  | 25.0%          | 1,000  | 00:00:00.100 | SELECT * FROM users WHERE id = 1
      00:00:00.567  | 15.0%          | 500    | 00:00:00.050 | UPDATE users SET name = 'John' WHERE id = 2
    `)
    expect(stderr.output).to.eq('')
  })

  it('displays database query performance information with --truncate flag', async function () {
    await runCommand(PgCalls, ['--app', 'my-app', '--truncate'])

    // Test behavior: does the user see the expected information with truncated queries?
    expect(stdout.output).to.eq(heredoc`
      total_exec_time | prop_exec_time | ncalls | sync_io_time | query
      ---------------|----------------|--------|--------------|-------
      00:00:01.234  | 25.0%          | 1,000  | 00:00:00.100 | SELECT * FROM users WHERE id = 1
      00:00:00.567  | 15.0%          | 500    | 00:00:00.050 | UPDATE users SET name = 'John' WHERE id = 2
    `)
    expect(stderr.output).to.eq('')
  })

  it('displays database query performance information for older PostgreSQL versions', async function () {
    // Mock utility functions to return false for older versions
    utilStub.newTotalExecTimeField.resolves(false)
    utilStub.newBlkTimeFields.resolves(false)

    await runCommand(PgCalls, ['--app', 'my-app'])

    // Test behavior: does the user see the expected information for older PostgreSQL?
    expect(stdout.output).to.eq(heredoc`
      total_exec_time | prop_exec_time | ncalls | sync_io_time | query
      ---------------|----------------|--------|--------------|-------
      00:00:01.234  | 25.0%          | 1,000  | 00:00:00.100 | SELECT * FROM users WHERE id = 1
      00:00:00.567  | 15.0%          | 500    | 00:00:00.050 | UPDATE users SET name = 'John' WHERE id = 2
    `)
    expect(stderr.output).to.eq('')

    // Verify the utility functions were called
    expect(utilStub.newTotalExecTimeField.calledOnce).to.be.true
    expect(utilStub.newBlkTimeFields.calledOnce).to.be.true
  })

  // Use helper functions for error handling tests
  it('handles database connection failures gracefully', async function () {
    await testDatabaseConnectionFailure(PgCalls, ['--app', 'my-app'], databaseStub)
  })

  it('handles SQL execution failures gracefully', async function () {
    await testSQLExecutionFailure(PgCalls, ['--app', 'my-app'], execStub)
  })
})
