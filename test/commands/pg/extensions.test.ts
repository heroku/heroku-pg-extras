import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgExtensions from '../../../src/commands/pg/extensions'
import {setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:extensions', function () {
  let sandbox: SinonSandbox
  let databaseStub: SinonStub
  let execStub: SinonStub
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

    // Mock the exec stub to return extensions output
    execStub.resolves(`
name | default_version | installed_version | comment
-----|----------------|-------------------|---------
uuid-ossp | 1.1 | 1.1 | generate universally unique identifiers (UUIDs)
pg_stat_statements | 1.8 | 1.8 | track execution statistics of all SQL statements
`.trim())

    // Mock utility functions
    utilStub = {
      essentialNumPlan: sandbox.stub().returns(true),
    }
    sandbox.stub(require('../../../src/lib/util'), 'essentialNumPlan').value(utilStub.essentialNumPlan)
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  it('displays database extension information for essential tier plans', async function () {
    await runCommand(PgExtensions, ['--app', 'my-app'])

    // Test behavior: verify the correct query was executed and output displayed
    expect(stdout.output).to.eq(heredoc`
      name | default_version | installed_version | comment
      -----|----------------|-------------------|---------
      uuid-ossp | 1.1 | 1.1 | generate universally unique identifiers (UUIDs)
      pg_stat_statements | 1.8 | 1.8 | track execution statistics of all SQL statements
    `)
    expect(stderr.output).to.eq('')

    // Verify the correct SQL query was used for essential tier plans
    expect(execStub.firstCall.args[1]).to.include('rds.allowed_extensions')
  })

  it('displays database extension information for non-essential tier plans', async function () {
    // Change the mock to return false for non-essential plans
    utilStub.essentialNumPlan.returns(false)

    await runCommand(PgExtensions, ['--app', 'my-app'])

    // Test behavior: verify the correct query was executed and output displayed
    expect(stdout.output).to.eq(heredoc`
      name | default_version | installed_version | comment
      -----|----------------|-------------------|---------
      uuid-ossp | 1.1 | 1.1 | generate universally unique identifiers (UUIDs)
      pg_stat_statements | 1.8 | 1.8 | track execution statistics of all SQL statements
    `)
    expect(stderr.output).to.eq('')

    // Verify the utility function was called and the correct SQL query was used
    expect(utilStub.essentialNumPlan.calledOnce).to.be.true
    expect(execStub.firstCall.args[1]).to.include('extwlist.extensions')
  })

  // Use helper functions for error handling tests
  it('handles database connection failures gracefully', async function () {
    await testDatabaseConnectionFailure(PgExtensions, ['--app', 'my-app'], databaseStub)
  })

  it('handles SQL execution failures gracefully', async function () {
    await testSQLExecutionFailure(PgExtensions, ['--app', 'my-app'], execStub)
  })
})
