import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgTableIndexesSize, {generateTableIndexesSizeQuery} from '../../../src/commands/pg/table-indexes-size'
import {
  setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure,
} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:table-indexes-size', function () {
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

    // Override the exec stub to return specific table indexes size output
    const mockOutput = `
table | index_size
------|------------
users | 2.1 MB
posts | 1.8 MB
comments | 1.2 MB
    `.trim()
    execStub.resolves(mockOutput)
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  describe('Full SQL Equality', function () {
    it('should generate exact expected SQL query', function () {
      const expectedQuery = `SELECT c.relname AS table,
  pg_size_pretty(pg_indexes_size(c.oid)) AS index_size
FROM pg_class c
LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
AND n.nspname !~ '^pg_toast'
AND c.relkind='r'
ORDER BY pg_indexes_size(c.oid) DESC;`

      const actualQuery = generateTableIndexesSizeQuery()
      expect(actualQuery).to.equal(expectedQuery)
    })
  })

  describe('Business Logic', function () {
    it('should exclude system schemas from table analysis', function () {
      const query = generateTableIndexesSizeQuery()
      expect(query).to.contain("n.nspname NOT IN ('pg_catalog', 'information_schema')")
      expect(query).to.contain("n.nspname !~ '^pg_toast'")
    })

    it('should only include tables', function () {
      const query = generateTableIndexesSizeQuery()
      expect(query).to.contain("c.relkind='r'")
    })

    it('should calculate index sizes correctly', function () {
      const query = generateTableIndexesSizeQuery()
      expect(query).to.contain('pg_indexes_size(c.oid)')
      expect(query).to.contain('pg_size_pretty')
    })

    it('should order by index size descending', function () {
      const query = generateTableIndexesSizeQuery()
      expect(query).to.contain('ORDER BY')
      expect(query).to.contain('pg_indexes_size(c.oid) DESC')
    })
  })

  describe('Command Behavior', function () {
    it('displays table index size information', async function () {
      await runCommand(PgTableIndexesSize, ['--app', 'my-app'])
      expect(stdout.output).to.eq(heredoc`
        table | index_size
        ------|------------
        users | 2.1 MB
        posts | 1.8 MB
        comments | 1.2 MB
      `)
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      await testDatabaseConnectionFailure(PgTableIndexesSize, ['--app', 'my-app'], databaseStub)
    })

    it('handles SQL execution failures gracefully', async function () {
      await testSQLExecutionFailure(PgTableIndexesSize, ['--app', 'my-app'], execStub)
    })
  })
})
