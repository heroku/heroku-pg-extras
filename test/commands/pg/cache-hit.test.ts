import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgCacheHit, {generateCacheHitQuery} from '../../../src/commands/pg/cache-hit'
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
name            | ratio
----------------|-------
index hit rate  | 0.95
table hit rate  | 0.87
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
  'index hit rate' AS name,
  (sum(idx_blks_hit)) / nullif(sum(idx_blks_hit + idx_blks_read),0) AS ratio
FROM pg_statio_user_indexes
UNION ALL
SELECT
 'table hit rate' AS name,
  sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read),0) AS ratio
FROM pg_statio_user_tables;`

      const actualQuery = generateCacheHitQuery()
      expect(actualQuery).to.equal(expectedQuery)
    })
  })

  describe('Business Logic', function () {
    it('should calculate hit rates with proper null handling', function () {
      const query = generateCacheHitQuery()
      // This validates the core business logic of safe division
      expect(query).to.contain('nullif(')
      expect(query).to.contain('sum(idx_blks_hit + idx_blks_read)')
      expect(query).to.contain('sum(heap_blks_hit) + sum(heap_blks_read)')
    })
  })

  describe('Command Behavior', function () {
    it('displays cache hit rate information', async function () {
      await runCommand(PgCacheHit, ['--app', 'my-app'])

      expect(stdout.output).to.eq(heredoc`
        name            | ratio
        ----------------|-------
        index hit rate  | 0.95
        table hit rate  | 0.87
      `)
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      await testDatabaseConnectionFailure(PgCacheHit, ['--app', 'my-app'], databaseStub)
    })

    it('handles SQL execution failures gracefully', async function () {
      await testSQLExecutionFailure(PgCacheHit, ['--app', 'my-app'], execStub)
    })
  })
})
