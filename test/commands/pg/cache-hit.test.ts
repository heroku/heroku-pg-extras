import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgCacheHit from '../../../src/commands/pg/cache-hit'
import {setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:cache-hit', function () {
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

    // Override the exec stub to return specific cache hit output
    const mockOutput = `
name | ratio
-----|-------
index hit rate | 0.95
table hit rate | 0.87
`.trim()
    execStub.resolves(mockOutput)
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  it('displays database cache hit information', async function () {
    await runCommand(PgCacheHit, ['--app', 'my-app'])

    // Test behavior: does the user see the expected information?
    expect(stdout.output).to.eq(heredoc`
      name | ratio
      -----|-------
      index hit rate | 0.95
      table hit rate | 0.87
    `)
    expect(stderr.output).to.eq('')
  })

  // Use helper functions for error handling tests
  it('handles database connection failures gracefully', async function () {
    await testDatabaseConnectionFailure(PgCacheHit, ['--app', 'my-app'], databaseStub)
  })

  it('handles SQL execution failures gracefully', async function () {
    await testSQLExecutionFailure(PgCacheHit, ['--app', 'my-app'], execStub)
  })
})
