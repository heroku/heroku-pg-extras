import {expect} from 'chai'
import sinon, {SinonSandbox, SinonStub} from 'sinon'
import {stderr, stdout} from 'stdout-stderr'
import heredoc from 'tsheredoc'

import PgTotalIndexSize, {generateTotalIndexSizeQuery} from '../../../src/commands/pg/total-index-size'
import {
  setupSimpleCommandMocks, testDatabaseConnectionFailure, testSQLExecutionFailure,
} from '../../helpers/mock-utils'
import {runCommand} from '../../run-command'

describe('pg:total-index-size', function () {
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

    // Override the exec stub to return specific total index size output
    const mockOutput = `
size
-----
15.2 MB
    `.trim()
    execStub.resolves(mockOutput)
  })

  afterEach(function () {
    process.env = env
    sandbox.restore()
  })

  describe('Full SQL Equality', function () {
    it('should generate exact expected SQL query', function () {
      const expectedQuery = `SELECT pg_size_pretty(sum(c.relpages::bigint*8192)::bigint) AS size
FROM pg_class c
LEFT JOIN pg_namespace n ON (n.oid = c.relnamespace)
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
AND n.nspname !~ '^pg_toast'
AND c.relkind='i';`

      const actualQuery = generateTotalIndexSizeQuery()
      expect(actualQuery).to.equal(expectedQuery)
    })
  })

  describe('Business Logic', function () {
    it('should exclude system schemas from index analysis', function () {
      const query = generateTotalIndexSizeQuery()
      expect(query).to.contain("n.nspname NOT IN ('pg_catalog', 'information_schema')")
      expect(query).to.contain("n.nspname !~ '^pg_toast'")
    })

    it('should only include indexes', function () {
      const query = generateTotalIndexSizeQuery()
      expect(query).to.contain("c.relkind='i'")
    })

    it('should calculate total index size correctly', function () {
      const query = generateTotalIndexSizeQuery()
      expect(query).to.contain('sum(c.relpages::bigint*8192)')
      expect(query).to.contain('pg_size_pretty')
    })
  })

  describe('Command Behavior', function () {
    it('displays total index size information', async function () {
      await runCommand(PgTotalIndexSize, ['--app', 'my-app'])
      expect(stdout.output).to.eq(heredoc`
        size
        -----
        15.2 MB
      `)
      expect(stderr.output).to.eq('')
    })
  })

  describe('Error Handling', function () {
    it('handles database connection failures gracefully', async function () {
      await testDatabaseConnectionFailure(PgTotalIndexSize, ['--app', 'my-app'], databaseStub)
    })

    it('handles SQL execution failures gracefully', async function () {
      await testSQLExecutionFailure(PgTotalIndexSize, ['--app', 'my-app'], execStub)
    })
  })
})
