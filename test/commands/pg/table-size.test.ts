import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgTableSize, {generateTableSizeQuery} from '../../../src/commands/pg/table-size'
import {setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:table-size', function () {
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

    // Override the exec stub to return specific table size output
    const mockOutput = `
name | size
-----|-----
users | 50 MB
posts | 25 MB
comments | 10 MB
    `.trim()
    execStub.resolves(mockOutput)
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  describe('Full SQL Equality', function () {
    it('should generate exact expected SQL query', function () {
      const expectedQuery = `SELECT c.relname AS name,
  pg_size_pretty(pg_table_size(c.oid)) AS size
FROM pg_class c
LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
AND n.nspname !~ '^pg_toast'
AND c.relkind='r'
ORDER BY pg_table_size(c.oid) DESC;`

      const actualQuery = generateTableSizeQuery()
      expect(actualQuery).to.equal(expectedQuery)
    })
  })

  describe('Business Logic', function () {
    it('should exclude system schemas from table analysis', function () {
      const query = generateTableSizeQuery()
      expect(query).to.contain("n.nspname NOT IN ('pg_catalog', 'information_schema')")
      expect(query).to.contain("n.nspname !~ '^pg_toast'")
    })

    it('should only include tables', function () {
      const query = generateTableSizeQuery()
      expect(query).to.contain("c.relkind='r'")
    })

    it('should calculate table sizes correctly', function () {
      const query = generateTableSizeQuery()
      expect(query).to.contain('pg_size_pretty(pg_table_size(c.oid))')
    })

    it('should order by table size descending', function () {
      const query = generateTableSizeQuery()
      expect(query).to.contain('ORDER BY pg_table_size(c.oid) DESC')
    })
  })

  describe('Command Behavior', function () {
    it('shows table size information', async function () {
      await runCommand(PgTableSize, ['--app', 'my-app'])
      expect(stdout.output).to.eq(heredoc`
        name | size
        -----|-----
        users | 50 MB
        posts | 25 MB
        comments | 10 MB
      `)
      expect(stderr.output).to.eq('')
    })

    it('shows empty result when no tables are found', async function () {
      execStub.resolves('')
      await runCommand(PgTableSize, ['--app', 'my-app'])
      expect(stdout.output).to.eq('\n')
      expect(stderr.output).to.eq('')
    })

    it('executes query against specified database', async function () {
      execStub.resolves('custom_table | 100 MB')
      await runCommand(PgTableSize, ['--app', 'my-app', 'custom-db'])
      expect(stdout.output).to.contain('custom_table | 100 MB')
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      await testDatabaseConnectionFailure(PgTableSize, ['--app', 'my-app'], databaseStub)
    })

    it('handles SQL execution failures gracefully', async function () {
      await testSQLExecutionFailure(PgTableSize, ['--app', 'my-app'], execStub)
    })
  })
})
