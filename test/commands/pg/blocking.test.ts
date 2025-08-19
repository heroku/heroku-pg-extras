import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgBlocking, {generateBlockingQuery} from '../../../src/commands/pg/blocking'
import {setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure} from '../../helpers/mock-utils'
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
123          | SELECT * FROM t1  | 00:01:30         | 456          | UPDATE t2 SET...  | 00:00:45
`.trim()
    execStub.resolves(mockOutput)
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  describe('Full SQL Equality', function () {
    it('should generate exact expected SQL query', function () {
      const expectedQuery = `SELECT bl.pid AS blocked_pid,
  ka.query AS blocking_statement,
  now() - ka.query_start AS blocking_duration,
  kl.pid AS blocking_pid,
  a.query AS blocked_statement,
  now() - a.query_start AS blocked_duration
FROM pg_catalog.pg_locks bl
JOIN pg_catalog.pg_stat_activity a
  ON bl.pid = a.pid
JOIN pg_catalog.pg_locks kl
  JOIN pg_catalog.pg_stat_activity ka
    ON kl.pid = ka.pid
ON bl.transactionid = kl.transactionid AND bl.pid != kl.pid
WHERE NOT bl.granted`

      const actualQuery = generateBlockingQuery()
      expect(actualQuery).to.equal(expectedQuery)
    })
  })

  describe('Business Logic', function () {
    it('should identify blocking vs blocked processes correctly', function () {
      const query = generateBlockingQuery()
      // This validates the core business logic of the blocking query
      expect(query).to.contain('bl.pid AS blocked_pid')
      expect(query).to.contain('kl.pid AS blocking_pid')
      expect(query).to.contain('WHERE NOT bl.granted')
    })
  })

  describe('Command Behavior', function () {
    it('displays blocking query information', async function () {
      await runCommand(PgBlocking, ['--app', 'my-app'])

      expect(stdout.output).to.eq(heredoc`
        blocked_pid | blocking_statement | blocking_duration | blocking_pid | blocked_statement | blocked_duration
        -------------|-------------------|-------------------|--------------|-------------------|------------------
        123          | SELECT * FROM t1  | 00:01:30         | 456          | UPDATE t2 SET...  | 00:00:45
      `)
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      await testDatabaseConnectionFailure(PgBlocking, ['--app', 'my-app'], databaseStub)
    })

    it('handles SQL execution failures gracefully', async function () {
      await testSQLExecutionFailure(PgBlocking, ['--app', 'my-app'], execStub)
    })
  })
})
