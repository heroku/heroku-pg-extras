import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgCalls, {generateCallsQuery} from '../../../src/commands/pg/calls'
import * as util from '../../../src/lib/util'
import {
  createMockDbConnection, setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure,
} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:calls', function () {
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

    // Override the exec stub to return specific calls output
    const mockOutput = `
query | exec_time | prop_exec_time | ncalls | sync_io_time
------|-----------|----------------|--------|-------------
SELECT * FROM users | 1.23 | 0.15 | 100 | 0.05
UPDATE users SET... | 2.45 | 0.30 | 50 | 0.12
`.trim()
    execStub.resolves(mockOutput)
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  describe('Full SQL Equality', function () {
    it('should generate exact expected SQL query for PostgreSQL 13+ with truncate', async function () {
      const mockDbConnection = createMockDbConnection('heroku-postgresql:premium-0')

      // Stub utility functions for this specific test
      sandbox.stub(util, 'ensurePGStatStatement').resolves()
      sandbox.stub(util, 'newTotalExecTimeField').resolves(true)
      sandbox.stub(util, 'newBlkTimeFields').resolves(true)

      const expectedQuery = `SELECT interval '1 millisecond' * total_exec_time AS total_exec_time,
to_char((total_exec_time/sum(total_exec_time) OVER()) * 100, 'FM90D0') || '%'  AS prop_exec_time,
to_char(calls, 'FM999G999G999G990') AS ncalls,
interval '1 millisecond' * (shared_blk_read_time + shared_blk_write_time) AS sync_io_time,
CASE WHEN length(query) <= 40 THEN query ELSE substr(query, 0, 39) || '…' END AS query
FROM pg_stat_statements WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user LIMIT 1)
ORDER BY calls DESC
LIMIT 10`

      const actualQuery = await generateCallsQuery(mockDbConnection, {truncate: true})
      expect(actualQuery).to.equal(expectedQuery)
    })

    it('should generate exact expected SQL query for PostgreSQL 13+ without truncate', async function () {
      const mockDbConnection = createMockDbConnection('heroku-postgresql:premium-0')

      // Stub utility functions for this specific test
      sandbox.stub(util, 'ensurePGStatStatement').resolves()
      sandbox.stub(util, 'newTotalExecTimeField').resolves(true)
      sandbox.stub(util, 'newBlkTimeFields').resolves(true)

      const expectedQuery = `SELECT interval '1 millisecond' * total_exec_time AS total_exec_time,
to_char((total_exec_time/sum(total_exec_time) OVER()) * 100, 'FM90D0') || '%'  AS prop_exec_time,
to_char(calls, 'FM999G999G999G990') AS ncalls,
interval '1 millisecond' * (shared_blk_read_time + shared_blk_write_time) AS sync_io_time,
query AS query
FROM pg_stat_statements WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user LIMIT 1)
ORDER BY calls DESC
LIMIT 10`

      const actualQuery = await generateCallsQuery(mockDbConnection, {truncate: false})
      expect(actualQuery).to.equal(expectedQuery)
    })

    it('should generate exact expected SQL query for older PostgreSQL versions', async function () {
      const mockDbConnection = createMockDbConnection('heroku-postgresql:premium-0')

      // Mock older PostgreSQL version with fresh stubs
      sandbox.stub(util, 'ensurePGStatStatement').resolves()
      sandbox.stub(util, 'newTotalExecTimeField').resolves(false)
      sandbox.stub(util, 'newBlkTimeFields').resolves(false)

      const expectedQuery = `SELECT interval '1 millisecond' * total_time AS total_exec_time,
to_char((total_time/sum(total_time) OVER()) * 100, 'FM90D0') || '%'  AS prop_exec_time,
to_char(calls, 'FM999G999G999G990') AS ncalls,
interval '1 millisecond' * (blk_read_time + blk_write_time) AS sync_io_time,
CASE WHEN length(query) <= 40 THEN query ELSE substr(query, 0, 39) || '…' END AS query
FROM pg_stat_statements WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user LIMIT 1)
ORDER BY calls DESC
LIMIT 10`

      const actualQuery = await generateCallsQuery(mockDbConnection, {truncate: true})
      expect(actualQuery).to.equal(expectedQuery)
    })
  })

  describe('Business Logic', function () {
    it('should handle truncate flag correctly', async function () {
      const mockDbConnection = createMockDbConnection('heroku-postgresql:premium-0')

      // Stub utility functions for this test
      sandbox.stub(util, 'ensurePGStatStatement').resolves()
      sandbox.stub(util, 'newTotalExecTimeField').resolves(true)
      sandbox.stub(util, 'newBlkTimeFields').resolves(true)

      const truncatedQuery = await generateCallsQuery(mockDbConnection, {truncate: true})
      const fullQuery = await generateCallsQuery(mockDbConnection, {truncate: false})

      expect(truncatedQuery).to.contain('CASE WHEN length(query) <= 40')
      expect(fullQuery).to.contain('query AS query')
      expect(fullQuery).not.to.contain('CASE WHEN length(query)')
    })

    it('should adapt to different PostgreSQL versions', async function () {
      const mockDbConnection = createMockDbConnection('heroku-postgresql:premium-0')

      // Test with newer version fields using fresh stubs
      sandbox.stub(util, 'ensurePGStatStatement').resolves()
      sandbox.stub(util, 'newTotalExecTimeField').resolves(true)
      sandbox.stub(util, 'newBlkTimeFields').resolves(true)

      const query = await generateCallsQuery(mockDbConnection, {truncate: false})
      expect(query).to.contain('shared_blk_read_time')
    })
  })

  describe('Command Behavior', function () {
    it('displays database calls information', async function () {
      // Stub utility functions for this test
      sandbox.stub(util, 'ensurePGStatStatement').resolves()
      sandbox.stub(util, 'newTotalExecTimeField').resolves(true)
      sandbox.stub(util, 'newBlkTimeFields').resolves(true)

      await runCommand(PgCalls, ['--app', 'my-app'])

      expect(stdout.output).to.eq(heredoc`
        query | exec_time | prop_exec_time | ncalls | sync_io_time
        ------|-----------|----------------|--------|-------------
        SELECT * FROM users | 1.23 | 0.15 | 100 | 0.05
        UPDATE users SET... | 2.45 | 0.30 | 50 | 0.12
      `)
      expect(stderr.output).to.eq('')
    })

    it('handles truncate flag correctly', async function () {
      // Stub utility functions for this test
      sandbox.stub(util, 'ensurePGStatStatement').resolves()
      sandbox.stub(util, 'newTotalExecTimeField').resolves(true)
      sandbox.stub(util, 'newBlkTimeFields').resolves(true)

      await runCommand(PgCalls, ['--app', 'my-app', '--truncate'])

      expect(stdout.output).to.eq(heredoc`
        query | exec_time | prop_exec_time | ncalls | sync_io_time
        ------|-----------|----------------|--------|-------------
        SELECT * FROM users | 1.23 | 0.15 | 100 | 0.05
        UPDATE users SET... | 2.45 | 0.30 | 50 | 0.12
      `)
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      await testDatabaseConnectionFailure(PgCalls, ['--app', 'my-app'], databaseStub)
    })

    it('handles SQL execution failures gracefully', async function () {
      await testSQLExecutionFailure(PgCalls, ['--app', 'my-app'], execStub)
    })
  })
})
