import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'

import PgFdwsql, {generateFdwsqlQuery} from '../../../src/commands/pg/fdwsql'
import {setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:fdwsql', function () {
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

    // Override the exec stub to return specific fdwsql output
    const mockOutput = `
CREATE FOREIGN TABLE test_prefix_table1(col1 int, col2 text) SERVER test_prefix_db OPTIONS (schema_name 'public', table_name 'table1');
CREATE FOREIGN TABLE test_prefix_table2(col3 varchar) SERVER test_prefix_db OPTIONS (schema_name 'public', table_name 'table2');
`.trim()
    execStub.resolves(mockOutput)
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  describe('Full SQL Equality', function () {
    it('should generate exact expected SQL query', function () {
      const prefix = 'test_prefix'
      const expectedQuery = `SELECT
  'CREATE FOREIGN TABLE '
  || quote_ident('${prefix}_' || c.relname)
  || '(' || array_to_string(array_agg(quote_ident(a.attname) || ' ' || t.typname), ', ') || ') '
  || ' SERVER ${prefix}_db OPTIONS'
  || ' (schema_name ''' || quote_ident(n.nspname) || ''', table_name ''' || quote_ident(c.relname) || ''');'
FROM
  pg_class     c,
  pg_attribute a,
  pg_type      t,
  pg_namespace n
WHERE
  a.attnum > 0
  AND a.attrelid = c.oid
  AND a.atttypid = t.oid
  AND n.oid = c.relnamespace
  AND c.relkind in ('r', 'v')
  AND n.nspname <> 'pg_catalog'
  AND n.nspname <> 'information_schema'
  AND n.nspname !~ '^pg_toast'
  AND pg_catalog.pg_table_is_visible(c.oid)
GROUP BY c.relname, n.nspname
ORDER BY c.relname;`

      const actualQuery = generateFdwsqlQuery(prefix)
      expect(actualQuery).to.equal(expectedQuery)
    })
  })

  describe('Business Logic', function () {
    it('should exclude system schemas from foreign table generation', function () {
      const query = generateFdwsqlQuery('test_prefix')

      // Should exclude pg_catalog and information_schema
      expect(query).to.contain("n.nspname <> 'pg_catalog'")
      expect(query).to.contain("n.nspname <> 'information_schema'")
      expect(query).to.contain("n.nspname !~ '^pg_toast'")
    })

    it('should only include tables and views', function () {
      const query = generateFdwsqlQuery('test_prefix')

      // Should only include relations and views
      expect(query).to.contain("c.relkind in ('r', 'v')")
    })
  })

  describe('Command Behavior', function () {
    it('displays foreign data wrapper SQL output', async function () {
      await runCommand(PgFdwsql, ['--app', 'my-app', 'test_prefix'])

      expect(stdout.output).to.include('CREATE EXTENSION IF NOT EXISTS postgres_fdw;')
      expect(stdout.output).to.include('DROP SERVER IF EXISTS test_prefix_db;')
      expect(stdout.output).to.include('CREATE SERVER test_prefix_db')
      expect(stdout.output).to.include('CREATE USER MAPPING FOR CURRENT_USER')
      expect(stdout.output).to.include('CREATE FOREIGN TABLE test_prefix_table1')
      expect(stderr.output).to.eq('')
    })

    it('handles empty foreign table results gracefully', async function () {
      // Mock empty results
      execStub.resolves('')

      await runCommand(PgFdwsql, ['--app', 'my-app', 'test_prefix'])

      // Should still show setup SQL even with no tables
      expect(stdout.output).to.include('CREATE EXTENSION IF NOT EXISTS postgres_fdw;')
      expect(stdout.output).to.include('DROP SERVER IF EXISTS test_prefix_db;')
      expect(stdout.output).to.include('CREATE SERVER test_prefix_db')
      expect(stdout.output).to.include('CREATE USER MAPPING FOR CURRENT_USER')
      expect(stderr.output).to.eq('')
    })

    it('executes query against specified database', async function () {
      await runCommand(PgFdwsql, ['--app', 'my-app', 'test_prefix', 'custom-db'])

      expect(stdout.output).to.include('CREATE EXTENSION IF NOT EXISTS postgres_fdw;')
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      await testDatabaseConnectionFailure(PgFdwsql, ['--app', 'my-app', 'test_prefix'], databaseStub)
    })

    it('handles SQL execution failures gracefully', async function () {
      await testSQLExecutionFailure(PgFdwsql, ['--app', 'my-app', 'test_prefix'], execStub)
    })
  })
})
