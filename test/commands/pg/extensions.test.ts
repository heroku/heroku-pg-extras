import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgExtensions from '../../../src/commands/pg/extensions'
import {setupSimpleCommandMocks} from '../../helpers/mock-utils'
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
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  it('displays database extension information', async function () {
    await runCommand(PgExtensions, ['--app', 'my-app'])

    // Test behavior: does the user see the expected information?
    expect(stdout.output).to.eq(heredoc`
      name | default_version | installed_version | comment
      -----|----------------|-------------------|---------
      uuid-ossp | 1.1 | 1.1 | generate universally unique identifiers (UUIDs)
      pg_stat_statements | 1.8 | 1.8 | track execution statistics of all SQL statements
    `)
    expect(stderr.output).to.eq('')
  })

  it('handles database connection failures gracefully', async function () {
    databaseStub.rejects(new Error('Database connection failed'))

    try {
      await runCommand(PgExtensions, ['--app', 'my-app'])
      expect.fail('Should have thrown an error when database connection fails')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Error)
    }
  })

  it('handles SQL execution failures gracefully', async function () {
    execStub.rejects(new Error('SQL execution failed'))

    try {
      await runCommand(PgExtensions, ['--app', 'my-app'])
      expect.fail('Should have thrown an error when SQL execution fails')
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(Error)
    }
  })
})
