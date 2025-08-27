import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgIndexUsage, {generateIndexUsageQuery} from '../../../src/commands/pg/index-usage'
import {setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:index-usage', function () {
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

    // Override the exec stub to return specific index usage output
    const mockOutput = `
relname | percent_of_times_index_used | rows_in_table
---------|------------------------------|---------------
users    | 95                          | 10000
posts    | 87                          | 5000
comments | 92                          | 25000
`.trim()
    execStub.resolves(mockOutput)
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  describe('Full SQL Equality', function () {
    it('should generate exact expected SQL query', function () {
      const expectedQuery = `SELECT relname,
   CASE idx_scan
     WHEN 0 THEN 'Insufficient data'
     ELSE (100 * idx_scan / (seq_scan + idx_scan))::text
   END percent_of_times_index_used,
   n_live_tup rows_in_table
 FROM
   pg_stat_user_tables
 ORDER BY
   n_live_tup DESC;`

      const actualQuery = generateIndexUsageQuery()
      expect(actualQuery).to.equal(expectedQuery)
    })
  })

  describe('Business Logic', function () {
    it('should calculate index usage percentage correctly', function () {
      const query = generateIndexUsageQuery()

      // Should use proper percentage calculation
      expect(query).to.contain('100 * idx_scan / (seq_scan + idx_scan)')
      expect(query).to.contain('CASE idx_scan')
      expect(query).to.contain('Insufficient data')
    })

    it('should order by table size', function () {
      const query = generateIndexUsageQuery()

      // Should order by number of live tuples
      expect(query).to.contain('ORDER BY')
      expect(query).to.contain('n_live_tup DESC')
    })
  })

  describe('Command Behavior', function () {
    it('displays index usage statistics', async function () {
      await runCommand(PgIndexUsage, ['--app', 'my-app'])

      expect(stdout.output).to.eq(heredoc`
        relname | percent_of_times_index_used | rows_in_table
        ---------|------------------------------|---------------
        users    | 95                          | 10000
        posts    | 87                          | 5000
        comments | 92                          | 25000
      `)
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      await testDatabaseConnectionFailure(PgIndexUsage, ['--app', 'my-app'], databaseStub)
    })

    it('handles SQL execution failures gracefully', async function () {
      await testSQLExecutionFailure(PgIndexUsage, ['--app', 'my-app'], execStub)
    })
  })
})
