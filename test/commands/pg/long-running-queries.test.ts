import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgLongRunningQueries, {generateLongRunningQueriesQuery} from '../../../src/commands/pg/long-running-queries'
import {setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:long-running-queries', function () {
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

    // Override the exec stub to return specific long running queries output
    const mockOutput = `
pid | duration | query
----|----------|-------
123 | 00:10:30 | SELECT * FROM large_table WHERE complex_condition
456 | 00:08:15 | UPDATE users SET status = 'processing' WHERE id > 1000
789 | 00:06:45 | DELETE FROM logs WHERE created_at < '2023-01-01'
`.trim()
    execStub.resolves(mockOutput)
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  describe('Full SQL Equality', function () {
    it('should generate exact expected SQL query', function () {
      const expectedQuery = `SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query AS query
FROM
  pg_stat_activity
WHERE
  pg_stat_activity.query <> ''::text
  AND state <> 'idle'
  AND now() - pg_stat_activity.query_start > interval '5 minutes'
ORDER BY
  now() - pg_stat_activity.query_start DESC;`

      const actualQuery = generateLongRunningQueriesQuery()
      expect(actualQuery).to.equal(expectedQuery)
    })
  })

  describe('Business Logic', function () {
    it('should filter for queries longer than 5 minutes', function () {
      const query = generateLongRunningQueriesQuery()

      // Should filter for queries longer than 5 minutes
      expect(query).to.contain("interval '5 minutes'")
      expect(query).to.contain('now() - pg_stat_activity.query_start >')
    })

    it('should exclude idle queries', function () {
      const query = generateLongRunningQueriesQuery()

      // Should exclude idle queries
      expect(query).to.contain("state <> 'idle'")
    })

    it('should exclude empty queries', function () {
      const query = generateLongRunningQueriesQuery()

      // Should exclude empty queries
      expect(query).to.contain("pg_stat_activity.query <> ''::text")
    })

    it('should order by duration descending', function () {
      const query = generateLongRunningQueriesQuery()

      // Should order by duration descending
      expect(query).to.contain('ORDER BY')
      expect(query).to.contain('now() - pg_stat_activity.query_start DESC')
    })
  })

  describe('Command Behavior', function () {
    it('displays long running queries information', async function () {
      await runCommand(PgLongRunningQueries, ['--app', 'my-app'])

      expect(stdout.output).to.eq(heredoc`
        pid | duration | query
        ----|----------|-------
        123 | 00:10:30 | SELECT * FROM large_table WHERE complex_condition
        456 | 00:08:15 | UPDATE users SET status = 'processing' WHERE id > 1000
        789 | 00:06:45 | DELETE FROM logs WHERE created_at < '2023-01-01'
      `)
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      await testDatabaseConnectionFailure(PgLongRunningQueries, ['--app', 'my-app'], databaseStub)
    })

    it('handles SQL execution failures gracefully', async function () {
      await testSQLExecutionFailure(PgLongRunningQueries, ['--app', 'my-app'], execStub)
    })
  })
})
