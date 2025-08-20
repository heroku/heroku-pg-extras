import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'

import PgUnusedIndexes, {generateUnusedIndexesQuery} from '../../../src/commands/pg/unused-indexes'
import {setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:unused-indexes', function () {
  let sandbox: SinonSandbox
  let databaseStub: SinonStub
  let execStub: SinonStub
  const {env} = process

  beforeEach(function () {
    process.env = {}
    sandbox = sinon.createSandbox()

    const mocks = setupSimpleCommandMocks(sandbox)
    databaseStub = mocks.database
    execStub = mocks.exec

    const mockOutput = `table | index | index_size | index_scans
------|-------|------------|-------------
public.users | idx_users_email | 2.1 MB | 12
public.posts | idx_posts_created | 1.5 MB | 8`
    execStub.resolves(mockOutput)
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  describe('Full SQL Equality', function () {
    it('should generate exact expected SQL query', function () {
      const expectedQuery = `SELECT
  schemaname || '.' || relname AS table,
  indexrelname AS index,
  pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
  idx_scan as index_scans
FROM pg_stat_user_indexes ui
JOIN pg_index i ON ui.indexrelid = i.indexrelid
WHERE NOT indisunique AND idx_scan < 50 AND pg_relation_size(relid) > 5 * 8192
ORDER BY pg_relation_size(i.indexrelid) / nullif(idx_scan, 0) DESC NULLS FIRST,
pg_relation_size(i.indexrelid) DESC;`

      const actualQuery = generateUnusedIndexesQuery()
      expect(actualQuery).to.equal(expectedQuery)
    })
  })

  describe('Business Logic', function () {
    it('should find indexes with low scan counts', function () {
      const query = generateUnusedIndexesQuery()
      expect(query).to.contain('idx_scan < 50')
    })

    it('should exclude unique indexes', function () {
      const query = generateUnusedIndexesQuery()
      expect(query).to.contain('NOT indisunique')
    })

    it('should filter by minimum table size', function () {
      const query = generateUnusedIndexesQuery()
      expect(query).to.contain('pg_relation_size(relid) > 5 * 8192')
    })

    it('should order by efficiency ratio', function () {
      const query = generateUnusedIndexesQuery()
      expect(query).to.contain('ORDER BY pg_relation_size(i.indexrelid) / nullif(idx_scan, 0) DESC NULLS FIRST')
    })
  })

  describe('Command Behavior', function () {
    it('shows unused indexes information', async function () {
      await runCommand(PgUnusedIndexes, ['--app', 'my-app'])
      expect(stdout.output).to.contain('table | index | index_size | index_scans')
      expect(stdout.output).to.contain('public.users | idx_users_email | 2.1 MB | 12')
      expect(stderr.output).to.eq('')
    })

    it('shows empty result when no unused indexes are found', async function () {
      execStub.resolves('')
      await runCommand(PgUnusedIndexes, ['--app', 'my-app'])
      expect(stdout.output).to.eq('\n')
      expect(stderr.output).to.eq('')
    })

    it('executes query against specified database', async function () {
      execStub.resolves('custom_table | custom_index | 3.0 MB | 5')
      await runCommand(PgUnusedIndexes, ['--app', 'my-app', 'custom-db'])
      expect(stdout.output).to.contain('custom_table | custom_index | 3.0 MB | 5')
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      await testDatabaseConnectionFailure(PgUnusedIndexes, ['--app', 'my-app'], databaseStub)
    })

    it('handles SQL execution failures gracefully', async function () {
      await testSQLExecutionFailure(PgUnusedIndexes, ['--app', 'my-app'], execStub)
    })
  })
})
