import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgBloat from '../../../src/commands/pg/bloat'
import {setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:bloat', function () {
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

    // Override the exec stub to return specific bloat output
    const mockOutput = `
type    | schemaname | object_name | bloat | waste
--------|------------|-------------|-------|-------
table   | public     | users       | 2.5   | 1.2 MB
index   | public     | users::idx  | 1.8   | 512 kB
`.trim()
    execStub.resolves(mockOutput)
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  it('displays database bloat information', async function () {
    await runCommand(PgBloat, ['--app', 'my-app'])

    // Test behavior: does the user see the expected information?
    expect(stdout.output).to.eq(heredoc`
      type    | schemaname | object_name | bloat | waste
      --------|------------|-------------|-------|-------
      table   | public     | users       | 2.5   | 1.2 MB
      index   | public     | users::idx  | 1.8   | 512 kB
    `)
    expect(stderr.output).to.eq('')
  })

  it('handles database connection failures gracefully', async function () {
    await testDatabaseConnectionFailure(PgBloat, ['--app', 'my-app'], databaseStub)
  })

  it('handles SQL execution failures gracefully', async function () {
    await testSQLExecutionFailure(PgBloat, ['--app', 'my-app'], execStub)
  })
})

