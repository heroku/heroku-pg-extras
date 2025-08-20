import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgRecordsRank, {generateRecordsRankQuery} from '../../../src/commands/pg/records-rank'
import {
  setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure,
} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:records-rank', function () {
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

    // Override the exec stub to return specific records rank output
    const mockOutput = `
name | estimated_count
-----|----------------
users | 10000
posts | 5000
comments | 25000
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
  relname AS name,
  n_live_tup AS estimated_count
FROM
  pg_stat_user_tables
ORDER BY
  n_live_tup DESC;`

      const actualQuery = generateRecordsRankQuery()
      expect(actualQuery).to.equal(expectedQuery)
    })
  })

  describe('Business Logic', function () {
    it('should order by estimated count descending', function () {
      const query = generateRecordsRankQuery()
      expect(query).to.contain('ORDER BY')
      expect(query).to.contain('n_live_tup DESC')
    })

    it('should select table name and estimated count', function () {
      const query = generateRecordsRankQuery()
      expect(query).to.contain('relname AS name')
      expect(query).to.contain('n_live_tup AS estimated_count')
    })
  })

  describe('Command Behavior', function () {
    it('displays records rank information', async function () {
      await runCommand(PgRecordsRank, ['--app', 'my-app'])
      expect(stdout.output).to.eq(heredoc`
        name | estimated_count
        -----|----------------
        users | 10000
        posts | 5000
        comments | 25000
      `)
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      await testDatabaseConnectionFailure(PgRecordsRank, ['--app', 'my-app'], databaseStub)
    })

    it('handles SQL execution failures gracefully', async function () {
      await testSQLExecutionFailure(PgRecordsRank, ['--app', 'my-app'], execStub)
    })
  })
})
