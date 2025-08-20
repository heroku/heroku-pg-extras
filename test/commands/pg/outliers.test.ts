import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgOutliers, {generateOutliersQuery} from '../../../src/commands/pg/outliers'
import * as util from '../../../src/lib/util'
import {
  createMockDbConnection, setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure,
} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:outliers', function () {
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

    // Override the exec stub to return specific outliers output
    const mockOutput = `
total_exec_time | prop_exec_time | ncalls | sync_io_time | query
----------------|----------------|---------|--------------|-------
00:01:30.123   | 25.5%          | 1,234  | 00:00:15.456 | SELECT * FROM large_table WHERE complex_condition
00:00:45.789   | 15.2%          | 567    | 00:00:08.123 | UPDATE users SET status = 'processing' WHERE id > 1000
00:00:30.456   | 10.1%          | 890    | 00:00:05.789 | DELETE FROM logs WHERE created_at < '2023-01-01'
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
CASE WHEN length(query) <= 40 THEN query ELSE substr(query, 0, 39) || '...' END AS query
FROM pg_stat_statements WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user LIMIT 1)
ORDER BY total_exec_time DESC
LIMIT 10`

      const actualQuery = await generateOutliersQuery(mockDbConnection, {truncate: true})
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
ORDER BY total_exec_time DESC
LIMIT 10`

      const actualQuery = await generateOutliersQuery(mockDbConnection, {})
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
query AS query
FROM pg_stat_statements WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user LIMIT 1)
ORDER BY total_time DESC
LIMIT 10`

      const actualQuery = await generateOutliersQuery(mockDbConnection, {})
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

      const truncatedQuery = await generateOutliersQuery(mockDbConnection, {truncate: true})
      const fullQuery = await generateOutliersQuery(mockDbConnection, {})

      expect(truncatedQuery).to.contain('CASE WHEN length(query) <= 40')
      expect(fullQuery).to.contain('query AS query')
      expect(fullQuery).not.to.contain('CASE WHEN length')
    })

    it('should handle custom limit correctly', async function () {
      const mockDbConnection = createMockDbConnection('heroku-postgresql:premium-0')

      // Stub utility functions for this test
      sandbox.stub(util, 'ensurePGStatStatement').resolves()
      sandbox.stub(util, 'newTotalExecTimeField').resolves(true)
      sandbox.stub(util, 'newBlkTimeFields').resolves(true)

      const query = await generateOutliersQuery(mockDbConnection, {num: 25})
      expect(query).to.contain('LIMIT 25')
    })

    it('should use default limit when not specified', async function () {
      const mockDbConnection = createMockDbConnection('heroku-postgresql:premium-0')

      // Stub utility functions for this test
      sandbox.stub(util, 'ensurePGStatStatement').resolves()
      sandbox.stub(util, 'newTotalExecTimeField').resolves(true)
      sandbox.stub(util, 'newBlkTimeFields').resolves(true)

      const query = await generateOutliersQuery(mockDbConnection, {})
      expect(query).to.contain('LIMIT 10')
    })

    it('should throw error for invalid num parameter', async function () {
      const mockDbConnection = createMockDbConnection('heroku-postgresql:premium-0')

      // Stub utility functions for this test
      sandbox.stub(util, 'ensurePGStatStatement').resolves()
      sandbox.stub(util, 'newTotalExecTimeField').resolves(true)
      sandbox.stub(util, 'newBlkTimeFields').resolves(true)

      try {
        await generateOutliersQuery(mockDbConnection, {num: 0})
        expect.fail('Should have thrown an error')
      } catch (error: unknown) {
        const err = error as Error
        expect(err.message).to.include('Cannot parse num param value "0" to a positive number')
      }
    })
  })

  describe('Command Behavior', function () {
    it('displays outliers information', async function () {
      // Stub utility functions for this test
      sandbox.stub(util, 'ensurePGStatStatement').resolves()
      sandbox.stub(util, 'newTotalExecTimeField').resolves(true)
      sandbox.stub(util, 'newBlkTimeFields').resolves(true)

      await runCommand(PgOutliers, ['--app', 'my-app'])

      expect(stdout.output).to.eq(heredoc`
        total_exec_time | prop_exec_time | ncalls | sync_io_time | query
        ----------------|----------------|---------|--------------|-------
        00:01:30.123   | 25.5%          | 1,234  | 00:00:15.456 | SELECT * FROM large_table WHERE complex_condition
        00:00:45.789   | 15.2%          | 567    | 00:00:08.123 | UPDATE users SET status = 'processing' WHERE id > 1000
        00:00:30.456   | 10.1%          | 890    | 00:00:05.789 | DELETE FROM logs WHERE created_at < '2023-01-01'
      `)
      expect(stderr.output).to.eq('')
    })

    it('handles truncate flag correctly', async function () {
      // Stub utility functions for this test
      sandbox.stub(util, 'ensurePGStatStatement').resolves()
      sandbox.stub(util, 'newTotalExecTimeField').resolves(true)
      sandbox.stub(util, 'newBlkTimeFields').resolves(true)

      await runCommand(PgOutliers, ['--app', 'my-app', '--truncate'])
      expect(stdout.output).to.include('total_exec_time')
      expect(stderr.output).to.eq('')
    })

    it('handles custom limit correctly', async function () {
      // Stub utility functions for this test
      sandbox.stub(util, 'ensurePGStatStatement').resolves()
      sandbox.stub(util, 'newTotalExecTimeField').resolves(true)
      sandbox.stub(util, 'newBlkTimeFields').resolves(true)

      await runCommand(PgOutliers, ['--app', 'my-app', '--num', '5'])
      expect(stdout.output).to.include('total_exec_time')
      expect(stderr.output).to.eq('')
    })

    it('resets statistics when reset flag is specified', async function () {
      await runCommand(PgOutliers, ['--app', 'my-app', '--reset'])
      // The reset command executes pg_stat_statements_reset() but doesn't log output
      expect(stdout.output).to.eq('')
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      await testDatabaseConnectionFailure(PgOutliers, ['--app', 'my-app'], databaseStub)
    })

    it('handles SQL execution failures gracefully', async function () {
      await testSQLExecutionFailure(PgOutliers, ['--app', 'my-app'], execStub)
    })
  })
})
