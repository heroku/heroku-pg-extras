import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgLocks, {generateLocksQuery} from '../../../src/commands/pg/locks'
import {setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:locks', function () {
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

    // Override the exec stub to return specific locks output
    const mockOutput = `
pid | relname | transactionid | granted | query_snippet | age
----|---------|---------------|---------|---------------|-----
123 | users   | 456789        | t       | UPDATE users  | 00:01:30
789 | posts   | 123456        | f       | DELETE FROM   | 00:00:45
`.trim()
    execStub.resolves(mockOutput)
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  describe('Full SQL Equality', function () {
    it('should generate exact expected SQL query without truncation', function () {
      const expectedQuery = `
  SELECT
    pg_stat_activity.pid,
    pg_class.relname,
    pg_locks.transactionid,
    pg_locks.granted,
    pg_stat_activity.query AS query_snippet,
    age(now(),pg_stat_activity.query_start) AS 'age'
  FROM pg_stat_activity,pg_locks left
  OUTER JOIN pg_class
    ON (pg_locks.relation = pg_class.oid)
  WHERE pg_stat_activity.query <> '<insufficient privilege>'
    AND pg_locks.pid = pg_stat_activity.pid
    AND pg_locks.mode = 'ExclusiveLock'
    AND pg_stat_activity.pid <> pg_backend_pid() order by query_start;`.trim()

      const actualQuery = generateLocksQuery(false)
      expect(actualQuery).to.equal(expectedQuery)
    })

    it('should generate exact expected SQL query with truncation', function () {
      const expectedQuery = `
  SELECT
    pg_stat_activity.pid,
    pg_class.relname,
    pg_locks.transactionid,
    pg_locks.granted,
    CASE WHEN length(pg_stat_activity.query) <= 40 THEN pg_stat_activity.query ELSE substr(pg_stat_activity.query, 0, 39) || '...' END AS query_snippet,
    age(now(),pg_stat_activity.query_start) AS 'age'
  FROM pg_stat_activity,pg_locks left
  OUTER JOIN pg_class
    ON (pg_locks.relation = pg_class.oid)
  WHERE pg_stat_activity.query <> '<insufficient privilege>'
    AND pg_locks.pid = pg_stat_activity.pid
    AND pg_locks.mode = 'ExclusiveLock'
    AND pg_stat_activity.pid <> pg_backend_pid() order by query_start;`.trim()

      const actualQuery = generateLocksQuery(true)
      expect(actualQuery).to.equal(expectedQuery)
    })
  })

  describe('Business Logic', function () {
    it('should handle truncate flag correctly', function () {
      const truncatedQuery = generateLocksQuery(true)
      const fullQuery = generateLocksQuery(false)

      expect(truncatedQuery).to.contain('CASE WHEN length(pg_stat_activity.query) <= 40')
      expect(fullQuery).to.contain('pg_stat_activity.query AS query_snippet')
      expect(fullQuery).not.to.contain('CASE WHEN length')
    })

    it('should only show exclusive locks', function () {
      const query = generateLocksQuery(false)

      // Should only show exclusive locks
      expect(query).to.contain("pg_locks.mode = 'ExclusiveLock'")
    })

    it('should exclude current backend process', function () {
      const query = generateLocksQuery(false)

      // Should exclude current backend
      expect(query).to.contain('pg_stat_activity.pid <> pg_backend_pid()')
    })
  })

  describe('Command Behavior', function () {
    it('displays locks information without truncation', async function () {
      await runCommand(PgLocks, ['--app', 'my-app'])

      expect(stdout.output).to.eq(heredoc`
        pid | relname | transactionid | granted | query_snippet | age
        ----|---------|---------------|---------|---------------|-----
        123 | users   | 456789        | t       | UPDATE users  | 00:01:30
        789 | posts   | 123456        | f       | DELETE FROM   | 00:00:45
      `)
      expect(stderr.output).to.eq('')
    })

    it('handles truncate flag correctly', async function () {
      await runCommand(PgLocks, ['--app', 'my-app', '--truncate'])

      expect(stdout.output).to.eq(heredoc`
        pid | relname | transactionid | granted | query_snippet | age
        ----|---------|---------------|---------|---------------|-----
        123 | users   | 456789        | t       | UPDATE users  | 00:01:30
        789 | posts   | 123456        | f       | DELETE FROM   | 00:00:45
      `)
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      await testDatabaseConnectionFailure(PgLocks, ['--app', 'my-app'], databaseStub)
    })

    it('handles SQL execution failures gracefully', async function () {
      await testSQLExecutionFailure(PgLocks, ['--app', 'my-app'], execStub)
    })
  })
})
