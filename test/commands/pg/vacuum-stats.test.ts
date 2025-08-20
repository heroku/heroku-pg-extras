import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'

import PgVacuumStats, {generateVacuumStatsQuery} from '../../../src/commands/pg/vacuum-stats'
import {setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:vacuum-stats', function () {
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

    const mockOutput = `schema | table | last_vacuum | last_autovacuum | rowcount | dead_rowcount | autovacuum_threshold | expect_autovacuum
-------|-------|-------------|-----------------|----------|---------------|---------------------|------------------
public | users | 2024-01-15 10:30 | 2024-01-16 14:20 | 1,000 | 50 | 1,100 | yes
public | posts | 2024-01-14 09:15 | 2024-01-15 16:45 | 5,000 | 200 | 5,500 | `
    execStub.resolves(mockOutput)
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  describe('Full SQL Equality', function () {
    it('should generate exact expected SQL query', function () {
      const expectedQuery = `WITH table_opts AS (
  SELECT
    pg_class.oid, relname, nspname, array_to_string(reloptions, '') AS relopts
  FROM
     pg_class INNER JOIN pg_namespace ns ON relnamespace = ns.oid
), vacuum_settings AS (
  SELECT
    oid, relname, nspname,
    CASE
      WHEN relopts LIKE '%autovacuum_vacuum_threshold%'
        THEN substring(relopts, '.*autovacuum_vacuum_threshold=([0-9.]+).*')::integer
        ELSE current_setting('autovacuum_vacuum_threshold')::integer
      END AS autovacuum_vacuum_threshold,
    CASE
      WHEN relopts LIKE '%autovacuum_vacuum_scale_factor%'
        THEN substring(relopts, '.*autovacuum_vacuum_scale_factor=([0-9.]+).*')::real
        ELSE current_setting('autovacuum_vacuum_scale_factor')::real
      END AS autovacuum_vacuum_scale_factor
  FROM
    table_opts
)
SELECT
  vacuum_settings.nspname AS schema,
  vacuum_settings.relname AS table,
  to_char(psut.last_vacuum, 'YYYY-MM-DD HH24:MI') AS last_vacuum,
  to_char(psut.last_autovacuum, 'YYYY-MM-DD HH24:MI') AS last_autovacuum,
  to_char(pg_class.reltuples, '9G999G999G999') AS rowcount,
  to_char(psut.n_dead_tup, '9G999G999G999') AS dead_rowcount,
  to_char(autovacuum_vacuum_threshold
       + (autovacuum_vacuum_scale_factor::numeric * pg_class.reltuples), '9G999G999G999') AS autovacuum_threshold,
  CASE
    WHEN autovacuum_vacuum_threshold + (autovacuum_vacuum_scale_factor::numeric * pg_class.reltuples) < psut.n_dead_tup
    THEN 'yes'
  END AS expect_autovacuum
FROM
  pg_stat_user_tables psut INNER JOIN pg_class ON psut.relid = pg_class.oid
    INNER JOIN vacuum_settings ON pg_class.oid = vacuum_settings.oid
ORDER BY 1`

      const actualQuery = generateVacuumStatsQuery()
      expect(actualQuery).to.equal(expectedQuery)
    })
  })

  describe('Business Logic', function () {
    it('should use CTEs for complex vacuum calculations', function () {
      const query = generateVacuumStatsQuery()
      expect(query).to.contain('WITH table_opts AS')
      expect(query).to.contain('vacuum_settings AS')
    })

    it('should handle autovacuum configuration overrides', function () {
      const query = generateVacuumStatsQuery()
      expect(query).to.contain('WHEN relopts LIKE \'%autovacuum_vacuum_threshold%\'')
      expect(query).to.contain('WHEN relopts LIKE \'%autovacuum_vacuum_scale_factor%\'')
    })

    it('should calculate autovacuum thresholds', function () {
      const query = generateVacuumStatsQuery()
      expect(query).to.contain('autovacuum_vacuum_threshold + (autovacuum_vacuum_scale_factor::numeric * pg_class.reltuples)')
    })

    it('should determine if autovacuum is expected', function () {
      const query = generateVacuumStatsQuery()
      expect(query).to.contain('WHEN autovacuum_vacuum_threshold + (autovacuum_vacuum_scale_factor::numeric * pg_class.reltuples) < psut.n_dead_tup')
      expect(query).to.contain('THEN \'yes\'')
    })
  })

  describe('Command Behavior', function () {
    it('shows vacuum statistics information', async function () {
      await runCommand(PgVacuumStats, ['--app', 'my-app'])
      expect(stdout.output).to.contain('schema | table | last_vacuum | last_autovacuum | rowcount | dead_rowcount | autovacuum_threshold | expect_autovacuum')
      expect(stdout.output).to.contain('public | users | 2024-01-15 10:30 | 2024-01-16 14:20 | 1,000 | 50 | 1,100 | yes')
      expect(stderr.output).to.eq('')
    })

    it('shows empty result when no vacuum stats are found', async function () {
      execStub.resolves('')
      await runCommand(PgVacuumStats, ['--app', 'my-app'])
      expect(stdout.output).to.eq('\n')
      expect(stderr.output).to.eq('')
    })

    it('executes query against specified database', async function () {
      execStub.resolves('custom_table | 2024-01-17 12:00 | 2024-01-17 12:00 | 100 | 5 | 110 | ')
      await runCommand(PgVacuumStats, ['--app', 'my-app', 'custom-db'])
      expect(stdout.output).to.contain('custom_table | 2024-01-17 12:00 | 2024-01-17 12:00 | 100 | 5 | 110 | ')
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      await testDatabaseConnectionFailure(PgVacuumStats, ['--app', 'my-app'], databaseStub)
    })

    it('handles SQL execution failures gracefully', async function () {
      await testSQLExecutionFailure(PgVacuumStats, ['--app', 'my-app'], execStub)
    })
  })
})
