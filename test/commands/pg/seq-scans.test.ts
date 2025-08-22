import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgSeqScans, {generateSeqScansQuery} from '../../../src/commands/pg/seq-scans'
import {
  setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure,
} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:seq-scans', function () {
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

    // Override the exec stub to return specific seq scans output
    const mockOutput = `
name | count
-----|-------
users | 150
posts | 75
comments | 25
    `.trim()
    execStub.resolves(mockOutput)
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  describe('Full SQL Equality', function () {
    it('should generate exact expected SQL query', function () {
      const expectedQuery = `SELECT relname AS name,
       seq_scan as count
FROM
  pg_stat_user_tables
ORDER BY seq_scan DESC;`

      const actualQuery = generateSeqScansQuery()
      expect(actualQuery).to.equal(expectedQuery)
    })
  })

  describe('Business Logic', function () {
    it('should order by sequential scan count descending', function () {
      const query = generateSeqScansQuery()
      expect(query).to.contain('ORDER BY')
      expect(query).to.contain('seq_scan DESC')
    })

    it('should select table name and scan count', function () {
      const query = generateSeqScansQuery()
      expect(query).to.contain('relname AS name')
      expect(query).to.contain('seq_scan as count')
    })
  })

  describe('Command Behavior', function () {
    it('displays sequential scans information', async function () {
      await runCommand(PgSeqScans, ['--app', 'my-app'])
      expect(stdout.output).to.eq(heredoc`
        name | count
        -----|-------
        users | 150
        posts | 75
        comments | 25
      `)
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      await testDatabaseConnectionFailure(PgSeqScans, ['--app', 'my-app'], databaseStub)
    })

    it('handles SQL execution failures gracefully', async function () {
      await testSQLExecutionFailure(PgSeqScans, ['--app', 'my-app'], execStub)
    })
  })
})
